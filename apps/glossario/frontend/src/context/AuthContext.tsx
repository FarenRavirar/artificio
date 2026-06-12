import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { redirectToLogin, logout as ssoLogout } from '@artificio/auth/client';
import api from '../services/api';

interface User {
  id: string;
  full_name: string;
  username?: string;
  email: string;
  role: 'admin' | 'member';
}

interface AuthContextType {
  user: User | null;
  login: () => void;
  logout: () => void;
  setUser: (user: User | null) => void;
  refresh: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Resolve a sessão local do glossário a partir do cookie SSO (account-linking
  // no backend). 401 → não logado (o interceptor já tentou refresh).
  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get('/auth/me');
      setUser(data);
    } catch (err) {
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

  // Login = Google OAuth via accounts. (D018). Volta para a URL atual.
  const login = () => redirectToLogin();

  // Logout = encerra a sessão SSO no accounts (limpa cookie do domínio) e recarrega.
  const logout = () => ssoLogout(window.location.origin);

  return (
    <AuthContext.Provider value={{ user, login, logout, setUser, refresh, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
};
