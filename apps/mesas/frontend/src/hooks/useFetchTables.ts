import { useMemo, useState, useEffect } from 'react';
import type { TablesResponse, TableCard, CatalogSeal } from '../types/tables';

interface UseFetchTablesOptions {
  limit?: number;
  featured?: boolean;
  search?: string;
  system?: string;
  seal?: CatalogSeal;
}

export const useFetchTables = (options: UseFetchTablesOptions = {}) => {
  const { limit, featured, search, system, seal } = options;
  const [tables, setTables] = useState<TableCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState<number>(0); // CORREÇÃO DT-05

  useEffect(() => {
    const controller = new AbortController();
    const fetchTables = async () => {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (limit) params.set('limit', String(limit));
      if (featured) params.set('featured', 'true');
      if (search) params.set('search', search);
      if (system) params.set('system', system);
      if (seal) params.set('seal', seal);

      try {
        const res = await fetch(`/api/v1/tables?${params.toString()}`, {
          signal: controller.signal,
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const json: TablesResponse = await res.json();
        setTables(json.data);
        // CORREÇÃO DT-05: Extrair totalCount do pagination
        setTotalCount(json.pagination?.total ?? json.data.length);
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError('Não foi possível carregar as mesas.');
        console.error('[useFetchTables]', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTables();
    return () => controller.abort();
  }, [limit, featured, search, system, seal]);

  return useMemo(
    () => ({ tables, isLoading, error, totalCount }),
    [tables, isLoading, error, totalCount]
  ); // CORREÇÃO DT-05
};
