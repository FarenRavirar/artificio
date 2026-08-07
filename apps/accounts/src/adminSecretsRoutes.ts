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
import { Router, type NextFunction, type Request, type Response } from 'express';
import { requireAuth } from '@artificio/auth';
import {
  encryptSecret,
  decryptSecret,
  SecretUnavailableError,
  SecretDecryptError,
} from '@artificio/config/secret-crypto';
import type { Kysely } from 'kysely';
import type { Database } from './db.js';
import { requireCurrentAdmin, sessionFrom } from './requireCurrentAdmin.js';
import {
  hasScope,
  resolveServiceCredential,
  touchServiceCredential,
} from './serviceCredential.js';
import type { ServiceAuthenticatedRequest } from './requireServiceCredential.js';

function getSecretsKey(env: Record<string, string | undefined>): string {
  // REV-023: chave dedicada e obrigatória. Sem fallback p/ JWT_SECRET — senão a
  // rotação do JWT inutilizaria toda a tabela admin_secrets e reusaria a mesma
  // chave p/ dois propósitos. Falhar explicitamente é mais seguro.
  const key = env.ACCOUNTS_SECRETS_KEY;
  if (!key) {
    throw new SecretUnavailableError('ACCOUNTS_SECRETS_KEY não configurado.');
  }
  return key;
}

/**
 * Autentica por credencial de serviço com escopo `secrets.read`; se não houver,
 * tenta cookie de admin.
 *
 * T2.2a (spec 090): antes bastava o `SERVICE_SECRET` global — o **mesmo** valor
 * que abre `/internal/users/:id`. Essa rota devolve segredo **decifrado** (chave
 * da DeepSeek, entre outros), então na prática todo serviço que resolvia e-mail
 * de usuário também podia ler a chave de API de qualquer um. O escopo
 * `secrets.read` separa as duas capacidades. O fallback pelo segredo global saiu
 * em 2026-08-07 (T2.2a-op, passo 6), depois de confirmado que nenhum consumidor
 * o usava; restam dois caminhos, credencial com escopo ou cookie de admin.
 *
 * O parâmetro `env` saiu junto: existia só para ler `SERVICE_SECRET`. A chave de
 * cifra (`ACCOUNTS_SECRETS_KEY`) é lida pelos handlers, que recebem `env` por
 * `createAdminSecretsRoutes`, não por este guard.
 */
export function requireServiceOrAdmin(db: Kysely<Database>) {
  const currentAdmin = requireCurrentAdmin(db);

  return (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers['x-service-token'];

    // Resolução direta, sem passar pelo guard de rota: aqui a falha de
    // autenticação de serviço **não** encerra a resposta — cai no fallback de
    // admin. Envolver `requireServiceCredential` num `res` sintético para
    // capturar isso confundiria 403 de escopo com 401 de credencial ausente, e a
    // diferença importa: escopo insuficiente é erro de configuração e precisa
    // aparecer como tal, não virar "tente com cookie".
    void resolveServiceCredential(db, header)
      .then((identity) => {
        if (identity) {
          if (!hasScope(identity, 'secrets.read')) {
            // Credencial válida sem escopo de segredo: 403 explícito. Não cair no
            // fallback de admin — mascararia configuração errada de escopo.
            res.status(403).json({ error: 'insufficient_scope' });
            return;
          }
          (req as ServiceAuthenticatedRequest).serviceCredential = identity;
          void touchServiceCredential(db, identity.credentialId);
          return next();
        }

        // Fallback: cookie de admin (usuário logado).
        // requireAuth popula req.session a partir do cookie; sem ele o guard de
        // admin nunca veria a sessão e devolveria 403 sempre (REV-017).
        requireAuth(req, res, () => {
          void currentAdmin(req, res, next);
        });
      })
      .catch(next);
  };
}

export function createAdminSecretsRoutes(
  db: Kysely<Database>,
  env: Record<string, string | undefined>,
): Router {
  const router = Router();
  // Revalida no banco: a claim do cookie sobrevive 15 min a um rebaixamento, e
  // sem isto a conta revogada ainda leria e sobrescreveria segredos nessa janela
  // (achado de review, PR #233).
  const currentAdmin = requireCurrentAdmin(db);

  // ── PUT /admin/secrets/:name ────────────────────────────────────────────
  router.put('/admin/secrets/:name', requireAuth, currentAdmin, async (req: Request, res: Response) => {
    try {
      const { name } = req.params;
      // req.body é externo e pode ser null/não-objeto — normalizar antes de extrair (REV-024).
      const body: unknown = req.body;
      const value =
        body && typeof body === 'object' && 'value' in body
          ? (body as { value?: unknown }).value
          : undefined;

      if (typeof value !== 'string' || !value.trim()) {
        return res.status(400).json({ error: 'Campo "value" obrigatório (string não vazia).' });
      }

      const key = getSecretsKey(env);
      const ciphertext = encryptSecret(value.trim(), key);
      const updatedBy = sessionFrom(req)?.user?.id ?? null;

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
  router.get('/admin/secrets/:name', requireServiceOrAdmin(db), async (req: Request, res: Response) => {
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
