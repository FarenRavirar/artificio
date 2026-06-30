import { useQuery } from '@tanstack/react-query';
import { discordSyncApi } from '../../discord-sync/api/discordSyncApi';
import type { DiscordImportRun } from '../../discord-sync/types';
import { authGet } from '../../../services/apiClient';

export interface AdminDashboardMetrics {
  activeTables: number;
  draftTotals: {
    drafts: number;
    ready: number;
    needsReview: number;
    synced: number;
    rejected: number;
  };
  latestImportRun: DiscordImportRun | null;
}

const EMPTY_METRICS: AdminDashboardMetrics = {
  activeTables: 0,
  draftTotals: {
    drafts: 0,
    ready: 0,
    needsReview: 0,
    synced: 0,
    rejected: 0,
  },
  latestImportRun: null,
};

function normalizeTablesCount(payload: unknown): number {
  const rows = payload && typeof payload === 'object' ? (payload as Record<string, unknown>).data : [];
  if (!Array.isArray(rows)) return 0;
  return rows.filter((item) => {
    if (!item || typeof item !== 'object') return false;
    const status = (item as Record<string, unknown>).status;
    return status === undefined || status === 'active';
  }).length;
}

async function fetchActiveTablesCount(): Promise<number> {
  const response = await authGet('/api/v1/tables');
  if (!response.ok) return 0;
  return normalizeTablesCount(await response.json());
}

async function fetchDashboardMetrics(): Promise<AdminDashboardMetrics> {
  const [activeTables, integrationMetrics] = await Promise.all([
    fetchActiveTablesCount(),
    discordSyncApi.getIntegrationMetrics(),
  ]);

  return {
    activeTables,
    draftTotals: {
      drafts: integrationMetrics.totals.drafts,
      ready: integrationMetrics.totals.ready,
      needsReview: integrationMetrics.totals.needs_review,
      synced: integrationMetrics.totals.synced,
      rejected: integrationMetrics.totals.rejected,
    },
    latestImportRun: integrationMetrics.runs[0] ?? null,
  };
}

export function useAdminDashboardMetrics() {
  return useQuery({
    queryKey: ['admin', 'dashboard-metrics'],
    queryFn: fetchDashboardMetrics,
    staleTime: 30_000,
    placeholderData: EMPTY_METRICS,
  });
}
