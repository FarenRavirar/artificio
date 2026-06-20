// Conexão dual: prod = pg Pool (DATABASE_URL); dev = pglite (in-process, persiste em .pgdata).
// Mesma interface query()/exec() p/ os dois. Migrations SQL e importador rodam igual.
// Kysely (canon) entra no backend HTTP/admin futuro; importador é descartável (SQL cru).
import "dotenv/config";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface QueryResult<T> {
  rows: T[];
}
export interface DbClient {
  query<T = unknown>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
  release(): void;
}

export interface Db {
  isPg: boolean;
  query<T = unknown>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
  exec(sql: string): Promise<void>;
  getClient(): Promise<DbClient>;
  close(): Promise<void>;
}

const here = dirname(fileURLToPath(import.meta.url));
export const PGDATA_DIR = process.env.SITE_PGDATA || resolve(here, "../.pgdata");

/** Há banco utilizável? (DSN prod OU diretório pglite já criado). Senão, build cai p/ fixtures. */
export function dbAvailable(): boolean {
  return Boolean(process.env.DATABASE_URL) || existsSync(PGDATA_DIR);
}

let cached: Promise<Db> | null = null;

export function getDb(): Promise<Db> {
  if (cached) return cached;
  cached = (async (): Promise<Db> => {
    const url = process.env.DATABASE_URL;
    if (url) {
      const { Pool } = await import("pg");
      const pool = new Pool({ connectionString: url, max: 10, connectionTimeoutMillis: 30_000 });
      return {
        isPg: true,
        query: (sql, params) => pool.query(sql, params as unknown[]) as Promise<QueryResult<never>>,
        exec: async (sql) => {
          await pool.query(sql);
        },
        getClient: async () => {
          const client = await pool.connect();
          return {
            query: (sql, params) => client.query(sql, params as unknown[]) as Promise<QueryResult<never>>,
            release: () => client.release(),
          };
        },
        close: () => pool.end(),
      };
    }
    const { PGlite } = await import("@electric-sql/pglite");
    const pg = new PGlite(PGDATA_DIR);
    await pg.waitReady;
    return {
      isPg: false,
      query: (sql, params) => pg.query(sql, params as unknown[]) as Promise<QueryResult<never>>,
      exec: async (sql) => {
        await pg.exec(sql);
      },
      getClient: async () => ({
        query: (sql: string, params?: unknown[]) =>
          pg.query(sql, params as unknown[]) as Promise<QueryResult<never>>,
        release: () => {},
      }),
      close: () => pg.close(),
    };
  })();
  return cached;
}
