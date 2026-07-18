import { useEffect, useRef, useState } from 'react';
import { useCatalogTables } from './useCatalogTables';
import type { CatalogFilters } from '../services/catalogService';
import type { TableCard } from '../types/tables';

/**
 * Acumula páginas do catálogo em scroll infinito, sem mudar contrato
 * do backend (que continua paginado por `page`/`limit`).
 *
 * Reseta o acumulado quando qualquer filtro além de `page` muda —
 * URL continua fonte única de verdade (`useCatalogFilters`).
 */
export function useInfiniteCatalogTables(filters: CatalogFilters, searchParamsString: string) {
  const [accumulated, setAccumulated] = useState<TableCard[]>([]);
  const filterKeyRef = useRef<string>('');

  const filterKey = JSON.stringify({ ...filters, page: undefined });

  const { tables, pagination, isLoading, isRefreshing, error } = useCatalogTables(filters, searchParamsString);

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
