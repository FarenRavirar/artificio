// Repo de taxonomias (categorias aninhadas + tags) — listar + criar termo inline (spec 011).
import { getDb } from "../connection.js";

export type TermKind = "category" | "tag";
export interface Term {
  id: number; kind: TermKind; slug: string; name: string; parent_id: number | null; count: number;
}

export async function listTerms(kind?: TermKind): Promise<Term[]> {
  const db = await getDb();
  const params: unknown[] = [];
  let where = "";
  if (kind) { params.push(kind); where = `WHERE kind = $1`; }
  const r = await db.query<Term>(
    `SELECT id, kind, slug, name, parent_id, count FROM taxonomies ${where} ORDER BY kind, name`,
    params,
  );
  return r.rows;
}

export async function termSlugExists(kind: TermKind, slug: string): Promise<boolean> {
  const db = await getDb();
  const r = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM taxonomies WHERE kind=$1 AND slug=$2`, [kind, slug],
  );
  return (r.rows[0]?.n ?? 0) > 0;
}

/** Cria termo com id nativo (sequence). Retorna o id. */
export async function createTerm(kind: TermKind, name: string, slug: string, parentId: number | null = null): Promise<number> {
  const db = await getDb();
  const r = await db.query<{ id: number }>(
    `INSERT INTO taxonomies (id, kind, slug, name, parent_id)
     VALUES (nextval('site_content_id_seq'), $1, $2, $3, $4) RETURNING id`,
    [kind, slug, name, parentId],
  );
  return Number(r.rows[0]!.id);
}

/** Recalcula `count` (posts publicados por termo). Chamar pós-rebuild/edição. */
export async function recountTerms(): Promise<void> {
  const db = await getDb();
  await db.query(
    `UPDATE taxonomies t SET count = (
       SELECT count(*) FROM post_taxonomies pt JOIN posts p ON p.id = pt.post_id
       WHERE pt.taxonomy_id = t.id AND p.status = 'publish')`,
  );
}
