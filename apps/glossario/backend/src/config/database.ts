import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

if (!process.env.POSTGRES_PASSWORD) {
  console.error('[db]: POSTGRES_PASSWORD environment variable is required');
  process.exit(1);
}

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.POSTGRES_USER || 'admin',
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB || 'glossario_v2',
  port: 5432,
});

pool.on('error', (err) => {
  console.error('[db]: Erro inesperado no cliente de banco de dados', err);
  process.exit(-1);
});

export const db = {
  query: (text: string, params?: any[]) => pool.query(text, params),
  pool,
};
