import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { getAccountsOrigin, useSession } from '@artificio/auth/client';
import { AuthContext, isValidRole } from './authContextCore';
import type { User } from './authContextCore';
import { authGet } from '../services/apiClient';

export type { User } from './authContextCore';

const mapSsoRole = (role: 'user' | 'admin'): User['role'] => role === 'admin' ? 'admin' : 'player';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const session = useSession();
  const [localUser, setLocalUser] = useState<User | null>(null);
  const [isLocalLoading, setIsLocalLoading] = useState(false);

  const clearSession = useCallback(() => {
    setLocalUser(null);
  }, []);

  const refreshSession = useCallback(async () => {
    if (!session.user) {
      clearSession();
      return;
    }

    setIsLocalLoading(true);
    try {
      const meRes = await authGet('/api/v1/me');

      if (meRes.status === 401 || meRes.status === 403 || meRes.status === 404) {
        return;
      }

      if (!meRes.ok) {
        throw new Error(`Falha ao consultar perfil local: ${meRes.status}`);
      }

      const meJson = await meRes.json();
      const apiUser = meJson?.data?.user;
      const displayName = meJson?.data?.profile?.display_name;

      if (apiUser?.id && isValidRole(apiUser.role)) {
        setLocalUser({
          id: apiUser.id,
          role: apiUser.role,
          name: displayName ?? session.user.name,
          avatar_url: session.user.avatar ?? undefined,
        });
      }
    } catch (error) {
      console.warn('[AuthContext] Erro ao hidratar perfil local:', error);
    } finally {
      setIsLocalLoading(false);
    }
  }, [clearSession, session.user]);

  useEffect(() => {
    void (async () => { await refreshSession(); })();
  }, [refreshSession]);

  const logout = useCallback(async () => {
    try {
      await fetch(`${getAccountsOrigin()}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.warn('[AuthContext] Falha ao chamar logout SSO:', error);
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const user = useMemo<User | null>(() => {
    if (!session.user) return null;
    return localUser ?? {
      id: session.user.id,
      role: mapSsoRole(session.user.role),
      name: session.user.name,
      avatar_url: session.user.avatar ?? undefined,
    };
  }, [localUser, session.user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: user !== null,
        isLoading: session.loading || isLocalLoading,
        refreshSession,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
