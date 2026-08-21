import { ShieldCheck, Star } from 'lucide-react';
import { SealToggle } from './SealToggle';
import { StyleFacetPicker } from './StyleFacetPicker';
import type {
  CatalogFilters,
  ExperienceLevelOption,
  StyleFacet,
  StyleOption,
} from '../services/catalogService';
import type { CatalogSeal } from '../types/tables';
import {
  PUBLIC_EXPERIENCE_LEVEL_OPTIONS,
  PUBLIC_SEAL_OPTIONS,
  PUBLIC_TABLE_TYPE_OPTIONS,
  pickOptional,
} from '../utils/catalogFilterOptions';
import type { TableTypeOption } from '../utils/catalogFilterOptions';

/**
 * Filtros secundários do catálogo (spec 094, R4/R6/R11/R12/R22) — UMA definição
 * canônica compartilhada por desktop (painel "Mais filtros") e mobile (drawer).
 * Nenhum valor/label é declarado aqui além do que já vem de
 * `catalogFilterOptions.ts` (fonte única): desktop e mobile produzem os mesmos
 * `URLSearchParams` porque recebem os mesmos filters/callbacks (R15).
 *
 * Política de renderização T0.2a (2026-08-21, medição pública de 25 mesas):
 * - `type`: somente `campanha` (24) e `oneshot-serie` (1) renderizam;
 *   `one-shot` e `aberta` tiveram 0 resultado e são omitidas (R22).
 * - `audience`, `state`, `city` e `featured`: NÃO renderizam (reprovadas /
 *   excluídas por D0.2) — não existem controles para elas.
 * - Estilos vêm de `useStyleFacets` via props (sem fetch próprio, sem lista fixa).
 */

export type CatalogAdvancedFiltersProps = Readonly<{
  filters: Pick<CatalogFilters, 'experience' | 'type' | 'seal' | 'styles'>;
  styleFacets: StyleFacet[];
  onExperienceChange: (value: ExperienceLevelOption | '') => void;
  onTypeChange: (value: TableTypeOption | '') => void;
  onSealToggle: (seal: CatalogSeal) => void;
  onStyleToggle: (style: StyleOption) => void;
  /** Prefixo de IDs — desktop e mobile passam valores distintos para garantir
   * unicidade de DOM caso as duas superfícies coexistam. */
  idPrefix: string;
}>;

export function CatalogAdvancedFilters({
  filters,
  styleFacets,
  onExperienceChange,
  onTypeChange,
  onSealToggle,
  onStyleToggle,
  idPrefix,
}: CatalogAdvancedFiltersProps) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="min-w-0">
          <label htmlFor={`${idPrefix}-experience`} className="mb-1.5 block text-xs font-semibold text-[var(--fg-muted)]">
            Experiência
          </label>
          <select
            id={`${idPrefix}-experience`}
            value={filters.experience}
            onChange={(event) => onExperienceChange(pickOptional(
              event.target.value,
              PUBLIC_EXPERIENCE_LEVEL_OPTIONS.map((option) => option.value),
            ))}
            className="app-select h-11 w-full min-w-0"
          >
            <option value="">Qualquer nível</option>
            {PUBLIC_EXPERIENCE_LEVEL_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        <div className="min-w-0">
          <label htmlFor={`${idPrefix}-type`} className="mb-1.5 block text-xs font-semibold text-[var(--fg-muted)]">
            Tipo de mesa
          </label>
          <select
            id={`${idPrefix}-type`}
            value={filters.type}
            onChange={(event) => onTypeChange(pickOptional(
              event.target.value,
              PUBLIC_TABLE_TYPE_OPTIONS.map((option) => option.value),
            ))}
            className="app-select h-11 w-full min-w-0"
          >
            <option value="">Todos os tipos</option>
            {PUBLIC_TABLE_TYPE_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {PUBLIC_SEAL_OPTIONS.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-semibold text-[var(--fg-muted)]">Selos</p>
          <div className="flex gap-2">
            {PUBLIC_SEAL_OPTIONS.map(({ value, label }) => (
            <SealToggle
              key={value}
              variant="drawer"
              active={filters.seal === value}
              onClick={() => onSealToggle(value)}
              icon={value === 'ddal' ? <ShieldCheck className="h-3.5 w-3.5" /> : <Star className="h-3.5 w-3.5" />}
              activeClassName={value === 'ddal' ? 'border-amber-300/50 bg-amber-500/20 text-amber-100' : 'border-purple-300/50 bg-purple-500/20 text-purple-100'}
            >
              {label}
            </SealToggle>
            ))}
          </div>
        </div>
      )}

      {styleFacets.length > 0 && (
      <div className="min-w-0">
        {/* StyleFacetPicker = top facetas visíveis + popover pesquisável pro
            resto (T2.7/R11): fonte real `style-facets`, sem lista fixa completa,
            sem scroll horizontal sem affordance. Reusado no desktop e no mobile. */}
        <StyleFacetPicker facets={styleFacets} selected={filters.styles} onToggle={onStyleToggle} />
      </div>
      )}
    </div>
  );
}
