import { createContext } from 'react';

export interface User {
  id: string;
  role: 'visitor' | 'player' | 'gm' | 'admin';
  name?: string;
  avatar_url?: string;
}

export interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  refreshSession: () => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const isValidRole = (value: unknown): value is User['role'] => {
  return value === 'visitor' || value === 'player' || value === 'gm' || value === 'admin';
};
