import { X } from 'lucide-react';
import type { CatalogSeal } from '../types/tables';

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
    seal?: CatalogSeal;
    styles?: string[];
    sort?: string;
  };
  systemName?: string;
  onRemove: (key: string, value?: string) => void;
}

const modalityLabels: Record<string, string> = {
  online: 'Online',
  presencial: 'Presencial',
  hibrida: 'Híbrida',
};

const priceLabels: Record<string, string> = {
  gratuita: 'Gratuita',
  paga: 'Paga',
};

const experienceLabels: Record<string, string> = {
  iniciante: 'Iniciante',
  intermediario: 'Intermediário',
  veterano: 'Veterano',
};

const sealLabels: Record<string, string> = {
  ddal: 'DDAL',
  'covil-do-lich': 'Covil do Lich',
};

const sortLabels: Record<string, string> = {
  popular: 'Mais relevantes',
  recent: 'Mais recentes',
  slots: 'Mais vagas',
  price_asc: 'Menor preço',
  price_desc: 'Maior preço',
};

export function ActiveFiltersChips({ filters, systemName, onRemove }: ActiveFiltersChipsProps) {
  const activeFilters: ActiveFilter[] = [];

  if (filters.search) {
    activeFilters.push({ key: 'search', label: `Busca: "${filters.search}"`, value: filters.search });
  }

  if (filters.system && systemName) {
    activeFilters.push({ key: 'system', label: systemName, value: filters.system });
  }

  if (filters.modality) {
    activeFilters.push({ key: 'modality', label: modalityLabels[filters.modality] || filters.modality, value: filters.modality });
  }

  if (filters.priceType) {
    activeFilters.push({ key: 'priceType', label: priceLabels[filters.priceType] || filters.priceType, value: filters.priceType });
  }

  if (filters.experience) {
    activeFilters.push({ key: 'experience', label: experienceLabels[filters.experience] || filters.experience, value: filters.experience });
  }

  if (filters.seal) {
    activeFilters.push({ key: 'seal', label: sealLabels[filters.seal] || filters.seal, value: filters.seal });
  }

  if (filters.styles && filters.styles.length > 0) {
    filters.styles.forEach((style) => {
      activeFilters.push({ key: 'styles', label: style, value: style });
    });
  }

  if (filters.sort && filters.sort !== 'popular') {
    activeFilters.push({ key: 'sort', label: sortLabels[filters.sort] || filters.sort, value: filters.sort });
  }

  if (activeFilters.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 overflow-hidden">
      {activeFilters.map((filter, idx) => (
        <button
          key={`${filter.key}-${filter.value}-${idx}`}
          onClick={() => onRemove(filter.key, filter.value)}
          className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-[var(--color-artificio-orange)]/40 bg-[var(--color-artificio-orange)]/20 px-3 py-1.5 text-sm text-white transition-colors hover:bg-[var(--color-artificio-orange)]/30 group"
          title={`Remover filtro ${filter.label}`}
        >
          <span className="min-w-0 truncate">{filter.label}</span>
          <X className="h-3.5 w-3.5 shrink-0 opacity-70 group-hover:opacity-100" />
        </button>
      ))}
    </div>
  );
}
