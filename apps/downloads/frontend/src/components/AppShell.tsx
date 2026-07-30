import { useEffect, useState, type ReactNode } from 'react';
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
// Spec 086 (T10.2/T10.3) — "Sobre e uso" sai do moduleNav (não é catálogo,
// é 100% institucional: D119, PWYW, download, moderação, direitos
// autorais) e vira link no footer via Footer.moduleLinks (packages/ui,
// spec 086 T10.1). Rota /sobre-e-uso preservada no router (SEO, sem 404).
const footerModuleLinks: NavItem[] = [{ label: 'Sobre e uso', href: '/sobre-e-uso' }];
const SEARCH_DEBOUNCE_MS = 300;

export const AppShell = ({ children }: AppShellProps) => {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { hasNewUpdate, markSeen } = useChangelogBadge('downloads_last_seen_update', CHANGELOG_UPDATE_MARKERS.downloads);
  const [isChangelogOpen, setIsChangelogOpen] = useState(false);
  const urlSearchValue = new URLSearchParams(search).get('q') ?? '';
  const [searchDraft, setSearchDraft] = useState(urlSearchValue);
  const [lastUrlSearchValue, setLastUrlSearchValue] = useState(urlSearchValue);

  // Mantém o input alinhado com voltar/avançar e links compartilhados sem
  // efeito que cause render em cascata. Mesmo padrão já usado na página do
  // catálogo antes de a busca subir para o Header compartilhado.
  if (lastUrlSearchValue !== urlSearchValue) {
    setLastUrlSearchValue(urlSearchValue);
    setSearchDraft(urlSearchValue);
  }

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (searchDraft === urlSearchValue) return;

      const isCatalogRoute = pathname === '/' || pathname === '/catalogo';
      const next = new URLSearchParams(isCatalogRoute ? search : '');
      if (searchDraft) next.set('q', searchDraft);
      else next.delete('q');
      next.set('page', '1');

      const serialized = next.toString();
      void navigate(
        {
          pathname: isCatalogRoute ? pathname : '/catalogo',
          search: serialized ? `?${serialized}` : '',
        },
        { replace: isCatalogRoute },
      );
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timeout);
  }, [navigate, pathname, search, searchDraft, urlSearchValue]);

  const openChangelog = () => {
    setIsChangelogOpen(true);
    markSeen();
  };

  return (
    <div className="min-h-screen bg-[var(--canvas)] text-[var(--fg)] flex flex-col">
      <Header
        variant={theme === 'light' ? 'light' : 'dark'}
        brandHref="/"
        currentHref={pathname}
        userMenu={userMenu}
        showThemeToggle
        showSearch
        searchValue={searchDraft}
        onSearchChange={setSearchDraft}
        searchPlaceholder="Buscar por título, autor ou sistema"
        searchLabel="Buscar materiais"
        showChangelog
        onOpenChangelog={openChangelog}
        changelogHasBadge={hasNewUpdate}
        serviceAccount={{ label: 'Conta Downloads', href: '/painel' }}
      />
      <main className="flex-1">{children}</main>
      <Footer variant={theme === 'light' ? 'light' : 'dark'} moduleLinks={footerModuleLinks} />
      <ChangelogModal isOpen={isChangelogOpen} onClose={() => setIsChangelogOpen(false)} />
    </div>
  );
};
