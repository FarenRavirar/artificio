import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Megaphone } from 'lucide-react';
import { TableCardComponent, TableCardSkeleton } from '../components/TableCard';
import { FilterDrawer } from '../components/FilterDrawer';
import { CatalogFiltersBar } from '../components/CatalogFiltersBar';
import { CatalogAdvancedFilters } from '../components/CatalogAdvancedFilters';
import { ResultsHeader } from '../components/ResultsHeader';
import { D20Glyph } from '../components/D20Glyph';
import type { CatalogSeal, TableCard } from '../types/tables';
import { applySeo } from '../utils/seo';
import { useInfiniteCatalogTables } from '../hooks/useInfiniteCatalogTables';
import { useCatalogFilters } from '../hooks/useCatalogFilters';
import { useStyleFacets } from '../hooks/useStyleFacets';
import { useSystemsCatalog } from '../hooks/useSystemsCatalog';
import { trackFilterSistema } from '@artificio/analytics';
import { useAuth } from '../contexts/useAuth';
import { startSsoLogin } from '../utils/auth';
import type {
  CatalogFilters,
  ExperienceLevelOption,
  ModalityOption,
  PriceTypeOption,
  StyleOption,
} from '../services/catalogService';
import {
  SORT_VALUES,
  activeCatalogFiltersCount,
  type TableTypeOption,
} from '../utils/catalogFilterOptions';

function pickOption<T extends string>(value: string, validOptions: readonly T[], fallback: T): T {
  return validOptions.includes(value as T) ? (value as T) : fallback;
}

const updateFilter = <K extends keyof CatalogFilters>(
  setFilters: (updater: (prev: CatalogFilters) => CatalogFilters) => void,
  key: K,
  value: CatalogFilters[K]
) => {
  // Achado Codex: qualquer mutação de filtro (exceto page em si) precisa
  // resetar page=1 — com scroll infinito acumulando resultados client-side,
  // trocar filtro sem resetar busca a página N do filtro antigo com o filtro novo.
  setFilters((prev) => ({ ...prev, [key]: value, ...(key === 'page' ? {} : { page: 1 }) }));
};

type AdvancedFiltersDraft = Pick<CatalogFilters, 'experience' | 'type' | 'seal' | 'styles'>;

function advancedFiltersFrom(filters: CatalogFilters): AdvancedFiltersDraft {
  return {
    experience: filters.experience,
    type: filters.type,
    seal: filters.seal,
    styles: [...filters.styles],
  };
}

type CatalogEmptyStateProps = Readonly<{
  activeFiltersCount: number;
  onClearFilters: () => void;
}>;

const CatalogEmptyState = ({ activeFiltersCount, onClearFilters }: CatalogEmptyStateProps) => (
  <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-subtle)] px-4 py-16 text-center sm:py-20">
    <D20Glyph className="mx-auto mb-5 h-16 w-16 text-[var(--fg-muted)]/40" />
    <p className="text-xl font-bold text-[var(--fg)] mb-2">Nenhuma mesa encontrada com esses filtros</p>
    <p className="text-sm text-[var(--fg-muted)] mb-6">Ajuste sistema, modalidade ou estilo, ou limpe os filtros para ver todo o catálogo</p>
    {activeFiltersCount > 0 && (
      <button
        type="button"
        onClick={onClearFilters}
        className="bg-[var(--color-artificio-orange)] hover:bg-[var(--color-artificio-orange-hover)] px-6 py-3 rounded-lg font-semibold transition-colors"
      >
        Limpar todos os filtros
      </button>
    )}
  </div>
);

const renderTableCards = (isLoading: boolean, tables: TableCard[]): ReactNode => {
  if (isLoading) {
    return Array.from({ length: 12 }).map((_, idx) => <TableCardSkeleton key={idx} />);
  }

  return tables.map((table) => <TableCardComponent key={table.id} table={table} />);
};

export const CatalogoPage = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [searchParams] = useSearchParams();

  // STATE - URL-driven filters + busca draft/confirmada (D0.3, spec 094):
  // digitar mexe só no draft; botão "Buscar"/Enter promovem para filters.search.
  const { filters, setFilters, draftSearch, setDraftSearch, submitSearch } = useCatalogFilters();

  // Estilos reais em uso, por frequência (não é lista fixa)
  const { facets: styleFacets } = useStyleFacets();

  // STATE - Árvore de sistemas
  const {
    tree: systemsTree,
    flat: systemsFlat,
    loading: systemsLoading,
    error: systemsTreeError,
    forceRefresh: retrySystemsTree,
  } = useSystemsCatalog();
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [mobileAdvancedDraft, setMobileAdvancedDraft] = useState<AdvancedFiltersDraft>(() =>
    advancedFiltersFrom(filters),
  );

  // Flatten tree para mapear ID -> slug
  const systemsMap = useMemo(() => {
    const map = new Map<string, string>();
    systemsFlat.forEach((node) => {
      map.set(node.id, node.slug);
    });
    return map;
  }, [systemsFlat]);

  // Flatten tree para mapear ID -> name (usado em trackFilterSistema)
  const systemsNameMap = useMemo(() => {
    const map = new Map<string, string>();
    systemsFlat.forEach((node) => {
      map.set(node.id, node.name);
    });
    return map;
  }, [systemsFlat]);

  // Converter slug do filtro para ID (para o seletor de sistema)
  const selectedSystemId = useMemo(() => {
    if (!filters.system) return null;
    const entry = Array.from(systemsMap.entries()).find(([, slug]) => slug === filters.system);
    return entry ? entry[0] : null;
  }, [filters.system, systemsMap]);

  // ============================================================================
  // DATA - React Query
  // ============================================================================
  
  const { tables, pagination, isLoading, isRefreshing, error } = useInfiniteCatalogTables(filters, searchParams.toString());

  const totalCount = useMemo(() => {
    if (!pagination) return 0;
    if (pagination.total !== undefined) return pagination.total;
    return tables.length;
  }, [pagination, tables.length]);

  const hasMore = pagination?.hasMore ?? false;

  // Sentinela de scroll infinito — carrega próxima página ao entrar em viewport
  const sentinelRef = useRef<HTMLDivElement>(null);
  // Achado Codex: observer (viewport) e botão fallback podiam disparar
  // avanço de página simultaneamente — trava com ref até o fetch assentar
  // em isLoading/isRefreshing (sinal de que a página nova já chegou).
  const isAdvancingPageRef = useRef(false);

  useEffect(() => {
    if (!isLoading && !isRefreshing) {
      isAdvancingPageRef.current = false;
    }
  }, [isLoading, isRefreshing]);

  const loadNextPage = useCallback(() => {
    if (isAdvancingPageRef.current || !hasMore || isLoading || isRefreshing) return;
    isAdvancingPageRef.current = true;
    setFilters(prev => ({ ...prev, page: prev.page + 1 }), { replace: true });
  }, [hasMore, isLoading, isRefreshing, setFilters]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore || isLoading || isRefreshing) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadNextPage();
        }
      },
      { rootMargin: '400px' }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, isLoading, isRefreshing, loadNextPage]);

  // ============================================================================
  // HANDLERS
  // ============================================================================
  
  const clearFilters = () => {
    // "Limpar tudo" também esvazia o campo de busca visual: sem isto, o draft
    // digitado e não submetido sobreviveria ao reset (o efeito de sincronização
    // do hook só reage a mudanças de filters.search).
    setDraftSearch('');
    setFilters(() => ({
      search: '',
      system: '',
      modality: '',
      priceType: '',
      experience: '',
      seal: '',
      styles: [],
      type: '',
      sort: 'popular',
      page: 1,
      limit: 24,
    }));
  };

  const removeFilter = (key: string, value?: string) => {
    if (key === 'styles' && value) {
      setFilters(prev => ({
        ...prev,
        styles: prev.styles.filter((s) => s !== value),
        page: 1,
      }));
    } else {
      setFilters(prev => ({
        ...prev,
        [key]: '',
        page: 1,
      }));
    }
  };

  const toggleStyle = (style: StyleOption) => {
    setFilters(prev => ({
      ...prev,
      styles: prev.styles.includes(style)
        ? prev.styles.filter((s) => s !== style)
        : [...prev.styles, style],
      page: 1,
    }));
  };

  const toggleSeal = (seal: CatalogSeal) => {
    setFilters(prev => ({
      ...prev,
      seal: prev.seal === seal ? '' : seal,
      page: 1,
    }));
  };

  const handleModalityChange = (value: ModalityOption | '') => {
    updateFilter(setFilters, 'modality', value);
  };

  const handlePriceChange = (value: PriceTypeOption | '') => {
    updateFilter(setFilters, 'priceType', value);
  };

  const handleExperienceChange = (value: ExperienceLevelOption | '') => {
    updateFilter(setFilters, 'experience', value);
  };

  const handleTypeChange = (value: TableTypeOption | '') => {
    updateFilter(setFilters, 'type', value);
  };

  const openMobileFilters = () => {
    setMobileAdvancedDraft(advancedFiltersFrom(filters));
    setIsFilterOpen(true);
  };

  const clearMobileAdvancedFilters = () => {
    setMobileAdvancedDraft({ experience: '', type: '', seal: '', styles: [] });
  };

  const applyMobileAdvancedFilters = () => {
    setFilters((previous) => ({ ...previous, ...mobileAdvancedDraft, page: 1 }));
    setIsFilterOpen(false);
  };

  const toggleMobileStyle = (style: StyleOption) => {
    setMobileAdvancedDraft((previous) => ({
      ...previous,
      styles: previous.styles.includes(style)
        ? previous.styles.filter((value) => value !== style)
        : [...previous.styles, style],
    }));
  };

  const toggleMobileSeal = (seal: CatalogSeal) => {
    setMobileAdvancedDraft((previous) => ({
      ...previous,
      seal: previous.seal === seal ? '' : seal,
    }));
  };

  const handleAnnounceTable = () => {
    if (isAuthenticated) {
      navigate('/painel?action=nova-mesa');
    } else {
      startSsoLogin('/painel?action=nova-mesa');
    }
  };

  // Callback canônico de seleção de sistema (R23): `trackFilterSistema` dispara
  // exatamente uma vez por mudança confirmada de sistema, e só aqui — abrir o
  // painel, submeter busca ou aplicar filtro avançado NÃO emite evento novo.
  const handleSystemSelect = (systemId: string | null) => {
    if (!systemId) {
      setFilters(prev => ({ ...prev, system: '', page: 1 }));
      return;
    }
    const slug = systemsMap.get(systemId);
    const newSystem = slug || '';
    if (newSystem && newSystem !== filters.system) {
      const sistemaNome = systemsNameMap.get(systemId) || '';
      trackFilterSistema({ sistema: sistemaNome });
    }
    setFilters(prev => ({
      ...prev,
      system: newSystem,
      page: 1,
    }));
  };

  // ============================================================================
  // COMPUTED
  // ============================================================================
  
  const activeFiltersCount = useMemo(() => activeCatalogFiltersCount(filters), [filters]);

  // Quantidade de filtros avançados ativos (badge do botão "Mais filtros").
  const advancedCount = useMemo(() => {
    return [
      filters.experience,
      filters.type,
      filters.seal,
      ...(filters.styles || []),
    ].filter(Boolean).length;
  }, [filters]);

  const selectedSystemName = useMemo(() => {
    if (!filters.system) return undefined;
    return systemsFlat.find((node) => node.slug === filters.system)?.name;
  }, [systemsFlat, filters.system]);

  // ============================================================================
  // EFFECTS
  // ============================================================================
  
  // SEO
  useEffect(() => {
    applySeo(
      'Catálogo de Mesas | Artifício Mesas',
      'Explore mesas de RPG com filtros por sistema, modalidade, preço, nível de experiência e selos DDAL/Covil do Lich.'
    );
  }, []);

  // Scroll to top quando filtros mudam (não na paginação)
  useEffect(() => {
    if (filters.page === 1) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [
    filters.search,
    filters.system,
    filters.modality,
    filters.priceType,
    filters.experience,
    filters.type,
    filters.styles,
    filters.seal,
    filters.sort,
    filters.page,
  ]);

  // ============================================================================
  // RENDER
  // ============================================================================

  const showEmptyState = !isLoading && !isRefreshing && tables.length === 0;
  const tableCards = renderTableCards(isLoading, tables);

  return (
    <main className="min-h-screen overflow-x-hidden bg-[var(--surface)] text-[var(--fg)]">
      {/* HERO — bug real achado pelo mantenedor (2026-07-18): fundo usava hex
          cru (#0B1220/#13213f), que NUNCA remapeia em tema light (só
          bg-[var(--color-artificio-blue)] tem essa regra em index.css), mas
          o texto (text-white) remapeia pra tinta escura em light — resultado:
          texto escuro sobre fundo que continua escuro. Bug pré-existente,
          nunca notado porque ninguém tinha testado o catálogo em light antes.
          Fix: usar a MESMA variável que o resto do app (AppShell) usa pro
          fundo sempre-escuro-que-também-vira-light, pra fundo e texto
          remaparem juntos e coerente com o resto do produto.
          Fase 2 (spec 094, R1): a busca saiu do hero — busca geral é UMA, na
          barra do catálogo. Hero mantém só o chamado de anúncio. */}
      <section className="relative w-full overflow-hidden bg-[var(--color-artificio-blue)] text-white py-10 lg:py-12">
        <div className="orange-glow" />
        <div className="container relative z-10 mx-auto space-y-4 px-6 text-center">
          <p className="eyebrow">
            ◆ {totalCount}+ mesas abertas · comunidade Artifício RPG
          </p>

          <h1 className="text-3xl font-extrabold tracking-tight lg:text-5xl">
            Encontre uma mesa de RPG em{' '}
            <span className="text-[var(--color-artificio-orange)]">30 segundos</span>
          </h1>

          <p className="mx-auto max-w-xl text-sm leading-relaxed text-white/70">
            D&amp;D, Tormenta, Vampiro e dezenas de outros sistemas. Online ou presencial.
            De mestres da comunidade Artifício e parceiros.
          </p>

          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              id="btn-anunciar-mesa-home"
              type="button"
              onClick={handleAnnounceTable}
              className="flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-full bg-[var(--color-artificio-orange)] px-5 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-[var(--color-artificio-orange-hover)]"
            >
              <Megaphone className="h-4 w-4" />
              Anunciar Mesa
            </button>
          </div>
        </div>
      </section>

      {systemsTreeError && (
        <section className="container mx-auto px-4 pt-10 pb-4 sm:px-6" aria-live="polite">
          <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 flex items-center justify-between gap-3">
            <p className="text-sm text-amber-100">{systemsTreeError}</p>
            <button
              id="catalog-retry-systems-tree"
              type="button"
              onClick={retrySystemsTree}
              className="shrink-0 rounded-lg border border-amber-300/40 bg-amber-500/20 px-3 py-1.5 text-xs font-semibold text-amber-50 hover:bg-amber-500/30 transition-colors"
            >
              Tentar novamente
            </button>
          </div>
        </section>
      )}

      {/* BARRA DE FILTROS — uma interface responsiva (desktop e mobile), linha
          primária em grid deliberado (spec 094, Fase 2). Substitui a antiga
          barra desktop + FAB mobile: uma busca geral, sistema compacto em
          popover/dialog, modalidade/preço, "Mais filtros" e ação Buscar. */}
      <CatalogFiltersBar
        filters={filters}
        draftSearch={draftSearch}
        onDraftSearchChange={setDraftSearch}
        onSearchSubmit={submitSearch}
        systemsTree={systemsTree}
        systemsLoading={systemsLoading}
        systemsError={systemsTreeError}
        selectedSystemId={selectedSystemId}
        onSystemSelect={handleSystemSelect}
        onModalityChange={handleModalityChange}
        onPriceChange={handlePriceChange}
        onExperienceChange={handleExperienceChange}
        onTypeChange={handleTypeChange}
        onSealToggle={toggleSeal}
        onStyleToggle={toggleStyle}
        styleFacets={styleFacets}
        advancedCount={advancedCount}
        systemName={selectedSystemName}
        onRemoveFilter={removeFilter}
        onClearFilters={clearFilters}
        onOpenMobileFilters={openMobileFilters}
        mobileFiltersOpen={isFilterOpen}
      />

      {/* DRAWER MOBILE — hospeda a MESMA definição canônica de filtros avançados
          que o painel desktop (R15): nenhuma lista/mapper duplicado. */}
      <FilterDrawer
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        onClear={clearMobileAdvancedFilters}
        onApply={applyMobileAdvancedFilters}
        isApplying={isRefreshing}
      >
        <CatalogAdvancedFilters
          filters={{
            experience: mobileAdvancedDraft.experience,
            type: mobileAdvancedDraft.type,
            seal: mobileAdvancedDraft.seal,
            styles: mobileAdvancedDraft.styles,
          }}
          styleFacets={styleFacets}
          onExperienceChange={(experience) => setMobileAdvancedDraft((previous) => ({ ...previous, experience }))}
          onTypeChange={(type) => setMobileAdvancedDraft((previous) => ({ ...previous, type }))}
          onSealToggle={toggleMobileSeal}
          onStyleToggle={toggleMobileStyle}
          idPrefix="catalog-advanced-mobile"
        />
      </FilterDrawer>

      {/* CONTEÚDO */}
      <section className="px-4 py-8 sm:px-6 lg:py-10">
        {/* LINHA DE CONTEXTO */}
        <div className="mb-6 space-y-4">
          {isRefreshing && (
            <div className="rounded-lg border border-orange-500/40 bg-orange-500/10 px-4 py-2 text-orange-200 text-sm flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
              Atualizando resultados...
            </div>
          )}
          
          <ResultsHeader
            count={totalCount}
            sort={filters.sort}
            onSortChange={(newSort) => updateFilter(setFilters, 'sort', pickOption(newSort, SORT_VALUES, 'popular'))}
            isLoading={isLoading}
            hasMore={hasMore}
          />
        </div>

        {/* ERROR */}
        {error && (
          <div className="mb-6 flex flex-col gap-3 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-red-200 sm:flex-row sm:items-center sm:justify-between">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-3 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-sm font-semibold transition-colors"
            >
              Tentar novamente
            </button>
          </div>
        )}

        {/* EMPTY STATE */}
        {showEmptyState ? (
          <CatalogEmptyState activeFiltersCount={activeFiltersCount} onClearFilters={clearFilters} />
        ) : (
          <>
            {/* GRID
                `auto-fill`, e não `auto-fit`: o `auto-fit` colapsa as trilhas
                vazias e reparte a largura entre as que sobraram, então o card
                cresce conforme CAIEM os resultados. Medido em 2026-08-17, com
                filtro de 1 resultado numa tela de 1793px: card de 1793×1416px,
                proporção 1.27, capa ocupando 79% da altura. Com 2 resultados,
                887px cada. `auto-fill` mantém as trilhas, então o card conserva
                o tamanho com 1, 2 ou 20 resultados — com 19 mesas a grade já
                produzia 6 colunas de 282px, que é o alvo.
                O teto de 420px (em vez de `1fr`) fecha o outro lado: `1fr` não
                tem máximo, e numa fileira incompleta os cards voltariam a
                esticar. `justify-center` centra as trilhas quando sobra
                largura, em vez de deixar tudo alinhado à esquerda. */}
            <div className="grid min-w-0 grid-cols-1 justify-center gap-5 md:grid-cols-2 xl:grid-cols-[repeat(auto-fill,minmax(280px,420px))]">
              {tableCards}
            </div>

            {/* SCROLL INFINITO — sentinela invisível + fallback manual */}
            {!isLoading && tables.length > 0 && hasMore && (
              <div ref={sentinelRef} className="mt-8 flex justify-center pb-20 md:pb-0">
                {isRefreshing ? (
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
                ) : (
                  <button
                    type="button"
                    onClick={loadNextPage}
                    className="rounded-lg border border-[var(--line)] bg-[var(--surface-subtle)] px-5 py-2.5 text-sm font-semibold text-[var(--fg)] transition-colors hover:bg-[var(--surface-strong)]"
                  >
                    Carregar mais mesas
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
};
