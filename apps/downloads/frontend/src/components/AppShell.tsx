import { useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Footer, Header, useTheme, useChangelogBadge, CHANGELOG_UPDATE_MARKERS, type NavItem, type UserMenuItem } from '@artificio/ui';
import { ChangelogModal } from './ChangelogModal';

interface AppShellProps {
  children: ReactNode;
}

const userMenu: UserMenuItem[] = [
  { label: 'Painel', href: '/painel' },
  { label: 'Gestão', href: '/gestao', adminOnly: true },
];

// T4.2 (spec 073) — submenu Downloads reaproveitando o mesmo Header
// compartilhado dos outros módulos (mesas/glossario/site/links).
const moduleNav: NavItem[] = [
  { label: 'Início', href: '/' },
  { label: 'Catálogo', href: '/catalogo' },
];

export const AppShell = ({ children }: AppShellProps) => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { hasNewUpdate, markSeen } = useChangelogBadge('downloads_last_seen_update', CHANGELOG_UPDATE_MARKERS.downloads);
  const [isChangelogOpen, setIsChangelogOpen] = useState(false);

  const handleSearch = () => {
    navigate('/catalogo');
  };

  const openChangelog = () => {
    setIsChangelogOpen(true);
    markSeen();
  };

  return (
    <div className="min-h-screen bg-[var(--color-artificio-blue)] text-white flex flex-col">
      <Header
        variant={theme === 'light' ? 'light' : 'dark'}
        brandHref="/"
        currentHref={pathname}
        moduleNav={moduleNav}
        moduleCurrentHref={pathname}
        userMenu={userMenu}
        showThemeToggle
        showSearch
        onSearch={handleSearch}
        showChangelog
        onOpenChangelog={openChangelog}
        changelogHasBadge={hasNewUpdate}
        serviceAccount={{ label: 'Conta Downloads', href: '/painel' }}
      />
      <main className="flex-1">{children}</main>
      <Footer />
      <ChangelogModal isOpen={isChangelogOpen} onClose={() => setIsChangelogOpen(false)} />
    </div>
  );
};
