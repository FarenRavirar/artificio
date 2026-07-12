import { Pool } from 'pg';
import { Kysely, PostgresDialect } from 'kysely';
import { Database } from './types';
import dotenv from 'dotenv';

const sanitizeDbUrl = (url: string): string => {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.hostname}:${parsed.port}${parsed.pathname}`;
  } catch {
    return '[URL inválida]';
  }
};

// Lazy-initialized singleton (mesmo padrao de apps/mesas/backend/src/db):
// sem side-effect no nivel do modulo, Pool so abre no 1o acesso.
let _dbInstance: Kysely<Database> | null = null;

function getDb(): Kysely<Database> {
  if (_dbInstance) return _dbInstance;
  dotenv.config();

  if (!process.env.DATABASE_URL) {
    throw new Error('[DB] ERRO CRÍTICO: DATABASE_URL não está definida no .env');
  }

  try {
    new URL(process.env.DATABASE_URL);
  } catch {
    throw new Error(
      `[DB] ERRO CRÍTICO: DATABASE_URL tem formato inválido: ${sanitizeDbUrl(process.env.DATABASE_URL)}`
    );
  }

  const dialect = new PostgresDialect({
    pool: new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
    }),
  });

  _dbInstance = new Kysely<Database>({ dialect });
  return _dbInstance;
}

export const db = new Proxy({} as Kysely<Database>, {
  get(_target, prop) {
    const instance = getDb();
    const value = Reflect.get(instance, prop, instance);
    return typeof value === 'function' ? value.bind(instance) : value;
  },
});
