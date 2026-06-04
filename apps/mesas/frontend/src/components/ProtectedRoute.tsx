import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import { startSsoLogin } from '../utils/auth';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: 'visitor' | 'player' | 'gm' | 'admin';
}

export const ProtectedRoute = ({ children, requiredRole }: ProtectedRouteProps) => {
  // CORREÇÃO B06: Usar isAuthenticated em vez de token
  const { isAuthenticated, user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <main className="min-h-screen bg-[var(--color-artificio-blue)] text-white flex items-center justify-center">
        <div id="protected-route-loading" className="animate-pulse text-white/70">
          Validando sessão...
        </div>
      </main>
    );
  }

  if (!isAuthenticated) {
    return <SsoRedirect returnPath={`${location.pathname}${location.search}${location.hash}`} />;
  }

  if (requiredRole && user?.role !== requiredRole) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

const SsoRedirect = ({ returnPath }: { returnPath: string }) => {
  useEffect(() => {
    startSsoLogin(returnPath);
  }, [returnPath]);

  return <Navigate to="/login" replace />;
};
