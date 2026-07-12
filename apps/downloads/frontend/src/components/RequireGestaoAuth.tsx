import type { ReactNode } from 'react';
import { useSession, redirectToLogin } from '@artificio/auth/client';
import { AppShell } from './AppShell';
import { useCreatorRole } from '../hooks/useCreatorRole';

// T1.x (spec 075) — guard de /gestao/*: exige sessao SSO + role
// moderator/admin no dominio downloads (download_creator.role). Backend
// valida de verdade em cada rota /admin/*; isso e so UX (evita expor o link
// e a tela pra quem nao tem acesso).
export function RequireGestaoAuth({ children }: { children: ReactNode }) {
  const { user, loading: sessionLoading } = useSession();
  const { data: creatorRole, isLoading: roleLoading } = useCreatorRole();

  if (sessionLoading || (user && roleLoading)) {
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

  const hasAccess = creatorRole?.role === 'moderator' || creatorRole?.role === 'admin';

  if (!hasAccess) {
    return (
      <AppShell>
        <div className="mx-auto max-w-2xl px-4 py-16 text-center text-white/70">
          Você não tem permissão para acessar a gestão do downloads.
        </div>
      </AppShell>
    );
  }

  return <>{children}</>;
}
