import { createContext, useContext } from 'react';

// Tipos + contexto + hook + helper de auth. Separado de AuthContext.tsx (que só
// exporta o componente AuthProvider) por causa do react-refresh.

export interface User {
  id: string;
  full_name: string;
  username?: string;
  email: string;
  role: 'admin' | 'member';
}

export interface AuthContextType {
  user: User | null;
  login: () => void;
  logout: () => void;
  setUser: (user: User | null) => void;
  refresh: () => Promise<void>;
  loading: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function getSsoReturnUrl(currentHref = window.location.href): string {
  const currentUrl = new URL(currentHref);
  const normalizedPath = currentUrl.pathname.replace(/\/+$/, '') || '/';

  if (normalizedPath === '/login') {
    return `${currentUrl.origin}/`;
  }

  return currentUrl.href;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
};
