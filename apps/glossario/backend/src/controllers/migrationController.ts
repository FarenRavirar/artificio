import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { db } from '../config/database';
import { SSO_NO_PASSWORD } from '../auth/resolveLocalUser';
import { issueMigrationToken, verifyMigrationToken } from '../auth/migrationToken';
import { mergeUsers, TxClient } from '../auth/mergeUsers';

// Hash BCrypt válido só para igualar o tempo de resposta quando o email não
// existe (anti-enumeração por timing). Nunca casa com senha real.
const DUMMY_HASH = bcrypt.hashSync('artificio-dummy-password', 10);

type Executor = { query: (text: string, params?: any[]) => Promise<{ rows: any[] }> };

export interface VerifyDeps {
  exec?: Executor;
  compare?: (plain: string, hash: string) => Promise<boolean>;
  issue?: (legacyUserId: string) => string;
}

export interface VerifyResult {
  ok: boolean;
  token?: string;
}

/**
 * Valida identidade legada (email + senha BCrypt antiga). NÃO cria sessão.
 * Em sucesso emite migration_token curto. Resposta uniforme em qualquer falha.
 */
export async function runVerify(
  body: any,
  deps: VerifyDeps = {}
): Promise<VerifyResult> {
  const exec = deps.exec ?? db;
  const compare = deps.compare ?? bcrypt.compare;
  const issue = deps.issue ?? issueMigrationToken;

  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  if (!email || !password) {
    // ainda roda um compare dummy para não vazar timing
    await compare('x', DUMMY_HASH);
    return { ok: false };
  }

  const r = await exec.query(
    `SELECT id, password_hash FROM public.users
       WHERE lower(email) = $1 AND sso_user_id IS NULL
       LIMIT 1`,
    [email]
  );
  const row = r.rows[0];
  const hash: string | undefined = row?.password_hash;
  const usableHash =
    typeof hash === 'string' && hash && hash !== SSO_NO_PASSWORD ? hash : DUMMY_HASH;

  const match = await compare(password, usableHash);

  if (!row || !match || hash === SSO_NO_PASSWORD) {
    return { ok: false };
  }
  return { ok: true, token: issue(String(row.id)) };
}

export const verifyMigrationHandler = async (req: Request, res: Response) => {
  try {
    const result = await runVerify(req.body);
    if (!result.ok) {
      return res
        .status(401)
        .json({ message: 'Não foi possível validar suas credenciais legadas.' });
    }
    return res.json({ migration_token: result.token });
  } catch (err) {
    console.error('[migration/verify] erro:', err);
    return res.status(500).json({ message: 'Erro ao validar credenciais.' });
  }
};

export interface ClaimDeps {
  getClient?: () => Promise<TxClient & { release?: () => void }>;
  verifyToken?: (token: string) => string | null;
}

export interface ClaimOutcome {
  status: number;
  body: Record<string, unknown>;
}

/**
 * Reivindicação: exige sessão SSO (sub/googleEmail) + migration_token. Vincula
 * sso_user_id ao usuário legado; se já havia auto-provisionado p/ o mesmo sub,
 * funde (repoint de FKs) numa identidade única. Transacional.
 */
export async function runClaim(
  input: { sub: string; googleEmail: string; migrationToken: string },
  deps: ClaimDeps = {}
): Promise<ClaimOutcome> {
  const verify = deps.verifyToken ?? verifyMigrationToken;
  const getClient = deps.getClient ?? (() => db.pool.connect() as any);

  const legacyId = verify(input.migrationToken);
  if (!legacyId) {
    return { status: 400, body: { message: 'Token de migração inválido ou expirado.' } };
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const legacyRes = await client.query(
      'SELECT id, sso_user_id, email FROM public.users WHERE id = $1 FOR UPDATE',
      [legacyId]
    );
    const legacy = legacyRes.rows[0];
    if (!legacy) {
      await client.query('ROLLBACK');
      return { status: 404, body: { message: 'Conta legada não encontrada.' } };
    }

    if (legacy.sso_user_id && legacy.sso_user_id !== input.sub) {
      await client.query('ROLLBACK');
      return { status: 409, body: { message: 'Conta legada já vinculada a outra conta Google.' } };
    }

    if (legacy.sso_user_id === input.sub) {
      await client.query('COMMIT');
      return { status: 200, body: { ok: true, already_linked: true } };
    }

    // Usuário auto-provisionado pelo login Google deste sub (se existir) → funde no legado.
    const autoRes = await client.query(
      'SELECT id FROM public.users WHERE sso_user_id = $1 AND id <> $2 LIMIT 1',
      [input.sub, legacyId]
    );
    const auto = autoRes.rows[0];
    if (auto) {
      await mergeUsers(client, String(auto.id), String(legacyId));
    }

    await client.query(
      'UPDATE public.users SET sso_user_id = $1, email = $2 WHERE id = $3',
      [input.sub, input.googleEmail, legacyId]
    );

    await client.query('COMMIT');
    return { status: 200, body: { ok: true, merged: Boolean(auto) } };
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore */
    }
    throw err;
  } finally {
    client.release?.();
  }
}

export const claimMigrationHandler = async (req: any, res: Response) => {
  const sub = req.user?.sub;
  const googleEmail = req.user?.sso_email;
  if (typeof sub !== 'string' || !sub || typeof googleEmail !== 'string' || !googleEmail) {
    return res.status(401).json({ message: 'Sessão Google necessária para concluir a migração.' });
  }
  const migrationToken =
    typeof req.body?.migration_token === 'string' ? req.body.migration_token : '';

  try {
    const out = await runClaim({ sub, googleEmail, migrationToken });
    return res.status(out.status).json(out.body);
  } catch (err) {
    console.error('[migration/claim] erro:', err);
    return res.status(500).json({ message: 'Erro ao concluir a migração.' });
  }
};
