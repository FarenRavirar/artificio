import type { TablesResponse } from '../types/tables';

// Tipos fortes para filtros
export type SortOption = 'popular' | 'recent' | 'slots' | 'price_asc' | 'price_desc' | 'ending_soon';
export type ModalityOption = 'online' | 'presencial' | 'hibrida';
export type PriceTypeOption = 'gratuita' | 'paga';
export type ExperienceLevelOption = 'iniciante' | 'intermediario' | 'veterano';
// Estilos vêm do backend (t.setting_styles, campo livre populado pelos mestres),
// não são um enum fixo — ver GET /api/v1/tables/style-facets.
export type StyleOption = string;

export interface StyleFacet {
  style: StyleOption;
  count: number;
}

export interface CatalogFilters {
  search: string;
  system: string;
  modality: ModalityOption | '';
  priceType: PriceTypeOption | '';
  experience: ExperienceLevelOption | '';
  seal: string;
  styles: StyleOption[];
  sort: SortOption;
  page: number;
  limit: number;
}

/**
 * Mapeia filtros do frontend (camelCase) para query params do backend (snake_case)
 */
function mapFiltersToQueryParams(filters: CatalogFilters): URLSearchParams {
  const params = new URLSearchParams();

  // Paginação
  params.set('limit', String(filters.limit ?? 24));
  params.set('page', String(filters.page ?? 1));

  // Busca
  if (filters.search) params.set('search', filters.search);

  // Filtros básicos
  if (filters.system) params.set('system', filters.system);
  if (filters.modality) params.set('modality', filters.modality);

  // Mapper: camelCase → snake_case
  if (filters.priceType) params.set('price_type', filters.priceType);
  if (filters.experience) params.set('experience_level', filters.experience);

  // Selos e estilos
  if (filters.seal) params.set('seal', filters.seal);
  if (filters.styles && filters.styles.length > 0) {
    // Normalizar para cache determinístico
    params.set('styles', [...filters.styles].sort().join(','));
  }

  // Ordenação (não adicionar se for padrão)
  if (filters.sort && filters.sort !== 'popular') {
    params.set('sort', filters.sort);
  }

  return params;
}

/**
 * Busca mesas do catálogo público
 * @param signal - AbortSignal para cancelamento de requisições em transições rápidas
 */
export async function fetchCatalogTables(filters: CatalogFilters, signal?: AbortSignal): Promise<TablesResponse> {
  const params = mapFiltersToQueryParams(filters);
  const response = await fetch(`/api/v1/tables?${params.toString()}`, { signal });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Mensagens de erro específicas por status HTTP
 */
export const catalogErrorMessages: Record<number, string> = {
  400: 'Filtros inválidos. Tente limpar os filtros.',
  404: 'Nenhuma mesa encontrada.',
  500: 'Erro no servidor. Tente novamente em alguns instantes.',
  503: 'Serviço temporariamente indisponível.',
};

/**
 * Extrai mensagem de erro amigável
 */
export function getCatalogErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.startsWith('HTTP ')) {
    const status = parseInt(error.message.replace('HTTP ', ''));
    return catalogErrorMessages[status] || 'Erro ao carregar mesas.';
  }
  return 'Erro ao carregar mesas.';
}
