import { Pool } from 'pg';
import { Kysely, PostgresDialect } from 'kysely';
import { Database } from './types';
import dotenv from 'dotenv';

dotenv.config();

// Lazy-initialized singleton instance
let _prodDbInstance: Kysely<Database> | null = null;

function getProdDb(): Kysely<Database> {
  if (_prodDbInstance) return _prodDbInstance;
  const prodUrl = process.env.PROD_DB_URL;
  if (!prodUrl) {
    throw new Error('PROD_DB_URL environment variable is required for production database connection');
  }
  const dialect = new PostgresDialect({
    pool: new Pool({
      connectionString: prodUrl,
      max: 5,
    }),
  });
  _prodDbInstance = new Kysely<Database>({ dialect });
  return _prodDbInstance;
}

// Proxy-based lazy loader: throws only on first actual use, not on import
export const prodDb = new Proxy({} as Kysely<Database> & { isProdConnection: boolean }, {
  get(_target, prop, receiver) {
    // Special property for testing validation - returns true without initializing
    if (prop === 'isProdConnection') return true;
    // Lazy-initialize on first method/property access
    const instance = getProdDb();
    const value = Reflect.get(instance, prop, receiver);
    // Bind methods to the instance to preserve 'this' context
    return typeof value === 'function' ? value.bind(instance) : value;
  },
});
