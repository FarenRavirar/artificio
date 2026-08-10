import { createHash, randomUUID } from "node:crypto";
import type { Kysely, Transaction } from "kysely";
import { z } from "zod";
import type { Database } from "./db.js";
import { createActor, resolveActorId } from "./communityActor.js";
import {
  claimIdempotencyKey,
  isUniqueViolation,
  replayIdempotentResponse,
  storeIdempotentResponse,
} from "./communityIdempotency.js";

/**
 * T2.17 + T2.18 + T2.19 + T2.21 — denúncia, limiar de auto-ocultação, caso
 * episódico e as corridas entre eles (`contrato-http-v1.md` §9; decisões 32-35,
 * 37-42, 45, 53).
 *
 * ## Por que as quatro tasks são um módulo só
 *
 * Uma denúncia recebida faz quatro coisas **na mesma transação**: grava a linha
 * de evidência, garante que existe exatamente um caso aberto para o comentário,
 * conta as contas distintas ativas e — se chegou a cinco — oculta o comentário.
 * Separá-las daria funções que só funcionam chamadas juntas, na ordem certa, e
 * a primeira vez que alguém chamasse três das quatro o limiar ficaria fora da
 * transação que o produziu. É o mesmo raciocínio de `communityCommentVote.ts`
 * para voto, revisão e faixa de score.
 *
 * ## O limiar é contado, nunca acumulado
 *
 * `AUTO_HIDE_THRESHOLD` compara contra `COUNT(DISTINCT reporter_actor_id)` de
 * denúncias **ativas**, não contra um contador incrementado a cada denúncia.
 * A diferença aparece na retirada: um contador precisaria ser decrementado, e
 * decrementos concorrentes com inserções produzem exatamente o voto perdido que
 * a PR #251 corrigiu no score. Contagem derivada não tem esse estado para
 * corromper — o preço é uma agregação por denúncia, sobre um índice que já
 * existe (`idx_community_comment_report_case`).
 *
 * `DISTINCT` e não `COUNT(*)`: `uq_community_comment_report_active` já impede
 * duas denúncias ativas do mesmo ator, mas uma denúncia retirada e refeita
 * deixaria duas linhas do mesmo ator no histórico. Contar linhas faria a mesma
 * conta valer duas vezes, que é literalmente o que a decisão 34 proíbe.
 *
 * ## O lock que serializa a corrida da decisão 42
 *
 * A quinta denúncia e a retirada de uma das quatro anteriores disputam o mesmo
 * resultado. As duas tomam o lock do **caso** (`FOR UPDATE` sobre
 * `community_moderation_case`) antes de contar, então uma espera a outra e
 * ambas enxergam a foto definitiva. Sem isso, o banco roda em `read committed`
 * (medido em `artificio_auth`: `show default_transaction_isolation` devolve
 * `read committed`) e as duas leriam quatro ativas: a inserção ocultaria e a
 * retirada recalcularia para quatro sem desocultar — estado que nenhuma das
 * duas quis.
 *
 * A trava **não** é sobre o comentário: `communityCommentVote.ts` usa `FOR
 * SHARE` nele, e um `FOR UPDATE` aqui serializaria voto com denúncia sem
 * necessidade. O caso é o objeto que as duas operações realmente disputam.
 *
 * ## Nada aqui restaura
 *
 * Retirar a quinta denúncia **não** devolve o comentário a `visible` (decisão
 * 41). Auto-hide é entrada na fila de revisão, não uma medida proporcional ao
 * total corrente; deixar a visibilidade oscilar com o placar permitiria a um
 * grupo coordenado ocultar, ser notado, retirar e repetir. Só a moderação
 * restaura, por T2.22.
 */

/** Decisão 34. Cinco **contas distintas**, não cinco denúncias. */
export const AUTO_HIDE_THRESHOLD = 5;

/** Namespace da chave de idempotência desta operação (§6). */
const OPERATION = "comment.report";

/** Motivos do registro compartilhado (§9), na ordem da semente da migration. */
export const REPORT_REASON_CODES = [
  "malicious_link",
  "inappropriate_content",
  "spam_or_off_topic",
  "harassment_or_hate",
  "personal_data",
  "copyright_violation",
  "illegal_content",
  "other",
] as const;

export type ReportReasonCode = (typeof REPORT_REASON_CODES)[number];

export const DETAILS_MAX_LENGTH = 4000;

export interface CreateReportInput {
  realm: string;
  sourceApp: string;
  commentId: string;
  actingUserId: string;
  reasonCode: ReportReasonCode;
  details: string | null;
  idempotencyKey: string;
}

export type ReportRejectionCode =
  /** Alvo inexistente, ou de outro `realm`/`source_app` da credencial. */
  | "comment_not_found"
  /** Autor não denuncia o próprio comentário (decisão 33). */
  | "self_report"
  /** Já existe denúncia ativa deste ator neste comentário. */
  | "report_already_active"
  /** Motivo exige detalhes e vieram vazios. */
  | "details_required"
  /** Motivo proíbe detalhes e vieram preenchidos. */
  | "details_forbidden"
  /** Motivo inexistente ou desativado no registro compartilhado. */
  | "invalid_reason"
  /** Legado não recebe denúncia: não tem autor a responsabilizar. */
  | "legacy_immutable"
  | "idempotency_key_reuse";

/**
 * Resposta mínima ao denunciante (§9, decisão 44).
 *
 * **Não** carrega quantidade de denúncias, estado do caso, identidade de outro
 * denunciante nem se o comentário foi ocultado. Devolver o total transformaria
 * a rota num placar consultável: bastaria denunciar para descobrir quantas
 * outras pessoas denunciaram, que é informação de moderação.
 *
 * `state` distingue a denúncia recebida (`active`) da recebida-e-arquivada
 * contra versão já aprovada (`no_determination`, decisão 45) — o denunciante
 * precisa saber que foi registrada e que não haverá análise nova.
 */
export interface CreatedReport {
  id: string;
  comment_id: string;
  reason_code: string;
  state: string;
  created_at: string;
}

export type CreateReportResult =
  | { ok: true; report: CreatedReport; replayed: boolean }
  | { ok: false; code: ReportRejectionCode; status: number };

/**
 * Forma de `response_body` no replay. `jsonb` volta do banco como `unknown`
 * (`AGENTS.md` §Regras Gerais de Código), e um `as` aqui serviria ao consumidor
 * uma linha gravada por versão anterior do handler como se estivesse tipada.
 */
const createdReportSchema = z
  .object({
    id: z.string(),
    comment_id: z.string(),
    reason_code: z.string(),
    state: z.string(),
    created_at: z.string(),
  })
  .strict();

class ReportRejection extends Error {
  constructor(
    readonly code: ReportRejectionCode,
    readonly status: number,
  ) {
    super(code);
    this.name = "ReportRejection";
  }
}

function hashReportRequest(input: CreateReportInput): string {
  return createHash("sha256")
    .update(
      JSON.stringify([
        input.commentId,
        input.reasonCode,
        input.details,
        input.actingUserId,
      ]),
    )
    .digest("hex");
}

interface ReportableComment {
  id: string;
  community_actor_id: string | null;
  current_version_id: string | null;
  visibility_state: string;
  legacy_source: string | null;
}

/**
 * Carrega o comentário denunciado e aplica as recusas que não dependem de
 * contagem.
 *
 * `FOR SHARE` pelo mesmo motivo do voto: a denúncia não escreve nesta linha na
 * maioria dos casos — só a quinta escreve, e nesse caminho o `UPDATE`
 * condicionado adiante toma a trava exclusiva. Um `FOR UPDATE` aqui
 * serializaria toda denúncia com todo voto do mesmo comentário.
 */
async function loadReportableComment(
  trx: Transaction<Database>,
  input: CreateReportInput,
  reporterActorId: string | null,
): Promise<ReportableComment> {
  const comment = await trx
    .selectFrom("community_comment")
    .select([
      "id",
      "community_actor_id",
      "current_version_id",
      "visibility_state",
      "legacy_source",
    ])
    .where("id", "=", input.commentId)
    .where("realm", "=", input.realm)
    .where("source_app", "=", input.sourceApp)
    .forShare()
    .executeTakeFirst();

  if (!comment) {
    throw new ReportRejection("comment_not_found", 404);
  }

  // Legado antes de autoria, mesma ordem do voto: comentário importado tem ator
  // nulo, então a checagem de auto-denúncia não o alcançaria. Não há autor a
  // responsabilizar nem versão viva a fixar como evidência — a moderação de
  // conteúdo legado é a retirada direta pelo moderador (§5), não a fila.
  if (comment.legacy_source !== null) {
    throw new ReportRejection("legacy_immutable", 403);
  }

  // Exige terceiro (§9). Autor que quer tirar o próprio comentário do ar tem
  // `DELETE /comments/:id`; denunciar-se abriria caso de moderação sobre si
  // mesmo e distorceria a fila.
  if (reporterActorId !== null && comment.community_actor_id === reporterActorId) {
    throw new ReportRejection("self_report", 403);
  }

  // Versão corrente é a evidência (decisão 39). Comentário sem versão não
  // deveria existir — `community_comment_current_version_fk` a exige —, mas
  // denunciar sem fixar evidência produziria caso sem prova, então a ausência é
  // tratada como alvo inválido em vez de virar `NOT NULL` violation.
  if (comment.current_version_id === null) {
    throw new ReportRejection("comment_not_found", 404);
  }

  return comment;
}

/** Política de detalhes do motivo, lida do registro compartilhado. */
async function loadReasonPolicy(
  trx: Transaction<Database>,
  reasonCode: string,
): Promise<string> {
  const reason = await trx
    .selectFrom("community_report_reason")
    .select("details_policy")
    .where("target_type", "=", "comment")
    .where("code", "=", reasonCode)
    .where("active", "=", true)
    .executeTakeFirst();

  // Motivo desativado depois de a interface tê-lo exibido cai aqui. `422` e não
  // `500`: a requisição é bem-formada, a configuração é que mudou embaixo dela.
  if (!reason) {
    throw new ReportRejection("invalid_reason", 422);
  }

  return reason.details_policy;
}

// `resolveActorId` e `createActor` vêm de `communityActor.ts`. A disciplina
// aqui é a mesma do voto: o ator é resolvido antes das recusas mas **criado
// depois delas** — criá-lo antes gravaria identidade comunitária permanente por
// causa de um pedido recusado nas linhas seguintes.

/**
 * Versão já aprovada pela moderação e não reaberta (decisão 45).
 *
 * Denúncia contra ela é **recebida e auditada**, mas não abre caso, não conta
 * para o limiar e não muda visibilidade. É o que impede que cinco denúncias
 * posteriores desfaçam por volume uma decisão que a moderação já tomou —
 * exatamente o vetor de brigada que o limiar alto pretende resistir.
 */
async function isApprovedVersion(
  trx: Transaction<Database>,
  input: CreateReportInput,
  versionId: string,
): Promise<boolean> {
  const approval = await trx
    .selectFrom("community_comment_version_approval")
    .select("id")
    .where("realm", "=", input.realm)
    .where("source_app", "=", input.sourceApp)
    .where("comment_version_id", "=", versionId)
    .where("reopened_at", "is", null)
    .executeTakeFirst();

  return approval !== undefined;
}

/**
 * Caso aberto do comentário, travado — ou um caso novo, criado aqui.
 *
 * `uq_community_moderation_case_open` é índice parcial único sobre
 * `(realm, source_app, comment_id) WHERE status = 'open'`, então duas denúncias
 * concorrentes sobre o mesmo comentário não podem criar dois casos: a segunda
 * bate no conflito. O `ON CONFLICT ... DO NOTHING` seguido de releitura é o que
 * transforma essa colisão em convergência para o mesmo caso, em vez de `500`.
 *
 * O `FOR UPDATE` da releitura é o lock que serializa a corrida da decisão 42 —
 * quinta denúncia contra retirada. Ele é tomado **antes** de qualquer contagem.
 */
async function lockOrOpenCase(
  trx: Transaction<Database>,
  input: CreateReportInput,
): Promise<string> {
  const existing = await trx
    .selectFrom("community_moderation_case")
    .select("id")
    .where("realm", "=", input.realm)
    .where("source_app", "=", input.sourceApp)
    .where("comment_id", "=", input.commentId)
    .where("status", "=", "open")
    .forUpdate()
    .executeTakeFirst();

  if (existing) return existing.id;

  const caseId = randomUUID();
  const inserted = await trx
    .insertInto("community_moderation_case")
    .values({
      id: caseId,
      realm: input.realm,
      source_app: input.sourceApp,
      comment_id: input.commentId,
      status: "open",
    })
    // Conflito com o índice parcial: outra transação abriu o caso entre a
    // leitura acima e este `INSERT`. Não é erro — é a convergência que a
    // decisão 40 exige ("no máximo um caso aberto por comentário").
    .onConflict((oc) => oc.doNothing())
    .returning("id")
    .executeTakeFirst();

  if (inserted) return inserted.id;

  // Perdeu a corrida. A releitura com `FOR UPDATE` espera o commit do vencedor
  // e devolve o caso dele, com o lock nas mãos desta transação.
  const winner = await trx
    .selectFrom("community_moderation_case")
    .select("id")
    .where("realm", "=", input.realm)
    .where("source_app", "=", input.sourceApp)
    .where("comment_id", "=", input.commentId)
    .where("status", "=", "open")
    .forUpdate()
    .executeTakeFirstOrThrow();

  return winner.id;
}

/**
 * Contas distintas com denúncia ativa no caso.
 *
 * Lida **sempre depois** do `FOR UPDATE` do caso — a mesma ordem que a PR #251
 * fixou para a contagem de votos, e pelo mesmo motivo: em `read committed`, uma
 * contagem lida antes do lock enxerga uma foto que o vencedor da corrida já
 * invalidou.
 */
export async function countDistinctActiveReporters(
  trx: Transaction<Database>,
  realm: string,
  sourceApp: string,
  caseId: string,
): Promise<number> {
  const row = await trx
    .selectFrom("community_comment_report")
    .select((eb) => eb.fn.count<string>("reporter_actor_id").distinct().as("total"))
    .where("realm", "=", realm)
    .where("source_app", "=", sourceApp)
    .where("case_id", "=", caseId)
    .where("state", "=", "active")
    .executeTakeFirstOrThrow();

  // `COUNT` do PostgreSQL é `bigint` e chega como string no driver. `Number`
  // sem o parse explícito daria `NaN` na comparação com o limiar, e o auto-hide
  // simplesmente nunca dispararia — falha silenciosa, sem exceção.
  return Number(row.total);
}

/**
 * `POST /internal/v1/comments/:id/reports` (§9).
 *
 * Ordem interna: idempotência → recusas puras → ator → caso travado → denúncia →
 * contagem → auto-hide → auditoria. O lock do caso vem antes da contagem, e a
 * contagem antes do auto-hide; inverter qualquer um dos dois reintroduz a
 * corrida da decisão 42.
 */
export async function createReport(
  db: Kysely<Database>,
  input: CreateReportInput,
): Promise<CreateReportResult> {
  const requestHash = hashReportRequest(input);

  try {
    return await db.transaction().execute(async (trx) => {
      // Idempotência primeiro: um `SELECT` antes do `INSERT` deixaria janela
      // para dois pedidos idênticos passarem juntos. A retomada de chave
      // vencida vive em `claimIdempotencyKey`.
      const claimed = await claimIdempotencyKey(trx, {
        realm: input.realm,
        sourceApp: input.sourceApp,
        idempotencyKey: input.idempotencyKey,
        operation: OPERATION,
        actingUserId: input.actingUserId,
        requestHash,
        responseStatus: 201,
      });

      if (!claimed) {
        return await replayReportOrConflict(trx, input, requestHash);
      }

      const existingActorId = await resolveActorId(trx, input.actingUserId);
      const comment = await loadReportableComment(trx, input, existingActorId);

      // Política de detalhes validada aqui **e** por trigger. A duplicação é
      // deliberada: a trigger é a garantia, mas ela levanta exceção sem código e
      // viraria `500`; o contrato exige `422`/`details_required` legível.
      const policy = await loadReasonPolicy(trx, input.reasonCode);
      const details = input.details;

      if (policy === "required" && (details === null || details.length === 0)) {
        throw new ReportRejection("details_required", 422);
      }
      if (policy === "forbidden" && details !== null && details.length > 0) {
        throw new ReportRejection("details_forbidden", 422);
      }

      const versionId = comment.current_version_id as string;
      const actorId =
        // `createActor` e não `resolveOrCreateActor`: `existingActorId` já
        // provou que não há vínculo, e reler seria consulta redundante.
        existingActorId ?? (await createActor(trx, input.actingUserId));

      // Denúncia contra versão aprovada: recebida, auditada, arquivada
      // (decisão 45). Não abre caso, então nem chega ao lock nem à contagem.
      if (await isApprovedVersion(trx, input, versionId)) {
        return await recordApprovedVersionReport(
          trx,
          input,
          comment,
          versionId,
          actorId,
        );
      }

      const caseId = await lockOrOpenCase(trx, input);

      // O caminho normal é **o mesmo** que `recordApprovedVersionReport` usa
      // quando não acha o caso fechado correspondente. Estava duplicado aqui
      // linha a linha, e a cópia significava que uma correção na ordem
      // lock→contagem→auto-hide teria de ser aplicada duas vezes (achado de
      // review, PR #251).
      return await insertActiveReportForCase(
        trx,
        input,
        versionId,
        actorId,
        caseId,
        details,
      );
    });
  } catch (error) {
    if (error instanceof ReportRejection) {
      return { ok: false, code: error.code, status: error.status };
    }
    throw error;
  }
}

/**
 * Denúncia contra versão aprovada (decisão 45).
 *
 * Nasce já terminal em `no_determination`, com `resolution_reason`
 * `approved_version`. Precisa de `resolved_by_actor_id` porque
 * `community_comment_report_resolution_check` exige os três campos juntos em
 * qualquer estado não-`active` — e o resolvedor aqui é o moderador que aprovou a
 * versão, não o denunciante.
 *
 * `case_id` aponta para o caso **encerrado** que produziu a aprovação: a coluna
 * é `NOT NULL`, e inventar um caso aberto para arquivá-lo em seguida sujaria a
 * fila com um item que ninguém deve ver.
 */
async function recordApprovedVersionReport(
  trx: Transaction<Database>,
  input: CreateReportInput,
  comment: ReportableComment,
  versionId: string,
  actorId: string,
): Promise<CreateReportResult> {
  const approval = await trx
    .selectFrom("community_comment_version_approval")
    .select(["approved_by_actor_id"])
    .where("realm", "=", input.realm)
    .where("source_app", "=", input.sourceApp)
    .where("comment_version_id", "=", versionId)
    .where("reopened_at", "is", null)
    .executeTakeFirstOrThrow();

  const closedCase = await trx
    .selectFrom("community_moderation_case")
    .select("id")
    .where("realm", "=", input.realm)
    .where("source_app", "=", input.sourceApp)
    .where("comment_id", "=", input.commentId)
    .where("status", "=", "closed")
    .where("decision_version_id", "=", versionId)
    .orderBy("closed_at", "desc")
    .executeTakeFirst();

  // Aprovação sem caso fechado correspondente não deveria acontecer — T2.22 e
  // T2.24 sempre gravam os dois juntos. Se acontecer, tratar como versão não
  // aprovada é mais seguro que inventar vínculo: a denúncia segue o fluxo
  // normal e a moderação decide, em vez de ser arquivada sem análise.
  if (!closedCase) {
    const caseId = await lockOrOpenCase(trx, input);
    return await insertActiveReportForCase(
      trx,
      input,
      versionId,
      actorId,
      caseId,
      input.details,
    );
  }

  const reportId = randomUUID();
  const createdAt = new Date();

  try {
    await trx
      .insertInto("community_comment_report")
      .values({
        id: reportId,
        realm: input.realm,
        source_app: input.sourceApp,
        comment_id: input.commentId,
        reported_version_id: versionId,
        reporter_actor_id: actorId,
        case_id: closedCase.id,
        reason_code: input.reasonCode,
        details: input.details,
        state: "no_determination",
        resolved_at: createdAt,
        resolved_by_actor_id: approval.approved_by_actor_id,
        resolution_reason: "approved_version",
        created_at: createdAt,
      })
      .execute();
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ReportRejection("report_already_active", 409);
    }
    throw error;
  }

  await trx
    .insertInto("community_moderation_audit")
    .values({
      realm: input.realm,
      source_app: input.sourceApp,
      actor_id: actorId,
      action: "comment.report.approved_version",
      target_type: "comment_report",
      target_id: reportId,
      reason: "approved_version",
      metadata: {
        case_id: closedCase.id,
        comment_id: input.commentId,
        reported_version_id: versionId,
        reason_code: input.reasonCode,
      },
    })
    .execute();

  const report: CreatedReport = {
    id: reportId,
    comment_id: input.commentId,
    reason_code: input.reasonCode,
    state: "no_determination",
    created_at: createdAt.toISOString(),
  };

  await storeReportResponse(trx, input, report);
  return { ok: true as const, report, replayed: false };
}

/**
 * Caminho normal: insere a denúncia ativa, conta, aplica o limiar e audita.
 *
 * Único ponto onde a sequência lock→inserção→contagem→auto-hide existe. Tanto
 * `createReport` quanto o fallback de `recordApprovedVersionReport` chamam
 * daqui — antes o corpo estava duplicado nos dois, e corrigir a ordem exigiria
 * lembrar do segundo.
 *
 * `details` chega por parâmetro em vez de sair de `input.details`: quem chama já
 * validou a política do motivo, e reler o campo cru aqui reintroduziria a
 * chance de gravar sem passar por ela.
 */
async function insertActiveReportForCase(
  trx: Transaction<Database>,
  input: CreateReportInput,
  versionId: string,
  actorId: string,
  caseId: string,
  details: string | null,
): Promise<CreateReportResult> {
  const reportId = randomUUID();
  const createdAt = new Date();

  try {
    await trx
      .insertInto("community_comment_report")
      .values({
        id: reportId,
        realm: input.realm,
        source_app: input.sourceApp,
        comment_id: input.commentId,
        reported_version_id: versionId,
        reporter_actor_id: actorId,
        case_id: caseId,
        reason_code: input.reasonCode,
        details,
        state: "active",
        created_at: createdAt,
      })
      .execute();
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ReportRejection("report_already_active", 409);
    }
    throw error;
  }

  const distinctReporters = await countDistinctActiveReporters(
    trx,
    input.realm,
    input.sourceApp,
    caseId,
  );

  if (distinctReporters >= AUTO_HIDE_THRESHOLD) {
    await applyAutoHide(trx, input, caseId, distinctReporters);
  }

  await trx
    .insertInto("community_moderation_audit")
    .values({
      realm: input.realm,
      source_app: input.sourceApp,
      actor_id: actorId,
      action: "comment.report.created",
      target_type: "comment_report",
      target_id: reportId,
      reason: input.reasonCode,
      metadata: {
        case_id: caseId,
        comment_id: input.commentId,
        reported_version_id: versionId,
        distinct_reporters: distinctReporters,
        auto_hidden: distinctReporters >= AUTO_HIDE_THRESHOLD,
      },
    })
    .execute();

  const report: CreatedReport = {
    id: reportId,
    comment_id: input.commentId,
    reason_code: input.reasonCode,
    state: "active",
    created_at: createdAt.toISOString(),
  };

  await storeReportResponse(trx, input, report);
  return { ok: true as const, report, replayed: false };
}

/**
 * Auto-ocultação por limiar (T2.18, decisão 34).
 *
 * `WHERE visibility_state = 'visible'` é o que torna isto seguro de chamar em
 * qualquer caminho: tombstone do autor, remoção moderadora e um `pending_review_hidden`
 * anterior não são sobrescritos. Auto-hide **não é tombstone** — não escreve
 * `removed_at`, `removed_by_actor_id` nem `removed_reason`, e
 * `community_comment_removal_check` exige que esses três continuem nulos fora
 * dos estados de remoção.
 *
 * O que some para o público é corpo e score, e isso acontece na **leitura**
 * (`communityCommentRead.ts` anula os dois para qualquer estado diferente de
 * `visible`). Posição e descendentes permanecem: a conversa de terceiros não é
 * apagada porque cinco pessoas denunciaram o pai.
 */
async function applyAutoHide(
  trx: Transaction<Database>,
  input: CreateReportInput,
  caseId: string,
  distinctReporters: number,
): Promise<void> {
  const hidden = await trx
    .updateTable("community_comment")
    .set({ visibility_state: "pending_review_hidden" })
    .where("id", "=", input.commentId)
    .where("realm", "=", input.realm)
    .where("source_app", "=", input.sourceApp)
    .where("visibility_state", "=", "visible")
    .returning("id")
    .executeTakeFirst();

  // Zero linhas significa que o comentário já não estava visível. Não é erro e
  // não vira auditoria: registrar "ocultei" quando nada mudou faria o log de
  // moderação afirmar um efeito que não houve.
  if (!hidden) return;

  await trx
    .insertInto("community_moderation_audit")
    .values({
      realm: input.realm,
      source_app: input.sourceApp,
      // `null` de propósito: auto-hide **não é decisão de moderador** (decisão
      // 34). Atribuí-lo ao quinto denunciante faria a auditoria dizer que uma
      // pessoa ocultou o comentário, quando o que ocultou foi o limiar.
      actor_id: null,
      action: "comment.auto_hidden",
      target_type: "comment",
      target_id: input.commentId,
      reason: "report_threshold_reached",
      metadata: {
        case_id: caseId,
        distinct_reporters: distinctReporters,
        threshold: AUTO_HIDE_THRESHOLD,
      },
    })
    .execute();
}

export interface WithdrawReportInput {
  realm: string;
  sourceApp: string;
  reportId: string;
  actingUserId: string;
}

export type WithdrawRejectionCode =
  | "report_not_found"
  /** Depois do auto-hide a denúncia trava (decisão 42). */
  | "report_locked";

export type WithdrawReportResult =
  | { ok: true }
  | { ok: false; code: WithdrawRejectionCode; status: number };

/**
 * `DELETE /internal/v1/reports/:id` (§9, decisão 42).
 *
 * ## Retirada é transição de estado, nunca `DELETE`
 *
 * A linha permanece com `state = 'withdrawn'`: deixa de contar para o limiar e
 * **permanece na auditoria**. Apagá-la destruiria a evidência de que houve
 * denúncia — que é justamente o que sustenta o sinal de abuso da decisão 37
 * (volume de denúncias improcedentes do mesmo ator) e o que impede denunciar,
 * ver o efeito e sumir com o rastro.
 *
 * ## Por que o lock do caso vem antes de tudo
 *
 * Esta é a outra metade da corrida da decisão 42. Sem tomar o mesmo `FOR UPDATE`
 * que `createReport` toma, a retirada leria quatro ativas enquanto a quinta
 * denúncia commita, e as duas se declarariam vencedoras. Com o lock, quem chega
 * primeiro define o resultado: se a retirada vence, o limiar é recalculado e a
 * quinta ocultará mais tarde; se o auto-hide vence, a retirada é recusada.
 *
 * ## Não desoculta
 *
 * A retirada bem-sucedida abaixo do limiar não restaura nada, porque só é
 * permitida **antes** do auto-hide. Depois dele, o `409` é o comportamento — e
 * é o que impede o ciclo ocultar-retirar-repetir.
 */
export async function withdrawReport(
  db: Kysely<Database>,
  input: WithdrawReportInput,
): Promise<WithdrawReportResult> {
  return await db.transaction().execute(async (trx) => {
    const actorId = await resolveActorId(trx, input.actingUserId);

    // Sem ator não há denúncia própria a retirar. `404` uniforme: distinguir
    // "não existe" de "não é sua" diria a qualquer um se um id de denúncia é
    // válido, e denúncia alheia é dado de moderação.
    if (actorId === null) {
      return { ok: false as const, code: "report_not_found" as const, status: 404 };
    }

    const report = await trx
      .selectFrom("community_comment_report")
      .select(["id", "case_id", "comment_id", "state"])
      .where("id", "=", input.reportId)
      .where("realm", "=", input.realm)
      .where("source_app", "=", input.sourceApp)
      .where("reporter_actor_id", "=", actorId)
      .executeTakeFirst();

    if (!report || report.state !== "active") {
      return { ok: false as const, code: "report_not_found" as const, status: 404 };
    }

    // Lock do caso antes de checar a visibilidade: a mesma trava que a quinta
    // denúncia toma. Ver a nota de cabeçalho.
    await trx
      .selectFrom("community_moderation_case")
      .select("id")
      .where("id", "=", report.case_id)
      .where("realm", "=", input.realm)
      .where("source_app", "=", input.sourceApp)
      .forUpdate()
      .executeTakeFirst();

    const comment = await trx
      .selectFrom("community_comment")
      .select("visibility_state")
      .where("id", "=", report.comment_id)
      .where("realm", "=", input.realm)
      .where("source_app", "=", input.sourceApp)
      .executeTakeFirst();

    // Auto-hide já aconteceu (ou o moderador já removeu): a denúncia trava.
    // A checagem é sobre a visibilidade e não sobre a contagem porque é o
    // **efeito** que a decisão 42 protege — "só antes do auto-hide".
    if (comment && comment.visibility_state !== "visible") {
      return { ok: false as const, code: "report_locked" as const, status: 409 };
    }

    await trx
      .updateTable("community_comment_report")
      .set({
        state: "withdrawn",
        resolved_at: new Date(),
        // O próprio denunciante é quem "resolve" a retirada.
        // `community_comment_report_resolution_check` exige os três campos
        // juntos em qualquer estado terminal.
        resolved_by_actor_id: actorId,
        resolution_reason: "withdrawn_by_reporter",
      })
      .where("id", "=", report.id)
      .where("state", "=", "active")
      .execute();

    await trx
      .insertInto("community_moderation_audit")
      .values({
        realm: input.realm,
        source_app: input.sourceApp,
        actor_id: actorId,
        action: "comment.report.withdrawn",
        target_type: "comment_report",
        target_id: report.id,
        reason: "withdrawn_by_reporter",
        metadata: { case_id: report.case_id, comment_id: report.comment_id },
      })
      .execute();

    return { ok: true as const };
  });
}

function keyLookup(input: CreateReportInput) {
  return {
    realm: input.realm,
    sourceApp: input.sourceApp,
    idempotencyKey: input.idempotencyKey,
    operation: OPERATION,
  };
}

async function storeReportResponse(
  trx: Transaction<Database>,
  input: CreateReportInput,
  report: CreatedReport,
): Promise<void> {
  await storeIdempotentResponse(trx, keyLookup(input), report);
}

async function replayReportOrConflict(
  trx: Transaction<Database>,
  input: CreateReportInput,
  requestHash: string,
): Promise<CreateReportResult> {
  const stored = await replayIdempotentResponse(
    trx,
    keyLookup(input),
    requestHash,
    createdReportSchema,
  );

  // `null` cobre os três casos que §6 colapsa em `idempotency_key_reuse`:
  // registro ausente/vencido, payload diferente na mesma chave, e corpo com
  // forma desconhecida.
  if (!stored) {
    return { ok: false, code: "idempotency_key_reuse", status: 409 };
  }

  return { ok: true, report: stored, replayed: true };
}
