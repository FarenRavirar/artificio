import React, { useState, useEffect, useCallback } from 'react';
import { redirectToLogin, logout as ssoLogout } from '@artificio/auth/client';
import api from '../services/api';
import { AuthContext, getSsoReturnUrl, type User } from './auth-context';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Resolve a sessão local do glossário a partir do cookie SSO (account-linking
  // no backend). 401 → não logado (o interceptor já tentou refresh).
  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get('/auth/me');
      setUser(data);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data } = await api.get('/auth/me');
        if (active) setUser(data);
      } catch {
        if (active) setUser(null);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Login = Google OAuth via accounts. (D018). A tela /login volta para a home
  // do próprio host; demais rotas voltam para a rota atual.
  const login = () => redirectToLogin(getSsoReturnUrl());

  // Logout = encerra a sessão SSO no accounts (limpa cookie do domínio) e recarrega.
  const logout = () => ssoLogout(window.location.origin);

  return (
    <AuthContext.Provider value={{ user, login, logout, setUser, refresh, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
