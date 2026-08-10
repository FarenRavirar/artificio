import type { Transaction } from "kysely";
import type { z } from "zod";
import type { Database } from "./db.js";

/**
 * Mecânica compartilhada de `Idempotency-Key` (`contrato-http-v1.md` §6).
 *
 * ## Por que isto virou módulo
 *
 * O bloco de reserva e o de replay eram idênticos em cinco handlers — criação,
 * edição, denúncia, resolução de caso, recurso e sanção —, variando apenas o
 * nome da operação e o status de sucesso. Sonar mediu **4,7% de duplicação no
 * código novo**, com `communityCommentReport.ts` em 20,3%.
 *
 * O custo da cópia não é estético. A retomada de chave vencida
 * (`DO UPDATE ... WHERE expires_at <= now()`) nasceu de um achado de review na
 * PR #250 e teve de ser aplicada à mão em cada cópia; a próxima correção de
 * idempotência teria o mesmo problema, e bastaria esquecer um arquivo para uma
 * operação ficar com chave bloqueada para sempre depois das 24h — falha
 * silenciosa, só visível ao usuário que repete um pedido no dia seguinte.
 *
 * ## O que **não** entrou aqui
 *
 * O `request_hash` continua sendo montado por cada handler. Ele decide o que
 * conta como "mesmo pedido", e isso é específico da operação: o do voto não
 * existe (§7 dispensa a chave), o da resolução de caso ordena os vereditos
 * porque a mesma decisão enviada em ordem diferente é a mesma decisão. Uma
 * função genérica de hash sobre o input inteiro apagaria essas escolhas e faria
 * um retry legítimo virar `409`.
 */

/** Retenção fixada em §6. Era constante duplicada em sete arquivos. */
export const IDEMPOTENCY_RETENTION_HOURS = 24;

export interface IdempotencyClaim {
  realm: string;
  sourceApp: string;
  idempotencyKey: string;
  /** Namespace da chave. Faz parte da unicidade, então `comment.edit` e
   * `comment.report` com a mesma chave são registros distintos. */
  operation: string;
  actingUserId: string | null;
  requestHash: string;
  /**
   * Status da resposta, gravado em `response_status`.
   *
   * **Não** é conferido no replay: `replayIdempotentResponse` devolve só o
   * corpo, e o status vem do handler, que sabe qual é o dele — a repetição de
   * uma criação responde `201` porque a rota responde `201`, não porque leu a
   * coluna. O comentário anterior aqui dizia "conferido no replay" e era falso.
   *
   * A coluna existe para auditoria e para um consumidor futuro do registro (o
   * contrato §6 fala em devolver "mesmo status, mesmo corpo"), então o valor
   * continua sendo gravado corretamente em vez de virar constante.
   */
  responseStatus: number;
}

/**
 * Reserva a chave, ou devolve `false` quando ela já pertence a outro pedido.
 *
 * Insere **antes** de qualquer leitura de estado: um `SELECT` primeiro deixaria
 * janela para dois pedidos idênticos passarem juntos, e capturar a violação de
 * unicidade depois mataria a transação (`25P02`), transformando repetição
 * legítima em `500`.
 *
 * `DO UPDATE ... WHERE expires_at <= now()` e não `DO NOTHING`: a chave vencida
 * é retomada aqui, atomicamente. `migration_008` documenta uma varredura
 * periódica de vencidos que nunca foi escrita (`rg "community_idempotency_key"`
 * em `apps packages scripts` não acha nenhum `DELETE`, medido em 2026-08-09),
 * então sem esta retomada a chave ficaria bloqueada **para sempre** depois das
 * 24h — e §6 diz o contrário. Achado de review do Codex (P2, PR #250).
 *
 * A condição no `WHERE` é o que mantém a segurança: dentro da janela o `UPDATE`
 * não acontece, zero linhas voltam, e o fluxo cai no replay.
 */
export async function claimIdempotencyKey(
  trx: Transaction<Database>,
  claim: IdempotencyClaim,
): Promise<boolean> {
  const expiresAt = new Date(
    Date.now() + IDEMPOTENCY_RETENTION_HOURS * 60 * 60 * 1000,
  );

  const claimed = await trx
    .insertInto("community_idempotency_key")
    .values({
      realm: claim.realm,
      source_app: claim.sourceApp,
      idempotency_key: claim.idempotencyKey,
      operation: claim.operation,
      acting_user_id: claim.actingUserId,
      request_hash: claim.requestHash,
      response_status: claim.responseStatus,
      response_body: {},
      expires_at: expiresAt,
    })
    .onConflict((oc) =>
      oc
        .columns(["realm", "source_app", "operation", "idempotency_key"])
        .doUpdateSet({
          acting_user_id: claim.actingUserId,
          request_hash: claim.requestHash,
          response_status: claim.responseStatus,
          response_body: {},
          // `created_at` também é reescrito: `community_idempotency_key_window`
          // exige `expires_at > created_at`, e manter o `created_at` antigo com
          // janela nova passa hoje mas quebra se a retenção mudar.
          created_at: new Date(),
          expires_at: expiresAt,
        })
        .where("community_idempotency_key.expires_at", "<=", new Date()),
    )
    .returning("id")
    .executeTakeFirst();

  return claimed !== undefined;
}

export interface IdempotencyLookup {
  realm: string;
  sourceApp: string;
  idempotencyKey: string;
  operation: string;
  /**
   * Ator que reivindicou a chave. Confere no replay — ver a nota de
   * `replayIdempotentResponse` sobre por que não basta o `request_hash`.
   */
  actingUserId: string | null;
}

/**
 * Repetição da chave: devolve a resposta original, ou `null` quando o registro
 * não serve.
 *
 * `null` cobre os quatro casos que o contrato colapsa em
 * `409`/`idempotency_key_reuse`: registro ausente ou vencido, `request_hash`
 * diferente (payload novo na mesma chave), **ator diferente do que reivindicou a
 * chave**, e corpo gravado com forma desconhecida.
 *
 * ## Por que o ator é conferido aqui, e não só pelo `request_hash`
 *
 * Os seis handlers incluem o id do ator no `request_hash` (medido: `rg` por
 * `hash*Request` em `apps/accounts/src`), então hoje um ator diferente já produz
 * hash diferente e cai no `409`. A conferência abaixo é redundante **com essa
 * convenção**, e é exatamente por isso que existe: a convenção vive espalhada em
 * seis funções de hash, e a sétima — escrita meses depois por quem não leu esta
 * nota — omitiria o ator sem nada falhar. O efeito seria um usuário receber a
 * resposta de uma operação de outro, com o `Idempotency-Key` funcionando como
 * senha adivinhável.
 *
 * `IS NOT DISTINCT FROM` e não `=`: `acting_user_id` é nulável, e `NULL = NULL`
 * é `NULL` em SQL — a comparação direta descartaria toda operação sem ator, que
 * passaria a nunca replicar.
 *
 * O último merece nota. `response_body` é `jsonb` **lido do banco**, portanto
 * `unknown` até passar por normalizador (`AGENTS.md` §Regras Gerais de Código);
 * o `as` que estava nos handlers afirmava a forma sem verificar, e o valor vai
 * direto para `res.json()` — uma linha gravada por versão anterior do handler
 * seria servida ao consumidor como se estivesse tipada (achado do CodeRabbit,
 * PR #250). Por isso o `schema` é parâmetro obrigatório, não opcional: quem
 * chamar isto **tem** que dizer qual é a forma esperada.
 *
 * Forma desconhecida vira `null` (logo, `409`) e não `500`: a linha existe e é
 * inutilizável, que é exatamente o que `idempotency_key_reuse` significa para o
 * chamador.
 */
export async function replayIdempotentResponse<T>(
  trx: Transaction<Database>,
  lookup: IdempotencyLookup,
  requestHash: string,
  schema: z.ZodType<T>,
): Promise<T | null> {
  const existing = await trx
    .selectFrom("community_idempotency_key")
    .select(["request_hash", "response_body", "expires_at", "acting_user_id"])
    .where("realm", "=", lookup.realm)
    .where("source_app", "=", lookup.sourceApp)
    .where("operation", "=", lookup.operation)
    .where("idempotency_key", "=", lookup.idempotencyKey)
    .executeTakeFirst();

  // Registro vencido não é repetição: passadas as 24h a chave está livre. Hoje
  // este ramo é inalcançável pelo caminho normal — `claimIdempotencyKey` retoma
  // a linha vencida antes de chegar aqui —, mas continua como defesa: uma linha
  // escrita por script operacional ou por versão anterior do handler não pode
  // virar replay de uma operação de ontem.
  if (!existing || existing.expires_at <= new Date()) return null;

  // Comparação NULL-safe em TypeScript: `null === null` é `true` aqui, ao
  // contrário do `NULL = NULL` do SQL. Operação sem ator continua replicando.
  if ((existing.acting_user_id ?? null) !== (lookup.actingUserId ?? null)) {
    return null;
  }

  if (existing.request_hash !== requestHash) return null;

  const stored = schema.safeParse(existing.response_body);
  return stored.success ? stored.data : null;
}

/** Grava a resposta real na chave, para a repetição devolver corpo idêntico. */
export async function storeIdempotentResponse(
  trx: Transaction<Database>,
  lookup: IdempotencyLookup,
  responseBody: unknown,
): Promise<void> {
  await trx
    .updateTable("community_idempotency_key")
    .set({ response_body: responseBody })
    .where("realm", "=", lookup.realm)
    .where("source_app", "=", lookup.sourceApp)
    .where("operation", "=", lookup.operation)
    .where("idempotency_key", "=", lookup.idempotencyKey)
    .execute();
}

/**
 * `23505` do PostgreSQL — violação de unicidade.
 *
 * O erro chega do driver como objeto com `code`, não como classe tipada, então a
 * checagem é estrutural. Distinguir a violação de qualquer outro erro importa:
 * relançar tudo transformaria denúncia repetida em `500`, e engolir tudo
 * esconderia falha real de banco atrás de um `409` inventado.
 */
export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505"
  );
}
