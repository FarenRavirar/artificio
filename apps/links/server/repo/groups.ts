// Queries Kysely da tabela `groups`. Espelha o estilo de apps/mesas/.../tableRepository.ts.
import { sql } from "kysely";
import { db } from "../../db/index.js";
import type {
  Group,
  GroupCategory,
  GroupKind,
  GroupSource,
  GroupStatus,
  GroupTag,
  GroupUpdate,
  GroupReport,
  ReportReason,
  ReportStatus,
} from "../../db/types.js";

export interface ListFilter {
  status?: GroupStatus;
  source?: GroupSource;
  category?: GroupCategory;
}

/** Listagem ordenada (categoria → sort_order → nome). Filtros opcionais. */
export async function listGroups(filter: ListFilter = {}): Promise<Group[]> {
  let q = db.selectFrom("groups").selectAll();
  if (filter.status) q = q.where("status", "=", filter.status);
  if (filter.source) q = q.where("source", "=", filter.source);
  if (filter.category) q = q.where("category", "=", filter.category);
  return q.orderBy("category", "asc").orderBy("sort_order", "asc").orderBy("name", "asc").execute();
}

export async function findById(id: string): Promise<Group | undefined> {
  return db.selectFrom("groups").selectAll().where("id", "=", id).executeTakeFirst();
}

export async function findBySlug(slug: string): Promise<Group | undefined> {
  return db.selectFrom("groups").selectAll().where("slug", "=", slug).executeTakeFirst();
}

/** Gera slug único a partir do base (sufixa -2, -3… se já existir noutro grupo). */
export async function ensureUniqueSlug(base: string, exceptId?: string): Promise<string> {
  const root = base || "grupo";
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? root : `${root}-${i + 1}`;
    const hit = await db.selectFrom("groups").select(["id"]).where("slug", "=", candidate).executeTakeFirst();
    if (!hit || hit.id === exceptId) return candidate;
  }
  return `${root}-${Date.now()}`;
}

export interface SuggestInput {
  name: string;
  description: string | null;
  invite_url: string;
  kind: GroupKind;
  submitted_by: string;
  submitted_email: string | null;
  submitted_name: string | null;
}

/**
 * Sugestão da comunidade → INSERT status=pending source=community.
 * ON CONFLICT(invite_url): não recria; devolve a linha existente (evita flood/duplicata).
 */
export async function insertSuggestion(input: SuggestInput): Promise<{ id: string; created: boolean }> {
  // Atômico contra corrida: ON CONFLICT(invite_url) DO NOTHING. Se nada inseriu (já existe),
  // devolve a linha existente. Sem janela select-then-insert.
  const row = await db
    .insertInto("groups")
    .values({
      name: input.name,
      description: input.description,
      invite_url: input.invite_url,
      kind: input.kind,
      category: "comunidade",
      status: "pending",
      source: "community",
      submitted_by: input.submitted_by,
      submitted_email: input.submitted_email,
      submitted_name: input.submitted_name,
    })
    .onConflict((oc) => oc.column("invite_url").doNothing())
    .returning("id")
    .executeTakeFirst();
  if (row) return { id: row.id, created: true };

  const existing = await db
    .selectFrom("groups")
    .select(["id"])
    .where("invite_url", "=", input.invite_url)
    .executeTakeFirstOrThrow();
  return { id: existing.id, created: false };
}

export interface AdminPatch {
  name?: string;
  slug?: string;
  tags?: string[];
  description?: string | null;
  rules?: string | null;
  category?: GroupCategory;
  is_adult?: boolean;
  approved_at?: string | null;
  invite_url?: string;
  kind?: GroupKind;
  status?: GroupStatus;
  logo_url?: string | null;
  logo_public_id?: string | null;
  sort_order?: number;
}

export async function updateGroup(id: string, patch: AdminPatch): Promise<Group | undefined> {
  const values: GroupUpdate = { ...patch, updated_at: sql`now()` as unknown as undefined };
  return db.updateTable("groups").set(values).where("id", "=", id).returningAll().executeTakeFirst();
}

export async function deleteGroup(id: string): Promise<Group | undefined> {
  return db.deleteFrom("groups").where("id", "=", id).returningAll().executeTakeFirst();
}

// ===== Vocabulário de tags (group_tags) — gerido pelo admin =====

export async function listTags(): Promise<GroupTag[]> {
  return db.selectFrom("group_tags").selectAll().orderBy("sort_order", "asc").orderBy("label", "asc").execute();
}

/** Filtra/dedupe slugs de tag contra o vocabulário existente; corta em 3. */
export async function sanitizeTagSlugs(slugs: string[]): Promise<string[]> {
  const known = new Set((await listTags()).map((t) => t.slug));
  const out: string[] = [];
  for (const s of slugs) {
    if (known.has(s) && !out.includes(s)) out.push(s);
    if (out.length === 3) break;
  }
  return out;
}

export async function createTag(label: string, slug: string, sortOrder = 0): Promise<GroupTag> {
  return db
    .insertInto("group_tags")
    .values({ label, slug, sort_order: sortOrder })
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function updateTag(
  id: string,
  patch: { label?: string; slug?: string; sort_order?: number },
): Promise<GroupTag | undefined> {
  return db
    .updateTable("group_tags")
    .set({ ...patch, updated_at: sql`now()` as unknown as undefined })
    .where("id", "=", id)
    .returningAll()
    .executeTakeFirst();
}

/** Remove a tag do vocabulário E retira o slug de todos os grupos (array_remove). */
export async function deleteTag(id: string): Promise<GroupTag | undefined> {
  return db.transaction().execute(async (trx) => {
    const removed = await trx.deleteFrom("group_tags").where("id", "=", id).returningAll().executeTakeFirst();
    if (!removed) return removed;
    await trx
      .updateTable("groups")
      .set({ tags: sql`array_remove(tags, ${removed.slug})` })
      .where(sql<boolean>`${removed.slug} = ANY(tags)`)
      .execute();
    return removed;
  });
}

// ===== Reports — denúncias da comunidade (spec 038 R6) =====

export interface InsertReportInput {
  group_id: string;
  reason: ReportReason;
  note?: string | null;
  reporter_email?: string | null;
}

export async function insertReport(input: InsertReportInput): Promise<GroupReport> {
  return db
    .insertInto("group_reports")
    .values({
      group_id: input.group_id,
      reason: input.reason,
      note: input.note ?? null,
      reporter_email: input.reporter_email ?? null,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
}

export interface ListReportsFilter {
  status?: ReportStatus;
}

export async function listReports(filter: ListReportsFilter = {}): Promise<GroupReport[]> {
  let q = db.selectFrom("group_reports").selectAll();
  if (filter.status) q = q.where("status", "=", filter.status);
  return q.orderBy("created_at", "desc").execute();
}

export async function updateReport(id: string, patch: { status: ReportStatus }): Promise<GroupReport | undefined> {
  return db
    .updateTable("group_reports")
    .set(patch)
    .where("id", "=", id)
    .returningAll()
    .executeTakeFirst();
}
