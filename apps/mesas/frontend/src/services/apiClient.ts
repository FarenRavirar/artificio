import { showError } from '../utils/toast';

const API_BASE = import.meta.env.VITE_API_URL || '';

interface ApiClientOptions extends RequestInit {
  skipErrorToast?: boolean;
  skipRetry?: boolean;
}

/**
 * Configuração de retry
 */
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
};

/**
 * Mapa de requisições em andamento para deduplication
 */
const pendingRequests = new Map<string, AbortController>();

/**
 * Sleep helper para retry
 */
async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calcula delay para retry com exponential backoff
 */
function getRetryDelay(attempt: number): number {
  const delay = RETRY_CONFIG.baseDelay * Math.pow(2, attempt);
  return Math.min(delay, RETRY_CONFIG.maxDelay);
}

/**
 * Verifica se deve fazer retry
 */
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
  
  // Retry em erros de rede
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true;
  }
  
  // Retry em 5xx (server errors)
  if (hasStatus(error) && error.status >= 500 && error.status < 600) {
    return true;
  }
  
  // Retry em 429 (rate limit)
  if (hasStatus(error) && error.status === 429) {
    return true;
  }
  
  return false;
}

/**
 * Cliente HTTP padronizado para todas as requisições da aplicação
 * 
 * Features:
 * - Configuração global (credentials, headers)
 * - Tratamento de erro centralizado
 * - Retry automático com exponential backoff
 * - AbortController para cancelamento
 * - Request deduplication
 * - Tipagem forte
 * - Toast automático de erros
 */
export async function apiClient<T>(
  url: string,
  options: ApiClientOptions = {}
): Promise<T> {
  const { skipErrorToast = false, skipRetry = false, ...fetchOptions } = options;
  
  // Request deduplication key
  const requestKey = `${fetchOptions.method || 'GET'}:${url}`;
  
  // Cancelar requisição anterior se existir
  if (pendingRequests.has(requestKey)) {
    console.log('[apiClient] Cancelando requisição duplicada:', requestKey);
    pendingRequests.get(requestKey)?.abort();
  }
  
  // Criar novo AbortController
  const controller = new AbortController();
  pendingRequests.set(requestKey, controller);
  
  let lastError: unknown;
  
  // Retry loop
  for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
    try {
      const response = await fetch(`${API_BASE}${url}`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(fetchOptions.headers || {}),
        },
        signal: controller.signal,
        ...fetchOptions,
      });
      
      // Limpar pending request
      pendingRequests.delete(requestKey);
      
      if (!response.ok) {
        const error = await response.json().catch(() => null);
        const message = error?.error || `Erro na requisição (${response.status})`;
        
        lastError = { message, status: response.status };
        
        // Verificar se deve fazer retry
        if (!skipRetry && shouldRetry(lastError, attempt)) {
          const delay = getRetryDelay(attempt);
          console.log(`[apiClient] Retry ${attempt + 1}/${RETRY_CONFIG.maxRetries} em ${delay}ms para ${requestKey}`);
          await sleep(delay);
          continue;
        }
        
        // Exibir toast de erro
        if (!skipErrorToast) {
          showError(message);
        }
        
        throw new Error(message);
      }
      
      return response.json();
      
    } catch (err: unknown) {
      lastError = err;
      
      // Requisição cancelada (não é erro)
      if (isAbortError(err)) {
        console.log('[apiClient] Requisição cancelada:', requestKey);
        throw err;
      }
      
      // Verificar se deve fazer retry
      if (!skipRetry && shouldRetry(err, attempt)) {
        const delay = getRetryDelay(attempt);
        console.log(`[apiClient] Retry ${attempt + 1}/${RETRY_CONFIG.maxRetries} em ${delay}ms para ${requestKey}`);
        await sleep(delay);
        continue;
      }
      
      // Limpar pending request
      pendingRequests.delete(requestKey);
      
      // Erro de rede
      if (err instanceof TypeError && err.message.includes('fetch')) {
        const message = 'Erro de conexão. Verifique sua internet e tente novamente.';
        if (!skipErrorToast) {
          showError(message);
        }
        throw new Error(message);
      }
      
      throw err;
    }
  }
  
  // Se chegou aqui, esgotou todas as tentativas
  pendingRequests.delete(requestKey);
  throw lastError;
}

/**
 * API helpers com métodos HTTP
 */
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
