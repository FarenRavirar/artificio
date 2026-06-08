// Repo da biblioteca de mídia (spec 011, fase 2, T18). SQL parametrizado sobre o adapter dual.
import { getDb } from "../connection.js";

export type MediaSource = "wp" | "cloudinary" | "local";

export interface MediaWrite {
  source: MediaSource;
  url: string;
  cloudinary_public_id: string | null;
  mime: string | null;
  size_bytes: number | null;
  width: number | null;
  height: number | null;
  alt: string | null;
  caption: string | null;
  title: string | null;
  created_by: string | null;
}

export interface MediaItem extends MediaWrite {
  id: number;
  wp_url: string | null;
  created_at: string | null;
  updated_at: string | null;
}

// Filtro por tipo via prefixo do mime (image/ audio/ video/).
const typePrefix = (t?: string): string | null =>
  t === "image" || t === "audio" || t === "video" ? `${t}/%` : null;

export async function listMedia(opts: { q?: string; type?: string; limit?: number; offset?: number } = {}): Promise<{ items: MediaItem[]; total: number }> {
  const db = await getDb();
  const where: string[] = [];
  const params: unknown[] = [];
  if (opts.q) { params.push(`%${opts.q}%`); const i = params.length; where.push(`(coalesce(title,'') ILIKE $${i} OR coalesce(alt,'') ILIKE $${i} OR coalesce(url,'') ILIKE $${i})`); }
  const tp = typePrefix(opts.type);
  if (tp) { params.push(tp); where.push(`coalesce(mime,'') LIKE $${params.length}`); }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const total = Number((await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM media ${whereSql}`, params)).rows[0]?.n ?? 0);

  params.push(opts.limit ?? 40); const lim = `$${params.length}`;
  params.push(opts.offset ?? 0); const off = `$${params.length}`;
  const items = (await db.query<MediaItem>(
    `SELECT id, source, url, wp_url, cloudinary_public_id, mime, size_bytes, width, height, alt, caption, title, created_by, created_at, updated_at
     FROM media ${whereSql}
     ORDER BY coalesce(created_at, now()) DESC, id DESC
     LIMIT ${lim} OFFSET ${off}`,
    params,
  )).rows;
  return { items, total };
}

export async function getMedia(id: number): Promise<MediaItem | null> {
  const db = await getDb();
  const r = await db.query<MediaItem>(
    `SELECT id, source, url, wp_url, cloudinary_public_id, mime, size_bytes, width, height, alt, caption, title, created_by, created_at, updated_at
     FROM media WHERE id = $1`, [id]);
  return r.rows[0] ?? null;
}

export async function createMedia(m: MediaWrite): Promise<number> {
  const db = await getDb();
  const r = await db.query<{ id: number }>(
    `INSERT INTO media (source, url, cloudinary_public_id, mime, size_bytes, width, height, alt, caption, title, created_by, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, now(), now())
     RETURNING id`,
    [m.source, m.url, m.cloudinary_public_id, m.mime, m.size_bytes, m.width, m.height, m.alt, m.caption, m.title, m.created_by],
  );
  return Number(r.rows[0]!.id);
}

export async function updateMediaMeta(id: number, meta: { alt: string | null; caption: string | null; title: string | null }): Promise<boolean> {
  const db = await getDb();
  const r = await db.query<{ id: number }>(
    `UPDATE media SET alt=$2, caption=$3, title=$4, updated_at=now() WHERE id=$1 RETURNING id`,
    [id, meta.alt, meta.caption, meta.title],
  );
  return r.rows.length > 0;
}

export async function deleteMedia(id: number): Promise<boolean> {
  const db = await getDb();
  const r = await db.query<{ id: number }>(`DELETE FROM media WHERE id=$1 RETURNING id`, [id]);
  return r.rows.length > 0;
}
