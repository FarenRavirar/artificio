/**
 * WS3 — Cliente de segredos de admin (accounts. → mesas).
 *
 * Busca segredos cifrados do serviço accounts via HTTP (X-Service-Token),
 * com cache em memória (TTL 5 min) para não bater no accounts a cada parse.
 *
 * Segurança: nunca loga o valor do segredo; nunca expõe SERVICE_CREDENTIAL.
 */

import { moduleOrigin } from '@artificio/config';

const ACCOUNTS_ORIGIN = moduleOrigin('accounts');
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

interface CacheEntry {
  value: string;
  fetchedAt: number;
}

const cache = new Map<string, CacheEntry>();

function getServiceCredential(): string | undefined {
  // T2.2a (spec 090): `SERVICE_CREDENTIAL` é a credencial registrada no formato
  // `<token_id>.<segredo>`, que identifica este app e o realm no `accounts.` e
  // carrega o escopo `secrets.read`. O fallback pelo `SERVICE_SECRET` global saiu
  // em 2026-08-07 (T2.2a-op, passo 6): ele não distinguia quem chamou nem de qual
  // realm, e o compose agora exige a credencial com `:?`.
  //
  // `|| undefined` normaliza string vazia — sem isso o guard do chamador passaria
  // batido e a requisição sairia com header vazio.
  return process.env.SERVICE_CREDENTIAL || undefined;
}

/**
 * Busca um segredo do accounts. Cache em memória com TTL de 5 min.
 * Retorna null se o segredo não existir, falhar a rede ou SERVICE_CREDENTIAL não estiver configurado.
 */
export async function getSecret(name: string): Promise<string | null> {
  const cached = cache.get(name);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.value;
  }

  const serviceCredential = getServiceCredential();
  if (!serviceCredential) {
    console.warn('[adminSecrets] SERVICE_CREDENTIAL não configurado — segredos indisponíveis.');
    return null;
  }

  try {
    const res = await fetch(`${ACCOUNTS_ORIGIN}/admin/secrets/${name}`, {
      method: 'GET',
      headers: {
        'X-Service-Token': serviceCredential,
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      if (res.status === 404) {
        return null; // segredo não configurado ainda
      }
      console.warn(`[adminSecrets] GET ${name} -> HTTP ${res.status}`);
      // 5xx/instabilidade temporária: usa cache stale se houver, em vez de
      // desligar o enrichment sem necessidade (REV-032).
      return cached?.value ?? null;
    }

    const body = await res.json() as { data?: { value?: string } };
    const value = body?.data?.value;
    if (typeof value !== 'string') return null;

    cache.set(name, { value, fetchedAt: Date.now() });
    return value;
  } catch (error: unknown) {
    console.warn('[adminSecrets] fetch failed:', error instanceof Error ? error.message : 'unknown');
    // Em falha de rede, retorna cache stale se existir
    return cached?.value ?? null;
  }
}

/** Limpa o cache (útil para testes). */
export function clearSecretCache(): void {
  cache.clear();
}
