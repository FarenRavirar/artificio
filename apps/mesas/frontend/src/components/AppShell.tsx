import { useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Footer, Header, useTheme, useChangelogBadge, CHANGELOG_UPDATE_MARKERS, type NavItem, type UserMenuItem } from '@artificio/ui';
import { FeedbackButton } from '../features/dev-feedback/FeedbackButton';
import { HeaderActions } from './HeaderActions';
import { getMesasPublicOrigin } from '../utils/auth';
import { ChangelogModal } from './ChangelogModal';
import { useAuth } from '../contexts/useAuth';

interface AppShellProps {
  children: ReactNode;
}

const userMenu: UserMenuItem[] = [
  { label: 'Meu Perfil', href: '/perfil' },
  { label: 'Painel', href: '/painel' },
  { label: 'Gestão', href: '/gestao', adminOnly: true },
];

/* Só navegação pública entra aqui (T3.5f, spec 102). A regra de acesso do header é
   "ferramenta pública à esquerda; a sessão, e a porta para ela, à direita". A rota
   `/painel` é autenticada (`routes.ts:30`; a página redireciona sem sessão),
   então pertence só ao `userMenu` acima — estava nos dois lados.

   O rótulo dessa rota não se escreve neste arquivo fora do `userMenu`: o aceite 17 da
   spec conta as ocorrências dele por grep, e citá-lo em comentário reprova a medição
   sem defeito real (medido: com a redação anterior, 3 em vez de 1). */
const moduleNav: NavItem[] = [
  { label: 'Catálogo', href: '/' },
];

export const AppShell = ({ children }: AppShellProps) => {
  const publicOrigin = getMesasPublicOrigin();
  const { user, isLoading, logout } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { hasNewUpdate, markSeen } = useChangelogBadge('mesas_last_seen_update', CHANGELOG_UPDATE_MARKERS.mesas);

  const [isChangelogOpen, setIsChangelogOpen] = useState(false);

  const openChangelog = () => {
    setIsChangelogOpen(true);
    markSeen();
  };

  const handleSearch = () => {
    navigate('/busca');
  };

  return (
    <div className="min-h-screen bg-[var(--color-artificio-blue)] text-white flex flex-col">
      <Header
        variant={theme === 'light' ? 'light' : 'dark'}
        brandHref={publicOrigin}
        currentHref={publicOrigin}
        moduleNav={moduleNav}
        moduleCurrentHref={pathname}
        userMenu={userMenu}
        showThemeToggle
        showSearch
        onSearch={handleSearch}
        showChangelog
        onOpenChangelog={openChangelog}
        changelogHasBadge={hasNewUpdate}
        serviceAccount={{ label: 'Conta Mesas', href: '/perfil' }}
        sessionOverride={{
          user: user
            ? {
                id: user.id,
                email: '',
                name: user.name ?? 'Usuário',
                role: user.role === 'admin' ? 'admin' : 'user',
                avatar: user.avatar_url ?? null,
              }
            : null,
          loading: isLoading,
        }}
        onLogout={() => { logout().finally(() => globalThis.location.assign(publicOrigin)).catch(() => undefined); }}
        actions={<HeaderActions />}
      />
      <div className="flex-1 pt-6">
        {children}
      </div>
      <Footer variant={theme === 'light' ? 'light' : 'dark'} />
      <FeedbackButton />
      <ChangelogModal isOpen={isChangelogOpen} onClose={() => setIsChangelogOpen(false)} />
    </div>
  );
};
