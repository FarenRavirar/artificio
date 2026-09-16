import { useCallback, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Footer, Header, NotificationBell, useChangelogBadge, CHANGELOG_UPDATE_MARKERS, type NavItem, type UserMenuItem } from '@artificio/ui';
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

/**
 * Onde o header colapsa para os 4 slots — o MESMO valor de
 * `@media (max-width: 860px)` em `packages/ui/src/styles.css` (T7.1, spec 102).
 *
 * Divergir daqui abre uma faixa de larguras sem busca nenhuma: o CSS já teria mandado o
 * campo embutido para a 2ª linha (ou escondido), e a lupa ainda não teria aparecido.
 */
const HEADER_COLLAPSE_QUERY = '(max-width: 860px)';

/**
 * `true` em ≤860px, onde o header do pacote colapsa (T7.6, spec 102).
 *
 * Existe porque o `Header` compartilhado trata lupa e campo embutido como EXCLUSIVOS:
 * `hasEmbeddedSearch = showSearch && Boolean(onSearchChange)` (`Header.tsx:163`) desliga
 * a lupa, e três guards do pacote travam essa exclusão de propósito
 * (`Header.test.tsx`, `Header.acesso.test.tsx`, `Header.slots.test.tsx`). Fazer os dois
 * coexistirem mudaria o componente dos 5 consumidores para resolver um caso de um app —
 * o app escolhe QUAL das duas props passa, e o pacote fica intocado.
 *
 * `matchMedia` direto, sem hook novo no `packages/ui`: é o precedente do repo
 * (`CatalogFiltersBar.tsx:134` no `mesas`), e o barrel do pacote não exporta nada do tipo.
 *
 * SSR e jsdom sem a API caem no `false` — desktop, o comportamento que já existia. O
 * `subscribe` devolve no-op nesse caso, senão `useSyncExternalStore` chamaria um
 * `addEventListener` inexistente no primeiro render.
 */
function useHeaderColapsado(): boolean {
  const subscribe = useCallback((notificar: () => void) => {
    const mql = globalThis.matchMedia?.(HEADER_COLLAPSE_QUERY);
    // `addEventListener` falta no mock de `test/setup.ts` de alguns apps e no Safari < 14.
    if (!mql?.addEventListener) return () => undefined;
    mql.addEventListener('change', notificar);
    return () => mql.removeEventListener('change', notificar);
  }, []);

  return useSyncExternalStore(
    subscribe,
    () => globalThis.matchMedia?.(HEADER_COLLAPSE_QUERY).matches ?? false,
    // Snapshot do servidor: sem `window`, o header nasce em modo desktop.
    () => false,
  );
}

export const AppShell = ({ children }: AppShellProps) => {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
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

  const headerColapsado = useHeaderColapsado();

  /**
   * Lupa do celular (T7.6, spec 102): leva à busca do módulo, como nos outros 4 apps.
   *
   * `/busca` é alias de `/catalogo` (`App.tsx`), então o destino é o catálogo com o termo
   * preservado. O que já foi digitado vai junto: quem começou a busca no desktop, girou o
   * aparelho e tocou na lupa não perde o termo.
   */
  const handleSearch = () => {
    const termo = searchDraft.trim();
    void navigate({ pathname: '/busca', search: termo ? `?q=${encodeURIComponent(termo)}` : '' });
  };

  return (
    <div className="min-h-screen bg-[var(--canvas)] text-[var(--fg)] flex flex-col">
      {/* Sem `variant`: o chrome segue `:root[data-theme]` por CSS, antes da
          hidratação (T7.4, spec 102). */}
      <Header
        brandHref="/"
        currentHref={pathname}
        userMenu={userMenu}
        showThemeToggle
        showSearch
        /* Lupa no celular, campo no desktop — nunca os dois (T7.6, spec 102).
           O `Header` compartilhado trata as duas formas como exclusivas
           (`hasEmbeddedSearch` em `Header.tsx:163` desliga a lupa), e é o app que escolhe
           qual passar: assim os outros 4 consumidores ficam intocados. Em ≤860px o campo
           embutido ocupava a 2ª linha do grid; a lupa devolve essa linha ao conteúdo e
           padroniza o gesto com `mesas`, `glossario`, `links` e `site`. */
        {...(headerColapsado
          ? { onSearch: handleSearch }
          : {
              searchValue: searchDraft,
              onSearchChange: setSearchDraft,
              searchPlaceholder: 'Buscar por título, autor ou sistema',
              searchLabel: 'Buscar materiais',
            })}
        showChangelog
        onOpenChangelog={openChangelog}
        changelogHasBadge={hasNewUpdate}
        serviceAccount={{ label: 'Conta Downloads', href: '/painel' }}
        actions={<NotificationBell sourceApp="downloads" />}
      />
      <main className="flex-1">{children}</main>
      <Footer moduleLinks={footerModuleLinks} />
      <ChangelogModal isOpen={isChangelogOpen} onClose={() => setIsChangelogOpen(false)} />
    </div>
  );
};
