import { useUrlState } from './useUrlState';
import { parseCatalogFilters, buildCatalogParams } from '../utils/catalogFilters';
import type { CatalogFilters } from '../services/catalogService';

/**
 * Hook especializado para filtros do catálogo
 * 
 * Wrapper sobre useUrlState que fornece interface específica
 * para os filtros do catálogo de mesas.
 * 
 * @example
 * ```ts
 * const [filters, setFilters] = useCatalogFilters();
 * 
 * // Atualizar página
 * setFilters(prev => ({ ...prev, page: prev.page + 1 }));
 * 
 * // Aplicar filtro
 * setFilters(prev => ({ ...prev, system: 'dnd', page: 1 }));
 * 
 * // Limpar filtros
 * setFilters(() => ({ 
 *   search: '', 
 *   system: '', 
 *   modality: '', 
 *   priceType: '', 
 *   experience: '', 
 *   seal: '', 
 *   styles: [], 
 *   sort: 'popular', 
 *   page: 1, 
 *   limit: 24 
 * }));
 * ```
 */
export function useCatalogFilters(): readonly [
  CatalogFilters,
  (updater: (prev: CatalogFilters) => CatalogFilters) => void
] {
  return useUrlState<CatalogFilters>({
    parse: parseCatalogFilters,
    serialize: buildCatalogParams,
  });
}
