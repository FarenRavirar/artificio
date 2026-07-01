import { Inbox } from 'lucide-react';
import type { ActivityEntry } from '../types';
import { ActivityItem } from './ActivityItem';

interface ActivityFeedProps {
  entries: ActivityEntry[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
}

export function ActivityFeed({
  entries,
  loading,
  loadingMore,
  hasMore,
  onLoadMore,
}: ActivityFeedProps) {
  if (loading && entries.length === 0) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={`activity-skeleton-${index}`}
            className="h-20 animate-pulse rounded-lg bg-white/5"
          />
        ))}
      </div>
    );
  }

  if (!loading && entries.length === 0) {
    return (
      <div className="rounded-lg border border-white/10 bg-[#0F1A2E]/40 p-8 text-center">
        <Inbox size={22} className="mx-auto mb-3 text-white/40" />
        <p className="text-sm text-white/60">Nenhuma atividade registrada para os filtros atuais.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {entries.map((entry) => (
          <ActivityItem key={entry.id} entry={entry} />
        ))}
      </ul>

      {hasMore && (
        <button
          id="activity-load-more"
          type="button"
          onClick={onLoadMore}
          disabled={loadingMore}
          className="w-full rounded-lg border border-white/10 bg-white/5 py-3 text-sm text-white/60 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
        >
          {loadingMore ? 'Carregando...' : 'Carregar mais'}
        </button>
      )}
    </div>
  );
}
