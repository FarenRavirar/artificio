/**
 * WS3 — Rotas de segredos de admin (DeepSeek key, etc.).
 *
 * - PUT /admin/secrets/:name — cifra e armazena (admin-gated)
 * - GET /admin/secrets/:name — decifra e retorna (admin-gated ou X-Service-Token)
 *
 * Segurança:
 * - Nunca loga plaintext/ciphertext/key.
 * - X-Service-Token permite consumo serviço-a-serviço (ex.: mesas backend).
 * - Chave de cifra: env ACCOUNTS_SECRETS_KEY.
 */
import { Router, type Request, type Response } from 'express';
import {
  encryptSecret,
  decryptSecret,
  SecretUnavailableError,
  SecretDecryptError,
} from '@artificio/config/secret-crypto';
import type { Kysely } from 'kysely';
import type { Database } from './db.js';
import type { Session } from '@artificio/auth';

function requireAdmin(req: Request, res: Response, next: () => void): void {
  const session = (req as Request & { session?: Session }).session;
  if (!session?.user || session.user.role !== 'admin') {
    res.status(403).json({ error: 'Acesso restrito a administradores.' });
    return;
  }
  next();
}

function getSecretsKey(env: Record<string, string | undefined>): string {
  const key = env.ACCOUNTS_SECRETS_KEY || env.JWT_SECRET;
  if (!key) {
    throw new SecretUnavailableError('ACCOUNTS_SECRETS_KEY ou JWT_SECRET não configurado.');
  }
  return key;
}

function getServiceSecret(env: Record<string, string | undefined>): string | null {
  return env.SERVICE_SECRET ?? null;
}

/** Valida X-Service-Token contra SERVICE_SECRET. Se ok, prossegue; senão tenta cookie de admin. */
function requireServiceOrAdmin(env: Record<string, string | undefined>) {
  return (req: Request, res: Response, next: () => void) => {
    const serviceSecret = getServiceSecret(env);
    const token = req.headers['x-service-token'];

    if (serviceSecret && typeof token === 'string' && token === serviceSecret) {
      // Serviço autenticado — prossegue sem sessão de usuário
      return next();
    }

    // Fallback: cookie de admin (usuário logado)
    requireAdmin(req, res, next);
  };
}

export function createAdminSecretsRoutes(
  db: Kysely<Database>,
  env: Record<string, string | undefined>,
): Router {
  const router = Router();

  // ── PUT /admin/secrets/:name ────────────────────────────────────────────
  router.put('/admin/secrets/:name', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { name } = req.params;
      const { value } = req.body as { value?: string };

      if (typeof value !== 'string' || !value.trim()) {
        return res.status(400).json({ error: 'Campo "value" obrigatório (string não vazia).' });
      }

      const key = getSecretsKey(env);
      const ciphertext = encryptSecret(value.trim(), key);
      const updatedBy = (req as Request & { session?: Session }).session?.user?.id ?? null;

      await db
        .insertInto('admin_secrets')
        .values({ name, ciphertext, updated_by: updatedBy })
        .onConflict((oc) => oc.column('name').doUpdateSet({
          ciphertext,
          updated_by: updatedBy,
          updated_at: new Date(),
        }))
        .execute();

      return res.status(204).send();
    } catch (error: unknown) {
      if (error instanceof SecretUnavailableError) {
        return res.status(500).json({ error: 'Chave de cifra não configurada no servidor.' });
      }
      console.error('[PUT /admin/secrets/:name]', error instanceof Error ? error.message : 'unknown');
      return res.status(500).json({ error: 'Erro ao armazenar segredo.' });
    }
  });

  // ── GET /admin/secrets/:name ────────────────────────────────────────────
  router.get('/admin/secrets/:name', requireServiceOrAdmin(env), async (req: Request, res: Response) => {
    try {
      const { name } = req.params;

      const row = await db
        .selectFrom('admin_secrets')
        .select(['ciphertext'])
        .where('name', '=', name)
        .executeTakeFirst();

      if (!row) {
        return res.status(404).json({ error: 'Segredo não encontrado.' });
      }

      const key = getSecretsKey(env);
      const value = decryptSecret(row.ciphertext, key);

      return res.json({ data: { value } });
    } catch (error: unknown) {
      if (error instanceof SecretDecryptError) {
        return res.status(409).json({ error: 'Segredo ilegível com a chave atual.' });
      }
      if (error instanceof SecretUnavailableError) {
        return res.status(500).json({ error: 'Chave de cifra não configurada no servidor.' });
      }
      console.error('[GET /admin/secrets/:name]', error instanceof Error ? error.message : 'unknown');
      return res.status(500).json({ error: 'Erro ao buscar segredo.' });
    }
  });

  return router;
}
