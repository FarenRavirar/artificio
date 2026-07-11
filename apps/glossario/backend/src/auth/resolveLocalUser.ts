import { db } from '../config/database';
import type { Session } from '@artificio/auth';

export type LocalRole = 'admin' | 'member';

export interface LocalUser {
  id: string;
  email: string;
  username: string | null;
  full_name: string | null;
  role: LocalRole;
  sso_user_id: string | null;
}

export interface QueryResult {
  rows: Array<Record<string, unknown>>;
  rowCount?: number | null;
}

export interface QueryExecutor {
  query: (text: string, params?: unknown[]) => Promise<QueryResult>;
}

const SELECT_COLS = 'id, email, username, full_name, role, sso_user_id';

// Usuários provisionados via SSO não têm senha legada. Sentinela não-BCrypt:
// bcrypt.compare(qualquer, SSO_NO_PASSWORD) === false, então nunca casa no verify.
export const SSO_NO_PASSWORD = '!sso-no-password';

function mapRow(r: Record<string, unknown>): LocalUser {
  return {
    id: String(r.id),
    email: String(r.email),
    username: r.username == null ? null : String(r.username),
    full_name: r.full_name == null ? null : String(r.full_name),
    role: r.role === 'admin' ? 'admin' : 'member',
    sso_user_id: r.sso_user_id == null ? null : String(r.sso_user_id),
  };
}

/**
 * Resolve o usuário LOCAL do glossário a partir da sessão SSO (accounts.).
 * Ordem (account-linking por email, spec 015):
 *   (a) já vinculado: users.sso_user_id = token.sub
 *   (b) email bate (lower-case): vincula sso_user_id e usa o legado
 *   (c) sem match: provisiona usuário novo (role 'member')
 *
 * Retorna sempre o id LEGADO (users.id), preservando ownership de
 * terms.added_by / votos / comentários / notificações.
 */
export async function resolveLocalUser(
  session: Session,
  executor: QueryExecutor = db
): Promise<LocalUser> {
  const sub = session.user.id;
  const email = (session.user.email ?? '').trim();
  const emailLower = email.toLowerCase();
  const name = (session.user.name ?? '').trim() || email;

  // (a) já vinculado por sso_user_id
  const bySso = await executor.query(
    `SELECT ${SELECT_COLS} FROM public.users WHERE sso_user_id = $1 LIMIT 1`,
    [sub]
  );
  if (bySso.rows.length > 0) return mapRow(bySso.rows[0]);

  // (b) account-linking por email (case-insensitive); ignora rows já vinculadas a OUTRO sub
  const byEmail = await executor.query(
    `SELECT ${SELECT_COLS} FROM public.users
       WHERE lower(email) = $1 AND (sso_user_id IS NULL OR sso_user_id = $2)
       ORDER BY created_at ASC
       LIMIT 1`,
    [emailLower, sub]
  );
  if (byEmail.rows.length > 0) {
    const row = byEmail.rows[0];
    // grava o vínculo só se ainda nulo (idempotente; corrida protegida pelo índice único parcial)
    const linked = await executor.query(
      `UPDATE public.users SET sso_user_id = $1
         WHERE id = $2 AND sso_user_id IS NULL
       RETURNING ${SELECT_COLS}`,
      [sub, row.id]
    );
    if (linked.rows.length > 0) return mapRow(linked.rows[0]);
    // corrida: outro request vinculou primeiro — relê por sso_user_id
    const reread = await executor.query(
      `SELECT ${SELECT_COLS} FROM public.users WHERE sso_user_id = $1 LIMIT 1`,
      [sub]
    );
    if (reread.rows.length > 0) return mapRow(reread.rows[0]);
    return mapRow({ ...row, sso_user_id: sub });
  }

  // (c) provisiona usuário novo (sem conta legada). username = email garante unicidade.
  const created = await executor.query(
    `INSERT INTO public.users (full_name, username, email, password_hash, role, sso_user_id)
       VALUES ($1, $2, $3, $4, 'member', $5)
     RETURNING ${SELECT_COLS}`,
    [name, email, email, SSO_NO_PASSWORD, sub]
  );
  return mapRow(created.rows[0]);
}
