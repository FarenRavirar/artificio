import { moduleOrigin } from '@artificio/config';

// Fase 4 (spec 084) — cliente de segredos de admin (accounts. -> downloads),
// mesmo protocolo ja usado em apps/mesas/backend/src/services/adminSecrets.ts
// (GET /admin/secrets/:name via X-Service-Token, cache 5min) — nao pode
// importar direto de outro app (isolamento), entao replica o mesmo cliente
// aqui reusando SERVICE_SECRET ja configurado em downloads (spec 083).
// Usado por languageDetector.ts pra buscar deepseek_api_key.
const ACCOUNTS_ORIGIN = moduleOrigin('accounts');
const CACHE_TTL_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 5000;

interface CacheEntry {
  value: string;
  fetchedAt: number;
}

const cache = new Map<string, CacheEntry>();

export async function getSecret(name: string): Promise<string | null> {
  const cached = cache.get(name);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.value;
  }

  const serviceSecret = process.env.SERVICE_SECRET;
  if (!serviceSecret) {
    console.warn('[secretsClient] SERVICE_SECRET não configurado — segredos indisponíveis.');
    return null;
  }

  try {
    const res = await fetch(`${ACCOUNTS_ORIGIN}/admin/secrets/${name}`, {
      method: 'GET',
      headers: { 'X-Service-Token': serviceSecret, Accept: 'application/json' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!res.ok) {
      if (res.status === 404) return null;
      console.warn(`[secretsClient] GET ${name} -> HTTP ${res.status}`);
      return cached?.value ?? null;
    }

    const body = (await res.json()) as { data?: { value?: string } };
    const value = body?.data?.value;
    if (typeof value !== 'string') return null;

    cache.set(name, { value, fetchedAt: Date.now() });
    return value;
  } catch (error: unknown) {
    console.warn('[secretsClient] fetch failed:', error instanceof Error ? error.message : 'unknown');
    return cached?.value ?? null;
  }
}

export function clearSecretCache(): void {
  cache.clear();
}
