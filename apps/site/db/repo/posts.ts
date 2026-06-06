// Repo de posts (autoria nativa, spec 011). SQL parametrizado sobre o adapter dual (pglite/pg).
// (Kysely canon adiado — atrito de dialect pglite; mesmo padrão query() do resto do site.)
import { getDb } from "../connection.js";

export type PostStatus = "draft" | "pending" | "publish" | "scheduled" | "private" | "trash" | "archived";

export interface PostWrite {
  title: string;
  slug: string;
  excerpt: string;
  content_html: string;
  block_doc: unknown | null;
  toc: unknown;
  status: PostStatus;
  published_at: string | null;
  reading_time: number;
  featured_url: string | null;
  seo_title: string | null;
  seo_description: string | null;
  canonical: string | null;
  og_title: string | null;
  og_description: string | null;
  og_image: string | null;
  twitter_card: string;
  noindex: boolean;
  author_id: string | null;
}

export interface PostListItem {
  id: number; slug: string; title: string; status: PostStatus;
  published_at: string | null; updated_at: string | null; author_id: string | null;
}

export interface PostFull extends PostWrite {
  id: number; updated_at: string | null; created_at: string | null;
  cats: number[]; tags: number[];
}

const j = (v: unknown): string | null => (v == null ? null : JSON.stringify(v));

export async function slugExists(slug: string, exceptId?: number): Promise<boolean> {
  const db = await getDb();
  const r = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM posts WHERE slug = $1 AND ($2::bigint IS NULL OR id <> $2)`,
    [slug, exceptId ?? null],
  );
  return (r.rows[0]?.n ?? 0) > 0;
}

export async function listPosts(opts: { status?: PostStatus; q?: string; limit?: number; offset?: number } = {}): Promise<PostListItem[]> {
  const db = await getDb();
  const where: string[] = [];
  const params: unknown[] = [];
  if (opts.status) { params.push(opts.status); where.push(`status = $${params.length}`); }
  else { where.push(`status <> 'trash'`); }
  if (opts.q) { params.push(`%${opts.q}%`); where.push(`title ILIKE $${params.length}`); }
  params.push(opts.limit ?? 50); const lim = `$${params.length}`;
  params.push(opts.offset ?? 0); const off = `$${params.length}`;
  const r = await db.query<PostListItem>(
    `SELECT id, slug, title, status, published_at, updated_at, author_id
     FROM posts WHERE ${where.join(" AND ")}
     ORDER BY coalesce(updated_at, published_at, created_at) DESC NULLS LAST
     LIMIT ${lim} OFFSET ${off}`,
    params,
  );
  return r.rows;
}

export async function getPost(id: number): Promise<PostFull | null> {
  const db = await getDb();
  const r = await db.query<Record<string, unknown>>(`SELECT * FROM posts WHERE id = $1`, [id]);
  const row = r.rows[0];
  if (!row) return null;
  const tx = await db.query<{ taxonomy_id: number; kind: string }>(
    `SELECT pt.taxonomy_id, t.kind FROM post_taxonomies pt JOIN taxonomies t ON t.id = pt.taxonomy_id WHERE pt.post_id = $1`,
    [id],
  );
  const cats = tx.rows.filter((x) => x.kind === "category").map((x) => Number(x.taxonomy_id));
  const tags = tx.rows.filter((x) => x.kind === "tag").map((x) => Number(x.taxonomy_id));
  return { ...(row as unknown as PostFull), cats, tags };
}

export async function createPost(p: PostWrite): Promise<number> {
  const db = await getDb();
  const r = await db.query<{ id: number }>(
    `INSERT INTO posts
      (slug, title, excerpt, content_html, block_doc, toc, status, published_at, reading_time,
       featured_url, seo_title, seo_description, canonical, og_title, og_description, og_image,
       twitter_card, noindex, author_id, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19, now())
     RETURNING id`,
    [p.slug, p.title, p.excerpt, p.content_html, j(p.block_doc), j(p.toc), p.status, p.published_at,
     p.reading_time, p.featured_url, p.seo_title, p.seo_description, p.canonical, p.og_title,
     p.og_description, p.og_image, p.twitter_card, p.noindex, p.author_id],
  );
  return Number(r.rows[0]!.id);
}

export async function updatePost(id: number, p: PostWrite): Promise<void> {
  const db = await getDb();
  await db.query(
    `UPDATE posts SET
       slug=$2, title=$3, excerpt=$4, content_html=$5, block_doc=$6, toc=$7, status=$8, published_at=$9,
       reading_time=$10, featured_url=$11, seo_title=$12, seo_description=$13, canonical=$14,
       og_title=$15, og_description=$16, og_image=$17, twitter_card=$18, noindex=$19, updated_at=now()
     WHERE id=$1`,
    [id, p.slug, p.title, p.excerpt, p.content_html, j(p.block_doc), j(p.toc), p.status, p.published_at,
     p.reading_time, p.featured_url, p.seo_title, p.seo_description, p.canonical, p.og_title,
     p.og_description, p.og_image, p.twitter_card, p.noindex],
  );
}

export async function setPostStatus(id: number, status: PostStatus): Promise<boolean> {
  const db = await getDb();
  const r = await db.query<{ id: number }>(
    `UPDATE posts SET status=$2, updated_at=now() WHERE id=$1 RETURNING id`, [id, status],
  );
  return r.rows.length > 0;
}

export async function setPostTaxonomies(id: number, cats: number[], tags: number[]): Promise<void> {
  const db = await getDb();
  const requested = [...new Set([...cats, ...tags])].filter((n) => Number.isInteger(n));
  // Atualiza o conjunto inteiro de taxonomias em uma única statement.
  // O lock do post serializa updates concorrentes do mesmo post; ids inexistentes são ignorados.
  await db.query(
    `WITH locked AS (
       SELECT id FROM posts WHERE id = $1 FOR UPDATE
     ),
     valid AS (
       SELECT id FROM taxonomies WHERE id = ANY($2)
     ),
     deleted AS (
       DELETE FROM post_taxonomies pt
       USING locked
       WHERE pt.post_id = locked.id
     ),
     inserted AS (
       INSERT INTO post_taxonomies (post_id, taxonomy_id)
       SELECT locked.id, valid.id
       FROM locked CROSS JOIN valid
       ON CONFLICT DO NOTHING
     )
     SELECT 1`,
    [id, requested],
  );
}

export async function getPostSlug(id: number): Promise<string | null> {
  const db = await getDb();
  const r = await db.query<{ slug: string; status: string }>(`SELECT slug, status FROM posts WHERE id=$1`, [id]);
  return r.rows[0]?.slug ?? null;
}
