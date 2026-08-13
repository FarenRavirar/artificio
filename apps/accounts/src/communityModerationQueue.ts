import type { Kysely } from "kysely";
import { sql } from "kysely";
import type { Database } from "./db.js";
import {
  COMMUNITY_NEW_ACCOUNT_MAX_AGE_MS,
  COMMUNITY_NEW_ACCOUNT_MIN_COMMENT_COUNT,
} from "./communityNewAccount.js";

/**
 * T2.19 + T2.20(a) — fila agregada, log e leitura de versões
 * (`contrato-http-v1.md` §5, §10; decisões 38, 39, 40, 53).
 *
 * ## Item agregado, evidências individuais
 *
 * A fila mostra **um item por caso**, com quantidade, categorias e prioridade
 * máxima. As denúncias continuam linhas separadas e imutáveis — a agregação é da
 * apresentação, não do armazenamento. Guardar o agregado desnormalizado exigiria
 * atualizá-lo a cada denúncia e a cada retirada, e é a fonte clássica de
 * divergência entre o que a fila mostra e o que o caso contém.
 *
 * ## Prioridade é derivada, e menor é mais urgente
 *
 * `community_report_reason.priority` vai de 0 (mais urgente:
 * `malicious_link`, `personal_data`, `illegal_content`) a 3. A prioridade do
 * caso é o **mínimo** entre as denúncias ativas — "prioridade máxima" no
 * contrato significa a mais urgente, não o maior número. Confundir os dois
 * enterraria link malicioso embaixo de spam na ordenação.
 *
 * ## `realm` sai da credencial, nunca do filtro do cliente
 *
 * Requisito 27a: beta nunca aparece misturado com produção. O parâmetro `realm`
 * do contrato é limitado ao da credencial, e é o chamador da função que passa o
 * valor já resolvido — aqui não há como pedir outro.
 *
 * ## Identidade do denunciante só enquanto o vínculo existir
 *
 * `LEFT JOIN` em `community_actor_account_link` e `users`: conta excluída perde
 * o vínculo por `CASCADE` (decisão 53) e o denunciante aparece como ator opaco,
 * sem nome. A denúncia e a evidência permanecem — é o que "após expurgo,
 * denúncia/evidência permanecem, sem reidentificação" quer dizer. Um `INNER
 * JOIN` faria a denúncia **sumir** da fila junto com a conta, apagando prova de
 * um caso que segue aberto.
 */

export interface QueueFilters {
  realm: string;
  sourceApp?: string;
  status?: "open" | "closed";
  /** Prioridade máxima aceita (mais urgente = número menor). */
  maxPriority?: number;
  limit: number;
  /** `(opened_at, id)` da última linha da página anterior. */
  cursor?: { openedAt: Date; id: string };
}

export interface QueueItem {
  case_id: string;
  comment_id: string;
  source_app: string;
  status: string;
  opened_at: string;
  active_report_count: number;
  reason_codes: string[];
  priority: number | null;
  comment_visibility_state: string;
}

export interface NewAccountCommentCandidate {
  comment_id: string;
  source_app: string;
  community_actor_id: string;
  created_at: string;
  comment_visibility_state: string;
  author_comment_count: number;
  new_account_reasons: Array<"account_age" | "comment_count">;
}

/**
 * Comentários publicados por contas novas que ainda não possuem caso.
 *
 * A coleção é separada de `items`: um candidato não ganha `case_id`, denúncia
 * ou evidência artificial só para caber no formato da fila existente.
 */
export async function readNewAccountCommentCandidates(
  db: Kysely<Database>,
  filters: Pick<QueueFilters, "realm" | "sourceApp" | "limit">,
  now = new Date(),
): Promise<NewAccountCommentCandidate[]> {
  const youngAccountCutoff = new Date(now.getTime() - COMMUNITY_NEW_ACCOUNT_MAX_AGE_MS);

  let query = db
    .selectFrom("community_comment as c")
    .innerJoin("community_actor_account_link as l", "l.actor_id", "c.community_actor_id")
    .innerJoin("users as u", "u.id", "l.user_id")
    .select((eb) => [
      "c.id as comment_id",
      "c.source_app",
      "l.actor_id as community_actor_id",
      "c.created_at",
      "c.visibility_state as comment_visibility_state",
      "u.created_at as account_created_at",
      eb
        .selectFrom("community_comment as authored")
        .select((inner) => inner.fn.countAll<string>().as("total"))
        .whereRef("authored.community_actor_id", "=", "c.community_actor_id")
        .as("author_comment_count"),
    ])
    .where("c.realm", "=", filters.realm)
    .where("c.visibility_state", "=", "visible")
    .where(({ not, exists, selectFrom }) =>
      not(
        exists(
          selectFrom("community_moderation_case as mc")
            .select("mc.id")
            .whereRef("mc.realm", "=", "c.realm")
            .whereRef("mc.source_app", "=", "c.source_app")
            .whereRef("mc.comment_id", "=", "c.id"),
        ),
      ),
    )
    .where(
      sql<boolean>`(
        u.created_at > ${youngAccountCutoff}
        or (
          select count(*)
          from community_comment authored
          where authored.community_actor_id = c.community_actor_id
        ) < ${COMMUNITY_NEW_ACCOUNT_MIN_COMMENT_COUNT}
      )`,
    )
    .orderBy("c.created_at", "desc")
    .orderBy("c.id", "desc")
    .limit(filters.limit);

  if (filters.sourceApp) {
    query = query.where("c.source_app", "=", filters.sourceApp);
  }

  const rows = await query.execute();

  return rows.map((row) => {
    const authorCommentCount = Number(row.author_comment_count ?? 0);
    const reasons: NewAccountCommentCandidate["new_account_reasons"] = [];
    if (row.account_created_at > youngAccountCutoff) reasons.push("account_age");
    if (authorCommentCount < COMMUNITY_NEW_ACCOUNT_MIN_COMMENT_COUNT) {
      reasons.push("comment_count");
    }

    return {
      comment_id: row.comment_id,
      source_app: row.source_app,
      community_actor_id: row.community_actor_id,
      created_at: row.created_at.toISOString(),
      comment_visibility_state: row.comment_visibility_state,
      author_comment_count: authorCommentCount,
      new_account_reasons: reasons,
    };
  });
}

/**
 * `GET /internal/v1/comments/moderation-queue` (§5).
 *
 * Cursor por `(opened_at, id)` e não por `OFFSET`: a fila muda embaixo do
 * moderador enquanto ele pagina — denúncia nova abre caso, decisão fecha outro —
 * e `OFFSET` faria itens pularem ou repetirem. O par ordenado é estável porque
 * `opened_at` nunca muda depois de gravado.
 */
export async function readModerationQueue(
  db: Kysely<Database>,
  filters: QueueFilters,
): Promise<QueueItem[]> {
  let query = db
    .selectFrom("community_moderation_case as mc")
    .innerJoin("community_comment as c", (join) =>
      join
        .onRef("c.realm", "=", "mc.realm")
        .onRef("c.source_app", "=", "mc.source_app")
        .onRef("c.id", "=", "mc.comment_id"),
    )
    .select((eb) => [
      "mc.id as case_id",
      "mc.comment_id",
      "mc.source_app",
      "mc.status",
      "mc.opened_at",
      "c.visibility_state as comment_visibility_state",
      // Subconsultas correlacionadas em vez de `GROUP BY`: agrupar exigiria
      // listar toda coluna projetada no `GROUP BY`, e a agregação precisa contar
      // **só as ativas** enquanto o item exibe o caso inteiro. Cada subconsulta
      // usa `idx_community_comment_report_case`, que cobre exatamente
      // `(realm, source_app, case_id, state, ...)`.
      eb
        .selectFrom("community_comment_report as r")
        .select((inner) => inner.fn.countAll<string>().as("total"))
        .whereRef("r.case_id", "=", "mc.id")
        .whereRef("r.realm", "=", "mc.realm")
        .whereRef("r.source_app", "=", "mc.source_app")
        .where("r.state", "=", "active")
        .as("active_report_count"),
      eb
        .selectFrom("community_comment_report as r")
        .select(
          sql<string[]>`array_agg(distinct r.reason_code order by r.reason_code)`.as(
            "codes",
          ),
        )
        .whereRef("r.case_id", "=", "mc.id")
        .whereRef("r.realm", "=", "mc.realm")
        .whereRef("r.source_app", "=", "mc.source_app")
        .where("r.state", "=", "active")
        .as("reason_codes"),
      eb
        .selectFrom("community_comment_report as r")
        .innerJoin("community_report_reason as rr", (join) =>
          join
            .on("rr.target_type", "=", "comment")
            .onRef("rr.code", "=", "r.reason_code"),
        )
        .select(sql<number | null>`min(rr.priority)`.as("priority"))
        .whereRef("r.case_id", "=", "mc.id")
        .whereRef("r.realm", "=", "mc.realm")
        .whereRef("r.source_app", "=", "mc.source_app")
        .where("r.state", "=", "active")
        .as("priority"),
    ])
    .where("mc.realm", "=", filters.realm)
    .orderBy("mc.opened_at", "desc")
    .orderBy("mc.id", "desc")
    .limit(filters.limit);

  if (filters.sourceApp) {
    query = query.where("mc.source_app", "=", filters.sourceApp);
  }

  if (filters.status) {
    query = query.where("mc.status", "=", filters.status);
  }

  if (filters.cursor) {
    const { openedAt, id } = filters.cursor;
    // Comparação lexicográfica do par, não `opened_at < x OR (= x AND id < y)`
    // escrito à mão: a forma em tupla é a que o PostgreSQL sabe casar com o
    // índice composto, e a manual erra na fronteira quando dois casos abrem no
    // mesmo instante.
    query = query.where(
      sql<boolean>`(mc.opened_at, mc.id) < (${openedAt}, ${id}::uuid)`,
    );
  }

  if (filters.maxPriority !== undefined) {
    // Filtro no SQL, **antes** do `LIMIT`, e não sobre o array devolvido.
    //
    // Filtrar em JS depois do `LIMIT` fazia a página vir com menos itens que o
    // pedido sem que isso significasse fim da fila: o banco entregava 20 casos,
    // o filtro descartava metade, e o moderador via 10 concluindo que acabou —
    // enquanto os outros 10 que casavam com o filtro estavam na página seguinte,
    // inalcançáveis porque a UI para de paginar quando a página vem curta.
    // Achado de review, PR #251.
    //
    // A subconsulta é repetida em vez de referenciada pelo alias: o `SELECT` do
    // Postgres não expõe alias de projeção ao próprio `WHERE` (avaliado antes),
    // então `WHERE priority <= $1` daria `column "priority" does not exist`.
    //
    // `IS NULL` passa: caso sem denúncia ativa não tem prioridade derivada, e
    // escondê-lo do filtro sumiria com casos legítimos que aguardam decisão.
    const maxPriority = filters.maxPriority;
    query = query.where(
      sql<boolean>`coalesce((
        select min(rr.priority)
        from community_comment_report r
        join community_report_reason rr
          on rr.target_type = 'comment' and rr.code = r.reason_code
        where r.case_id = mc.id
          and r.realm = mc.realm
          and r.source_app = mc.source_app
          and r.state = 'active'
      ), -1) <= ${maxPriority}`,
    );
  }

  const rows = await query.execute();

  return rows.map((row) => ({
    case_id: row.case_id,
    comment_id: row.comment_id,
    source_app: row.source_app,
    status: row.status,
    opened_at: row.opened_at.toISOString(),
    // `COUNT` é `bigint` e o driver o entrega como **string**. Sem o `Number`,
    // o campo sairia no JSON como `"12"` e a interface ordenaria por volume
    // lexicograficamente — `"9"` acima de `"12"`.
    active_report_count: Number(row.active_report_count ?? 0),
    reason_codes: Array.isArray(row.reason_codes) ? row.reason_codes : [],
    priority: row.priority === null ? null : Number(row.priority),
    comment_visibility_state: row.comment_visibility_state,
  }));
}

export interface CaseDetailReport {
  id: string;
  reason_code: string;
  details: string | null;
  state: string;
  created_at: string;
  reported_version_id: string;
  reporter_actor_id: string;
  /** `null` quando o vínculo já foi desfeito (decisão 53). */
  reporter_display_name: string | null;
}

export interface CaseDetail {
  case_id: string;
  comment_id: string;
  /** `null` só em dado legado/inconsistente; a UI de sanção deve falhar fechado. */
  reported_author_actor_id: string | null;
  status: string;
  terminal_action: string | null;
  opened_at: string;
  closed_at: string | null;
  decision_reason: string | null;
  reports: CaseDetailReport[];
}

/**
 * `GET /internal/v1/moderation/cases/:id` (§10) — **só moderação**.
 *
 * Carrega denúncias individuais com identidade resolvida, que é o único lugar
 * do sistema onde a identidade do denunciante aparece. Público, autor denunciado
 * e outros denunciantes nunca recebem nenhum destes campos (decisão 32).
 */
export async function readCaseDetail(
  db: Kysely<Database>,
  realm: string,
  sourceApp: string,
  caseId: string,
): Promise<CaseDetail | null> {
  const moderationCase = await db
    .selectFrom("community_moderation_case as mc")
    .innerJoin("community_comment as c", (join) =>
      join
        .onRef("c.realm", "=", "mc.realm")
        .onRef("c.source_app", "=", "mc.source_app")
        .onRef("c.id", "=", "mc.comment_id"),
    )
    .select([
      "mc.id",
      "mc.comment_id",
      "mc.status",
      "mc.terminal_action",
      "mc.opened_at",
      "mc.closed_at",
      "mc.decision_reason",
      "c.community_actor_id as reported_author_actor_id",
    ])
    .where("mc.id", "=", caseId)
    .where("mc.realm", "=", realm)
    .where("mc.source_app", "=", sourceApp)
    .executeTakeFirst();

  if (!moderationCase) return null;

  const reports = await db
    .selectFrom("community_comment_report as r")
    // `LEFT JOIN` nos dois: conta excluída não faz a denúncia sumir. Ver a nota
    // de cabeçalho — `INNER JOIN` apagaria evidência de caso aberto.
    .leftJoin("community_actor_account_link as l", "l.actor_id", "r.reporter_actor_id")
    .leftJoin("users as u", "u.id", "l.user_id")
    .select([
      "r.id",
      "r.reason_code",
      "r.details",
      "r.state",
      "r.created_at",
      "r.reported_version_id",
      "r.reporter_actor_id",
      "u.name as reporter_display_name",
    ])
    .where("r.realm", "=", realm)
    .where("r.source_app", "=", sourceApp)
    .where("r.case_id", "=", caseId)
    .orderBy("r.created_at", "asc")
    .orderBy("r.id", "asc")
    .execute();

  return {
    case_id: moderationCase.id,
    comment_id: moderationCase.comment_id,
    reported_author_actor_id: moderationCase.reported_author_actor_id,
    status: moderationCase.status,
    terminal_action: moderationCase.terminal_action,
    opened_at: moderationCase.opened_at.toISOString(),
    closed_at: moderationCase.closed_at?.toISOString() ?? null,
    decision_reason: moderationCase.decision_reason,
    reports: reports.map((row) => ({
      id: row.id,
      reason_code: row.reason_code,
      details: row.details,
      state: row.state,
      created_at: row.created_at.toISOString(),
      reported_version_id: row.reported_version_id,
      reporter_actor_id: row.reporter_actor_id,
      reporter_display_name: row.reporter_display_name,
    })),
  };
}

export interface ModerationLogEntry {
  id: string;
  action: string;
  target_type: string;
  target_id: string;
  reason: string;
  metadata: unknown;
  occurred_at: string;
  actor_id: string | null;
}

/**
 * `GET /internal/v1/comments/moderation-log` (§5).
 *
 * Lê `community_moderation_audit`, que é append-only por trigger. Inclui as
 * linhas de `actor_id` nulo — o auto-hide por limiar, que não tem moderador
 * responsável e cuja ausência de autor é informação, não lacuna.
 */
export async function readModerationLog(
  db: Kysely<Database>,
  realm: string,
  sourceApp: string,
  limit: number,
  cursor?: { occurredAt: Date; id: string },
): Promise<ModerationLogEntry[]> {
  let query = db
    .selectFrom("community_moderation_audit")
    .select([
      "id",
      "action",
      "target_type",
      "target_id",
      "reason",
      "metadata",
      "occurred_at",
      "actor_id",
    ])
    .where("realm", "=", realm)
    .where("source_app", "=", sourceApp)
    .orderBy("occurred_at", "desc")
    .orderBy("id", "desc")
    .limit(limit);

  if (cursor) {
    query = query.where(
      sql<boolean>`(occurred_at, id) < (${cursor.occurredAt}, ${cursor.id}::uuid)`,
    );
  }

  const rows = await query.execute();

  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    target_type: row.target_type,
    target_id: row.target_id,
    reason: row.reason,
    metadata: row.metadata,
    occurred_at: row.occurred_at.toISOString(),
    actor_id: row.actor_id,
  }));
}

export interface CommentVersionEntry {
  id: string;
  body_markdown: string | null;
  legacy_content_html: string | null;
  created_at: string;
  redacted_at: string | null;
  is_current: boolean;
  is_reported: boolean;
}

/**
 * `GET /internal/v1/comments/:id/versions` (§5) — **restrito à moderação**.
 *
 * Devolve o histórico com a versão corrente e as denunciadas marcadas. O diff
 * não é computado aqui: mandar dois corpos e deixar a interface diferenciá-los
 * evita fixar um formato de diff no contrato interno, e o corpo já trafega.
 *
 * `is_reported` vem de `community_comment_report.reported_version_id`, que é o
 * que a decisão 39 fixa atomicamente — é por isso que editar depois de
 * denunciado não faz a evidência sumir da lista.
 */
export async function readCommentVersions(
  db: Kysely<Database>,
  realm: string,
  sourceApp: string,
  commentId: string,
): Promise<CommentVersionEntry[]> {
  const comment = await db
    .selectFrom("community_comment")
    .select("current_version_id")
    .where("id", "=", commentId)
    .where("realm", "=", realm)
    .where("source_app", "=", sourceApp)
    .executeTakeFirst();

  if (!comment) return [];

  const reported = await db
    .selectFrom("community_comment_report")
    .select("reported_version_id")
    .distinct()
    .where("realm", "=", realm)
    .where("source_app", "=", sourceApp)
    .where("comment_id", "=", commentId)
    .execute();

  const reportedIds = new Set(reported.map((row) => row.reported_version_id));

  const versions = await db
    .selectFrom("community_comment_version")
    .select([
      "id",
      "body_markdown",
      "legacy_content_html",
      "created_at",
      "redacted_at",
    ])
    .where("realm", "=", realm)
    .where("source_app", "=", sourceApp)
    .where("comment_id", "=", commentId)
    .orderBy("created_at", "asc")
    .orderBy("id", "asc")
    .execute();

  return versions.map((row) => ({
    id: row.id,
    body_markdown: row.body_markdown,
    legacy_content_html: row.legacy_content_html,
    created_at: row.created_at.toISOString(),
    redacted_at: row.redacted_at?.toISOString() ?? null,
    is_current: row.id === comment.current_version_id,
    is_reported: reportedIds.has(row.id),
  }));
}
