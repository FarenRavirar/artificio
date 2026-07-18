import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { RotateCcw, Search, ShieldCheck, Star, SlidersHorizontal, Megaphone } from 'lucide-react';
import { TableCardComponent, TableCardSkeleton } from '../components/TableCard';
import { SealToggle } from '../components/SealToggle';
import { FilterDrawer } from '../components/FilterDrawer';
import { ActiveFiltersChips } from '../components/ActiveFiltersChips';
import { ResultsHeader } from '../components/ResultsHeader';
import { SystemPicker } from '../components/SystemPicker';
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
import type { SystemTreeNode } from '../types/systems';
import type {
  CatalogFilters,
  ExperienceLevelOption,
  ModalityOption,
  PriceTypeOption,
  SortOption,
  StyleOption,
} from '../services/catalogService';

// Constantes de validação (compartilhadas com parser)
const VALID_MODALITIES: ModalityOption[] = ['online', 'presencial', 'hibrida'];
const VALID_PRICE_TYPES: PriceTypeOption[] = ['gratuita', 'paga'];
const VALID_EXPERIENCE_LEVELS: ExperienceLevelOption[] = ['iniciante', 'intermediario', 'veterano'];
const VALID_SORTS: SortOption[] = ['popular', 'recent', 'slots', 'price_asc', 'price_desc', 'ending_soon'];
const VALID_SEALS: CatalogSeal[] = ['ddal', 'covil-do-lich', ''];

function pickOption<T extends string>(value: string, validOptions: readonly T[], fallback: T): T {
  return validOptions.includes(value as T) ? (value as T) : fallback;
}

function pickOptionalOption<T extends string>(value: string, validOptions: readonly T[]): T | '' {
  return value !== '' && validOptions.includes(value as T) ? (value as T) : '';
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

type CatalogSystemFilterProps = Readonly<{
  tree: SystemTreeNode[];
  loading: boolean;
  error: string | null;
  selectedSystemId: string | null;
  idPrefix: string;
  loadingClassName: string;
  onSelect: (systemId: string | null) => void;
}>;

const getSelectedSystemIds = (selectedSystemId: string | null): string[] => {
  if (!selectedSystemId) return [];
  return [selectedSystemId];
};

const CatalogSystemFilter = ({
  tree,
  loading,
  error,
  selectedSystemId,
  idPrefix,
  loadingClassName,
  onSelect,
}: CatalogSystemFilterProps) => {
  const selectedIds = getSelectedSystemIds(selectedSystemId);

  if (loading) {
    return (
      <p className={`rounded-lg border border-white/10 px-3 py-2.5 text-sm text-white/60 ${loadingClassName}`}>
        Carregando sistemas...
      </p>
    );
  }

  if (error) {
    return (
      <p className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-200">
        Sistemas indisponíveis.
      </p>
    );
  }

  return (
    <SystemPicker
      tree={tree}
      selectedIds={selectedIds}
      onSelectionChange={(ids) => onSelect(ids[0] ?? null)}
      idPrefix={idPrefix}
      mode="single"
      role="user"
    />
  );
};

type CatalogEmptyStateProps = Readonly<{
  activeFiltersCount: number;
  onClearFilters: () => void;
}>;

const CatalogEmptyState = ({ activeFiltersCount, onClearFilters }: CatalogEmptyStateProps) => (
  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-16 text-center sm:py-20">
    <D20Glyph className="mx-auto mb-5 h-16 w-16 text-white/20" />
    <p className="text-xl font-bold text-white mb-2">Nenhuma mesa encontrada com esses filtros</p>
    <p className="text-sm text-white/50 mb-6">Ajuste sistema, modalidade ou estilo, ou limpe os filtros para ver todo o catálogo</p>
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

const SUGGESTIONS = ['D&D 5e', 'Ordem Paranormal', 'Vampiro', 'Tormenta'];

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
  const [heroSearchInput, setHeroSearchInput] = useState('');

  // STATE - URL-driven filters (hook genérico)
  const [filters, setFilters] = useCatalogFilters();

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

  // Converter slug do filtro para ID (para SystemPicker)
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
    setFilters(prev => ({ ...prev, page: prev.page + 1 }));
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
    setFilters(() => ({
      search: '',
      system: '',
      modality: '',
      priceType: '',
      experience: '',
      seal: '',
      styles: [],
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
      }));
    } else {
      setFilters(prev => ({
        ...prev,
        [key]: '',
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

  const handleHeroSearch = () => {
    const term = heroSearchInput.trim();
    setFilters(prev => ({ ...prev, search: term, page: 1 }));
  };

  const handleHeroSuggestionClick = (suggestion: string) => {
    setHeroSearchInput(suggestion);
    setFilters(prev => ({ ...prev, search: suggestion, page: 1 }));
  };

  const handleAnnounceTable = () => {
    if (isAuthenticated) {
      navigate('/painel?action=nova-mesa');
    } else {
      startSsoLogin('/painel?action=nova-mesa');
    }
  };

  const handleSystemSelect = (systemId: string | null) => {
    if (!systemId) {
      setFilters(prev => ({ ...prev, system: '' }));
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
    }));
  };

  // ============================================================================
  // COMPUTED
  // ============================================================================
  
  const activeFiltersCount = useMemo(() => {
    return [
      filters.search,
      filters.system,
      filters.modality,
      filters.priceType,
      filters.experience,
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
  }, [filters.search, filters.system, filters.modality, filters.priceType, filters.experience, filters.seal, filters.sort, filters.page]);

  // ============================================================================
  // RENDER
  // ============================================================================

  const showEmptyState = !isLoading && !isRefreshing && tables.length === 0;
  const tableCards = renderTableCards(isLoading, tables);

  return (
    <main className="min-h-screen overflow-x-hidden bg-gradient-to-b from-[#0B1220] to-[#13213f] text-white">
      {/* HERO */}
      <section className="relative w-full overflow-hidden py-16 lg:py-20">
        <div className="orange-glow" />
        <div className="container relative z-10 mx-auto space-y-6 px-6 text-center">
          <p className="eyebrow">
            ◆ {totalCount}+ mesas abertas · comunidade Artifício RPG
          </p>

          <h1 className="text-4xl font-extrabold tracking-tight lg:text-6xl">
            Encontre uma mesa de RPG em{' '}
            <span className="text-[var(--color-artificio-orange)]">30 segundos</span>
          </h1>

          <p className="mx-auto max-w-xl text-base leading-relaxed text-white/70">
            D&amp;D, Tormenta, Vampiro e dezenas de outros sistemas. Online ou presencial.
            De mestres da comunidade Artifício e parceiros.
          </p>

          <div className="glass mx-auto mt-6 flex max-w-2xl items-center rounded-full p-2 shadow-2xl transition-all focus-within:ring-2 focus-within:ring-[var(--color-artificio-orange)]/50">
            <Search className="ml-4 hidden h-6 w-6 text-white/50 sm:block" />
            <input
              id="input-busca-mesas"
              type="text"
              aria-label="Buscar mesas"
              value={heroSearchInput}
              onChange={(e) => setHeroSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleHeroSearch()}
              placeholder="Ex: D&D, Vampiro, Mesa iniciante..."
              className="flex-1 border-none bg-transparent px-4 py-3 text-white placeholder-white/50 outline-none"
            />
            <button
              id="btn-buscar-mesas"
              type="button"
              onClick={handleHeroSearch}
              className="cursor-pointer rounded-full bg-[var(--color-artificio-orange)] px-6 py-3 font-semibold text-white transition-colors duration-200 hover:bg-[var(--color-artificio-orange-hover)]"
            >
              Buscar
            </button>
          </div>

          <div className="mt-4 flex justify-center">
            <button
              id="btn-anunciar-mesa-home"
              type="button"
              onClick={handleAnnounceTable}
              className="flex cursor-pointer items-center gap-2 rounded-full bg-[var(--color-artificio-orange)] px-5 py-3 font-semibold text-white transition-colors duration-200 hover:bg-[var(--color-artificio-orange-hover)]"
            >
              <Megaphone className="h-5 w-5" />
              Anunciar Mesa
            </button>
          </div>

          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {SUGGESTIONS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => handleHeroSuggestionClick(item)}
                className="rounded-full bg-white/10 px-3 py-1 text-sm transition-colors hover:bg-white/20"
              >
                {item}
              </button>
            ))}
          </div>

          <div className="mt-2 flex flex-wrap justify-center gap-2">
            <SealToggle variant="pill" active={filters.seal === ''} onClick={() => toggleSeal('' as CatalogSeal)}>
              Todas as mesas
            </SealToggle>
            <SealToggle
              variant="pill"
              active={filters.seal === 'ddal'}
              onClick={() => toggleSeal('ddal')}
              icon={<ShieldCheck className="w-3.5 h-3.5" />}
              activeClassName="bg-amber-500 font-semibold text-white"
            >
              DDAL
            </SealToggle>
            <SealToggle
              variant="pill"
              active={filters.seal === 'covil-do-lich'}
              onClick={() => toggleSeal('covil-do-lich')}
              icon={<Star className="w-3.5 h-3.5" />}
              activeClassName="bg-purple-500 font-semibold text-white"
            >
              Covil do Lich
            </SealToggle>
            <SealToggle
              variant="pill"
              active={filters.priceType === 'gratuita'}
              onClick={() => updateFilter(setFilters, 'priceType', filters.priceType === 'gratuita' ? '' : 'gratuita')}
            >
              Gratuitas
            </SealToggle>
          </div>
        </div>
      </section>

      {/* TRANSIÇÃO hero->toolbar: eyebrow de contexto (achado do mantenedor,
          2026-07-18) — antes tinha um <h1> "Catálogo de Mesas" redundante com
          o <h1> do hero acima (duas tags h1 na mesma página, quebra hierarquia
          semântica) e um subtítulo que só repetia o que o hero já dizia melhor.
          Vira <h2> real (subseção do hero, não título concorrente) + eyebrow
          reaproveitando a mesma classe do hero, sinalizando "você saiu da
          landing, entrou na área de navegação/filtro". Botão Limpar mantido. */}
      <div className="relative overflow-hidden border-b border-white/10 bg-[#0B1220]">
        <D20Glyph className="pointer-events-none absolute -right-10 -top-16 h-64 w-64 text-[var(--color-artificio-orange)]/[0.06] sm:h-80 sm:w-80" />
        <div className="relative px-4 py-6 sm:px-6 sm:py-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <p className="eyebrow">◆ Catálogo</p>
            {activeFiltersCount > 0 && (
              <button
                type="button"
                onClick={clearFilters}
                className="hidden items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/10 md:flex"
              >
                <RotateCcw className="h-4 w-4" />
                Limpar
              </button>
            )}
          </div>
        </div>
      </div>

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

      {/* FILTROS - DESKTOP (barra horizontal única, full-bleed) */}
      <section className="hidden border-b border-white/10 bg-[#0B1220]/40 md:block">
        <div className="px-6 py-5">
          <div className="flex flex-wrap items-center gap-3 overflow-x-auto pb-1">
            <div className="relative min-w-[220px]">
              <label htmlFor="catalog-desktop-search" className="sr-only">Buscar mesas</label>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
              <input
                id="catalog-desktop-search"
                type="text"
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value, page: 1 }))}
                placeholder="Buscar mesas..."
                className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] py-2.5 pl-9 pr-3 text-sm text-[var(--fg)] outline-none placeholder:text-[var(--fg-muted)] transition-colors focus:border-[var(--artificio-brand)]"
              />
            </div>

            <div className="min-w-[180px] shrink-0">
              <CatalogSystemFilter
                tree={systemsTree}
                loading={systemsLoading}
                error={systemsTreeError}
                selectedSystemId={selectedSystemId}
                idPrefix="catalog-desktop"
                loadingClassName="bg-[#0B1220]"
                onSelect={handleSystemSelect}
              />
            </div>

            <label htmlFor="catalog-desktop-modality" className="sr-only">Modalidade</label>
            <select
              id="catalog-desktop-modality"
              value={filters.modality}
              onChange={(e) => updateFilter(setFilters, 'modality', pickOptionalOption(e.target.value, VALID_MODALITIES))}
              className="app-select shrink-0 py-2.5"
            >
              <option value="">Modalidade</option>
              <option value="online">Online</option>
              <option value="presencial">Presencial</option>
              <option value="hibrida">Híbrida</option>
            </select>

            <label htmlFor="catalog-desktop-price" className="sr-only">Preço</label>
            <select
              id="catalog-desktop-price"
              value={filters.priceType}
              onChange={(e) => updateFilter(setFilters, 'priceType', pickOptionalOption(e.target.value, VALID_PRICE_TYPES))}
              className="app-select shrink-0 py-2.5"
            >
              <option value="">Preço</option>
              <option value="gratuita">Gratuita</option>
              <option value="paga">Paga</option>
            </select>

            <label htmlFor="catalog-desktop-experience" className="sr-only">Nível de experiência</label>
            <select
              id="catalog-desktop-experience"
              value={filters.experience}
              onChange={(e) => updateFilter(setFilters, 'experience', pickOptionalOption(e.target.value, VALID_EXPERIENCE_LEVELS))}
              className="app-select shrink-0 py-2.5"
            >
              <option value="">Nível</option>
              <option value="iniciante">Iniciante</option>
              <option value="intermediario">Intermediário</option>
              <option value="veterano">Veterano</option>
            </select>

            <div className="h-6 w-px shrink-0 bg-white/10" />

            <SealToggle
              variant="toolbar"
              active={filters.seal === 'ddal'}
              onClick={() => toggleSeal('ddal')}
              icon={<ShieldCheck className="w-3.5 h-3.5" />}
              activeClassName="border-amber-300/50 bg-amber-500/20 text-amber-100"
            >
              DDAL
            </SealToggle>

            <SealToggle
              variant="toolbar"
              active={filters.seal === 'covil-do-lich'}
              onClick={() => toggleSeal('covil-do-lich')}
              icon={<Star className="w-3.5 h-3.5" />}
              activeClassName="border-purple-300/50 bg-purple-500/20 text-purple-100"
            >
              Covil do Lich
            </SealToggle>
          </div>

          {/* ESTILOS — linha própria com scroll horizontal (evita quebra de 48 botões) */}
          {styleFacets.length > 0 && (
            <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1">
              <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/40">Estilos</span>
              <div className="flex shrink-0 gap-2">
                {styleFacets.map(({ style, count }) => (
                  <button
                    key={style}
                    type="button"
                    onClick={() => toggleStyle(style)}
                    aria-pressed={filters.styles.includes(style)}
                    className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs transition-all whitespace-nowrap ${
                      filters.styles.includes(style)
                        ? 'border-orange-500 bg-orange-500/20 text-orange-100'
                        : 'border-white/10 bg-[#0B1220] text-white/70 hover:border-white/20 hover:bg-white/5'
                    }`}
                  >
                    {style} <span className="text-white/40">({count})</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* BOTÃO FILTROS - MOBILE (acima do FAB de feedback, que fica em bottom-5) */}
      <button
        type="button"
        onClick={() => setIsFilterOpen(true)}
        className="fixed bottom-20 right-4 z-30 flex items-center gap-2 rounded-full bg-[var(--color-artificio-orange)] px-5 py-3 font-bold text-white shadow-lg transition-colors hover:bg-[var(--color-artificio-orange-hover)] md:hidden"
      >
        <SlidersHorizontal className="w-5 h-5" />
        Filtros
        {activeFiltersCount > 0 && (
          <span className="bg-white text-[var(--color-artificio-orange)] rounded-full w-6 h-6 flex items-center justify-center text-xs font-black">
            {activeFiltersCount}
          </span>
        )}
      </button>

      {/* DRAWER MOBILE */}
      <FilterDrawer
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        onClear={clearFilters}
        isApplying={isRefreshing}
      >
        {/* BLOCO 1 — busca textual + sistema (filtros primários) */}
        <div className="space-y-3">
          <div className="relative">
            <label htmlFor="catalog-mobile-search" className="sr-only">Buscar mesas</label>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
            <input
              id="catalog-mobile-search"
              type="text"
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value, page: 1 }))}
              placeholder="Buscar mesas..."
              className="w-full rounded-lg bg-[#13213f] border border-white/10 pl-9 pr-3 py-2.5 text-sm outline-none focus:border-[var(--color-artificio-orange)] transition-colors"
            />
          </div>

          <CatalogSystemFilter
            tree={systemsTree}
            loading={systemsLoading}
            error={systemsTreeError}
            selectedSystemId={selectedSystemId}
            idPrefix="catalog-mobile"
            loadingClassName="bg-[#13213f]"
            onSelect={handleSystemSelect}
          />
        </div>

        <div className="h-px bg-white/10" />

        {/* BLOCO 2 — refinamento por atributo da mesa */}
        <div className="space-y-3">
          <select
            value={filters.modality}
            onChange={(e) => updateFilter(setFilters, 'modality', pickOptionalOption(e.target.value, VALID_MODALITIES))}
            className="app-select w-full py-2.5"
          >
            <option value="">Modalidade</option>
            <option value="online">Online</option>
            <option value="presencial">Presencial</option>
            <option value="hibrida">Híbrida</option>
          </select>

          <select
            value={filters.priceType}
            onChange={(e) => updateFilter(setFilters, 'priceType', pickOptionalOption(e.target.value, VALID_PRICE_TYPES))}
            className="app-select w-full py-2.5"
          >
            <option value="">Preço</option>
            <option value="gratuita">Gratuita</option>
            <option value="paga">Paga</option>
          </select>

          <select
            value={filters.experience}
            onChange={(e) => updateFilter(setFilters, 'experience', pickOptionalOption(e.target.value, VALID_EXPERIENCE_LEVELS))}
            className="app-select w-full py-2.5"
          >
            <option value="">Nível</option>
            <option value="iniciante">Iniciante</option>
            <option value="intermediario">Intermediário</option>
            <option value="veterano">Veterano</option>
          </select>

          <select
            value={filters.sort}
            onChange={(e) => updateFilter(setFilters, 'sort', pickOption(e.target.value, VALID_SORTS, 'popular'))}
            className="app-select w-full py-2.5"
          >
            <option value="popular">Mais populares</option>
            <option value="recent">Mais recentes</option>
            <option value="ending_soon">Encerrando em breve</option>
          </select>
        </div>

        <div className="h-px bg-white/10" />

        {/* BLOCO 3 — selos (curados) e estilos (livres, com contagem) */}
        <div>
          <p className="text-xs text-white/50 mb-2 font-semibold">Selos</p>
          <div className="flex gap-2">
            <SealToggle
              variant="drawer"
              active={filters.seal === 'ddal'}
              onClick={() => toggleSeal('ddal')}
              icon={<ShieldCheck className="w-3.5 h-3.5" />}
              activeClassName="border-amber-300/50 bg-amber-500/20 text-amber-100"
            >
              DDAL
            </SealToggle>

            <SealToggle
              variant="drawer"
              active={filters.seal === 'covil-do-lich'}
              onClick={() => toggleSeal('covil-do-lich')}
              icon={<Star className="w-3.5 h-3.5" />}
              activeClassName="border-purple-300/50 bg-purple-500/20 text-purple-100"
            >
              Covil
            </SealToggle>
          </div>
        </div>

        {/* Estilos */}
        <div>
          <p className="text-xs text-white/50 mb-2 font-semibold">Estilos</p>
          <div className="flex flex-wrap gap-2">
            {styleFacets.map(({ style, count }) => (
              <button
                key={style}
                type="button"
                onClick={() => toggleStyle(style)}
                className={`px-3 py-1.5 rounded-lg border text-xs transition-all ${
                  filters.styles.includes(style)
                    ? 'border-orange-500 bg-orange-500/20 text-orange-100'
                    : 'border-white/10 bg-[#13213f] text-white/70'
                }`}
              >
                {style} <span className="text-white/40">({count})</span>
              </button>
            ))}
          </div>
        </div>
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
            onSortChange={(newSort) => updateFilter(setFilters, 'sort', pickOption(newSort, VALID_SORTS, 'popular'))}
            isLoading={isLoading}
            hasMore={hasMore}
          />

          {/* CHIPS DE FILTROS ATIVOS */}
          <ActiveFiltersChips
            filters={{
              search: filters.search,
              system: filters.system,
              modality: filters.modality,
              priceType: filters.priceType,
              experience: filters.experience,
              seal: pickOptionalOption(filters.seal, VALID_SEALS),
              styles: filters.styles,
              sort: filters.sort,
            }}
            systemName={selectedSystemName}
            onRemove={removeFilter}
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
            {/* GRID */}
            <div className="grid min-w-0 grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-[repeat(auto-fit,minmax(280px,1fr))]">
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
                    className="rounded-lg border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
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
