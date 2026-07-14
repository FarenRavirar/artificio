import { refreshSession } from '@artificio/auth/client';
import { showError } from '../utils/toast';

const API_BASE = import.meta.env.VITE_API_URL || '';

interface ApiClientOptions extends RequestInit {
  skipErrorToast?: boolean;
  skipRetry?: boolean;
}

// ─── Retry config ────────────────────────────────────────────────────────────

const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
};

// ─── Deduplication ───────────────────────────────────────────────────────────

const pendingRequests = new Map<string, AbortController>();

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getRetryDelay(attempt: number): number {
  const delay = RETRY_CONFIG.baseDelay * Math.pow(2, attempt);
  return Math.min(delay, RETRY_CONFIG.maxDelay);
}

function hasStatus(error: unknown): error is { status: number } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    typeof (error as { status: unknown }).status === 'number'
  );
}

function isAbortError(error: unknown): error is { name: 'AbortError' } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name: unknown }).name === 'AbortError'
  );
}

function shouldRetry(error: unknown, attempt: number): boolean {
  if (attempt >= RETRY_CONFIG.maxRetries) return false;

  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true;
  }
  if (hasStatus(error) && error.status >= 500 && error.status < 600) {
    return true;
  }
  if (hasStatus(error) && error.status === 429) {
    return true;
  }
  return false;
}

/**
 * Resolve URL: adiciona API_BASE se o endpoint for relativo.
 */
function resolveUrl(endpoint: string): string {
  return endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
}

/**
 * Core HTTP executor — retry + dedup + refresh-on-401.
 * Retorna Response (sem parse JSON). Ambos os wrappers (apiClient<T> e
 * authenticatedFetch) compartilham esta engine.
 */
async function executeHttpRequest(
  url: string,
  init: RequestInit,
  skipRetry: boolean,
): Promise<Response> {
  // REV-055: retry automático só para métodos idempotentes (GET/HEAD)
  // REV-056: dedup de requisição também só para métodos seguros
  const isIdempotent = init.method === 'GET' || init.method === 'HEAD' || !init.method;
  const effectiveSkipRetry = skipRetry || !isIdempotent;

  const requestKey = `${init.method || 'GET'}:${url}`;

  // REV-056: Cancelar requisição duplicada anterior — só para métodos seguros.
  // Log só em dev (achado do mantenedor 2026-07-14, DEB-077-04): esperado em
  // StrictMode/re-render rápido (2+ efeitos pedindo o mesmo GET no mount), a
  // chamada sobrevivente resolve normal — mas poluía o console em produção.
  if (isIdempotent && pendingRequests.has(requestKey)) {
    if (import.meta.env.DEV) {
      console.log('[api] Cancelando requisição duplicada:', requestKey);
    }
    pendingRequests.get(requestKey)?.abort();
  }

  const controller = new AbortController();
  // REV-056: só registrar no mapa de dedup para métodos seguros (GET/HEAD)
  if (isIdempotent) {
    pendingRequests.set(requestKey, controller);
  }

  // REV-039/057: Encadear AbortSignal externo ao controller interno para que
  // abort() do caller (ex.: useMestre, useMestreInsights) cancele a requisição.
  if (init.signal) {
    if (init.signal.aborted) {
      controller.abort();
    } else {
      init.signal.addEventListener('abort', () => controller.abort(), { once: true });
    }
  }

  let lastError: unknown;
  let authRefreshed = false;
  // REV-055: usa effectiveSkipRetry que desabilita retry em POST/PUT/PATCH/DELETE
  const maxAttempts = effectiveSkipRetry ? 0 : RETRY_CONFIG.maxRetries;

  for (let attempt = 0; attempt <= maxAttempts; attempt++) {
    try {
      const isFormData = init.body instanceof FormData;
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
        credentials: 'include',
        headers: isFormData
          ? { ...(init.headers as Record<string, string> | undefined) }
          : {
              'Content-Type': 'application/json',
              ...(init.headers as Record<string, string> | undefined),
            },
      });

      pendingRequests.delete(requestKey);

      // ── Refresh-on-401 (D20-P1) ──
      if (response.status === 401 && !authRefreshed) {
        authRefreshed = true;
        const refreshed = await refreshSession();
        if (refreshed) {
          // Repetir a requisição com novo access token
          attempt = -1; // reinicia contagem
          continue;
        }
        // Refresh falhou → devolve o 401 original
        return response;
      }

      // ── Retry 5xx / 429 (REV-055: só para métodos idempotentes) ──
      if (
        !effectiveSkipRetry &&
        !response.ok &&
        (response.status >= 500 || response.status === 429) &&
        attempt < RETRY_CONFIG.maxRetries
      ) {
        const delay = getRetryDelay(attempt);
        console.log(`[api] Retry ${attempt + 1}/${RETRY_CONFIG.maxRetries} em ${delay}ms para ${requestKey}`);
        await sleep(delay);
        continue;
      }

      return response;

    } catch (err: unknown) {
      if (isAbortError(err)) {
        pendingRequests.delete(requestKey);
        throw err;
      }

      lastError = err;

      if (!effectiveSkipRetry && shouldRetry(err, attempt)) {
        const delay = getRetryDelay(attempt);
        console.log(`[api] Retry ${attempt + 1}/${RETRY_CONFIG.maxRetries} em ${delay}ms para ${requestKey}`);
        await sleep(delay);
        continue;
      }

      pendingRequests.delete(requestKey);

      if (err instanceof TypeError && err.message.includes('fetch')) {
        throw new Error('Erro de conexão. Verifique sua internet e tente novamente.', { cause: err });
      }
      throw err;
    }
  }

  pendingRequests.delete(requestKey);
  throw lastError;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Wrapper tipado (apiClient<T>) — mantido para consumidores existentes
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Cliente HTTP tipado. Retorna `Promise<T>`, lança erro com toast.
 *
 * Features (D20-P1 unificadas):
 * - refresh-on-401 (antes só do authenticatedFetch)
 * - retry exp backoff (antes só do apiClient)
 * - deduplication (antes só do apiClient)
 * - credenciais automáticas (ambos)
 */
export async function apiClient<T>(
  url: string,
  options: ApiClientOptions = {},
): Promise<T> {
  const { skipErrorToast = false, skipRetry = false, ...fetchOptions } = options;

  const fullUrl = resolveUrl(url);
  const response = await executeHttpRequest(fullUrl, fetchOptions, skipRetry);

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    const message = error?.error || `Erro na requisição (${response.status})`;

    if (!skipErrorToast) {
      showError(message);
    }
    throw new Error(message);
  }

  return response.json();
}

export const api = {
  get: <T>(url: string, options?: ApiClientOptions) =>
    apiClient<T>(url, { ...options, method: 'GET' }),

  post: <T>(url: string, data?: unknown, options?: ApiClientOptions) =>
    apiClient<T>(url, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    }),

  patch: <T>(url: string, data?: unknown, options?: ApiClientOptions) =>
    apiClient<T>(url, {
      ...options,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    }),

  delete: <T>(url: string, options?: ApiClientOptions) =>
    apiClient<T>(url, { ...options, method: 'DELETE' }),
};

// ═══════════════════════════════════════════════════════════════════════════════
// Wrapper raw Response (authenticatedFetch) — mantido para consumidores existentes
// ═══════════════════════════════════════════════════════════════════════════════

type FetchOptions = RequestInit;

/**
 * Wrapper que retorna `Response` (ao contrário de apiClient<T>).
 * Usa a mesma engine `executeHttpRequest` com refresh + retry + dedup.
 */
export const authenticatedFetch = async (
  endpoint: string,
  options: FetchOptions = {},
): Promise<Response> => {
  const url = resolveUrl(endpoint);
  return executeHttpRequest(url, options, false);
};

export const authGet = (endpoint: string, options: FetchOptions = {}) =>
  authenticatedFetch(endpoint, { ...options, method: 'GET' });

export const authPost = (endpoint: string, body?: unknown, options: FetchOptions = {}) =>
  authenticatedFetch(endpoint, {
    ...options,
    method: 'POST',
    body: body instanceof FormData ? body : (body ? JSON.stringify(body) : undefined),
  });

export const authPut = (endpoint: string, body?: unknown, options: FetchOptions = {}) =>
  authenticatedFetch(endpoint, {
    ...options,
    method: 'PUT',
    body: body instanceof FormData ? body : (body ? JSON.stringify(body) : undefined),
  });

export const authPatch = (endpoint: string, body?: unknown, options: FetchOptions = {}) =>
  authenticatedFetch(endpoint, {
    ...options,
    method: 'PATCH',
    body: body instanceof FormData ? body : (body ? JSON.stringify(body) : undefined),
  });

export const authDelete = (endpoint: string, options: FetchOptions = {}) =>
  authenticatedFetch(endpoint, { ...options, method: 'DELETE' });
