import axios from 'axios';
import { refreshSession } from '@artificio/auth/client';
import { recordNetworkEntry } from '../features/dev-feedback/diagnostics';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
  // SSO: sessão via cookie httpOnly `artificio_session` (Domain=.artificiorpg.com).
  // Sem token no cliente. credentials garante o envio do cookie (inclusive em dev cross-origin).
  withCredentials: true,
});

// Ao tomar 401, tenta UM refresh (cookie de refresh 7d → novo access 15m no accounts)
// e repete a request uma vez. Mantém o login persistente (fix de sessão SSO, 356b650).
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    // Captura de rede p/ widget de feedback (Spec 021): só url/método/status.
    const status = error?.response?.status;
    if (typeof status === 'number' && status >= 400 && original) {
      const url = `${original.baseURL ?? ''}${original.url ?? ''}`;
      recordNetworkEntry(url, (original.method ?? 'GET').toUpperCase(), status);
    }
    if (error?.response?.status === 401 && original && !original._retry) {
      original._retry = true;
      const refreshed = await refreshSession();
      if (refreshed) return api(original);
    }
    return Promise.reject(error);
  }
);

export default api;
