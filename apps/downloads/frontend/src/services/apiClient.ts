const API_BASE_URL = import.meta.env.VITE_API_URL ?? '';

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${API_BASE_URL}${path}`, {
    credentials: 'include',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
}

export function apiGet(path: string): Promise<Response> {
  return apiFetch(path, { method: 'GET' });
}

export function apiPost(path: string, body?: unknown): Promise<Response> {
  return apiFetch(path, { method: 'POST', body: body !== undefined ? JSON.stringify(body) : undefined });
}

export function apiPut(path: string, body?: unknown): Promise<Response> {
  return apiFetch(path, { method: 'PUT', body: body !== undefined ? JSON.stringify(body) : undefined });
}

export function apiPatch(path: string, body?: unknown): Promise<Response> {
  return apiFetch(path, { method: 'PATCH', body: body !== undefined ? JSON.stringify(body) : undefined });
}

export function apiDelete(path: string): Promise<Response> {
  return apiFetch(path, { method: 'DELETE' });
}
