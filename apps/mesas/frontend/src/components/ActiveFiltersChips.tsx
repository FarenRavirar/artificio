import { X } from 'lucide-react';
import type { CatalogSeal } from '../types/tables';
import {
  DAYPART_OPTIONS,
  EXPERIENCE_LEVEL_OPTIONS,
  MODALITY_OPTIONS,
  PRICE_TYPE_OPTIONS,
  SEAL_OPTIONS,
  SORT_OPTIONS,
  TABLE_TYPE_OPTIONS,
  WEEKDAY_OPTIONS,
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
    weekdays?: string[];
    dayparts?: string[];
    sort?: string;
  };
  systemName?: string;
  onRemove: (key: string, value?: string) => void;
}

// Labels derivados da fonte única (R6): nenhuma lista de valores paralela.
function optionLabel(options: readonly { value: string; label: string }[], value: string): string | undefined {
  return options.find((option) => option.value === value)?.label;
}

/**
 * Chip de campo de valor único, rotulado pela fonte única (R6). Campo vazio não
 * gera chip. `undefined` some na concatenação, então o chamador fica sem `if`.
 *
 * O `label` cai no valor cru quando a opção não está no registro: valor vindo da
 * URL pode ser de uma opção retirada da lista, e sumir com o chip deixaria um
 * filtro ativo e invisível.
 */
function scalarChip(
  key: ActiveFilter['key'],
  value: string | undefined,
  options: readonly { value: string; label: string }[],
): ActiveFilter | undefined {
  if (!value) return undefined;
  return { key, label: optionLabel(options, value) || value, value };
}

/**
 * Um chip por item da lista (E7): o clique remove só aquele valor, não o filtro
 * inteiro — `removeFilter` trata cada chave em ramo próprio.
 */
function listChips(
  key: ActiveFilter['key'],
  values: readonly string[] | undefined,
  options: readonly { value: string; label: string }[],
): ActiveFilter[] {
  return (values ?? []).map((value) => ({
    key,
    label: optionLabel(options, value) || value,
    value,
  }));
}

export function ActiveFiltersChips({ filters, systemName, onRemove }: ActiveFiltersChipsProps) {
  // Lista declarativa em vez de uma cadeia de `if`: acrescentar filtro é
  // acrescentar uma linha, e não há como esquecer o `push` (a cadeia anterior
  // deixou `weekdays`/`dayparts` sem chip por um campo não repassado — achado P2
  // do Codex na PR #327). Complexidade cognitiva de 17 para dentro do limite,
  // apontada pelo Sonar.
  const activeFilters: ActiveFilter[] = [
    filters.search
      ? { key: 'search' as const, label: `Busca: "${filters.search}"`, value: filters.search }
      : undefined,
    // `system` é o único cujo label não vem de registro: o nome chega resolvido
    // do catálogo central, por isso não passa por `scalarChip`.
    filters.system && systemName
      ? { key: 'system' as const, label: systemName, value: filters.system }
      : undefined,
    scalarChip('modality', filters.modality, MODALITY_OPTIONS),
    scalarChip('priceType', filters.priceType, PRICE_TYPE_OPTIONS),
    scalarChip('experience', filters.experience, EXPERIENCE_LEVEL_OPTIONS),
    // Faceta habilitada por T0.2a (spec 094): somente `type` entra nos chips.
    scalarChip('type', filters.type, TABLE_TYPE_OPTIONS),
    scalarChip('seal', filters.seal, SEAL_OPTIONS),
    // Estilo é texto livre do mestre, sem registro de opções: o próprio valor é
    // o label.
    ...listChips('styles', filters.styles, []),
    ...listChips('weekdays', filters.weekdays, WEEKDAY_OPTIONS),
    ...listChips('dayparts', filters.dayparts, DAYPART_OPTIONS),
    filters.sort && filters.sort !== 'popular'
      ? scalarChip('sort', filters.sort, SORT_OPTIONS)
      : undefined,
  ].filter((chip): chip is ActiveFilter => chip !== undefined);

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
