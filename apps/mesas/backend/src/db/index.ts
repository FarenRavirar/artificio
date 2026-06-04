import { Pool } from 'pg';
import { Kysely, PostgresDialect } from 'kysely';
import { Database } from './types';
import dotenv from 'dotenv';

dotenv.config();

// CORREÇÃO DT-004: Validar DATABASE_URL no startup
if (!process.env.DATABASE_URL) {
  console.error('[DB] ERRO CRÍTICO: DATABASE_URL não está definida no .env');
  process.exit(1);
}

// CORREÇÃO DT-007: Sanitizar URL para logs (remover credenciais)
const sanitizeDbUrl = (url: string): string => {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.hostname}:${parsed.port}${parsed.pathname}`;
  } catch {
    return '[URL inválida]';
  }
};

try {
  new URL(process.env.DATABASE_URL);
} catch {
  console.error('[DB] ERRO CRÍTICO: DATABASE_URL tem formato inválido:', sanitizeDbUrl(process.env.DATABASE_URL));
  process.exit(1);
}

const dialect = new PostgresDialect({
  pool: new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
  }),
});

// Database interface is passed to Kysely's constructor
export const db = new Kysely<Database>({
  dialect,
});
