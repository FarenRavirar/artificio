import { useEffect, useRef, useState } from 'react';
import { useCatalogTables } from './useCatalogTables';
import type { CatalogFilters } from '../services/catalogService';
import type { TableCard, TablesResponse } from '../types/tables';

/**
 * Acumula páginas do catálogo em scroll infinito, sem mudar contrato
 * do backend (que continua paginado por `page`/`limit`).
 *
 * Reseta o acumulado quando qualquer filtro além de `page` muda —
 * URL continua fonte única de verdade (`useCatalogFilters`).
 */
export function useInfiniteCatalogTables(
  filters: CatalogFilters,
  searchParamsString: string,
  /** Página 1 vinda do `loader` (spec 102 T4.2) — ver `useCatalogTables`. */
  initialData?: TablesResponse | null,
) {
  // O acumulado nasce com o que o servidor já buscou: partir de `[]` faria o
  // HTML do SSR sair sem card nenhum, mesmo com o dado em mãos.
  const [accumulated, setAccumulated] = useState<TableCard[]>(initialData?.data ?? []);
  const filterKeyRef = useRef<string>('');

  const filterKey = JSON.stringify({ ...filters, page: undefined });

  const { tables, pagination, isLoading, isRefreshing, error } = useCatalogTables(
    filters,
    searchParamsString,
    initialData,
  );

  useEffect(() => {
    if (isLoading) return;

    if (filterKeyRef.current !== filterKey) {
      filterKeyRef.current = filterKey;
      setAccumulated(tables);
      return;
    }

    setAccumulated((prev) => {
      if (filters.page === 1) return tables;
      const seen = new Set(prev.map((t) => t.id));
      return [...prev, ...tables.filter((t) => !seen.has(t.id))];
    });
  }, [tables, filters.page, filterKey, isLoading]);

  return {
    tables: accumulated,
    pagination,
    isLoading,
    isRefreshing,
    error,
  };
}
