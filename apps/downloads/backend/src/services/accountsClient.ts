import { fetch as undiciFetch } from 'undici';

// T3.2 (spec 083) — resolve e-mail/nome do autor via rota interna
// server-to-server de accounts. (GET /internal/users/:id, X-Service-Token).
// Nunca lanca: qualquer falha (timeout, 404, secret ausente/errado) retorna
// null e loga o motivo, para nao travar o fluxo de moderacao que depende
// disso so para enviar e-mail (best-effort). undici explicito (mesmo padrao
// de linkChecker.ts), nao fetch global.
const REQUEST_TIMEOUT_MS = 2000;

export interface ResolvedUser {
  email: string;
  displayName: string;
}

export async function resolveUserEmail(userId: string): Promise<ResolvedUser | null> {
  const baseUrl = process.env.ACCOUNTS_URL;
  const serviceSecret = process.env.SERVICE_SECRET;

  if (!baseUrl || !serviceSecret) {
    console.warn('[accountsClient] ACCOUNTS_URL ou SERVICE_SECRET não configurado — não é possível resolver e-mail do autor.');
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await undiciFetch(`${baseUrl}/internal/users/${encodeURIComponent(userId)}`, {
      headers: { 'X-Service-Token': serviceSecret },
      signal: controller.signal,
    });

    if (response.status === 404) {
      console.warn(`[accountsClient] Usuário ${userId} não encontrado em accounts.`);
      return null;
    }

    if (!response.ok) {
      console.warn(`[accountsClient] Falha ao resolver usuário ${userId}: HTTP ${response.status}`);
      return null;
    }

    const body = (await response.json()) as { email?: unknown; display_name?: unknown };
    if (typeof body.email !== 'string' || typeof body.display_name !== 'string') {
      console.warn(`[accountsClient] Resposta inválida ao resolver usuário ${userId}.`);
      return null;
    }

    return { email: body.email, displayName: body.display_name };
  } catch (error: unknown) {
    const reason = error instanceof Error && error.name === 'AbortError' ? 'timeout' : error;
    console.warn(`[accountsClient] Falha ao resolver usuário ${userId}:`, reason);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
