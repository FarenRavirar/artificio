import { db } from '../config/database.js';

export type UserRole = 'admin' | 'member';

type QueryExecutor = {
  query: (text: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;
};

export const normalizeRole = (value: unknown): UserRole => {
  const role = String(value ?? '').trim().toLowerCase();
  return role === 'admin' ? 'admin' : 'member';
};

export const fetchUserRoleFromDb = async (
  userId: string,
  executor: QueryExecutor = db
): Promise<UserRole | null> => {
  const result = await executor.query(
    `SELECT role
       FROM public.users
      WHERE id = $1
      LIMIT 1`,
    [userId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return normalizeRole(result.rows[0]?.role);
};
