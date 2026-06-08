// Repo de pages institucionais (autoria nativa, spec 011).
import { getDb } from "../connection.js";

export type PageStatus = "draft" | "publish" | "trash" | "archived";

export interface PageWrite {
  title: string;
  slug: string;
  excerpt: string;
  content_html: string;
  block_doc: unknown | null;
  status: PageStatus;
  published_at: string | null;
  seo_title: string | null;
  seo_description: string | null;
  canonical: string | null;
  og_title: string | null;
  og_description: string | null;
  og_image: string | null;
  noindex: boolean;
  author_id: string | null;
}

export interface PageListItem {
  id: number; slug: string; title: string; status: PageStatus; updated_at: string | null;
}
export interface PageFull extends PageWrite { id: number; updated_at: string | null; created_at: string | null; }

const j = (v: unknown): string | null => (v == null ? null : JSON.stringify(v));

export async function pageSlugExists(slug: string, exceptId?: number): Promise<boolean> {
  const db = await getDb();
  const r = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM pages WHERE slug = $1 AND ($2::bigint IS NULL OR id <> $2)`,
    [slug, exceptId ?? null],
  );
  return (r.rows[0]?.n ?? 0) > 0;
}

export async function listPages(opts: { status?: PageStatus; q?: string } = {}): Promise<PageListItem[]> {
  const db = await getDb();
  const where: string[] = [];
  const params: unknown[] = [];
  if (opts.status) { params.push(opts.status); where.push(`status = $${params.length}`); }
  else { where.push(`status <> 'trash'`); }
  if (opts.q) { params.push(`%${opts.q}%`); where.push(`title ILIKE $${params.length}`); }
  const r = await db.query<PageListItem>(
    `SELECT id, slug, title, status, updated_at FROM pages WHERE ${where.join(" AND ")} ORDER BY slug`,
    params,
  );
  return r.rows;
}

export async function getPage(id: number): Promise<PageFull | null> {
  const db = await getDb();
  const r = await db.query<Record<string, unknown>>(`SELECT * FROM pages WHERE id = $1`, [id]);
  return (r.rows[0] as unknown as PageFull) ?? null;
}

export async function createPage(p: PageWrite): Promise<number> {
  const db = await getDb();
  const r = await db.query<{ id: number }>(
    `INSERT INTO pages
      (slug, title, excerpt, content_html, block_doc, status, published_at, seo_title, seo_description,
       canonical, og_title, og_description, og_image, noindex, author_id, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15, now())
     RETURNING id`,
    [p.slug, p.title, p.excerpt, p.content_html, j(p.block_doc), p.status, p.published_at, p.seo_title,
     p.seo_description, p.canonical, p.og_title, p.og_description, p.og_image, p.noindex, p.author_id],
  );
  return Number(r.rows[0]!.id);
}

export async function updatePage(id: number, p: PageWrite): Promise<void> {
  const db = await getDb();
  await db.query(
    `UPDATE pages SET
       slug=$2, title=$3, excerpt=$4, content_html=$5, block_doc=$6, status=$7, published_at=$8,
       seo_title=$9, seo_description=$10, canonical=$11, og_title=$12, og_description=$13, og_image=$14,
       noindex=$15, updated_at=now()
     WHERE id=$1`,
    [id, p.slug, p.title, p.excerpt, p.content_html, j(p.block_doc), p.status, p.published_at,
     p.seo_title, p.seo_description, p.canonical, p.og_title, p.og_description, p.og_image, p.noindex],
  );
}

export async function setPageStatus(id: number, status: PageStatus): Promise<boolean> {
  const db = await getDb();
  const r = await db.query<{ id: number }>(
    `UPDATE pages SET status=$2, updated_at=now(),
       published_at = CASE WHEN $2 = 'publish' AND published_at IS NULL THEN now() ELSE published_at END
     WHERE id=$1 RETURNING id`,
    [id, status],
  );
  return r.rows.length > 0;
}

/** Status atual da page (p/ confirmar delete permanente). */
export async function getPageStatus(id: number): Promise<PageStatus | null> {
  const db = await getDb();
  const r = await db.query<{ status: PageStatus }>(`SELECT status FROM pages WHERE id=$1`, [id]);
  return r.rows[0]?.status ?? null;
}

/** Apaga permanentemente a page. NÃO remove redirects (histórico de slug preservado, R4c). */
export async function deletePage(id: number): Promise<boolean> {
  const db = await getDb();
  const r = await db.query<{ id: number }>(`DELETE FROM pages WHERE id = $1 RETURNING id`, [id]);
  return r.rows.length > 0;
}

export async function getPageSlug(id: number): Promise<string | null> {
  const db = await getDb();
  const r = await db.query<{ slug: string }>(`SELECT slug FROM pages WHERE id=$1`, [id]);
  return r.rows[0]?.slug ?? null;
}
