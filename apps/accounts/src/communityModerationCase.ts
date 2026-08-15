import { createHash, randomUUID } from "node:crypto";
import type { Kysely, Transaction } from "kysely";
import { z } from "zod";
import type { Database } from "./db.js";
import { resolveOrCreateActor, resolveUserIdOfActor } from "./communityActor.js";
import {
  claimIdempotencyKey,
  replayIdempotentResponse,
  storeIdempotentResponse,
} from "./communityIdempotency.js";

/**
 * T2.20 + T2.22 + T2.23 + T2.24 — decisão terminal do caso
 * (`contrato-http-v1.md` §10; decisões 36, 43, 44, 45, 46).
 *
 * ## Os três defeitos do `downloads` que T2.20 manda **não** reproduzir
 *
 * 1. **Check-before-transaction.** O fluxo local do `downloads` lê o estado,
 *    decide, e depois faz `UPDATE ... WHERE id = ?` sem condicionar à leitura.
 *    Dois moderadores decidindo junto passam os dois pela leitura, os dois
 *    escrevem, e o segundo sobrescreve o primeiro em silêncio — duas
 *    notificações, dois efeitos, nenhum erro. Aqui a transição é
 *    `UPDATE ... WHERE status = 'open' RETURNING`: **zero linhas** é o sinal de
 *    que outro venceu, e vira `409`/`case_already_resolved`. Um vencedor, uma
 *    notificação, conflito explícito para o segundo.
 * 2. **Auditoria em `console.log`.** Aqui é linha em `community_moderation_audit`,
 *    escrita na **mesma transação** do estado. A consequência é deliberada e
 *    contraintuitiva: se a transação reverte, a auditoria reverte junto — que é
 *    o correto, porque auditar uma decisão que não aconteceu é pior que não
 *    auditar. Auditoria que sobrevive ao rollback registraria ficção.
 * 3. **Orçamento de escrita nas rotas de leitura.** Tratado no roteador
 *    (`communityCommentRoutes.ts`), com bucket `read` nas rotas `GET`.
 *
 * ## Veredito é por denúncia, ação é por caso
 *
 * A interface pode oferecer "julgar todas como procedentes", mas o backend exige
 * o veredito de **cada** denúncia não retirada (decisão 43). É o que permite um
 * caso terminar com três `upheld` e dois `dismissed` — situação comum quando
 * cinco pessoas denunciam o mesmo comentário por motivos diferentes e só alguns
 * procedem. Um veredito único por caso apagaria essa distinção, e é ela que
 * alimenta o sinal de abuso da decisão 37.
 *
 * `withdrawn` fica **neutra**: não recebe veredito e não impede o fechamento.
 * Quem retirou saiu do caso.
 *
 * ## `no_change` não é "tornar visível"
 *
 * Decisão 46: `no_change` preserva a visibilidade **atual**, seja ela `visible`,
 * `author_removed` ou `pending_review_hidden`. O nome anterior era
 * `keep_visible` e induzia exatamente o erro contrário — moderador que arquiva
 * denúncia contra comentário que o autor já retirou não pretende republicá-lo.
 *
 * Consequência que o contrato fixa e que surpreende: `no_change` sobre um
 * comentário em `pending_review_hidden` o **deixa oculto**. Para desocultar é
 * preciso `restore`.
 */

/** Namespace da chave de idempotência desta operação (§6). */
const OPERATION = "moderation.case.resolution";

/** Veredito individual da denúncia (§10). `withdrawn` não é escolhível. */
export const REPORT_VERDICTS = ["upheld", "dismissed", "no_determination"] as const;
export type ReportVerdict = (typeof REPORT_VERDICTS)[number];

/** Ação única do caso (§10, decisão 46). */
export const CASE_ACTIONS = ["no_change", "restore", "remove"] as const;
export type CaseAction = (typeof CASE_ACTIONS)[number];

export interface ResolveCaseInput {
  realm: string;
  sourceApp: string;
  caseId: string;
  /** `users.id` do moderador, já validado por `requireModeratorRole`. */
  moderatorUserId: string;
  verdicts: ReadonlyArray<{ report_id: string; verdict: ReportVerdict }>;
  action: CaseAction;
  reason: string;
  idempotencyKey: string;
}

export type ResolveCaseRejectionCode =
  | "case_not_found"
  /** Outro moderador já fechou. Um vencedor, sempre (decisão 36b). */
  | "case_already_resolved"
  /** Falta veredito de alguma denúncia não retirada, ou sobra veredito. */
  | "incomplete_verdicts"
  /** Veredito para denúncia que não pertence ao caso. */
  | "unknown_report"
  | "idempotency_key_reuse";

export interface ResolvedCase {
  case_id: string;
  action: string;
  status: string;
  closed_at: string;
  verdict_count: number;
}

export type ResolveCaseResult =
  | { ok: true; resolution: ResolvedCase; replayed: boolean }
  | { ok: false; code: ResolveCaseRejectionCode; status: number };

const resolvedCaseSchema = z
  .object({
    case_id: z.string(),
    action: z.string(),
    status: z.string(),
    closed_at: z.string(),
    verdict_count: z.number(),
  })
  .strict();

class CaseRejection extends Error {
  constructor(
    readonly code: ResolveCaseRejectionCode,
    readonly status: number,
  ) {
    super(code);
    this.name = "CaseRejection";
  }
}

function hashResolveRequest(input: ResolveCaseInput): string {
  return createHash("sha256")
    .update(
      JSON.stringify([
        input.caseId,
        // Ordenado: a mesma decisão enviada com os vereditos em ordem diferente
        // é a mesma decisão. Sem a ordenação, um retry que reserializasse o
        // array viraria `409`/`idempotency_key_reuse` para o cliente que só
        // reenviou o que já mandou.
        // `.sort()` sem comparador é deliberado — ver a nota equivalente em
        // `communityModerationAppeal.ts`. Trocar por `localeCompare` (achado do
        // Sonar, PR #262, recusado com medição) tornaria a chave dependente do
        // locale do runtime e quebraria a idempotência que este bloco garante.
        [...input.verdicts]
          .map((v) => `${v.report_id}:${v.verdict}`)
          .sort(),
        input.action,
        input.reason,
        input.moderatorUserId,
      ]),
    )
    .digest("hex");
}

/**
 * Ator comunitário do moderador — `resolveOrCreateActor` de `communityActor.ts`.
 *
 * O alias existe pelo nome, não pelo corpo: aqui o ator é criado **sem recusa
 * prévia**, ao contrário do voto e da denúncia. Um moderador que nunca comentou
 * ainda precisa de ator, porque `closed_by_actor_id` e `resolved_by_actor_id`
 * são `NOT NULL` e referenciam `community_actor`; e a requisição já passou por
 * `requireModeratorRole`, então não há risco de gravar identidade por causa de
 * um pedido que será recusado por autorização.
 */
const resolveOrCreateModeratorActor = resolveOrCreateActor;

/**
 * `POST /internal/v1/moderation/cases/:id/resolution` (§10).
 *
 * Ordem: idempotência → lock do caso → conferência dos vereditos → transição
 * condicionada → vereditos → efeito na visibilidade → aprovação de versão →
 * notificações → auditoria. Tudo numa transação; a reversão leva junto os
 * recibos, que é o que a decisão 44 exige ("evento e recibos nascem na transação
 * da mudança de estado").
 */
export async function resolveCase(
  db: Kysely<Database>,
  input: ResolveCaseInput,
): Promise<ResolveCaseResult> {
  const requestHash = hashResolveRequest(input);

  try {
    return await db.transaction().execute(async (trx) => {
      const claimed = await claimIdempotencyKey(trx, {
        realm: input.realm,
        sourceApp: input.sourceApp,
        idempotencyKey: input.idempotencyKey,
        operation: OPERATION,
        actingUserId: input.moderatorUserId,
        requestHash,
        responseStatus: 200,
      });

      if (!claimed) {
        return await replayResolutionOrConflict(trx, input, requestHash);
      }

      // Lock do caso. Mesma trava que a denúncia e a retirada tomam — é ela que
      // impede um auto-hide commitar no meio do fechamento e deixar o caso
      // fechado sobre um comentário que acabou de ser ocultado por limiar.
      const moderationCase = await trx
        .selectFrom("community_moderation_case")
        .select(["id", "comment_id", "status"])
        .where("id", "=", input.caseId)
        .where("realm", "=", input.realm)
        .where("source_app", "=", input.sourceApp)
        .forUpdate()
        .executeTakeFirst();

      if (!moderationCase) {
        throw new CaseRejection("case_not_found", 404);
      }

      // Caso já fechado antes mesmo do lock: `409` explícito, nunca um segundo
      // efeito. É a leitura otimista; a condicionada abaixo é a garantia real.
      if (moderationCase.status !== "open") {
        throw new CaseRejection("case_already_resolved", 409);
      }

      const pending = await trx
        .selectFrom("community_comment_report")
        .select(["id", "reporter_actor_id"])
        .where("realm", "=", input.realm)
        .where("source_app", "=", input.sourceApp)
        .where("case_id", "=", input.caseId)
        .where("state", "=", "active")
        .execute();

      const pendingIds = new Set(pending.map((report) => report.id));
      const verdictIds = new Set(input.verdicts.map((v) => v.report_id));

      // Veredito para denúncia que não está ativa neste caso: `422`. Aceitar em
      // silêncio faria a interface achar que julgou algo que não julgou —
      // tipicamente uma denúncia retirada entre o carregamento da tela e o envio.
      for (const id of verdictIds) {
        if (!pendingIds.has(id)) {
          throw new CaseRejection("unknown_report", 422);
        }
      }

      // Caso não fecha com denúncia sem veredito (decisão 43). A conferência é
      // por conjunto e não por contagem: dois vereditos para a mesma denúncia
      // dariam `verdicts.length === pending.length` com uma denúncia órfã.
      if (verdictIds.size !== pendingIds.size) {
        throw new CaseRejection("incomplete_verdicts", 422);
      }

      const moderatorActorId = await resolveOrCreateModeratorActor(
        trx,
        input.moderatorUserId,
      );

      const comment = await trx
        .selectFrom("community_comment")
        .select([
          "id",
          "community_actor_id",
          "current_version_id",
          "visibility_state",
        ])
        .where("id", "=", moderationCase.comment_id)
        .where("realm", "=", input.realm)
        .where("source_app", "=", input.sourceApp)
        .forUpdate()
        .executeTakeFirstOrThrow();

      const closedAt = new Date();

      // A transição condicionada — o coração de T2.20(b). `WHERE status =
      // 'open'` mais `RETURNING`: zero linhas significa que outro moderador
      // fechou entre o lock e aqui. Não pode acontecer com o `FOR UPDATE` acima,
      // e é exatamente por isso que fica: a condição é a garantia que não depende
      // de o lock ter sido tomado corretamente por toda versão futura do código.
      const closed = await trx
        .updateTable("community_moderation_case")
        .set({
          status: "closed",
          terminal_action: input.action,
          decision_version_id: comment.current_version_id,
          closed_at: closedAt,
          closed_by_actor_id: moderatorActorId,
          decision_reason: input.reason,
        })
        .where("id", "=", input.caseId)
        .where("realm", "=", input.realm)
        .where("source_app", "=", input.sourceApp)
        .where("status", "=", "open")
        .returning("id")
        .executeTakeFirst();

      if (!closed) {
        throw new CaseRejection("case_already_resolved", 409);
      }

      // Um `UPDATE` por **veredito distinto**, não por denúncia. O corpo aceita
      // até 500 vereditos, e o laço anterior fazia 500 idas ao banco **com o
      // caso e o comentário travados** — a janela em que qualquer denúncia nova
      // no mesmo comentário espera. Agrupados, são no máximo três instruções,
      // uma por valor de `REPORT_VERDICTS` (achado de review, PR #251).
      const porVeredito = new Map<ReportVerdict, string[]>();
      for (const verdict of input.verdicts) {
        const ids = porVeredito.get(verdict.verdict) ?? [];
        ids.push(verdict.report_id);
        porVeredito.set(verdict.verdict, ids);
      }

      for (const [veredito, ids] of porVeredito) {
        await trx
          .updateTable("community_comment_report")
          .set({
            state: veredito,
            resolved_at: closedAt,
            resolved_by_actor_id: moderatorActorId,
            resolution_reason: input.reason,
          })
          .where("id", "in", ids)
          .where("realm", "=", input.realm)
          .where("source_app", "=", input.sourceApp)
          // `state = 'active'` também aqui: `guard_community_comment_report_update`
          // recusa rejulgar denúncia terminal, e a condição transforma essa
          // recusa em zero linhas em vez de exceção sem código.
          .where("state", "=", "active")
          .execute();
      }

      await applyTerminalAction(trx, input, comment, moderatorActorId, closedAt);

      // Aprovação de versão (T2.24, decisão 45). Nasce quando a decisão declara
      // que **o conteúdo revisado está aprovado**: `no_change` sobre conteúdo
      // visível, ou `restore`. `remove` não aprova nada, e `no_change` sobre
      // tombstone tampouco — não houve juízo sobre o texto.
      const approvesVersion =
        input.action === "restore" ||
        (input.action === "no_change" && comment.visibility_state === "visible");

      if (approvesVersion) {
        await approveVersion(
          trx,
          input,
          comment.current_version_id,
          moderatorActorId,
        );
      }

      await notifyResolution(
        trx,
        input,
        moderationCase.comment_id,
        comment.community_actor_id,
        pending,
        moderatorActorId,
      );

      await trx
        .insertInto("community_moderation_audit")
        .values({
          realm: input.realm,
          source_app: input.sourceApp,
          actor_id: moderatorActorId,
          action: "moderation.case.resolved",
          target_type: "moderation_case",
          target_id: input.caseId,
          reason: input.reason,
          metadata: {
            comment_id: moderationCase.comment_id,
            terminal_action: input.action,
            verdicts: input.verdicts.map((v) => ({
              report_id: v.report_id,
              verdict: v.verdict,
            })),
            approved_version_id: approvesVersion ? comment.current_version_id : null,
          },
        })
        .execute();

      const resolution: ResolvedCase = {
        case_id: input.caseId,
        action: input.action,
        status: "closed",
        closed_at: closedAt.toISOString(),
        verdict_count: input.verdicts.length,
      };

      await storeIdempotentResponse(trx, keyLookup(input), resolution);

      return { ok: true as const, resolution, replayed: false };
    });
  } catch (error) {
    if (error instanceof CaseRejection) {
      return { ok: false, code: error.code, status: error.status };
    }
    throw error;
  }
}

interface DecidedComment {
  id: string;
  community_actor_id: string | null;
  current_version_id: string;
  visibility_state: string;
}

/**
 * Efeito da ação na visibilidade (decisão 46).
 *
 * - `no_change`: **nada**. Nem um `UPDATE` que reescreve o mesmo valor — ele
 *   apareceria no `edited_at`/trilha como se algo tivesse mudado.
 * - `remove`: tombstone moderador. `community_comment_removal_check` exige as
 *   três colunas de remoção preenchidas junto com o estado, então elas vão no
 *   mesmo `SET`.
 * - `restore`: volta a `visible` e **limpa** as três. Só a partir de
 *   `pending_review_hidden` ou `moderator_removed` — restaurar um
 *   `author_removed` republicaria conteúdo que o autor decidiu tirar do ar, e a
 *   decisão 17 diz que a auto-retirada é irreversível pela moderação.
 */
async function applyTerminalAction(
  trx: Transaction<Database>,
  input: ResolveCaseInput,
  comment: DecidedComment,
  moderatorActorId: string,
  closedAt: Date,
): Promise<void> {
  if (input.action === "no_change") return;

  if (input.action === "remove") {
    // Já removido pelo autor continua removido pelo autor: sobrescrever o
    // tombstone trocaria a autoria da retirada e faria a interface dizer que a
    // moderação removeu o que o próprio autor tirou. O caso fecha do mesmo
    // jeito — o veredito das denúncias é que carrega a decisão.
    if (comment.visibility_state === "author_removed") return;
    if (comment.visibility_state === "moderator_removed") return;

    await trx
      .updateTable("community_comment")
      .set({
        visibility_state: "moderator_removed",
        removed_at: closedAt,
        removed_by_actor_id: moderatorActorId,
        removed_reason: input.reason,
      })
      .where("id", "=", comment.id)
      .where("realm", "=", input.realm)
      .where("source_app", "=", input.sourceApp)
      .execute();
    return;
  }

  // `restore`
  if (
    comment.visibility_state !== "pending_review_hidden" &&
    comment.visibility_state !== "moderator_removed"
  ) {
    return;
  }

  await trx
    .updateTable("community_comment")
    .set({
      visibility_state: "visible",
      removed_at: null,
      removed_by_actor_id: null,
      removed_reason: null,
    })
    .where("id", "=", comment.id)
    .where("realm", "=", input.realm)
    .where("source_app", "=", input.sourceApp)
    .execute();
}

/**
 * Aprova a versão revisada (T2.24, decisão 45).
 *
 * `uq_community_comment_version_approval_active` permite uma aprovação ativa por
 * versão, então uma segunda decisão sobre a mesma versão não duplica linha. O
 * `ON CONFLICT DO NOTHING` transforma isso em no-op em vez de `500`: a versão já
 * está aprovada, que é o estado desejado.
 */
async function approveVersion(
  trx: Transaction<Database>,
  input: ResolveCaseInput,
  versionId: string,
  moderatorActorId: string,
): Promise<void> {
  await trx
    .insertInto("community_comment_version_approval")
    .values({
      realm: input.realm,
      source_app: input.sourceApp,
      comment_version_id: versionId,
      approved_by_actor_id: moderatorActorId,
      approval_reason: input.reason,
    })
    .onConflict((oc) => oc.doNothing())
    .execute();
}

/**
 * Evento e recibos da decisão (T2.23, decisão 44).
 *
 * ## O que o `snapshot` **não** carrega, e por que a ausência é o requisito
 *
 * Sem identidade de denunciante, sem nota interna, sem o motivo textual que o
 * moderador escreveu, sem quais outros vereditos saíram. Só `action` e o
 * veredito **do próprio destinatário**. O snapshot vai para `notification_event`,
 * que a Fase 3 vai ler para montar texto — qualquer campo reservado gravado aqui
 * vazaria lá, e migrar dado já gravado é caro.
 *
 * Autor e denunciantes recebem eventos **separados** exatamente por isso: um
 * evento único com recibos para os dois lados teria que carregar o superconjunto
 * dos campos, e o recibo não filtra conteúdo — ele só endereça.
 *
 * ## Um recibo por destinatário, sem duplicata
 *
 * `Set` sobre os `user_id`, e o moderador que decidiu sai da lista: notificar
 * quem executou a ação treina o usuário a ignorar o sino. A segunda barreira é a
 * unicidade `(realm, source_app, event_id, recipient_user_id)` no banco.
 */
async function notifyResolution(
  trx: Transaction<Database>,
  input: ResolveCaseInput,
  commentId: string,
  authorActorId: string | null,
  reports: ReadonlyArray<{ id: string; reporter_actor_id: string }>,
  moderatorActorId: string,
): Promise<void> {
  const verdictByReport = new Map(
    input.verdicts.map((v) => [v.report_id, v.verdict] as const),
  );

  // Autor: recebe a ação, nunca o veredito individual de terceiro.
  if (authorActorId !== null && input.action !== "no_change") {
    const authorUserId = await resolveUserIdOfActor(trx, authorActorId);
    if (authorUserId !== null && authorActorId !== moderatorActorId) {
      await emitEvent(
        trx,
        input,
        commentId,
        "comment.moderation.decision.author",
        { action: input.action },
        [authorUserId],
        moderatorActorId,
      );
    }
  }

  // Denunciantes: cada um recebe **o próprio** veredito, traduzido para o
  // vocabulário mínimo do contrato. `upheld` vira `action_taken`, `dismissed`
  // vira `not_upheld`. Mandar o veredito bruto revelaria o vocabulário interno da
  // moderação sem ganho para quem denunciou.
  //
  // Agrupados por `outcome`, não um evento por denunciante: com 500 denúncias o
  // laço anterior fazia ~2000 idas ao banco dentro da transação que segura o
  // caso e o comentário travados (achado de review, PR #251).
  //
  // Agrupar é seguro **porque o snapshot é idêntico** para quem compartilha o
  // resultado — ele carrega só `outcome` e `comment_id`, nunca identidade de
  // terceiro (decisão 44), e o recibo endereça sem revelar os outros
  // destinatários. Vereditos diferentes continuam em eventos separados, que é o
  // que impede alguém deduzir o veredito alheio.
  const porResultado = new Map<string, string[]>();

  for (const report of reports) {
    const verdict = verdictByReport.get(report.id);
    if (!verdict) continue;
    if (report.reporter_actor_id === moderatorActorId) continue;

    const reporterUserId = await resolveUserIdOfActor(trx, report.reporter_actor_id);
    if (reporterUserId === null) continue;

    const outcome =
      verdict === "upheld"
        ? "action_taken"
        : verdict === "dismissed"
          ? "not_upheld"
          : "no_determination";

    const destinatarios = porResultado.get(outcome) ?? [];
    destinatarios.push(reporterUserId);
    porResultado.set(outcome, destinatarios);
  }

  for (const [outcome, destinatarios] of porResultado) {
    await emitEvent(
      trx,
      input,
      commentId,
      "comment.moderation.decision.reporter",
      { outcome },
      destinatarios,
      moderatorActorId,
    );
  }
}

async function emitEvent(
  trx: Transaction<Database>,
  input: ResolveCaseInput,
  commentId: string,
  eventType: string,
  snapshot: Record<string, unknown>,
  recipients: readonly string[],
  moderatorActorId: string,
): Promise<void> {
  const unique = [...new Set(recipients)];

  // Destinatário sem conta viva não recebe recibo, e a FK falharia se
  // tentássemos: `findIneligibleRecipients` em `communityCommentWrite.ts` resolve
  // o mesmo problema na criação. Aqui os ids já vieram de `users` por
  // `resolveUserIdOfActor`, então a lista está filtrada na origem.
  const eventRowId = randomUUID();

  await trx
    .insertInto("notification_event")
    .values({
      id: eventRowId,
      event_id: randomUUID(),
      realm: input.realm,
      source_app: input.sourceApp,
      event_type: eventType,
      event_version: 1,
      subject_type: "comment",
      subject_id: commentId,
      actor_id: moderatorActorId,
      // Caminho canônico do comentário não é conhecido aqui — a decisão parte do
      // caso, não da árvore. String vazia violaria a expectativa de quem monta
      // link na Fase 3; o id do comentário no snapshot é o que permite resolver
      // o caminho na leitura.
      canonical_path: `/comments/${commentId}`,
      snapshot: { ...snapshot, comment_id: commentId },
    })
    .execute();

  if (unique.length > 0) {
    await trx
      .insertInto("notification_receipt")
      .values(
        unique.map((recipientUserId) => ({
          realm: input.realm,
          source_app: input.sourceApp,
          event_id: eventRowId,
          recipient_user_id: recipientUserId,
          read_at: null,
        })),
      )
      .execute();
  }
}

function keyLookup(input: ResolveCaseInput) {
  return {
    realm: input.realm,
    sourceApp: input.sourceApp,
    idempotencyKey: input.idempotencyKey,
    operation: OPERATION,
    actingUserId: input.moderatorUserId,
  };
}

async function replayResolutionOrConflict(
  trx: Transaction<Database>,
  input: ResolveCaseInput,
  requestHash: string,
): Promise<ResolveCaseResult> {
  const stored = await replayIdempotentResponse(
    trx,
    keyLookup(input),
    requestHash,
    resolvedCaseSchema,
  );

  if (!stored) {
    return { ok: false, code: "idempotency_key_reuse", status: 409 };
  }

  return { ok: true, resolution: stored, replayed: true };
}

export interface ReopenCaseInput {
  realm: string;
  sourceApp: string;
  caseId: string;
  moderatorUserId: string;
  reason: string;
}

export type ReopenRejectionCode =
  | "case_not_found"
  /** Não há aprovação ativa a reabrir. */
  | "approval_not_found";

export type ReopenCaseResult =
  | { ok: true }
  | { ok: false; code: ReopenRejectionCode; status: number };

/**
 * `POST /internal/v1/moderation/cases/:id/reopen` (T2.24, decisão 45).
 *
 * ## O que reabre é a **versão**, não o caso
 *
 * O caso encerrado permanece encerrado — decisão 40 é explícita: "denúncia
 * posterior abre caso novo, não reabre o encerrado". O que esta rota desfaz é a
 * **aprovação da versão**, e o efeito é que denúncias futuras contra ela voltam
 * a abrir caso e a contar para o limiar, em vez de serem arquivadas como
 * `no_determination`/`approved_version`.
 *
 * Sem isto, uma aprovação equivocada seria permanente para aquela versão: só
 * uma edição do autor criaria versão nova denunciável, e o autor de um conteúdo
 * aprovado por engano não tem motivo para editar.
 */
export async function reopenCaseApproval(
  db: Kysely<Database>,
  input: ReopenCaseInput,
): Promise<ReopenCaseResult> {
  return await db.transaction().execute(async (trx) => {
    const moderationCase = await trx
      .selectFrom("community_moderation_case")
      .select(["id", "comment_id", "decision_version_id"])
      .where("id", "=", input.caseId)
      .where("realm", "=", input.realm)
      .where("source_app", "=", input.sourceApp)
      .executeTakeFirst();

    if (!moderationCase || moderationCase.decision_version_id === null) {
      return { ok: false as const, code: "case_not_found" as const, status: 404 };
    }

    const moderatorActorId = await resolveOrCreateModeratorActor(
      trx,
      input.moderatorUserId,
    );

    const reopened = await trx
      .updateTable("community_comment_version_approval")
      .set({
        reopened_at: new Date(),
        reopened_by_actor_id: moderatorActorId,
        reopened_reason: input.reason,
      })
      .where("realm", "=", input.realm)
      .where("source_app", "=", input.sourceApp)
      .where("comment_version_id", "=", moderationCase.decision_version_id)
      .where("reopened_at", "is", null)
      .returning("id")
      .executeTakeFirst();

    if (!reopened) {
      return {
        ok: false as const,
        code: "approval_not_found" as const,
        status: 404,
      };
    }

    await trx
      .insertInto("community_moderation_audit")
      .values({
        realm: input.realm,
        source_app: input.sourceApp,
        actor_id: moderatorActorId,
        action: "moderation.approval.reopened",
        target_type: "comment_version_approval",
        target_id: reopened.id,
        reason: input.reason,
        metadata: {
          case_id: input.caseId,
          comment_id: moderationCase.comment_id,
          comment_version_id: moderationCase.decision_version_id,
        },
      })
      .execute();

    return { ok: true as const };
  });
}

export interface DirectModerationInput {
  realm: string;
  sourceApp: string;
  commentId: string;
  moderatorUserId: string;
  reason: string;
}

export type DirectModerationRejectionCode =
  | "comment_not_found"
  /** Auto-retirada do autor não é revertida pela moderação (decisão 17). */
  | "comment_removed_by_author"
  /** Já está no estado pedido. */
  | "no_change";

export type DirectModerationResult =
  | { ok: true }
  | { ok: false; code: DirectModerationRejectionCode; status: number };

/**
 * `POST /internal/v1/comments/:id/removal` (§5) — tombstone moderador direto.
 *
 * ## Existe separada da decisão de caso, e a separação é o ponto
 *
 * Nem toda remoção nasce de denúncia. Conteúdo que a moderação encontra
 * navegando — ou que o legado importou — precisa sair do ar sem que alguém
 * tenha que denunciar primeiro para abrir um caso. Forçar tudo pelo fluxo de
 * caso criaria denúncias fictícias do próprio moderador, e a fila deixaria de
 * medir o que a comunidade reporta.
 *
 * O caso aberto, se houver, **não** é fechado aqui: a remoção é sobre o
 * conteúdo, o caso é sobre as denúncias, e elas ainda precisam de veredito
 * individual (decisão 43).
 */
export async function removeCommentByModerator(
  db: Kysely<Database>,
  input: DirectModerationInput,
): Promise<DirectModerationResult> {
  return await db.transaction().execute(async (trx) => {
    const comment = await trx
      .selectFrom("community_comment")
      .select(["id", "visibility_state"])
      .where("id", "=", input.commentId)
      .where("realm", "=", input.realm)
      .where("source_app", "=", input.sourceApp)
      .forUpdate()
      .executeTakeFirst();

    if (!comment) {
      return { ok: false as const, code: "comment_not_found" as const, status: 404 };
    }

    if (comment.visibility_state === "author_removed") {
      return {
        ok: false as const,
        code: "comment_removed_by_author" as const,
        status: 409,
      };
    }

    if (comment.visibility_state === "moderator_removed") {
      return { ok: false as const, code: "no_change" as const, status: 409 };
    }

    const moderatorActorId = await resolveOrCreateModeratorActor(
      trx,
      input.moderatorUserId,
    );
    const removedAt = new Date();

    await trx
      .updateTable("community_comment")
      .set({
        visibility_state: "moderator_removed",
        removed_at: removedAt,
        removed_by_actor_id: moderatorActorId,
        removed_reason: input.reason,
      })
      .where("id", "=", comment.id)
      .where("realm", "=", input.realm)
      .where("source_app", "=", input.sourceApp)
      .execute();

    await notifyAuthorOfDirectAction(
      trx,
      input,
      comment.id,
      moderatorActorId,
      "removed",
    );

    await trx
      .insertInto("community_moderation_audit")
      .values({
        realm: input.realm,
        source_app: input.sourceApp,
        actor_id: moderatorActorId,
        action: "comment.removed_by_moderator",
        target_type: "comment",
        target_id: comment.id,
        reason: input.reason,
        metadata: { previous_state: comment.visibility_state },
      })
      .execute();

    return { ok: true as const };
  });
}

/**
 * `POST /internal/v1/comments/:id/restore` (§5).
 *
 * Limpa as três colunas de tombstone e devolve `visible`. Recusa
 * `author_removed` pelo mesmo motivo de `applyTerminalAction`: a auto-retirada é
 * irreversível para a moderação (decisão 17), e restaurá-la republicaria o texto
 * de alguém contra a vontade dela.
 */
export async function restoreCommentByModerator(
  db: Kysely<Database>,
  input: DirectModerationInput,
): Promise<DirectModerationResult> {
  return await db.transaction().execute(async (trx) => {
    const comment = await trx
      .selectFrom("community_comment")
      .select(["id", "visibility_state"])
      .where("id", "=", input.commentId)
      .where("realm", "=", input.realm)
      .where("source_app", "=", input.sourceApp)
      .forUpdate()
      .executeTakeFirst();

    if (!comment) {
      return { ok: false as const, code: "comment_not_found" as const, status: 404 };
    }

    if (comment.visibility_state === "author_removed") {
      return {
        ok: false as const,
        code: "comment_removed_by_author" as const,
        status: 409,
      };
    }

    if (comment.visibility_state === "visible") {
      return { ok: false as const, code: "no_change" as const, status: 409 };
    }

    const moderatorActorId = await resolveOrCreateModeratorActor(
      trx,
      input.moderatorUserId,
    );

    await trx
      .updateTable("community_comment")
      .set({
        visibility_state: "visible",
        removed_at: null,
        removed_by_actor_id: null,
        removed_reason: null,
      })
      .where("id", "=", comment.id)
      .where("realm", "=", input.realm)
      .where("source_app", "=", input.sourceApp)
      .execute();

    await notifyAuthorOfDirectAction(
      trx,
      input,
      comment.id,
      moderatorActorId,
      "restored",
    );

    await trx
      .insertInto("community_moderation_audit")
      .values({
        realm: input.realm,
        source_app: input.sourceApp,
        actor_id: moderatorActorId,
        action: "comment.restored_by_moderator",
        target_type: "comment",
        target_id: comment.id,
        reason: input.reason,
        metadata: { previous_state: comment.visibility_state },
      })
      .execute();

    return { ok: true as const };
  });
}

/**
 * Avisa o autor da remoção/restauração direta (§5, decisão 44).
 *
 * Carrega o `outcome` e nada mais — sem o motivo textual que o moderador
 * escreveu, que é nota interna. A categoria pública aplicável é derivada na
 * leitura, na Fase 3, a partir do tipo do evento.
 */
async function notifyAuthorOfDirectAction(
  trx: Transaction<Database>,
  input: DirectModerationInput,
  commentId: string,
  moderatorActorId: string,
  outcome: "removed" | "restored",
): Promise<void> {
  const comment = await trx
    .selectFrom("community_comment")
    .select("community_actor_id")
    .where("id", "=", commentId)
    .where("realm", "=", input.realm)
    .where("source_app", "=", input.sourceApp)
    .executeTakeFirst();

  if (!comment?.community_actor_id) return;
  if (comment.community_actor_id === moderatorActorId) return;

  const authorUserId = await resolveUserIdOfActor(trx, comment.community_actor_id);
  if (authorUserId === null) return;

  const eventRowId = randomUUID();
  await trx
    .insertInto("notification_event")
    .values({
      id: eventRowId,
      event_id: randomUUID(),
      realm: input.realm,
      source_app: input.sourceApp,
      event_type: "comment.moderation.direct_action",
      event_version: 1,
      subject_type: "comment",
      subject_id: commentId,
      actor_id: moderatorActorId,
      canonical_path: `/comments/${commentId}`,
      snapshot: { comment_id: commentId, outcome },
    })
    .execute();

  await trx
    .insertInto("notification_receipt")
    .values({
      realm: input.realm,
      source_app: input.sourceApp,
      event_id: eventRowId,
      recipient_user_id: authorUserId,
      read_at: null,
    })
    .execute();
}

export interface ChangePriorityInput {
  realm: string;
  sourceApp: string;
  caseId: string;
  moderatorUserId: string;
  priority: number;
  reason: string;
}

export type ChangePriorityResult =
  | { ok: true }
  | { ok: false; code: "case_not_found"; status: number };

/**
 * `PATCH /internal/v1/moderation/cases/:id/priority` (§10, decisão 38).
 *
 * ## A prioridade não é coluna, e isso é deliberado
 *
 * `community_moderation_case` não tem `priority`. A prioridade exibida na fila é
 * **derivada** — o mínimo de `community_report_reason.priority` entre as
 * denúncias ativas (0 é a mais urgente). Guardá-la desnormalizada exigiria
 * recalculá-la a cada denúncia nova e a cada retirada, com o mesmo risco de
 * divergência que o contador de limiar teria.
 *
 * A reclassificação manual do moderador é registrada **em auditoria**, que é
 * onde a decisão 38 a coloca ("reclassifica prioridade com motivo"), e a fila a
 * lê de lá. É por isso que esta função não faz `UPDATE` em lugar nenhum: o
 * registro **é** o efeito.
 *
 * Categoria e prioridade nunca ocultam sozinhas (decisão 38) — o único auto-hide
 * da fase é o limiar de cinco contas.
 */
export async function changeCasePriority(
  db: Kysely<Database>,
  input: ChangePriorityInput,
): Promise<ChangePriorityResult> {
  return await db.transaction().execute(async (trx) => {
    const moderationCase = await trx
      .selectFrom("community_moderation_case")
      .select(["id", "comment_id"])
      .where("id", "=", input.caseId)
      .where("realm", "=", input.realm)
      .where("source_app", "=", input.sourceApp)
      .where("status", "=", "open")
      .executeTakeFirst();

    if (!moderationCase) {
      return { ok: false as const, code: "case_not_found" as const, status: 404 };
    }

    const moderatorActorId = await resolveOrCreateModeratorActor(
      trx,
      input.moderatorUserId,
    );

    await trx
      .insertInto("community_moderation_audit")
      .values({
        realm: input.realm,
        source_app: input.sourceApp,
        actor_id: moderatorActorId,
        action: "moderation.case.priority_changed",
        target_type: "moderation_case",
        target_id: input.caseId,
        reason: input.reason,
        metadata: {
          comment_id: moderationCase.comment_id,
          priority: input.priority,
        },
      })
      .execute();

    return { ok: true as const };
  });
}
