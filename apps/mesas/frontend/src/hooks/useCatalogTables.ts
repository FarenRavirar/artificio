import { useQuery } from '@tanstack/react-query';
import { fetchCatalogTables, getCatalogErrorMessage, type CatalogFilters } from '../services/catalogService';
import type { TableCard, TablesResponse } from '../types/tables';

// Referência estável: `[]` literal no retorno do hook cria array novo a cada
// render, entra como dependência de useEffect em useInfiniteCatalogTables e
// causa "Maximum update depth exceeded" (setState nunca estabiliza porque a
// referência de `tables` muda toda vez, mesmo com conteúdo idêntico vazio).
const EMPTY_TABLES: TableCard[] = [];

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
export function useCatalogTables(
  filters: CatalogFilters,
  searchParamsString: string,
  /**
   * T4.2 (spec 102): página 1 já resolvida pelo `loader` no servidor.
   *
   * Entra como `initialData` para que o PRIMEIRO render — o do SSR — já tenha
   * os cards. Sem isto o HTML sai com "Carregando…" e zero links `/mesas/`, que
   * é o que o crawler recebia. Só vale para a chave que o servidor buscou:
   * mudou o filtro, o React Query busca normalmente.
   */
  initialData?: TablesResponse | null,
) {
  const query = useQuery<TablesResponse>({
    // QueryKey usa URL diretamente - fonte única de verdade
    // Escala automaticamente com novos filtros, zero manutenção
    queryKey: ['catalog-tables', searchParamsString],
    queryFn: ({ signal }) => fetchCatalogTables(filters, signal),
    ...(initialData ? { initialData } : {}),
    placeholderData: (previousData) => previousData, // React Query v5 - mantém dados anteriores durante transição
    staleTime: 10 * 1000, // 10 segundos - reduz refetch desnecessário
    retry: 1,
    // enabled removido - deve executar sempre, mesmo com URL vazia (sem filtros = todas as mesas)
  });

  // Separar loading inicial de refetch
  const isInitialLoading = query.isLoading && !query.data;
  const isRefetching = query.isFetching && !!query.data;

  return {
    tables: query.data?.data ?? EMPTY_TABLES,
    pagination: query.data?.pagination,
    isLoading: isInitialLoading,
    isRefreshing: isRefetching,
    error: query.error ? getCatalogErrorMessage(query.error) : null,
    refetch: query.refetch,
  };
}
