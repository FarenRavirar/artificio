import { useEffect, useRef, useState } from 'react';
import {
  Monitor,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Ticket,
} from 'lucide-react';
import { ActiveFiltersChips } from './ActiveFiltersChips';
import { CatalogAdvancedFilters } from './CatalogAdvancedFilters';
import { CatalogSystemPopover } from './CatalogSystemPopover';
import type {
  CatalogFilters,
  StyleFacet,
  StyleOption,
} from '../services/catalogService';
import type { CatalogSeal } from '../types/tables';
import type { SystemTreeNode } from '../types/systems';
import {
  PUBLIC_MODALITY_OPTIONS,
  PUBLIC_SHORTCUT_OPTIONS,
  PRICE_TYPE_OPTIONS,
  SEAL_VALUES,
} from '../utils/catalogFilterOptions';
import type { ModalityOption, PriceTypeOption } from '../services/catalogService';

/**
 * Barra de filtros do catálogo (spec 094, R1–R3, R10–R12).
 *
 * - UMA busca geral, com estado visual (draft) promovido só por botão/Enter
 *   (D0.3) — a página continua dona do `filters` confirmado;
 * - linha primária em grid deliberado (nunca `flex-wrap`): no mobile, busca e
 *   sistema ocupam largura total e os demais controles formam pares; em `lg+`
 *   tudo vive numa linha só (R3, aceite 1);
 * - "Mais filtros" abre o painel avançado inline no desktop (badge com a
 *   quantidade de filtros avançados ativos) e o drawer no mobile;
 * - atalhos são aliases de filtros reais (R10–R12) — clicar de novo remove;
 * - chips ativos + "Limpar tudo" logo abaixo (R10).
 *
 * `CatalogAdvancedFilters` é o MESMO componente no painel desktop e no drawer
 * mobile (fonte única de campos, R15).
 */

function pickOptional<T extends string>(value: string, valid: readonly T[]): T | '' {
  return value !== '' && (valid as readonly string[]).includes(value) ? (value as T) : '';
}

export type CatalogFiltersBarProps = Readonly<{
  filters: CatalogFilters;
  draftSearch: string;
  onDraftSearchChange: (value: string) => void;
  onSearchSubmit: () => void;
  systemsTree: SystemTreeNode[];
  systemsLoading: boolean;
  systemsError: string | null;
  selectedSystemId: string | null;
  onSystemSelect: (systemId: string | null) => void;
  onModalityChange: (value: ModalityOption | '') => void;
  onPriceChange: (value: PriceTypeOption | '') => void;
  onExperienceChange: (value: CatalogFilters['experience']) => void;
  onTypeChange: (value: CatalogFilters['type']) => void;
  onSealToggle: (seal: CatalogSeal) => void;
  onStyleToggle: (style: StyleOption) => void;
  styleFacets: StyleFacet[];
  /** Quantidade de filtros avançados ativos (experiência, tipo, selo, estilos)
   * — badge do botão "Mais filtros". */
  advancedCount: number;
  systemName?: string;
  onRemoveFilter: (key: string, value?: string) => void;
  onClearFilters: () => void;
  onOpenMobileFilters: () => void;
  /** Estado do drawer mobile — mantém `aria-expanded` fiel em qualquer viewport (R9). */
  mobileFiltersOpen: boolean;
}>;

export function CatalogFiltersBar({
  filters,
  draftSearch,
  onDraftSearchChange,
  onSearchSubmit,
  systemsTree,
  systemsLoading,
  systemsError,
  selectedSystemId,
  onSystemSelect,
  onModalityChange,
  onPriceChange,
  onExperienceChange,
  onTypeChange,
  onSealToggle,
  onStyleToggle,
  styleFacets,
  advancedCount,
  systemName,
  onRemoveFilter,
  onClearFilters,
  onOpenMobileFilters,
  mobileFiltersOpen,
}: CatalogFiltersBarProps) {
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const closeMore = () => {
    setIsMoreOpen(false);
    moreButtonRef.current?.focus();
  };

  // Escape fecha o painel avançado e devolve o foco ao gatilho (R16).
  useEffect(() => {
    if (!isMoreOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMore();
    };
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        panelRef.current
        && !panelRef.current.contains(target)
        && moreButtonRef.current
        && !moreButtonRef.current.contains(target)
      ) {
        closeMore();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handlePointerDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [isMoreOpen]);

  const handleMoreClick = () => {
    if (window.matchMedia('(min-width: 768px)').matches) {
      setIsMoreOpen((prev) => !prev);
    } else {
      onOpenMobileFilters();
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onSearchSubmit();
  };

  // Atalhos = aliases de filtros reais (R10), limitados às escolhas que tiveram
  // resultado público na medição T0.2a/R22.
  const shortcuts: ReadonlyArray<{
    key: string;
    label: string;
    icon: React.ReactNode;
    active: boolean;
    onToggle: () => void;
  }> = PUBLIC_SHORTCUT_OPTIONS.map((shortcut) => {
    if (shortcut.kind === 'priceType') {
      return {
        ...shortcut,
        icon: <Ticket className="h-3.5 w-3.5" />,
        active: filters.priceType === shortcut.value,
        onToggle: () => onPriceChange(filters.priceType === shortcut.value ? '' : shortcut.value),
      };
    }
    return {
      ...shortcut,
      icon: <Monitor className="h-3.5 w-3.5" />,
      active: filters.modality === shortcut.value,
      onToggle: () => onModalityChange(filters.modality === shortcut.value ? '' : shortcut.value),
    };
  });

  const hasActiveFilters =
    [filters.search, filters.system, filters.modality, filters.priceType, filters.experience, filters.type, filters.seal,
      filters.sort !== 'popular' ? filters.sort : '']
      .filter(Boolean).length > 0
    || filters.styles.length > 0;

  return (
    <section aria-label="Filtros de mesas" className="border-b border-[var(--line)] bg-[var(--surface-subtle)]">
      <div className="mx-auto max-w-[1180px] px-4 py-4 sm:px-6 sm:py-5">
        <form
          role="search"
          onSubmit={handleSubmit}
          className="grid grid-cols-2 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,190px)_130px_112px_auto_auto]"
        >
          {/* BUSCA GERAL — única na página (R1). Draft visual → confirmado só
              por botão/Enter (D0.3); nenhuma request por caractere. */}
          <div className="relative col-span-2 min-w-0 lg:col-span-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--fg-muted)]" />
            <input
              id="catalog-search"
              type="search"
              aria-label="Buscar mesas"
              value={draftSearch}
              onChange={(event) => onDraftSearchChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return;
                event.preventDefault();
                onSearchSubmit();
              }}
              placeholder="Ex: D&D, Vampiro, Mesa iniciante..."
              className="h-11 w-full rounded-lg border border-transparent bg-[var(--surface)] pl-9 pr-3 text-sm text-[var(--fg)] outline-none transition-colors placeholder:text-[var(--fg-muted)] focus:border-[var(--artificio-brand)] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[var(--artificio-focus)]"
            />
          </div>

          {/* SISTEMA — gatilho compacto + árvore em popover/dialog (R8/R9). */}
          <div className="col-span-2 min-w-0 lg:col-span-1">
            <CatalogSystemPopover
              tree={systemsTree}
              loading={systemsLoading}
              error={systemsError}
              selectedSystemId={selectedSystemId}
              onSelect={onSystemSelect}
            />
          </div>

          {/* MODALIDADE */}
          <div className="col-span-1 min-w-0">
            <label htmlFor="catalog-modality" className="sr-only">Modalidade</label>
            <select
              id="catalog-modality"
              value={filters.modality}
              onChange={(event) => onModalityChange(pickOptional(event.target.value, PUBLIC_MODALITY_OPTIONS.map((option) => option.value)))}
              className="app-select h-11 w-full min-w-0"
            >
              <option value="">Modalidade</option>
              {PUBLIC_MODALITY_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          {/* PREÇO */}
          <div className="col-span-1 min-w-0">
            <label htmlFor="catalog-price" className="sr-only">Preço</label>
            <select
              id="catalog-price"
              value={filters.priceType}
              onChange={(event) => onPriceChange(pickOptional(event.target.value, PRICE_TYPE_OPTIONS.map((option) => option.value)))}
              className="app-select h-11 w-full min-w-0"
            >
              <option value="">Preço</option>
              {PRICE_TYPE_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          {/* MAIS FILTROS */}
          <div className="col-span-1 min-w-0">
            <button
              ref={moreButtonRef}
              id="catalog-more-filters"
              type="button"
              onClick={handleMoreClick}
              aria-expanded={isMoreOpen || mobileFiltersOpen}
              aria-controls="catalog-advanced-panel catalog-mobile-filters-drawer"
              className="flex h-11 w-full min-w-0 items-center justify-center gap-2 rounded-lg border border-transparent bg-[var(--surface)] px-3 text-sm font-semibold whitespace-nowrap text-[var(--fg)] transition-colors hover:bg-[var(--surface-strong)] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[var(--artificio-focus)]"
            >
              <SlidersHorizontal className="h-4 w-4 shrink-0" />
              <span className="truncate">Mais filtros</span>
              {advancedCount > 0 && (
                <span
                  aria-label={`${advancedCount} ${advancedCount === 1 ? 'filtro avançado ativo' : 'filtros avançados ativos'}`}
                  className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-artificio-orange)] px-1 text-xs font-black text-white"
                >
                  {advancedCount}
                </span>
              )}
            </button>
          </div>

          {/* AÇÃO BUSCAR */}
          <div className="col-span-1 min-w-0">
            <button
              id="catalog-search-submit"
              type="submit"
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[var(--color-artificio-orange)] px-4 text-sm font-semibold whitespace-nowrap text-white transition-colors hover:bg-[var(--color-artificio-orange-hover)] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[var(--artificio-focus)]"
            >
              <Search className="h-4 w-4 shrink-0" />
              Buscar
            </button>
          </div>
        </form>

        {/* ATALHOS — aliases de filtros reais; rolagem horizontal deliberada no
            mobile (D0.1), sem flex-wrap emergente no desktop. */}
        <div
          aria-label="Atalhos de filtro"
          className="mt-3 flex items-center gap-2 overflow-x-auto pb-1 md:flex-wrap md:overflow-visible"
        >
          <span className="hidden shrink-0 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--fg-muted)] md:inline">
            Atalhos
          </span>
          {shortcuts.map(({ key, label, icon, active, onToggle }) => (
            <button
              key={key}
              type="button"
              onClick={onToggle}
              aria-pressed={active}
              className={`flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-all focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[var(--artificio-focus)] ${
                active
                  ? 'border-[var(--color-artificio-orange)]/50 bg-[var(--color-artificio-orange)]/20 text-[var(--fg)]'
                  : 'border-transparent bg-[var(--surface)] text-[var(--fg-muted)] hover:bg-[var(--surface-strong)]'
              }`}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>

        {/* PAINEL AVANÇADO (desktop) — mesma definição canônica do drawer (R15). */}
        {isMoreOpen && (
          <div
            ref={panelRef}
            id="catalog-advanced-panel"
            className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4"
          >
            <CatalogAdvancedFilters
              filters={{
                experience: filters.experience,
                type: filters.type,
                seal: filters.seal,
                styles: filters.styles,
              }}
              styleFacets={styleFacets}
              onExperienceChange={onExperienceChange}
              onTypeChange={onTypeChange}
              onSealToggle={onSealToggle}
              onStyleToggle={onStyleToggle}
              idPrefix="catalog-advanced-desktop"
            />
          </div>
        )}

        {/* CHIPS ATIVOS + LIMPAR TUDO (R10) */}
        {hasActiveFilters && (
          <div className="mt-3 flex flex-wrap items-center gap-2" aria-live="polite">
            <ActiveFiltersChips
              filters={{
                search: filters.search,
                system: filters.system,
                modality: filters.modality,
                priceType: filters.priceType,
                experience: filters.experience,
                type: filters.type,
                seal: pickOptional(filters.seal, SEAL_VALUES),
                styles: filters.styles,
                sort: filters.sort,
              }}
              systemName={systemName}
              onRemove={onRemoveFilter}
            />
            <button
              type="button"
              onClick={onClearFilters}
              className="ml-auto flex min-h-11 shrink-0 items-center gap-2 rounded-lg border border-transparent bg-[var(--surface)] px-3 text-sm font-semibold whitespace-nowrap text-[var(--fg)] transition-colors hover:bg-[var(--surface-strong)] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[var(--artificio-focus)]"
            >
              <RotateCcw className="h-4 w-4" />
              Limpar tudo
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
