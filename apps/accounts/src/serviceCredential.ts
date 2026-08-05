import { timingSafeEqual } from "node:crypto";
import { hash as argon2Hash, verify as argon2Verify } from "@node-rs/argon2";
import type { Kysely } from "kysely";
import type { Database } from "./db.js";

/**
 * T2.2a — resolução de credencial de serviço por `source_app` e `realm`.
 *
 * A diferença que carrega a correção inteira está no **tipo de retorno**:
 * `isValidServiceToken` (serviceToken.ts) devolve `boolean`, respondendo "esse
 * token é igual ao segredo?". Aqui devolvemos **identidade ou `null`** —
 * `resolveServiceCredential` responde *quem* chamou, *em qual realm* pode
 * escrever e *quais operações* pode fazer.
 *
 * Isso importa porque `spec.md` §"Trust boundary e credenciais" exige que
 * `realm` seja derivado da credencial e **nunca aceito do payload**. Com um
 * segredo único global (o estado até 2026-08-04: mesmo digest em seis serviços e
 * nos dois realms) essa exigência é impossível de cumprir — não há nada na
 * credencial de onde derivar. Com o registro, `realm` sai daqui e o payload que
 * tentar declará-lo é rejeitado.
 */

/** Identidade resolvida. Nunca contém o segredo nem o hash. */
export interface ServiceCredentialIdentity {
  credentialId: string;
  tokenId: string;
  sourceApp: string;
  /**
   * Sempre exatamente um realm — garantido pelo CHECK
   * `community_service_credential_single_realm` na migration 007. Continua array
   * para espelhar a coluna, mas `realm` abaixo é o valor que os handlers usam.
   */
  realms: string[];
  /** O realm derivado. Handler usa este campo; nunca lê `realm` do payload. */
  realm: string;
  scopes: string[];
}

/** Escopos válidos. Espelha o CHECK de `scopes` na migration 007. */
export const SERVICE_SCOPES = [
  "users.read",
  "secrets.read",
  "comment.write",
  "comment.read",
  "vote.write",
  "report.write",
  "moderation.write",
] as const;

export type ServiceScope = (typeof SERVICE_SCOPES)[number];

/**
 * Parâmetros do Argon2id. Os defaults do `@node-rs/argon2` (m=19456, t=2, p=1)
 * são a recomendação atual do OWASP Password Storage Cheat Sheet para Argon2id.
 * Ficam explícitos para que uma mudança de default do pacote não altere
 * silenciosamente a força do hash — hashes antigos continuam verificáveis porque
 * os parâmetros viajam dentro da própria string `$argon2id$v=19$m=...`.
 */
const ARGON2_OPTIONS = {
  // `2` é `Algorithm.Argon2id`. O enum do pacote é `const enum` ambiente, que o
  // `isolatedModules` do projeto proíbe importar como valor (TS2748) — o literal
  // é o contorno, e o nome fica no comentário para não virar número mágico.
  algorithm: 2,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

/**
 * Formato do header: `<token_id>.<segredo>`.
 *
 * O `token_id` viaja em claro de propósito. Sem ele, verificar um token exigiria
 * rodar Argon2id contra **toda** linha da tabela — custo proporcional ao número
 * de credenciais, o que transformaria o próprio registro num vetor de DoS
 * conforme ele cresce. Com o prefixo, é um `SELECT` por índice e **um** Argon2id.
 */
const TOKEN_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{2,63}$/;

export function parseServiceTokenHeader(
  header: unknown,
): { tokenId: string; secret: string } | null {
  if (typeof header !== "string" || header === "") return null;

  // `indexOf`, não `split`: o segredo pode conter `.` e um `split('.')` cru
  // truncaria segredos legítimos, produzindo falha de autenticação intermitente
  // e difícil de diagnosticar.
  const separator = header.indexOf(".");
  if (separator <= 0 || separator === header.length - 1) return null;

  const tokenId = header.slice(0, separator);
  const secret = header.slice(separator + 1);

  if (!TOKEN_ID_PATTERN.test(tokenId)) return null;
  if (secret === "") return null;

  return { tokenId, secret };
}

/**
 * Compara dois `token_id` em tempo constante.
 *
 * O `token_id` não é secreto, mas o resultado do lookup é: comparar com `===`
 * depois da consulta permitiria descobrir por timing **quais IDs existem** no
 * registro, o que é reconhecimento gratuito para um atacante escolher alvo.
 * Reusa a normalização por digest de `timingSafeEqualStrings`.
 */
function constantTimeEquals(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, "utf8");
  const bufferB = Buffer.from(b, "utf8");
  if (bufferA.length !== bufferB.length) {
    // Comprimentos diferentes já são observáveis pelo próprio `token_id`, que é
    // público. Comparar contra si mesmo mantém um caminho de execução único.
    timingSafeEqual(bufferA, bufferA);
    return false;
  }
  return timingSafeEqual(bufferA, bufferB);
}

/** Gera o hash Argon2id de um segredo. Usado só pelo emissor de credenciais. */
export async function hashServiceSecret(secret: string): Promise<string> {
  return argon2Hash(secret, ARGON2_OPTIONS);
}

/**
 * Resolve a credencial a partir do header. Devolve `null` para **qualquer**
 * falha — token ausente, malformado, inexistente, revogado ou segredo errado.
 *
 * A indistinção é deliberada: diferenciar "credencial não existe" de "segredo
 * errado" na resposta entregaria ao atacante um oráculo de enumeração de
 * `source_app`. Quem chama devolve 401 genérico.
 */
export async function resolveServiceCredential(
  db: Kysely<Database>,
  header: unknown,
): Promise<ServiceCredentialIdentity | null> {
  const parsed = parseServiceTokenHeader(header);
  if (!parsed) return null;

  const row = await db
    .selectFrom("community_service_credential")
    .select([
      "id",
      "token_id",
      "token_hash",
      "source_app",
      "realms",
      "scopes",
    ])
    .where("token_id", "=", parsed.tokenId)
    .where("revoked_at", "is", null)
    .executeTakeFirst();

  if (!row) return null;
  if (!constantTimeEquals(row.token_id, parsed.tokenId)) return null;

  let matches: boolean;
  try {
    matches = await argon2Verify(row.token_hash, parsed.secret, ARGON2_OPTIONS);
  } catch {
    // Hash corrompido ou em formato desconhecido: falha fechado. Nunca logar o
    // hash nem o segredo — o motivo do erro não vale o risco de vazamento.
    return null;
  }
  if (!matches) return null;

  // A migration garante `cardinality(realms) = 1`, mas o dado vem do banco e é
  // `unknown` até ser normalizado (AGENTS.md §Regras Gerais de Código). Um
  // registro fora do invariante falha fechado em vez de derivar realm errado.
  const realms = Array.isArray(row.realms) ? row.realms.filter((r): r is string => typeof r === "string") : [];
  if (realms.length !== 1) return null;

  const scopes = Array.isArray(row.scopes) ? row.scopes.filter((s): s is string => typeof s === "string") : [];
  if (scopes.length === 0) return null;

  return {
    credentialId: row.id,
    tokenId: row.token_id,
    sourceApp: row.source_app,
    realms,
    realm: realms[0] as string,
    scopes,
  };
}

/** `true` quando a credencial carrega o escopo pedido. */
export function hasScope(
  identity: ServiceCredentialIdentity,
  scope: ServiceScope,
): boolean {
  return identity.scopes.includes(scope);
}

/**
 * Registra o uso da credencial. Best-effort e **fora** do caminho de decisão:
 * falha aqui nunca pode negar uma requisição legítima nem atrasá-la, por isso
 * não é aguardado pelo handler. Serve para provar que uma credencial pode ser
 * revogada antes de revogá-la.
 */
export async function touchServiceCredential(
  db: Kysely<Database>,
  credentialId: string,
): Promise<void> {
  try {
    await db
      .updateTable("community_service_credential")
      .set({ last_used_at: new Date() })
      .where("id", "=", credentialId)
      .execute();
  } catch {
    // Silencioso por desenho: observabilidade não derruba autenticação.
  }
}
