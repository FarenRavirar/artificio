import { X } from 'lucide-react';
import type { CatalogSeal } from '../types/tables';
import {
  EXPERIENCE_LEVEL_OPTIONS,
  MODALITY_OPTIONS,
  PRICE_TYPE_OPTIONS,
  SEAL_OPTIONS,
  SORT_OPTIONS,
  TABLE_TYPE_OPTIONS,
} from '../utils/catalogFilterOptions';

interface ActiveFilter {
  key: string;
  label: string;
  value: string;
}

interface ActiveFiltersChipsProps {
  filters: {
    search?: string;
    system?: string;
    modality?: string;
    priceType?: string;
    experience?: string;
    type?: string;
    seal?: CatalogSeal;
    styles?: string[];
    sort?: string;
  };
  systemName?: string;
  onRemove: (key: string, value?: string) => void;
}

// Labels derivados da fonte única (R6): nenhuma lista de valores paralela.
function optionLabel(options: readonly { value: string; label: string }[], value: string): string | undefined {
  return options.find((option) => option.value === value)?.label;
}

export function ActiveFiltersChips({ filters, systemName, onRemove }: ActiveFiltersChipsProps) {
  const activeFilters: ActiveFilter[] = [];

  if (filters.search) {
    activeFilters.push({ key: 'search', label: `Busca: "${filters.search}"`, value: filters.search });
  }

  if (filters.system && systemName) {
    activeFilters.push({ key: 'system', label: systemName, value: filters.system });
  }

  if (filters.modality) {
    activeFilters.push({ key: 'modality', label: optionLabel(MODALITY_OPTIONS, filters.modality) || filters.modality, value: filters.modality });
  }

  if (filters.priceType) {
    activeFilters.push({ key: 'priceType', label: optionLabel(PRICE_TYPE_OPTIONS, filters.priceType) || filters.priceType, value: filters.priceType });
  }

  if (filters.experience) {
    activeFilters.push({ key: 'experience', label: optionLabel(EXPERIENCE_LEVEL_OPTIONS, filters.experience) || filters.experience, value: filters.experience });
  }

  // Faceta habilitada por T0.2a (spec 094): somente `type` entra nos chips.
  if (filters.type) {
    activeFilters.push({ key: 'type', label: optionLabel(TABLE_TYPE_OPTIONS, filters.type) || filters.type, value: filters.type });
  }

  if (filters.seal) {
    activeFilters.push({ key: 'seal', label: optionLabel(SEAL_OPTIONS, filters.seal) || filters.seal, value: filters.seal });
  }

  if (filters.styles && filters.styles.length > 0) {
    filters.styles.forEach((style) => {
      activeFilters.push({ key: 'styles', label: style, value: style });
    });
  }

  if (filters.sort && filters.sort !== 'popular') {
    activeFilters.push({ key: 'sort', label: optionLabel(SORT_OPTIONS, filters.sort) || filters.sort, value: filters.sort });
  }

  if (activeFilters.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 overflow-hidden">
      {activeFilters.map((filter, idx) => (
        <button
          key={`${filter.key}-${filter.value}-${idx}`}
          onClick={() => onRemove(filter.key, filter.value)}
          className="inline-flex max-w-full min-h-11 items-center gap-1.5 rounded-lg border border-[var(--color-artificio-orange)]/40 bg-[var(--color-artificio-orange)]/20 px-3 py-1.5 text-sm text-[var(--fg)] transition-colors hover:bg-[var(--color-artificio-orange)]/30 group"
          title={`Remover filtro ${filter.label}`}
          aria-label={`Remover filtro ${filter.label}`}
        >
          <span className="min-w-0 truncate">{filter.label}</span>
          <X className="h-3.5 w-3.5 shrink-0 opacity-70 group-hover:opacity-100" />
        </button>
      ))}
    </div>
  );
}
