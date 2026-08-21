import type {
  CatalogFilters,
  StyleOption,
} from '../services/catalogService';
import {
  EXPERIENCE_LEVEL_VALUES,
  MODALITY_VALUES,
  normalizeStyles,
  PRICE_TYPE_VALUES,
  SEAL_VALUES,
  SORT_VALUES,
  TABLE_TYPE_VALUES,
} from './catalogFilterOptions';

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
  const stylesParam = params.get('styles') || '';
  const stylesArray = stylesParam.split(',').filter(Boolean).map(s => {
    try {
      return decodeURIComponent(s);
    } catch {
      return s; // Fallback se decode falhar
    }
  });
  const styles: StyleOption[] = normalizeStyles(stylesArray);

  return {
    search: params.get('search') || '',
    system: params.get('system') || '',
    modality,
    priceType,
    experience,
    seal,
    styles,
    type,
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
  if (filters.sort && filters.sort !== 'popular') {
    params.set('sort', filters.sort);
  }
  if (filters.page && filters.page > 1) {
    params.set('page', String(filters.page));
  }

  return params;
}
