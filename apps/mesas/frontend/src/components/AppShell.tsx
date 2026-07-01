import { useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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

const moduleNav: NavItem[] = [
  { label: 'Início', href: '/' },
  { label: 'Catálogo', href: '/catalogo' },
  { label: 'Painel', href: '/painel' },
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
        onLogout={() => { void logout().then(() => window.location.assign(publicOrigin)); }}
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
