// Conexão Kysely/pg do módulo links. Espelha apps/mesas/backend/src/db/index.ts:
// singleton lazy (sem side-effect no import), Pool pg sob PostgresDialect.
import { Pool } from "pg";
import { Kysely, PostgresDialect } from "kysely";
import dotenv from "dotenv";
import type { Database } from "./types.js";

// Sanitiza URL p/ logs (não vaza credenciais) — mesmo padrão DT-007 do mesas.
const sanitizeDbUrl = (url: string): string => {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.hostname}:${parsed.port}${parsed.pathname}`;
  } catch {
    return "[URL inválida]";
  }
};

let _dbInstance: Kysely<Database> | null = null;

function getDb(): Kysely<Database> {
  if (_dbInstance) return _dbInstance;
  dotenv.config();

  if (!process.env.DATABASE_URL) {
    throw new Error("[links/db] ERRO CRÍTICO: DATABASE_URL não está definida no .env");
  }
  try {
    new URL(process.env.DATABASE_URL);
  } catch {
    throw new Error(
      `[links/db] ERRO CRÍTICO: DATABASE_URL tem formato inválido: ${sanitizeDbUrl(process.env.DATABASE_URL)}`,
    );
  }

  const dialect = new PostgresDialect({
    pool: new Pool({ connectionString: process.env.DATABASE_URL, max: 10 }),
  });
  _dbInstance = new Kysely<Database>({ dialect });
  return _dbInstance;
}

// Proxy lazy: inicializa só no 1º uso, não no import (importar `db` é sempre seguro).
export const db = new Proxy({} as Kysely<Database>, {
  get(_target, prop) {
    const instance = getDb();
    const value = Reflect.get(instance, prop, instance);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});
