import { Pool } from 'pg';
import { Kysely, PostgresDialect } from 'kysely';
import { Database } from './types';
import dotenv from 'dotenv';

// CORREÇÃO DT-007: Sanitizar URL para logs (remover credenciais)
const sanitizeDbUrl = (url: string): string => {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.hostname}:${parsed.port}${parsed.pathname}`;
  } catch {
    return '[URL inválida]';
  }
};

// Lazy-initialized singleton (Option 2 / D078): sem side-effect no nível do
// módulo. A validação DT-004/DT-007 e a abertura do Pool ocorrem no 1º acesso,
// não no import — importar `db` é sempre seguro (mesmo padrão de `prodDb`).
let _dbInstance: Kysely<Database> | null = null;

function getDb(): Kysely<Database> {
  if (_dbInstance) return _dbInstance;
  dotenv.config();

  // CORREÇÃO DT-004: Validar DATABASE_URL no startup (do uso real)
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

// Proxy-based lazy loader: inicializa só no primeiro uso, não no import
export const db = new Proxy({} as Kysely<Database>, {
  get(_target, prop) {
    const instance = getDb();
    const value = Reflect.get(instance, prop, instance);
    return typeof value === 'function' ? value.bind(instance) : value;
  },
});
