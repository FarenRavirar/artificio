import type {
  CatalogFilters,
  StyleOption,
} from '../services/catalogService';
import type { DaypartOption, WeekdayOption } from './catalogFilterOptions';
import {
  DAYPART_VALUES,
  EXPERIENCE_LEVEL_VALUES,
  MODALITY_VALUES,
  normalizeEnumMulti,
  normalizeStyles,
  PRICE_TYPE_VALUES,
  SEAL_VALUES,
  SORT_VALUES,
  TABLE_TYPE_VALUES,
  WEEKDAY_VALUES,
} from './catalogFilterOptions';

/**
 * Lista multivalor separada por vírgula, com decode por item — mesma forma de
 * `styles` (o valor pode conter acento, e o dia contém: `sábado`, `terça`).
 */
function parseCsvParam(raw: string): string[] {
  return raw
    .split(',')
    .filter(Boolean)
    .map((item) => {
      try {
        return decodeURIComponent(item);
      } catch {
        return item; // decode inválido não quebra o parser
      }
    });
}

// Helper genérico para parsing de enums
function parseEnum<T extends string>(
  value: string,
  validValues: readonly T[],
  fallback: T
): T {
  return (validValues as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

/**
 * Parser: URLSearchParams → CatalogFilters
 * Valida e normaliza todos os parâmetros da URL.
 *
 * Contratos da Fase 1 (spec 094):
 * - valores válidos vêm exclusivamente da fonte única catalogFilterOptions.ts;
 * - `sort=ending_soon` legado normaliza para `popular` (D0.4) — nunca produz
 *   opção selecionada sem efeito;
 * - `featured`, `audience`, `state` e `city` não existem aqui (D0.2/T0.2a):
 *   parâmetros presentes na URL são simplesmente ignorados.
 */
export function parseCatalogFilters(params: URLSearchParams): CatalogFilters {
  // Page: sempre >= 1
  const pageParam = params.get('page');
  const page = pageParam ? Math.max(1, parseInt(pageParam, 10) || 1) : 1;

  // Validar enums usando helper. `ending_soon` não está em SORT_VALUES, então
  // cai no fallback `popular` — normalização de URL legado (D0.4).
  const sort = parseEnum(params.get('sort') || '', SORT_VALUES, 'popular');
  const modality = parseEnum(params.get('modality') || '', [...MODALITY_VALUES, ''] as const, '');
  const priceType = parseEnum(params.get('price_type') || '', [...PRICE_TYPE_VALUES, ''] as const, '');
  const experience = parseEnum(params.get('experience_level') || '', [...EXPERIENCE_LEVEL_VALUES, ''] as const, '');
  const seal = parseEnum(params.get('seal') || '', [...SEAL_VALUES, ''] as const, '');
  const type = parseEnum(params.get('type') || '', [...TABLE_TYPE_VALUES, ''] as const, '');

  // Styles: normalizar (decode + trim + dedupe + sort) — ver normalizeStyles.
  const styles: StyleOption[] = normalizeStyles(parseCsvParam(params.get('styles') || ''));

  // Agenda (spec 103): valor fora do registro canônico é descartado em silêncio,
  // igual aos enums escalares — `weekday=funday` cai no vazio, não quebra a
  // página. `normalizeEnumMulti` também deduplica e reordena pela ordem de
  // calendário/cronologia, então a URL é estável qualquer que seja a ordem.
  const weekdays: WeekdayOption[] = normalizeEnumMulti(
    parseCsvParam(params.get('weekday') || ''),
    WEEKDAY_VALUES,
  );
  const dayparts: DaypartOption[] = normalizeEnumMulti(
    parseCsvParam(params.get('daypart') || ''),
    DAYPART_VALUES,
  );

  return {
    search: params.get('search') || '',
    system: params.get('system') || '',
    modality,
    priceType,
    experience,
    seal,
    styles,
    type,
    weekdays,
    dayparts,
    sort,
    page,
    limit: 24,
  };
}

/**
 * Builder: CatalogFilters → URLSearchParams
 * Constrói URL normalizada omitindo defaults.
 *
 * Não serializa `featured`/`audience`/`state`/`city` (fora do contrato do
 * frontend) nem `sort=popular`/`page=1` (defaults). Styles são normalizados
 * antes do encode para a URL ser estável independentemente da ordem de seleção.
 */
export function buildCatalogParams(filters: CatalogFilters): URLSearchParams {
  const params = new URLSearchParams();

  if (filters.search) params.set('search', filters.search);
  if (filters.system) params.set('system', filters.system);
  if (filters.modality) params.set('modality', filters.modality);
  if (filters.priceType) params.set('price_type', filters.priceType);
  if (filters.experience) params.set('experience_level', filters.experience);
  if (filters.type) params.set('type', filters.type);
  if (filters.seal) params.set('seal', filters.seal);
  if (filters.styles && filters.styles.length > 0) {
    const normalizedStyles = normalizeStyles(filters.styles);
    if (normalizedStyles.length > 0) {
      // Encode cada style para segurança futura
      params.set('styles', normalizedStyles.map(s => encodeURIComponent(s)).join(','));
    }
  }
  // Agenda: ordem canônica antes do encode, para o round-trip parse→build ser
  // estável (E4/E5 da spec 103). O `encodeURIComponent` por item protege o
  // acento de `sábado`/`terça` da vírgula delimitadora.
  const weekdays = normalizeEnumMulti(filters.weekdays ?? [], WEEKDAY_VALUES);
  if (weekdays.length > 0) {
    params.set('weekday', weekdays.map((day) => encodeURIComponent(day)).join(','));
  }
  const dayparts = normalizeEnumMulti(filters.dayparts ?? [], DAYPART_VALUES);
  if (dayparts.length > 0) {
    params.set('daypart', dayparts.join(','));
  }

  if (filters.sort && filters.sort !== 'popular') {
    params.set('sort', filters.sort);
  }
  if (filters.page && filters.page > 1) {
    params.set('page', String(filters.page));
  }

  return params;
}
