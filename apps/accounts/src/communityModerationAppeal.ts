import { createHash, randomUUID } from "node:crypto";
import type { Kysely, Transaction } from "kysely";
import { z } from "zod";
import type { Database } from "./db.js";
import {
  resolveActorId,
  resolveOrCreateActor,
  resolveUserIdOfActor,
} from "./communityActor.js";
import {
  claimIdempotencyKey,
  isUniqueViolation,
  replayIdempotentResponse,
  storeIdempotentResponse,
} from "./communityIdempotency.js";

/**
 * T2.25 + T2.26 — recurso do autor e sanção comunitária
 * (`contrato-http-v1.md` §10, §11; decisões 47, 48, 49).
 *
 * ## As duas moram juntas porque são as duas escritas **pós-terminal**
 *
 * Recurso e sanção acontecem depois que o caso fechou, e ambas dependem da
 * decisão terminal para existir: o recurso referencia a decisão que removeu, a
 * sanção é a consequência que o moderador escolhe aplicar sobre o ator. Nenhuma
 * das duas reabre o caso.
 *
 * ## Nada aqui é automático — é a trava central da decisão 48
 *
 * Denúncia não sanciona. Limiar não sanciona. Reincidência não sanciona.
 * `remove` não sanciona. **Só uma chamada explícita de moderador** cria
 * restrição, com nível, prazo e motivo escolhidos por ele. Um gatilho automático
 * transformaria brigada coordenada em ferramenta de banimento: cinco contas
 * ocultam, a sanção cai, e o alvo perde a voz sem que ninguém tenha julgado.
 *
 * `GET .../sanctions?actor_id=` existe para **sugerir progressão** ao moderador
 * — informação, não regra.
 */

/** Namespaces das chaves de idempotência (§6): duas operações neste módulo. */
const APPEAL_OPERATION = "moderation.appeal.create";
const SANCTION_OPERATION = "moderation.sanction.create";

/** Janela do recurso (decisão 47). O banco valida o mesmo valor por trigger. */
export const APPEAL_WINDOW_MONTHS = 6;

export interface FileAppealInput {
  realm: string;
  sourceApp: string;
  caseId: string;
  actingUserId: string;
  reason: string;
  idempotencyKey: string;
}

export type AppealRejectionCode =
  | "case_not_found"
  /** Terceiro ou denunciante tentando recorrer (decisão 47). */
  | "forbidden_appellant"
  /** Caso não terminou em `remove` — não há remoção a recorrer. */
  | "appeal_not_available"
  | "appeal_already_filed"
  | "appeal_window_expired"
  | "idempotency_key_reuse";

export interface FiledAppeal {
  id: string;
  case_id: string;
  status: string;
  submitted_at: string;
  appeal_deadline_at: string;
}

export type FileAppealResult =
  | { ok: true; appeal: FiledAppeal; replayed: boolean }
  | { ok: false; code: AppealRejectionCode; status: number };

export interface OwnAppealDetail {
  id: string;
  case_id: string;
  status: string;
  submitted_at: string;
  appeal_deadline_at: string;
  decision: "upheld" | "reversed" | null;
  decided_at: string | null;
}

/** Recurso do titular, sem justificativa interna nem identidade do moderador. */
export async function readOwnAppeal(
  db: Kysely<Database>,
  userId: string,
  appealId: string,
): Promise<OwnAppealDetail | null> {
  return await db.transaction().execute(async (trx) => {
    const actorId = await resolveActorId(trx, userId);
    if (actorId === null) return null;

    const row = await trx
      .selectFrom("community_comment_appeal")
      .select([
        "id",
        "case_id",
        "status",
        "submitted_at",
        "appeal_deadline_at",
        "decided_at",
      ])
      .where("id", "=", appealId)
      .where("appellant_actor_id", "=", actorId)
      .executeTakeFirst();

    if (!row) return null;
    return {
      id: row.id,
      case_id: row.case_id,
      status: row.status,
      submitted_at: row.submitted_at.toISOString(),
      appeal_deadline_at: row.appeal_deadline_at.toISOString(),
      decision:
        row.status === "upheld" || row.status === "reversed" ? row.status : null,
      decided_at: row.decided_at?.toISOString() ?? null,
    };
  });
}

export interface ModeratorAppealDetail extends OwnAppealDetail {
  comment_version_id: string;
  reason: string;
  /** `null` quando o caso foi fechado sem ator registrado (fechamento por sistema). */
  original_decider_actor_id: string | null;
  /** `null` quando o moderador ainda não tem ator comunitário — ver `readAppealForModerator`. */
  current_decider_actor_id: string | null;
}

/**
 * Detalhe interno do recurso com os dois lados da comparação de T4.25.
 * `current_decider_actor_id` é derivado do `X-Acting-User-Id` já validado pelo
 * guard de papel; nenhum identificador declarado pelo payload entra na consulta.
 */
export async function readAppealForModerator(
  db: Kysely<Database>,
  input: {
    realm: string;
    sourceApp: string;
    appealId: string;
    moderatorUserId: string;
  },
): Promise<ModeratorAppealDetail | null> {
  return await db.transaction().execute(async (trx) => {
    // Ausência de ator **não** vira ausência de recurso: um moderador global
    // recém-promovido que nunca comentou não tem linha em `community_actor`, e
    // encerrar aqui devolvia `404` para um recurso existente — o workspace
    // ficava inacessível justamente para quem precisa abri-lo (achado de
    // review, PR #258). O ator só é necessário para a comparação "mesmo
    // decisor"; sem ele a comparação é indeterminada, não falsa, e a leitura
    // segue. Não usar `resolveOrCreateActor`: leitura não cria estado.
    const currentDeciderActorId = await resolveActorId(trx, input.moderatorUserId);

    const row = await trx
      .selectFrom("community_comment_appeal as a")
      .innerJoin("community_moderation_case as mc", (join) =>
        join
          .onRef("mc.realm", "=", "a.realm")
          .onRef("mc.source_app", "=", "a.source_app")
          .onRef("mc.id", "=", "a.case_id"),
      )
      .select([
        "a.id",
        "a.case_id",
        "a.comment_version_id",
        "a.reason",
        "a.status",
        "a.submitted_at",
        "a.appeal_deadline_at",
        "a.decided_at",
        "mc.closed_by_actor_id as original_decider_actor_id",
      ])
      .where("a.id", "=", input.appealId)
      .where("a.realm", "=", input.realm)
      .where("a.source_app", "=", input.sourceApp)
      .executeTakeFirst();

    // Pelo mesmo motivo, caso fechado sem `closed_by_actor_id` (fechamento por
    // sistema) devolve o recurso com o decisor original nulo, em vez de sumir.
    if (!row) return null;
    return {
      id: row.id,
      case_id: row.case_id,
      comment_version_id: row.comment_version_id,
      reason: row.reason,
      status: row.status,
      submitted_at: row.submitted_at.toISOString(),
      appeal_deadline_at: row.appeal_deadline_at.toISOString(),
      decision:
        row.status === "upheld" || row.status === "reversed" ? row.status : null,
      decided_at: row.decided_at?.toISOString() ?? null,
      original_decider_actor_id: row.original_decider_actor_id,
      current_decider_actor_id: currentDeciderActorId,
    };
  });
}

const filedAppealSchema = z
  .object({
    id: z.string(),
    case_id: z.string(),
    status: z.string(),
    submitted_at: z.string(),
    appeal_deadline_at: z.string(),
  })
  .strict();

class AppealRejection extends Error {
  constructor(
    readonly code: AppealRejectionCode,
    readonly status: number,
  ) {
    super(code);
    this.name = "AppealRejection";
  }
}

/**
 * `closed_at + INTERVAL 'N months'`, com a semântica do PostgreSQL.
 *
 * `validate_community_comment_appeal` exige que `appeal_deadline_at` seja
 * **exatamente** `closed_at + INTERVAL '6 months'`, e as duas linguagens
 * discordam no fim do mês. Medido:
 *
 * | `closed_at`  | `Date.setUTCMonth(+6)` | PostgreSQL   |
 * |--------------|------------------------|--------------|
 * | `2026-01-31` | `2026-07-31`           | `2026-07-31` |
 * | `2026-08-31` | `2027-03-03`           | `2027-02-28` |
 *
 * JavaScript **transborda** para o mês seguinte quando o dia não existe no mês
 * de destino; o PostgreSQL **satura** no último dia. Um caso fechado em 31/08
 * produzia um prazo que a trigger recusava — exceção de `plpgsql`, que chega ao
 * Express sem código HTTP e vira `500` no lugar do `201`. O autor perderia o
 * recurso por causa da data em que o moderador decidiu. Achado de review,
 * PR #251.
 *
 * `setUTCMonth` e não `setMonth`: usar o fuso local do processo deslocaria o
 * prazo pelo `TZ` da VM, que ninguém garante.
 *
 * ## O `TimeZone` da sessão do banco **não** entra nesta conta
 *
 * `appeal_deadline_at` e `closed_at` são `TIMESTAMPTZ`, e `INTERVAL` sobre
 * `timestamptz` opera no instante absoluto — o `TimeZone` da sessão muda só como
 * o valor é *exibido*. Medido em produção (`artificio_auth`, 2026-08-10), com a
 * base em `2026-08-31 23:00Z`, que é 1º de setembro em Tóquio:
 *
 * ```
 * set time zone 'UTC';        -> 2027-02-28 23:00:00 (em UTC)
 * set time zone 'Asia/Tokyo'; -> 2027-02-28 23:00:00 (em UTC)
 * ```
 *
 * Mesmo instante nos dois, inclusive nas fronteiras de mês. Um review sugeriu
 * fixar `SET TIME ZONE 'UTC'` na conexão antes do `INSERT`; a medição mostra que
 * seria uma escrita de sessão sem efeito sobre a comparação da trigger, num pool
 * compartilhado. Não foi feito.
 */
export function addMonthsLikePostgres(from: Date, months: number): Date {
  const day = from.getUTCDate();
  const result = new Date(from);

  // Fixa o dia 1 antes de mover o mês: sem isso `setUTCMonth` já transborda
  // durante a própria chamada, e o clamp abaixo não teria como saber que mês
  // era o pretendido.
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);

  // Último dia do mês de destino: dia 0 do mês seguinte.
  const lastDay = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
  ).getUTCDate();

  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

function hashAppealRequest(input: FileAppealInput): string {
  return createHash("sha256")
    .update(JSON.stringify([input.caseId, input.reason, input.actingUserId]))
    .digest("hex");
}

// `resolveActorId`, `resolveOrCreateActor` e `resolveUserIdOfActor` vêm de
// `communityActor.ts`. O recurso usa a variante que **não cria**: quem nunca
// participou não é autor de comentário removido, e criar ator aqui gravaria
// identidade por causa de um pedido que será recusado como `forbidden_appellant`.

/**
 * `POST /internal/v1/moderation/decisions/:id/appeals` (§10, decisão 47).
 *
 * ## As checagens são duplicadas com a trigger, de propósito
 *
 * `validate_community_comment_appeal` já recusa caso não removido, recorrente
 * que não é o autor e prazo fora da janela. Mas exceção de `plpgsql` chega ao
 * Express como erro sem código HTTP, e viraria `500` — o contrato exige `403`,
 * `409` e `422` distinguíveis, porque cada um diz coisa diferente ao autor.
 *
 * A trigger continua sendo a garantia: ela pega o caminho que o handler não
 * previu, e é ela que impede um script operacional de inserir recurso inválido.
 *
 * ## `appeal_deadline_at` é calculado, não recebido
 *
 * A trigger exige que ele seja **exatamente** `closed_at + 6 meses`. Aceitá-lo
 * do cliente daria ao autor a chance de esticar o próprio prazo, e a recusa
 * viria como `500` em vez de erro legível.
 */
export async function fileAppeal(
  db: Kysely<Database>,
  input: FileAppealInput,
): Promise<FileAppealResult> {
  const requestHash = hashAppealRequest(input);

  try {
    return await db.transaction().execute(async (trx) => {
      const claimed = await claimIdempotencyKey(trx, {
        realm: input.realm,
        sourceApp: input.sourceApp,
        idempotencyKey: input.idempotencyKey,
        operation: APPEAL_OPERATION,
        actingUserId: input.actingUserId,
        requestHash,
        responseStatus: 201,
      });

      if (!claimed) {
        return await replayAppealOrConflict(trx, input, requestHash);
      }

      const moderationCase = await trx
        .selectFrom("community_moderation_case")
        .select([
          "id",
          "comment_id",
          "status",
          "terminal_action",
          "decision_version_id",
          "closed_at",
        ])
        .where("id", "=", input.caseId)
        .where("realm", "=", input.realm)
        .where("source_app", "=", input.sourceApp)
        .executeTakeFirst();

      if (!moderationCase) {
        throw new AppealRejection("case_not_found", 404);
      }

      // Só decisão terminal que **removeu** conteúdo é recorrível. `no_change` e
      // `restore` não tiraram nada do ar — não há o que reverter, e permitir
      // recurso deles transformaria a rota em canal de reclamação sobre decisão
      // favorável.
      if (
        moderationCase.status !== "closed" ||
        moderationCase.terminal_action !== "remove" ||
        moderationCase.closed_at === null ||
        moderationCase.decision_version_id === null
      ) {
        throw new AppealRejection("appeal_not_available", 422);
      }

      const comment = await trx
        .selectFrom("community_comment")
        .select("community_actor_id")
        .where("id", "=", moderationCase.comment_id)
        .where("realm", "=", input.realm)
        .where("source_app", "=", input.sourceApp)
        .executeTakeFirst();

      const actorId = await resolveActorId(trx, input.actingUserId);

      // Somente o autor. Denunciante que quer recorrer de `not_upheld` cai aqui
      // com `403` — decisão 47 é explícita: o resultado mínimo que ele recebeu é
      // o fim da linha para ele.
      if (
        actorId === null ||
        comment?.community_actor_id === null ||
        comment?.community_actor_id !== actorId
      ) {
        throw new AppealRejection("forbidden_appellant", 403);
      }

      const submittedAt = new Date();
      const deadline = addMonthsLikePostgres(
        moderationCase.closed_at,
        APPEAL_WINDOW_MONTHS,
      );

      if (submittedAt > deadline) {
        throw new AppealRejection("appeal_window_expired", 422);
      }

      const appealId = randomUUID();

      try {
        await trx
          .insertInto("community_comment_appeal")
          .values({
            id: appealId,
            realm: input.realm,
            source_app: input.sourceApp,
            case_id: input.caseId,
            comment_version_id: moderationCase.decision_version_id,
            appellant_actor_id: actorId,
            reason: input.reason,
            status: "open",
            submitted_at: submittedAt,
            appeal_deadline_at: deadline,
          })
          .execute();
      } catch (error) {
        // `UNIQUE (realm, source_app, case_id)`: um recurso por decisão
        // terminal. O segundo é `409`, não `500`.
        if (isUniqueViolation(error)) {
          throw new AppealRejection("appeal_already_filed", 409);
        }
        throw error;
      }

      await trx
        .insertInto("community_moderation_audit")
        .values({
          realm: input.realm,
          source_app: input.sourceApp,
          actor_id: actorId,
          action: "moderation.appeal.filed",
          target_type: "comment_appeal",
          target_id: appealId,
          reason: input.reason,
          metadata: {
            case_id: input.caseId,
            comment_id: moderationCase.comment_id,
            comment_version_id: moderationCase.decision_version_id,
          },
        })
        .execute();

      const appeal: FiledAppeal = {
        id: appealId,
        case_id: input.caseId,
        status: "open",
        submitted_at: submittedAt.toISOString(),
        appeal_deadline_at: deadline.toISOString(),
      };

      await storeIdempotentResponse(trx, appealKeyLookup(input), appeal);

      return { ok: true as const, appeal, replayed: false };
    });
  } catch (error) {
    if (error instanceof AppealRejection) {
      return { ok: false, code: error.code, status: error.status };
    }
    throw error;
  }
}

export interface DecideAppealInput {
  realm: string;
  sourceApp: string;
  appealId: string;
  moderatorUserId: string;
  outcome: "upheld" | "reversed";
  reason: string;
}

export type DecideAppealRejectionCode =
  | "appeal_not_found"
  | "appeal_already_decided";

export type DecideAppealResult =
  | { ok: true; restored: boolean }
  | { ok: false; code: DecideAppealRejectionCode; status: number };

/**
 * `POST /internal/v1/moderation/appeals/:id/resolution` (§10, decisão 47).
 *
 * ## `upheld` mantém a remoção, `reversed` a desfaz
 *
 * O vocabulário é do ponto de vista da **decisão original**, não do recorrente:
 * `upheld` = a decisão foi mantida (o recurso perdeu), `reversed` = a decisão
 * caiu (o recurso ganhou). É o que o `CHECK` do banco fixa, e inverter os dois
 * no handler produziria restauração exatamente nos casos em que a moderação
 * confirmou a remoção.
 *
 * ## O mesmo moderador pode rejulgar
 *
 * Decisão 47 é explícita: "não há exigência de segundo moderador". A trava não é
 * técnica — é a nova justificativa registrada, que este handler exige por ser
 * `reason` obrigatório e auditado. Impor moderador diferente travaria o recurso
 * num projeto com um moderador só, que é o estado atual.
 *
 * A identificação de que o decisor é o original vive na interface, não aqui: o
 * dado (`closed_by_actor_id` do caso) já está disponível para ela comparar.
 *
 * ## Nada é restaurado automaticamente na abertura
 *
 * O recurso aberto não muda visibilidade — só esta decisão muda, e só quando
 * `reversed`. É o que impede recurso vazio de funcionar como republicação.
 */
export async function decideAppeal(
  db: Kysely<Database>,
  input: DecideAppealInput,
): Promise<DecideAppealResult> {
  return await db.transaction().execute(async (trx) => {
    const appeal = await trx
      .selectFrom("community_comment_appeal")
      .select(["id", "case_id", "status", "appellant_actor_id"])
      .where("id", "=", input.appealId)
      .where("realm", "=", input.realm)
      .where("source_app", "=", input.sourceApp)
      .forUpdate()
      .executeTakeFirst();

    if (!appeal) {
      return { ok: false as const, code: "appeal_not_found" as const, status: 404 };
    }

    if (appeal.status !== "open") {
      return {
        ok: false as const,
        code: "appeal_already_decided" as const,
        status: 409,
      };
    }

    const moderatorActorId = await resolveOrCreateActor(trx, input.moderatorUserId);
    const decidedAt = new Date();

    // Transição condicionada, mesmo padrão de T2.20(b): `WHERE status = 'open'`
    // mais `RETURNING`. Zero linhas significa que outro moderador decidiu entre
    // o lock e aqui.
    const decided = await trx
      .updateTable("community_comment_appeal")
      .set({
        status: input.outcome,
        decided_at: decidedAt,
        decided_by_actor_id: moderatorActorId,
        decision_reason: input.reason,
      })
      .where("id", "=", input.appealId)
      .where("realm", "=", input.realm)
      .where("source_app", "=", input.sourceApp)
      .where("status", "=", "open")
      .returning("id")
      .executeTakeFirst();

    if (!decided) {
      return {
        ok: false as const,
        code: "appeal_already_decided" as const,
        status: 409,
      };
    }

    const moderationCase = await trx
      .selectFrom("community_moderation_case")
      .select("comment_id")
      .where("id", "=", appeal.case_id)
      .where("realm", "=", input.realm)
      .where("source_app", "=", input.sourceApp)
      .executeTakeFirstOrThrow();

    let restored = false;

    if (input.outcome === "reversed") {
      // Só sai de `moderator_removed`. Se o autor retirou depois da remoção
      // moderadora, o tombstone dele prevalece — restaurar republicaria conteúdo
      // contra a vontade de quem o escreveu.
      const undone = await trx
        .updateTable("community_comment")
        .set({
          visibility_state: "visible",
          removed_at: null,
          removed_by_actor_id: null,
          removed_reason: null,
        })
        .where("id", "=", moderationCase.comment_id)
        .where("realm", "=", input.realm)
        .where("source_app", "=", input.sourceApp)
        .where("visibility_state", "=", "moderator_removed")
        .returning("id")
        .executeTakeFirst();

      restored = undone !== undefined;
    }

    // Notificação privada ao recorrente (decisão 47). Carrega só o resultado —
    // sem a justificativa do moderador, que é nota interna.
    const appellantUserId = await resolveUserIdOfActor(trx, appeal.appellant_actor_id);
    if (appellantUserId !== null) {
      const eventRowId = randomUUID();
      await trx
        .insertInto("notification_event")
        .values({
          id: eventRowId,
          event_id: randomUUID(),
          realm: input.realm,
          source_app: input.sourceApp,
          event_type: "comment.moderation.appeal.decided",
          event_version: 1,
          subject_type: "comment",
          subject_id: moderationCase.comment_id,
          actor_id: moderatorActorId,
          canonical_path: `/comments/${moderationCase.comment_id}`,
          snapshot: {
            comment_id: moderationCase.comment_id,
            outcome: input.outcome,
            restored,
          },
        })
        .execute();

      await trx
        .insertInto("notification_receipt")
        .values({
          realm: input.realm,
          source_app: input.sourceApp,
          event_id: eventRowId,
          recipient_user_id: appellantUserId,
          read_at: null,
        })
        .execute();
    }

    await trx
      .insertInto("community_moderation_audit")
      .values({
        realm: input.realm,
        source_app: input.sourceApp,
        actor_id: moderatorActorId,
        action: "moderation.appeal.decided",
        target_type: "comment_appeal",
        target_id: input.appealId,
        reason: input.reason,
        metadata: {
          case_id: appeal.case_id,
          comment_id: moderationCase.comment_id,
          outcome: input.outcome,
          restored,
        },
      })
      .execute();

    return { ok: true as const, restored };
  });
}

/** Escopos independentes (decisão 48). `posting` nasce no contrato central. */
export const SANCTION_SCOPES = ["posting", "commenting"] as const;
export type SanctionScope = (typeof SANCTION_SCOPES)[number];

/**
 * Níveis do contrato (§11) mapeados para os do banco.
 *
 * O `CHECK` da migration usa `temporary_suspension`/`permanent_suspension`; o
 * contrato HTTP fala `temporary`/`permanent`. A tradução mora aqui, num só
 * lugar: espalhar o `_suspension` pelo handler faria o payload público carregar
 * vocabulário de schema, e mudar um sem o outro passaria no `tsc` e falharia no
 * `CHECK` só em runtime.
 */
export const SANCTION_LEVELS = ["warning", "temporary", "permanent"] as const;
export type SanctionLevel = (typeof SANCTION_LEVELS)[number];

const LEVEL_TO_COLUMN: Record<SanctionLevel, string> = {
  warning: "warning",
  temporary: "temporary_suspension",
  permanent: "permanent_suspension",
};

export interface ApplySanctionInput {
  realm: string;
  sourceApp: string;
  targetActorId: string;
  moderatorUserId: string;
  scopes: readonly SanctionScope[];
  level: SanctionLevel;
  expiresAt: Date | null;
  reason: string;
  idempotencyKey: string;
}

export type SanctionRejectionCode =
  | "actor_not_found"
  /** `temporary` sem `expires_at`, ou `expires_at` no passado. */
  | "invalid_duration"
  /** Já existe suspensão ativa no mesmo escopo (índice parcial único). */
  | "sanction_already_active"
  | "idempotency_key_reuse";

export interface AppliedSanction {
  ids: string[];
  scopes: string[];
  level: string;
  expires_at: string | null;
}

export type ApplySanctionResult =
  | { ok: true; sanction: AppliedSanction; replayed: boolean }
  | { ok: false; code: SanctionRejectionCode; status: number };

const appliedSanctionSchema = z
  .object({
    ids: z.array(z.string()),
    scopes: z.array(z.string()),
    level: z.string(),
    expires_at: z.string().nullable(),
  })
  .strict();

class SanctionRejection extends Error {
  constructor(
    readonly code: SanctionRejectionCode,
    readonly status: number,
  ) {
    super(code);
    this.name = "SanctionRejection";
  }
}

function hashSanctionRequest(input: ApplySanctionInput): string {
  return createHash("sha256")
    .update(
      JSON.stringify([
        input.targetActorId,
        [...input.scopes].sort(),
        input.level,
        input.expiresAt?.toISOString() ?? null,
        input.reason,
        input.moderatorUserId,
      ]),
    )
    .digest("hex");
}

/**
 * `POST /internal/v1/moderation/sanctions` (§11, decisões 48, 49).
 *
 * ## Uma linha por escopo, e é isso que os torna independentes
 *
 * `scopes: ["posting", "commenting"]` grava **duas** restrições, não uma com
 * dois escopos. É o que permite levantar `commenting` mantendo `posting`, e é o
 * que `uq_community_restriction_active` assume — o índice é sobre
 * `(realm, actor_id, scope)`.
 *
 * ## O que a sanção **não** alcança
 *
 * Login, leitura, uso não comunitário e auto-retirada do próprio conteúdo
 * continuam (decisão 48). Sanção comunitária não é banimento de conta: quem
 * perde a voz não perde o acesso, e quem quer apagar o que escreveu continua
 * podendo. Nenhum código aqui toca `users`, refresh token ou sessão — a
 * separação é estrutural, não uma regra que alguém precisa lembrar.
 *
 * `commenting` **falha fechado** na escrita: `communityCommentWrite.ts` consulta
 * `hasActiveSanction` antes de criar comentário. `posting` nasce no contrato
 * central sem efeito automático — o app adotante decide o que "postar" significa
 * no domínio dele, e classificar objetos de domínio aqui seria decidir por ele.
 */
export async function applySanction(
  db: Kysely<Database>,
  input: ApplySanctionInput,
): Promise<ApplySanctionResult> {
  const requestHash = hashSanctionRequest(input);

  try {
    return await db.transaction().execute(async (trx) => {
      const claimed = await claimIdempotencyKey(trx, {
        realm: input.realm,
        sourceApp: input.sourceApp,
        idempotencyKey: input.idempotencyKey,
        operation: SANCTION_OPERATION,
        actingUserId: input.moderatorUserId,
        requestHash,
        responseStatus: 201,
      });

      if (!claimed) {
        return await replaySanctionOrConflict(trx, input, requestHash);
      }

      const target = await trx
        .selectFrom("community_actor")
        .select("id")
        .where("id", "=", input.targetActorId)
        .executeTakeFirst();

      if (!target) {
        throw new SanctionRejection("actor_not_found", 404);
      }

      const startsAt = new Date();

      // `community_restriction_duration_check` recusa `temporary` sem
      // `expires_at` e `warning`/`permanent` com ele. Validar aqui devolve `422`
      // legível em vez do `500` que a violação de `CHECK` produziria.
      if (input.level === "temporary") {
        if (input.expiresAt === null || input.expiresAt <= startsAt) {
          throw new SanctionRejection("invalid_duration", 422);
        }
      } else if (input.expiresAt !== null) {
        throw new SanctionRejection("invalid_duration", 422);
      }

      const moderatorActorId = await resolveOrCreateActor(trx, input.moderatorUserId);
      const ids: string[] = [];

      for (const scope of input.scopes) {
        const id = randomUUID();
        try {
          await trx
            .insertInto("community_restriction")
            .values({
              id,
              realm: input.realm,
              source_app: input.sourceApp,
              actor_id: input.targetActorId,
              scope,
              level: LEVEL_TO_COLUMN[input.level],
              reason: input.reason,
              imposed_by_actor_id: moderatorActorId,
              starts_at: startsAt,
              expires_at: input.expiresAt,
            })
            .execute();
        } catch (error) {
          // `uq_community_restriction_active` cobre só suspensão, não
          // `warning`: advertências acumulam de propósito (é o histórico que
          // sugere progressão), suspensões não.
          if (isUniqueViolation(error)) {
            throw new SanctionRejection("sanction_already_active", 409);
          }
          throw error;
        }

        ids.push(id);

        await trx
          .insertInto("community_moderation_audit")
          .values({
            realm: input.realm,
            source_app: input.sourceApp,
            actor_id: moderatorActorId,
            action: "moderation.sanction.applied",
            target_type: "community_restriction",
            target_id: id,
            reason: input.reason,
            metadata: {
              target_actor_id: input.targetActorId,
              scope,
              level: input.level,
              expires_at: input.expiresAt?.toISOString() ?? null,
            },
          })
          .execute();
      }

      const sanction: AppliedSanction = {
        ids,
        scopes: [...input.scopes],
        level: input.level,
        expires_at: input.expiresAt?.toISOString() ?? null,
      };

      await storeIdempotentResponse(trx, sanctionKeyLookup(input), sanction);

      return { ok: true as const, sanction, replayed: false };
    });
  } catch (error) {
    if (error instanceof SanctionRejection) {
      return { ok: false, code: error.code, status: error.status };
    }
    throw error;
  }
}

export interface LiftSanctionInput {
  realm: string;
  sourceApp: string;
  sanctionId: string;
  moderatorUserId: string;
  reason: string;
}

export type LiftSanctionResult =
  | { ok: true }
  | { ok: false; code: "sanction_not_found"; status: number };

/**
 * `DELETE /internal/v1/moderation/sanctions/:id` (§11).
 *
 * Revoga marcando `lifted_at`; a linha **permanece**. É o histórico que sustenta
 * a auditoria e a sugestão de progressão (`spec.md` 12f) — apagar faria a
 * segunda infração parecer a primeira.
 */
export async function liftSanction(
  db: Kysely<Database>,
  input: LiftSanctionInput,
): Promise<LiftSanctionResult> {
  return await db.transaction().execute(async (trx) => {
    const moderatorActorId = await resolveOrCreateActor(trx, input.moderatorUserId);

    const lifted = await trx
      .updateTable("community_restriction")
      .set({
        lifted_at: new Date(),
        lifted_by_actor_id: moderatorActorId,
        lift_reason: input.reason,
      })
      .where("id", "=", input.sanctionId)
      .where("realm", "=", input.realm)
      .where("source_app", "=", input.sourceApp)
      .where("lifted_at", "is", null)
      .returning(["id", "actor_id", "scope"])
      .executeTakeFirst();

    if (!lifted) {
      return {
        ok: false as const,
        code: "sanction_not_found" as const,
        status: 404,
      };
    }

    await trx
      .insertInto("community_moderation_audit")
      .values({
        realm: input.realm,
        source_app: input.sourceApp,
        actor_id: moderatorActorId,
        action: "moderation.sanction.lifted",
        target_type: "community_restriction",
        target_id: lifted.id,
        reason: input.reason,
        metadata: { target_actor_id: lifted.actor_id, scope: lifted.scope },
      })
      .execute();

    return { ok: true as const };
  });
}

export interface SanctionHistoryEntry {
  id: string;
  scope: string;
  level: string;
  reason: string;
  starts_at: string;
  expires_at: string | null;
  lifted_at: string | null;
  active: boolean;
}

/**
 * `GET /internal/v1/moderation/sanctions?actor_id=` (§11).
 *
 * Devolve histórico completo, incluindo vencidas e levantadas — é ele que
 * sugere progressão ao moderador. `active` é derivado na leitura pelas mesmas
 * três condições que `hasActiveSanction` usa na escrita; guardá-lo em coluna
 * exigiria um processo que expira sanções, e a expiração por relógio não
 * precisa de escrita nenhuma.
 */
export async function listSanctions(
  db: Kysely<Database>,
  realm: string,
  actorId: string,
): Promise<SanctionHistoryEntry[]> {
  const now = new Date();

  // `source_app` fora do filtro, deliberadamente: `uq_community_restriction_active`
  // também o deixa de fora porque sanção é comunitária, não por aplicativo
  // (T2.1f). Filtrar aqui esconderia do moderador do `site` a suspensão que o
  // moderador do `downloads` aplicou sobre o mesmo ator.
  const rows = await db
    .selectFrom("community_restriction")
    .select([
      "id",
      "scope",
      "level",
      "reason",
      "starts_at",
      "expires_at",
      "lifted_at",
    ])
    .where("realm", "=", realm)
    .where("actor_id", "=", actorId)
    .orderBy("starts_at", "desc")
    .execute();

  return rows.map((row) => ({
    id: row.id,
    scope: row.scope,
    level: row.level,
    reason: row.reason,
    starts_at: row.starts_at.toISOString(),
    expires_at: row.expires_at?.toISOString() ?? null,
    lifted_at: row.lifted_at?.toISOString() ?? null,
    active:
      row.lifted_at === null &&
      row.starts_at <= now &&
      (row.expires_at === null || row.expires_at > now),
  }));
}

function appealKeyLookup(input: FileAppealInput) {
  return {
    realm: input.realm,
    sourceApp: input.sourceApp,
    idempotencyKey: input.idempotencyKey,
    operation: APPEAL_OPERATION,
    actingUserId: input.actingUserId,
  };
}

function sanctionKeyLookup(input: ApplySanctionInput) {
  return {
    realm: input.realm,
    sourceApp: input.sourceApp,
    idempotencyKey: input.idempotencyKey,
    operation: SANCTION_OPERATION,
    actingUserId: input.moderatorUserId,
  };
}

async function replayAppealOrConflict(
  trx: Transaction<Database>,
  input: FileAppealInput,
  requestHash: string,
): Promise<FileAppealResult> {
  const stored = await replayIdempotentResponse(
    trx,
    appealKeyLookup(input),
    requestHash,
    filedAppealSchema,
  );

  if (!stored) {
    return { ok: false, code: "idempotency_key_reuse", status: 409 };
  }

  return { ok: true, appeal: stored, replayed: true };
}

async function replaySanctionOrConflict(
  trx: Transaction<Database>,
  input: ApplySanctionInput,
  requestHash: string,
): Promise<ApplySanctionResult> {
  const stored = await replayIdempotentResponse(
    trx,
    sanctionKeyLookup(input),
    requestHash,
    appliedSanctionSchema,
  );

  if (!stored) {
    return { ok: false, code: "idempotency_key_reuse", status: 409 };
  }

  return { ok: true, sanction: stored, replayed: true };
}
