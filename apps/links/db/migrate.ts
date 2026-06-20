// Runner de migrations LOCAL (dev). Paridade com o framework de deploy (D039):
// aplica database/migration_*.sql em ordem, registra em schema_migrations(migration_name PK),
// transacional + advisory lock. Em prod quem aplica é scripts/deploy/apply_required_migrations.sh.
// Uso: pnpm --filter @artificio/links migrate  (requer DATABASE_URL).
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

const here = dirname(fileURLToPath(import.meta.url));
const MIG_DIR = resolve(here, "../database");
const LOCK_ID = 918273646; // distinto do mesas (918273645)

if (!process.env.DATABASE_URL) {
  throw new Error("[links/migrate] DATABASE_URL ausente.");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });

try {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      migration_name TEXT PRIMARY KEY,
      applied_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      applied_by     TEXT
    );
  `);

  // Advisory lock via conexão dedicada: lock+unlock na mesma sessão PG.
  // pool.query() pode usar conexões diferentes → unlock em conexão B não libera lock da A.
  const lockClient = await pool.connect();
  try {
    await lockClient.query("SELECT pg_advisory_lock($1)", [LOCK_ID]);

    const applied = new Set(
      (await pool.query<{ migration_name: string }>("SELECT migration_name FROM schema_migrations")).rows.map(
        (r) => r.migration_name,
      ),
    );
    const files = readdirSync(MIG_DIR)
      .filter((f) => /^migration_.*\.sql$/.test(f))
      .sort();

    let n = 0;
    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = readFileSync(join(MIG_DIR, file), "utf8");
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (migration_name, applied_by) VALUES ($1, $2)", [
          file,
          "local",
        ]);
        await client.query("COMMIT");
        console.log(`✓ applied ${file}`);
        n += 1;
      } catch (err) {
        await client.query("ROLLBACK");
        console.error(`✗ FAILED ${file}:`, err);
        throw err;
      } finally {
        client.release();
      }
    }
    console.log(`migrate: ${n} new, ${files.length} total`);
  } finally {
    await lockClient.query("SELECT pg_advisory_unlock($1)", [LOCK_ID]).catch(() => {});
    lockClient.release();
  }
} finally {
  await pool.end();
}
