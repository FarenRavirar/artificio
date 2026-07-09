import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RotateCcw, Search, ShieldCheck, Star, ChevronLeft, ChevronRight, SlidersHorizontal } from 'lucide-react';
import { TableCardComponent, TableCardSkeleton } from '../components/TableCard';
import { FilterDrawer } from '../components/FilterDrawer';
import { ActiveFiltersChips } from '../components/ActiveFiltersChips';
import { ResultsHeader } from '../components/ResultsHeader';
import { SystemPicker } from '../components/SystemPicker';
import { D20Glyph } from '../components/D20Glyph';
import type { CatalogSeal } from '../types/tables';
import { applySeo } from '../utils/seo';
import { useCatalogTables } from '../hooks/useCatalogTables';
import { useCatalogFilters } from '../hooks/useCatalogFilters';
import { useStyleFacets } from '../hooks/useStyleFacets';
import { useSystemsCatalog } from '../hooks/useSystemsCatalog';
import { trackFilterSistema } from '@artificio/analytics';
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
  setFilters((prev) => ({ ...prev, [key]: value }));
};

export const CatalogoPage = () => {
  const [searchParams] = useSearchParams();

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
  
  const { tables, pagination, isLoading, isRefreshing, error } = useCatalogTables(filters, searchParams.toString());

  const totalCount = useMemo(() => {
    if (!pagination) return 0;
    if (pagination.total !== undefined) return pagination.total;
    return (filters.page - 1) * 24 + tables.length;
  }, [pagination, filters.page, tables.length]);

  const hasMore = pagination?.hasMore ?? false;

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
    }));
  };

  const toggleSeal = (seal: CatalogSeal) => {
    setFilters(prev => ({
      ...prev,
      seal: prev.seal === seal ? '' : seal,
    }));
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
  
  return (
    <main className="min-h-screen overflow-x-hidden bg-gradient-to-b from-[#0B1220] to-[#13213f] text-white">
      {/* HEADER */}
      <div className="relative overflow-hidden border-b border-white/10 bg-[#0B1220]">
        <D20Glyph className="pointer-events-none absolute -right-10 -top-16 h-64 w-64 text-[var(--color-artificio-orange)]/[0.06] sm:h-80 sm:w-80" />
        <div className="container relative mx-auto px-4 py-12 sm:px-6 sm:py-16">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="min-w-0">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-artificio-orange)]">
                Artifício Mesas
              </p>
              <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">Catálogo de Mesas</h1>
              <p className="mt-2.5 text-sm text-white/60">Encontre a mesa perfeita para você</p>
            </div>
            <div className="flex items-center gap-3 text-xs text-white/50">
              <span>{totalCount} {totalCount === 1 ? 'mesa encontrada' : 'mesas encontradas'}</span>
              {activeFiltersCount > 0 && (
                <button
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

      {/* FILTROS - DESKTOP */}
      <section className="hidden border-b border-white/10 bg-[#0B1220]/40 md:block">
        <div className="container mx-auto px-6 py-10">
          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">

            {/* GAVETA 1 — busca + sistema (filtros primários) */}
            <div className="rounded-2xl border border-white/10 bg-[#13213f]/60 p-4">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/40">Buscar</p>
              <div className="grid gap-2.5 sm:grid-cols-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                  <input
                    type="text"
                    value={filters.search}
                    onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                    placeholder="Buscar mesas..."
                    className="w-full rounded-lg border border-white/10 bg-[#0B1220] py-2.5 pl-9 pr-3 text-sm outline-none transition-colors focus:border-[var(--color-artificio-orange)]"
                  />
                </div>

                <div className="min-w-0">
                  {systemsLoading ? (
                    <p className="rounded-lg border border-white/10 bg-[#0B1220] px-3 py-2.5 text-sm text-white/60">
                      Carregando sistemas...
                    </p>
                  ) : systemsTreeError ? (
                    <p className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-200">
                      Sistemas indisponíveis.
                    </p>
                  ) : (
                    <SystemPicker
                      tree={systemsTree}
                      selectedIds={selectedSystemId ? [selectedSystemId] : []}
                      onSelectionChange={(ids) => handleSystemSelect(ids[0] ?? null)}
                      idPrefix="catalog-desktop"
                      mode="single"
                      role="user"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* GAVETA 2 — refinamento por atributo da mesa */}
            <div className="rounded-2xl border border-white/10 bg-[#13213f]/60 p-4">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/40">Refinar</p>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={filters.modality}
                  onChange={(e) => updateFilter(setFilters, 'modality', pickOptionalOption(e.target.value, VALID_MODALITIES))}
                  className="app-select py-2.5"
                >
                  <option value="">Modalidade</option>
                  <option value="online">Online</option>
                  <option value="presencial">Presencial</option>
                  <option value="hibrida">Híbrida</option>
                </select>

                <select
                  value={filters.priceType}
                  onChange={(e) => updateFilter(setFilters, 'priceType', pickOptionalOption(e.target.value, VALID_PRICE_TYPES))}
                  className="app-select py-2.5"
                >
                  <option value="">Preço</option>
                  <option value="gratuita">Gratuita</option>
                  <option value="paga">Paga</option>
                </select>

                <select
                  value={filters.experience}
                  onChange={(e) => updateFilter(setFilters, 'experience', pickOptionalOption(e.target.value, VALID_EXPERIENCE_LEVELS))}
                  className="app-select py-2.5"
                >
                  <option value="">Nível</option>
                  <option value="iniciante">Iniciante</option>
                  <option value="intermediario">Intermediário</option>
                  <option value="veterano">Veterano</option>
                </select>
              </div>
            </div>

            {/* GAVETA 3 — selos (curados) e estilos (livres, com contagem) */}
            <div className="rounded-2xl border border-white/10 bg-[#13213f]/60 p-4 lg:col-span-2">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/40">Selos</span>
                  <button
                    type="button"
                    onClick={() => toggleSeal('ddal')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all whitespace-nowrap ${
                      filters.seal === 'ddal'
                        ? 'border-amber-300/50 bg-amber-500/20 text-amber-100'
                        : 'border-white/10 bg-[#0B1220] text-white/70 hover:border-white/20 hover:bg-white/5'
                    }`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5" /> DDAL
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleSeal('covil-do-lich')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all whitespace-nowrap ${
                      filters.seal === 'covil-do-lich'
                        ? 'border-purple-300/50 bg-purple-500/20 text-purple-100'
                        : 'border-white/10 bg-[#0B1220] text-white/70 hover:border-white/20 hover:bg-white/5'
                    }`}
                  >
                    <Star className="w-3.5 h-3.5" /> Covil do Lich
                  </button>
                </div>

                {styleFacets.length > 0 && (
                  <>
                    <div className="hidden h-6 w-px bg-white/10 sm:block" />
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/40">Estilos</span>
                      {styleFacets.map(({ style, count }) => (
                        <button
                          key={style}
                          type="button"
                          onClick={() => toggleStyle(style)}
                          className={`px-3 py-1.5 rounded-lg border text-xs transition-all whitespace-nowrap ${
                            filters.styles.includes(style)
                              ? 'border-orange-500 bg-orange-500/20 text-orange-100'
                              : 'border-white/10 bg-[#0B1220] text-white/70 hover:border-white/20 hover:bg-white/5'
                          }`}
                        >
                          {style} <span className="text-white/40">({count})</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* BOTÃO FILTROS - MOBILE (acima do FAB de feedback, que fica em bottom-5) */}
      <button
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
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              placeholder="Buscar mesas..."
              className="w-full rounded-lg bg-[#13213f] border border-white/10 pl-9 pr-3 py-2.5 text-sm outline-none focus:border-[var(--color-artificio-orange)] transition-colors"
            />
          </div>

          {systemsLoading ? (
            <p className="rounded-lg border border-white/10 bg-[#13213f] px-3 py-2.5 text-sm text-white/60">
              Carregando sistemas...
            </p>
          ) : systemsTreeError ? (
            <p className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-200">
              Sistemas indisponíveis.
            </p>
          ) : (
            <SystemPicker
              tree={systemsTree}
              selectedIds={selectedSystemId ? [selectedSystemId] : []}
              onSelectionChange={(ids) => handleSystemSelect(ids[0] ?? null)}
              idPrefix="catalog-mobile"
              mode="single"
              role="user"
            />
          )}
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
            <button
              type="button"
              onClick={() => toggleSeal('ddal')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition-all ${
                filters.seal === 'ddal'
                  ? 'border-amber-300/50 bg-amber-500/20 text-amber-100'
                  : 'border-white/10 bg-[#13213f] text-white/70'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" /> DDAL
            </button>

            <button
              type="button"
              onClick={() => toggleSeal('covil-do-lich')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition-all ${
                filters.seal === 'covil-do-lich'
                  ? 'border-purple-300/50 bg-purple-500/20 text-purple-100'
                  : 'border-white/10 bg-[#13213f] text-white/70'
              }`}
            >
              <Star className="w-3.5 h-3.5" /> Covil
            </button>
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
      <section className="container mx-auto px-4 py-8 sm:px-6 lg:py-10">
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
              onClick={() => window.location.reload()}
              className="px-3 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-sm font-semibold transition-colors"
            >
              Tentar novamente
            </button>
          </div>
        )}

        {/* EMPTY STATE */}
        {!isLoading && !isRefreshing && tables.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-16 text-center sm:py-20">
            <D20Glyph className="mx-auto mb-5 h-16 w-16 text-white/20" />
            <p className="text-xl font-bold text-white mb-2">Nenhuma mesa encontrada com esses filtros</p>
            <p className="text-sm text-white/50 mb-6">Ajuste sistema, modalidade ou estilo, ou limpe os filtros para ver todo o catálogo</p>
            {activeFiltersCount > 0 && (
              <button
                onClick={clearFilters}
                className="bg-[var(--color-artificio-orange)] hover:bg-[var(--color-artificio-orange-hover)] px-6 py-3 rounded-lg font-semibold transition-colors"
              >
                Limpar todos os filtros
              </button>
            )}
          </div>
        ) : (
          <>
            {/* GRID */}
            <div className="grid min-w-0 grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-[repeat(auto-fit,minmax(280px,1fr))]">
              {isLoading
                ? Array.from({ length: 12 }).map((_, idx) => <TableCardSkeleton key={idx} />)
                : tables.map((table) => <TableCardComponent key={table.id} table={table} />)}
            </div>

            {/* PAGINATION */}
            {!isLoading && tables.length > 0 && (filters.page > 1 || hasMore) && (
              <div className="mt-8 flex flex-wrap items-center justify-center gap-2 pb-20 md:pb-0">
                <button
                  onClick={() => setFilters(prev => ({ ...prev, page: prev.page - 1 }))}
                  disabled={filters.page === 1}
                  className="p-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Página anterior"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                <div className="flex flex-col items-center gap-1 px-4 py-2 rounded-lg border border-white/10 bg-white/5">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-white/70">Página</span>
                    <span className="font-semibold text-white">{filters.page}</span>
                    {hasMore && <span className="text-white/50">de muitas</span>}
                  </div>
                  <span className="text-xs text-white/50">{tables.length} resultados nesta página</span>
                </div>

                <button
                  onClick={() => setFilters(prev => ({ ...prev, page: prev.page + 1 }))}
                  disabled={!hasMore}
                  className="p-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Próxima página"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
};
