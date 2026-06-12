import axios from 'axios';
import { refreshSession } from '@artificio/auth/client';

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
    if (error?.response?.status === 401 && original && !original._retry) {
      original._retry = true;
      const refreshed = await refreshSession();
      if (refreshed) return api(original);
    }
    return Promise.reject(error);
  }
);

export default api;
