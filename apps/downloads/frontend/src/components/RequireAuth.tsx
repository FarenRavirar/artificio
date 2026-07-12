import type { ReactNode } from 'react';
import { useSession, redirectToLogin } from '@artificio/auth/client';
import { AppShell } from './AppShell';

// T4.2 (spec 074) — guard de painel: sem sessao SSO, redireciona pro login
// do accounts. (mesmo padrao do useSession usado em apps/mesas/frontend).
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useSession();

  if (loading) {
    return (
      <AppShell>
        <div className="mx-auto max-w-2xl px-4 py-16 text-center text-white/70">Carregando...</div>
      </AppShell>
    );
  }

  if (!user) {
    redirectToLogin();
    return (
      <AppShell>
        <div className="mx-auto max-w-2xl px-4 py-16 text-center text-white/70">Redirecionando para login...</div>
      </AppShell>
    );
  }

  return <>{children}</>;
}
