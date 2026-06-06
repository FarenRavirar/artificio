// Repo de redirects 301 (slug antigo -> novo). Gerados ao mudar slug de post/page publicado (R3/D047).
import { getDb } from "../connection.js";

export async function addRedirect(fromPath: string, toPath: string, code = 301): Promise<void> {
  if (fromPath === toPath) return;
  const db = await getDb();
  await db.query(
    `INSERT INTO redirects (from_path, to_path, code) VALUES ($1,$2,$3)
     ON CONFLICT (from_path) DO UPDATE SET to_path = EXCLUDED.to_path, code = EXCLUDED.code`,
    [fromPath, toPath, code],
  );
}

export interface Redirect { id: number; from_path: string; to_path: string; code: number; }
export async function listRedirects(): Promise<Redirect[]> {
  const db = await getDb();
  return (await db.query<Redirect>(`SELECT id, from_path, to_path, code FROM redirects ORDER BY from_path`)).rows;
}
