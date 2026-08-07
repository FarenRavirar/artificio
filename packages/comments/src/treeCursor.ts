import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

/**
 * T2.3 — cursor da leitura em árvore (requisito 6; decisões 3, 8).
 *
 * ## Por que o cursor é assinado e não um offset
 *
 * `plan.md` §Árvore, voto e ranking: "cursor stateless assinado fixa assunto,
 * sort, revisão, ramo, sort-key, limite e expiração de 30 minutos". Stateless é
 * a parte que decide o desenho — **não existe tabela de cursor**, o estado
 * inteiro viaja no próprio token. Isso é o que dispensa transação PostgreSQL
 * aberta entre requests, cache de paginação e cron (T2.3).
 *
 * Sem assinatura, um cursor stateless é payload do cliente: trocar
 * `snapshot_revision` ou `subject_id` no texto daria leitura de outro assunto
 * ou de outra revisão. Por isso o conteúdo é público (base64url, legível) mas
 * **não forjável** — HMAC-SHA256 sobre a carga serializada.
 *
 * ## O que o cursor NÃO protege
 *
 * Não é credencial nem prova de autorização. `realm`/`source_app` continuam
 * vindo da credencial de serviço a cada request (`contrato-http-v1.md` §2), e o
 * chamador precisa ter escopo `comment.read` de todo jeito. Um cursor válido de
 * um assunto que o chamador não pode ler continua sendo recusado pelo guard —
 * o cursor só garante que a *posição* não foi adulterada.
 *
 * ## Expiração
 *
 * 30 minutos, contados na emissão. O prazo existe porque a posição é congelada
 * numa `snapshot_revision`: quanto mais velho o cursor, mais a revisão fixada
 * diverge do estado atual. Expirado falha explicitamente — `contrato-http-v1.md`
 * §2 manda `400`/`invalid_cursor` —, nunca devolve posição aproximada, que é o
 * caminho para duplicar ou perder item sem ninguém notar.
 */

/** `contrato-http-v1.md` §2 — os quatro sorts; `best` é o padrão. */
export const COMMENT_SORTS = ['best', 'top', 'new', 'old'] as const;
export type CommentSort = (typeof COMMENT_SORTS)[number];

/** T2.3 — validade do cursor, em milissegundos. */
export const CURSOR_TTL_MS = 30 * 60 * 1000;

/**
 * Versão do formato. Vai assinada junto: se o formato mudar, cursor antigo
 * falha a verificação em vez de ser reinterpretado com o significado errado.
 */
const CURSOR_VERSION = 1;

/**
 * Chave mínima de 32 bytes, mesmo piso dos demais segredos do `accounts.`
 * (`JWT_SECRET`, `JWT_REFRESH_SECRET`, `ACCOUNTS_SECRETS_KEY` em
 * `apps/accounts/src/env.ts`).
 */
export const CURSOR_SECRET_MIN_LENGTH = 32;

/**
 * Carga do cursor. Os campos são exatamente os que `spec.md` 8d e
 * `contrato-http-v1.md` §2 mandam fixar — nem mais (cada campo a mais é
 * superfície de adulteração), nem menos.
 */
export const treeCursorPayloadSchema = z.object({
  /** Versão do formato; a assinatura cobre este campo. */
  v: z.literal(CURSOR_VERSION),
  /** Assunto: cursor de outra consulta precisa ser detectável. */
  subject_type: z.string().min(1).max(64),
  subject_id: z.string().min(1).max(255),
  /** Ordenação fixada na primeira leitura; trocar o sort invalida a posição. */
  sort: z.enum(COMMENT_SORTS),
  /** Revisão congelada. Toda expansão `more` navega dentro dela. */
  snapshot_revision: z.number().int().nonnegative(),
  /**
   * Ramo que este cursor expande. `null` = continuação da raiz.
   * É o que faz `more` ser por ramo e nunca produzir filho órfão.
   */
  branch_id: z.string().uuid().nullable(),
  /**
   * Última chave de ordenação emitida naquele ramo, para retomar depois dela.
   * Formato depende do sort; opaco para quem lê o cursor.
   */
  after: z.string().min(1).max(255),
  /** Limite daquela navegação, fixado na emissão. */
  limit: z.number().int().positive().max(1000),
  /** Instante de expiração, em epoch ms. */
  exp: z.number().int().positive(),
});

export type TreeCursorPayload = z.infer<typeof treeCursorPayloadSchema>;

/** Motivo da recusa. O handler colapsa todos em `400`/`invalid_cursor`. */
export type CursorRejectionReason =
  | 'malformed'
  | 'bad_signature'
  | 'expired'
  | 'other_query';

export type TreeCursorVerification =
  | { ok: true; payload: TreeCursorPayload }
  | { ok: false; reason: CursorRejectionReason };

function assertSecret(secret: string): void {
  if (secret.length < CURSOR_SECRET_MIN_LENGTH) {
    throw new Error(
      `segredo do cursor precisa de ao menos ${CURSOR_SECRET_MIN_LENGTH} caracteres`,
    );
  }
}

function base64UrlEncode(input: Buffer): string {
  return input.toString('base64url');
}

function sign(body: string, secret: string): string {
  return base64UrlEncode(createHmac('sha256', secret).update(body).digest());
}

/**
 * Comparação em tempo constante. `timingSafeEqual` exige mesmo comprimento,
 * então tamanho diferente já recusa — e nesse caso o vazamento de tempo é
 * inócuo, porque o comprimento do HMAC é público e fixo.
 */
function signaturesMatch(expected: string, received: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Emite um cursor assinado.
 *
 * `now` é injetável porque o aceite de T2.3 exige provar a expiração sem teste
 * dependente do relógio real.
 */
export function issueTreeCursor(
  payload: Omit<TreeCursorPayload, 'v' | 'exp'>,
  secret: string,
  now: number = Date.now(),
): string {
  assertSecret(secret);

  const complete: TreeCursorPayload = {
    ...payload,
    v: CURSOR_VERSION,
    exp: now + CURSOR_TTL_MS,
  };

  // Valida na emissão: cursor malformado precisa falhar aqui, onde o defeito
  // é do nosso código, e não depois, parecendo adulteração do cliente.
  const parsed = treeCursorPayloadSchema.parse(complete);

  const body = base64UrlEncode(Buffer.from(JSON.stringify(parsed), 'utf8'));
  return `${body}.${sign(body, secret)}`;
}

/**
 * Verifica um cursor recebido.
 *
 * Ordem deliberada: **assinatura antes de expiração**. Só depois de provar que
 * o token é nosso é que faz sentido acreditar no `exp` que ele carrega — o
 * contrário deixaria um `exp` forjado decidir o fluxo.
 *
 * `expected` amarra o cursor à consulta atual: assunto e sort diferentes
 * recusam com `other_query`, que é o `400` de "cursor de outra consulta" do
 * `contrato-http-v1.md` §2.
 */
export function verifyTreeCursor(
  cursor: string,
  secret: string,
  expected: { subject_type: string; subject_id: string; sort: CommentSort },
  now: number = Date.now(),
): TreeCursorVerification {
  assertSecret(secret);

  const separator = cursor.lastIndexOf('.');
  if (separator <= 0 || separator === cursor.length - 1) {
    return { ok: false, reason: 'malformed' };
  }

  const body = cursor.slice(0, separator);
  const signature = cursor.slice(separator + 1);

  if (!signaturesMatch(sign(body, secret), signature)) {
    return { ok: false, reason: 'bad_signature' };
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    // Assinatura válida com corpo ilegível não é ataque: é cursor emitido por
    // versão anterior do formato. Recusar como malformado força recarregar.
    return { ok: false, reason: 'malformed' };
  }

  const parsed = treeCursorPayloadSchema.safeParse(decoded);
  if (!parsed.success) {
    return { ok: false, reason: 'malformed' };
  }

  if (parsed.data.exp <= now) {
    return { ok: false, reason: 'expired' };
  }

  if (
    parsed.data.subject_type !== expected.subject_type ||
    parsed.data.subject_id !== expected.subject_id ||
    parsed.data.sort !== expected.sort
  ) {
    return { ok: false, reason: 'other_query' };
  }

  return { ok: true, payload: parsed.data };
}
