import { useCallback, useEffect, useMemo, useState } from 'react';
import { showError } from '../../../../utils/toast';
import {
  DEFAULT_ACTIVITY_FILTERS,
  DEFAULT_ACTIVITY_FILTERS_META,
  type ActivityEntry,
  type ActivityFeedResponse,
  type ActivityFiltersState,
} from '../types';

const API_BASE = import.meta.env.VITE_API_URL || '';
const DEFAULT_LIMIT = 30;

interface UseActivityLogReturn {
  entries: ActivityEntry[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  nextCursor: string | null;
  filtersMeta: ActivityFeedResponse['filters_meta'];
  filters: ActivityFiltersState;
  setFilters: (next: ActivityFiltersState | ((prev: ActivityFiltersState) => ActivityFiltersState)) => void;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  clearFilters: () => void;
}

function buildQuery(filters: ActivityFiltersState, cursor: string | null): string {
  const params = new URLSearchParams();

  if (filters.search.trim()) {
    params.set('search', filters.search.trim());
  }

  for (const action of filters.actions) {
    if (action.trim()) {
      params.append('action', action.trim());
    }
  }

  if (filters.actor_id) {
    params.set('actor_id', filters.actor_id);
  }

  if (filters.target_user_id) {
    params.set('target_user_id', filters.target_user_id);
  }

  if (filters.date_from) {
    params.set('date_from', filters.date_from);
  }

  if (filters.date_to) {
    params.set('date_to', filters.date_to);
  }

  if (cursor) {
    params.set('cursor', cursor);
  }

  params.set('limit', String(DEFAULT_LIMIT));

  const queryString = params.toString();
  return queryString.length > 0 ? `?${queryString}` : '';
}

export function useActivityLog(): UseActivityLogReturn {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [filtersMeta, setFiltersMeta] = useState<ActivityFeedResponse['filters_meta']>(DEFAULT_ACTIVITY_FILTERS_META);
  const [filters, setFiltersState] = useState<ActivityFiltersState>(DEFAULT_ACTIVITY_FILTERS);
  const [debouncedSearch, setDebouncedSearch] = useState(filters.search);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(filters.search);
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [filters.search]);

  const effectiveFilters = useMemo<ActivityFiltersState>(() => ({
    ...filters,
    search: debouncedSearch,
  }), [filters, debouncedSearch]);

  const fetchPage = useCallback(async (
    currentFilters: ActivityFiltersState,
    cursor: string | null,
    append: boolean,
  ) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    try {
      const query = buildQuery(currentFilters, cursor);
      const response = await fetch(`${API_BASE}/api/v1/admin/activity${query}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = await response.json() as ActivityFeedResponse;
      const pageEntries = Array.isArray(payload.data) ? payload.data : [];

      if (append) {
        setEntries((prev) => [...prev, ...pageEntries]);
      } else {
        setEntries(pageEntries);
      }

      setHasMore(Boolean(payload.pagination?.has_more));
      setNextCursor(payload.pagination?.next_cursor ?? null);
      setFiltersMeta(payload.filters_meta ?? DEFAULT_ACTIVITY_FILTERS_META);
    } catch (error) {
      console.error('[useActivityLog] Erro ao carregar atividades:', error);
      showError('Erro ao carregar atividades.');

      if (!append) {
        setEntries([]);
        setHasMore(false);
        setNextCursor(null);
      }
    } finally {
      if (append) {
        setLoadingMore(false);
      } else {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void (async () => { await fetchPage(effectiveFilters, null, false); })();
  }, [effectiveFilters, fetchPage]);

  const setFilters = useCallback(
    (next: ActivityFiltersState | ((prev: ActivityFiltersState) => ActivityFiltersState)) => {
      setFiltersState((prev) => (typeof next === 'function' ? next(prev) : next));
    },
    [],
  );

  const loadMore = useCallback(async () => {
    if (!hasMore || loading || loadingMore || !nextCursor) {
      return;
    }

    await fetchPage(effectiveFilters, nextCursor, true);
  }, [effectiveFilters, fetchPage, hasMore, loading, loadingMore, nextCursor]);

  const refresh = useCallback(async () => {
    await fetchPage(effectiveFilters, null, false);
  }, [effectiveFilters, fetchPage]);

  const clearFilters = useCallback(() => {
    setFiltersState(DEFAULT_ACTIVITY_FILTERS);
  }, []);

  return {
    entries,
    loading,
    loadingMore,
    hasMore,
    nextCursor,
    filtersMeta,
    filters,
    setFilters,
    loadMore,
    refresh,
    clearFilters,
  };
}
