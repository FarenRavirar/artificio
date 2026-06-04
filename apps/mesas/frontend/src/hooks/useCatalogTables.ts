import { useQuery } from '@tanstack/react-query';
import { fetchCatalogTables, getCatalogErrorMessage, type CatalogFilters } from '../services/catalogService';
import type { TablesResponse } from '../types/tables';

/**
 * Hook para buscar mesas do catálogo com React Query
 * 
 * Benefícios:
 * - Cache automático por queryKey (URL como fonte única de verdade)
 * - Deduplicação de requisições
 * - Retry automático em caso de erro
 * - placeholderData para transições suaves
 * - Proteção contra race conditions em transições rápidas
 */
export function useCatalogTables(filters: CatalogFilters, searchParamsString: string) {
  const query = useQuery<TablesResponse>({
    // QueryKey usa URL diretamente - fonte única de verdade
    // Escala automaticamente com novos filtros, zero manutenção
    queryKey: ['catalog-tables', searchParamsString],
    queryFn: ({ signal }) => fetchCatalogTables(filters, signal),
    placeholderData: (previousData) => previousData, // React Query v5 - mantém dados anteriores durante transição
    staleTime: 10 * 1000, // 10 segundos - reduz refetch desnecessário
    retry: 1,
    // enabled removido - deve executar sempre, mesmo com URL vazia (sem filtros = todas as mesas)
  });

  // Separar loading inicial de refetch
  const isInitialLoading = query.isLoading && !query.data;
  const isRefetching = query.isFetching && !!query.data;

  return {
    tables: query.data?.data ?? [],
    pagination: query.data?.pagination,
    isLoading: isInitialLoading,
    isRefreshing: isRefetching,
    error: query.error ? getCatalogErrorMessage(query.error) : null,
    refetch: query.refetch,
  };
}
