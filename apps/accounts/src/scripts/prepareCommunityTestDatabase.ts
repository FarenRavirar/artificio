/**
 * Prepara um banco descartável com o schema completo do `accounts.` para os
 * testes que exigem PostgreSQL real (`COMMUNITY_TEST_DATABASE_URL`).
 *
 * Por que existe: `communityWilson`, `notificationOutboxSavepoint` e
 * `notificationRecipientsIntegration` — 33 testes — pulam quando a variável
 * está ausente, e ela nunca foi definida em lugar nenhum. Medido em
 * 2026-08-14: o CI já sobe `postgres:16` como service (`ci.yml:29-43`) mas o
 * step `Test` (`:99-106`) não exporta a variável, então esses testes nunca
 * rodaram em gate algum — nem local, nem CI. Um deles é justamente o que
 * provou pegar bug real na T3.15 (entrada de outbox presa em reprocessamento
 * infinito), porque `SAVEPOINT`/`ROLLBACK TO` em SQL raw só falham contra
 * Postgres de verdade; o mock não alcança.
 *
 * **Banco dedicado, não schema isolado por PID.** O precedente do `downloads`
 * (`downloads/backend/src/db/testMigrationsPostgres.ts:28,33-34`) cria um
 * schema e ajusta `search_path`, o que aqui **não funcionaria**: as migrations
 * do `accounts` qualificam `public.` literalmente nos guards de idempotência
 * (medido: `migration_006:251,263,360,375,684,...`, `007:142`, `002:20,77`,
 * `004:43`), então um `CREATE TABLE` cairia no schema isolado enquanto o guard
 * consultaria `public` — e toda migration se veria como "ainda não aplicada".
 * Nenhuma delas ajusta `search_path` (busca negativa: `rg "search_path"` em
 * `apps/accounts/database/*.sql` devolve zero).
 */
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { Client } from "pg";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`prepare_community_test_db: ${message}`);
}

/**
 * Mesma trava do precedente: o script cria e **destrói** banco, então recusa
 * qualquer host que não seja local/CI descartável. Sem isso, uma variável de
 * ambiente errada apontaria `DROP DATABASE` para infraestrutura real.
 */
function requireSafeAdminUrl(): URL {
  const raw = process.env.COMMUNITY_TEST_ADMIN_URL ?? process.env.DATABASE_URL;
  assert(raw, "COMMUNITY_TEST_ADMIN_URL (ou DATABASE_URL) ausente");
  const parsed = new URL(raw);
  assert(
    ["localhost", "127.0.0.1", "::1", "[::1]"].includes(parsed.hostname),
    "host deve ser local/CI descartável",
  );
  return parsed;
}

const TEST_DATABASE_NAME = "artificio_accounts_community_test";

async function main(): Promise<void> {
  const adminUrl = requireSafeAdminUrl();
  const migrationsDir = path.resolve(import.meta.dirname, "../../database");

  const admin = new Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  try {
    // Recriar em vez de reusar: teste que assume tabela vazia não pode herdar
    // linha de execução anterior. `WITH (FORCE)` derruba conexão pendurada de
    // run interrompido — sem ele, `DROP DATABASE` falha com 55006.
    await admin.query(`DROP DATABASE IF EXISTS "${TEST_DATABASE_NAME}" WITH (FORCE)`);
    await admin.query(`CREATE DATABASE "${TEST_DATABASE_NAME}"`);
  } finally {
    await admin.end();
  }

  const targetUrl = new URL(adminUrl.toString());
  targetUrl.pathname = `/${TEST_DATABASE_NAME}`;

  const target = new Client({ connectionString: targetUrl.toString() });
  await target.connect();
  try {
    // Ordem lexicográfica = ordem de aplicação, porque o prefixo é
    // `migration_NNN_` com N fixo em três dígitos. É o mesmo critério do
    // runner de deploy (`scripts/deploy/lib_migrations.sh`).
    const migrations = (await readdir(migrationsDir))
      .filter((filename) => filename.startsWith("migration_") && filename.endsWith(".sql"))
      .sort();
    assert(migrations.length > 0, `nenhuma migration encontrada em ${migrationsDir}`);

    for (const filename of migrations) {
      const sql = await readFile(path.join(migrationsDir, filename), "utf8");
      try {
        await target.query(sql);
      } catch (error) {
        throw new Error(`falhou em ${filename}: ${(error as Error).message}`, {
          cause: error,
        });
      }
    }

    console.log(
      `prepare_community_test_db: ${migrations.length} migrations aplicadas em ${TEST_DATABASE_NAME}`,
    );
    // O caller exporta esta URL como COMMUNITY_TEST_DATABASE_URL.
    console.log(targetUrl.toString());
  } finally {
    await target.end();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
