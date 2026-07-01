import { useQuery } from '@tanstack/react-query';
import { discordSyncApi } from '../../discord-sync/api/discordSyncApi';
import { authGet } from '../../../services/apiClient';

export interface AdminPendencias {
  sugestoes: number;
  systemSuggestions: number;
  scenarioSuggestions: number;
  hasDraftsToReview: boolean;
  total: number;
}

function rowsLength(payload: unknown): number {
  const rows = payload && typeof payload === 'object' ? (payload as Record<string, unknown>).data : [];
  return Array.isArray(rows) ? rows.length : 0;
}

async function fetchSystemSuggestionCount(): Promise<number> {
  const response = await authGet('/api/v1/admin/system-suggestions?status=pending');
  if (!response.ok) throw new Error('Erro ao buscar sugestões de sistema.');
  return rowsLength(await response.json());
}

async function fetchScenarioSuggestionCount(): Promise<number> {
  const response = await authGet('/api/v1/admin/scenario-suggestions?status=pending');
  if (!response.ok) throw new Error('Erro ao buscar sugestões de cenário.');
  return rowsLength(await response.json());
}

async function fetchAdminPendencias(): Promise<AdminPendencias> {
  const [systemSuggestions, scenarioSuggestions, drafts] = await Promise.all([
    fetchSystemSuggestionCount(),
    fetchScenarioSuggestionCount(),
    discordSyncApi.getDrafts({ origin: 'all', status: 'needs_review', limit: 1 }).catch(() => []),
  ]);

  const sugestoes = systemSuggestions + scenarioSuggestions;
  const hasDraftsToReview = Array.isArray(drafts) && drafts.length > 0;

  return {
    sugestoes,
    systemSuggestions,
    scenarioSuggestions,
    hasDraftsToReview,
    total: sugestoes + (hasDraftsToReview ? 1 : 0),
  };
}

export function useAdminPendencias() {
  return useQuery({
    queryKey: ['admin', 'pendencias'],
    queryFn: fetchAdminPendencias,
    staleTime: 30_000,
  });
}
