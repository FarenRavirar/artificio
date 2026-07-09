import type { 
  CatalogFilters, 
  SortOption, 
  ModalityOption, 
  PriceTypeOption, 
  ExperienceLevelOption,
  StyleOption 
} from '../services/catalogService';
import type { CatalogSeal } from '../types/tables';

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

// Valores válidos para validação
const VALID_SORT_VALUES: readonly SortOption[] = ['popular', 'recent', 'price_asc', 'price_desc'];
const VALID_MODALITIES: readonly ModalityOption[] = ['online', 'presencial', 'hibrida'];
const VALID_PRICE_TYPES: readonly PriceTypeOption[] = ['gratuita', 'paga'];
const VALID_EXPERIENCE_LEVELS: readonly ExperienceLevelOption[] = ['iniciante', 'intermediario', 'veterano'];
const VALID_SEALS: readonly CatalogSeal[] = ['ddal', 'covil-do-lich', ''];

/**
 * Parser: URLSearchParams → CatalogFilters
 * Valida e normaliza todos os parâmetros da URL
 */
export function parseCatalogFilters(params: URLSearchParams): CatalogFilters {
  // Page: sempre >= 1
  const pageParam = params.get('page');
  const page = pageParam ? Math.max(1, parseInt(pageParam, 10) || 1) : 1;

  // Validar enums usando helper
  const sort = parseEnum(params.get('sort') || '', VALID_SORT_VALUES, 'popular');
  const modality = parseEnum(params.get('modality') || '', [...VALID_MODALITIES, ''] as const, '');
  const priceType = parseEnum(params.get('price_type') || '', [...VALID_PRICE_TYPES, ''] as const, '');
  const experience = parseEnum(params.get('experience_level') || '', [...VALID_EXPERIENCE_LEVELS, ''] as const, '');
  const seal = parseEnum(params.get('seal') || '', VALID_SEALS, '');

  // Styles: normalizar (dedupe + sort + validar) com decode
  const stylesParam = params.get('styles') || '';
  const stylesArray = stylesParam.split(',').filter(Boolean).map(s => {
    try {
      return decodeURIComponent(s);
    } catch {
      return s; // Fallback se decode falhar
    }
  });
  // Estilo é campo livre (setting_styles no backend) — validação real fica
  // no filtro SQL; aqui só descarta lixo óbvio (vazio/gigante).
  const validStyles = stylesArray.filter((s) => s.length > 0 && s.length <= 50);
  const styles: StyleOption[] = [...new Set(validStyles)].sort();

  return {
    search: params.get('search') || '',
    system: params.get('system') || '',
    modality,
    priceType,
    experience,
    seal,
    styles,
    sort,
    page,
    limit: 24,
  };
}

/**
 * Builder: CatalogFilters → URLSearchParams
 * Constrói URL normalizada omitindo defaults
 */
export function buildCatalogParams(filters: CatalogFilters): URLSearchParams {
  const params = new URLSearchParams();
  
  if (filters.search) params.set('search', filters.search);
  if (filters.system) params.set('system', filters.system);
  if (filters.modality) params.set('modality', filters.modality);
  if (filters.priceType) params.set('price_type', filters.priceType);
  if (filters.experience) params.set('experience_level', filters.experience);
  if (filters.seal) params.set('seal', filters.seal);
  if (filters.styles && filters.styles.length > 0) {
    // Encode cada style para segurança futura
    params.set('styles', filters.styles.map(s => encodeURIComponent(s)).join(','));
  }
  if (filters.sort && filters.sort !== 'popular') {
    params.set('sort', filters.sort);
  }
  if (filters.page && filters.page > 1) {
    params.set('page', String(filters.page));
  }
  
  return params;
}
