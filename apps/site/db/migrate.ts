// Runner de migrations frameworkado (D039): schema_migrations + advisory lock (pg) + transacional por arquivo.
// Roda: pnpm --filter @artificio/site migrate. Idempotente.
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getDb } from "./connection";
import { assertMigrationAllowed, readMigrationPolicy } from "./migrationPolicy";

const here = dirname(fileURLToPath(import.meta.url));
const MIG_DIR = resolve(here, "migrations");
const LOCK_KEY = 8270727; // advisory lock id (só pg)

const db = await getDb();

await db.exec(
  `CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now());`,
);
const lockClient = await db.getClient();
if (db.isPg) await lockClient.query("SELECT pg_advisory_lock($1)", [LOCK_KEY]);

try {
  const applied = new Set(
    (await db.query<{ version: string }>("SELECT version FROM schema_migrations")).rows.map((r) => r.version),
  );
  const files = readdirSync(MIG_DIR).filter((f) => f.endsWith(".sql")).sort();
  let n = 0;
  for (const file of files) {
    const version = file.replace(/\.sql$/, "");
    if (applied.has(version)) continue;
    const sql = readFileSync(join(MIG_DIR, file), "utf8");
    const policy = readMigrationPolicy(sql, file);
    assertMigrationAllowed(file, policy);
    await db.exec("BEGIN");
    try {
      await db.exec(sql);
      await db.query("INSERT INTO schema_migrations (version) VALUES ($1)", [version]);
      await db.exec("COMMIT");
      console.log(`✓ applied ${version}`);
      n += 1;
    } catch (err) {
      await db.exec("ROLLBACK");
      console.error(`✗ FAILED ${version}:`, err);
      throw err;
    }
  }
  console.log(`migrate: ${n} new, ${files.length} total (driver=${db.isPg ? "pg" : "pglite"})`);
} finally {
  if (db.isPg) await lockClient.query("SELECT pg_advisory_unlock($1)", [LOCK_KEY]).catch(() => {});
  lockClient.release();
  await db.close();
}
