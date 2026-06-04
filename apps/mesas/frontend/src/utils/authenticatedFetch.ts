// CORREÇÃO C01, C02, C03, C04: Helper centralizado para requests autenticadas
// Todas as requests autenticadas devem usar credentials: 'include' para enviar cookie

const API_BASE = import.meta.env.VITE_API_URL || '';

interface FetchOptions extends RequestInit {
  headers?: Record<string, string>;
}

/**
 * Wrapper para fetch que adiciona automaticamente credentials: 'include'
 * para enviar cookie de sessão HttpOnly
 */
export const authenticatedFetch = async (
  endpoint: string,
  options: FetchOptions = {}
): Promise<Response> => {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;

  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  return fetch(url, {
    ...options,
    headers: defaultHeaders,
    credentials: 'include', // SEMPRE envia cookie artificio_session
  });
};

/**
 * Helper para requests GET autenticadas
 */
export const authGet = (endpoint: string, options: FetchOptions = {}) => {
  return authenticatedFetch(endpoint, { ...options, method: 'GET' });
};

/**
 * Helper para requests POST autenticadas
 */
export const authPost = (endpoint: string, body?: unknown, options: FetchOptions = {}) => {
  return authenticatedFetch(endpoint, {
    ...options,
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });
};

/**
 * Helper para requests PUT autenticadas
 */
export const authPut = (endpoint: string, body?: unknown, options: FetchOptions = {}) => {
  return authenticatedFetch(endpoint, {
    ...options,
    method: 'PUT',
    body: body ? JSON.stringify(body) : undefined,
  });
};

/**
 * Helper para requests PATCH autenticadas
 */
export const authPatch = (endpoint: string, body?: unknown, options: FetchOptions = {}) => {
  return authenticatedFetch(endpoint, {
    ...options,
    method: 'PATCH',
    body: body ? JSON.stringify(body) : undefined,
  });
};

/**
 * Helper para requests DELETE autenticadas
 */
export const authDelete = (endpoint: string, options: FetchOptions = {}) => {
  return authenticatedFetch(endpoint, { ...options, method: 'DELETE' });
};
