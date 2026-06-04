import { Activity, RefreshCw } from 'lucide-react';
import { useActivityLog } from '../hooks/useActivityLog';
import { ActivityFeed } from './ActivityFeed';
import { ActivityFilters } from './ActivityFilters';

export function ActivityPanel() {
  const {
    entries,
    loading,
    loadingMore,
    hasMore,
    filtersMeta,
    filters,
    setFilters,
    loadMore,
    refresh,
    clearFilters,
  } = useActivityLog();

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold text-white">
            <Activity size={22} className="text-[var(--color-artificio-orange)]" />
            Atividade Administrativa
          </h2>
          <p className="text-sm text-white/60">Timeline consolidada de ações na plataforma.</p>
        </div>

        <button
          id="activity-refresh"
          type="button"
          onClick={() => {
            void refresh();
          }}
          className="inline-flex items-center gap-2 rounded border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/60 transition-colors hover:bg-white/10 hover:text-white"
        >
          <RefreshCw size={14} /> Atualizar
        </button>
      </header>

      <ActivityFilters
        filters={filters}
        filtersMeta={filtersMeta}
        onChange={setFilters}
        onClear={clearFilters}
      />

      <ActivityFeed
        entries={entries}
        loading={loading}
        loadingMore={loadingMore}
        hasMore={hasMore}
        onLoadMore={() => {
          void loadMore();
        }}
      />
    </div>
  );
}
