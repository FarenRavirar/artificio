import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../../contexts/useAuth';
import { authGet, authPatch, authPost } from '../../../services/apiClient';
import { SystemSuggestionResolutionDrawer } from '../../../components/SystemSuggestionResolutionDrawer';
import toast from 'react-hot-toast';

interface SystemSuggestion {
  kind: 'system';
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  parent_id: string | null;
  node_type: 'system' | 'edition' | 'variant' | 'subsystem';
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

interface ScenarioSuggestion {
  kind: 'scenario';
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

type CatalogSuggestion = SystemSuggestion | ScenarioSuggestion;

const isSuggestionStatus = (value: unknown): value is CatalogSuggestion['status'] =>
  value === 'pending' || value === 'approved' || value === 'rejected';

const readString = (value: unknown): string => (typeof value === 'string' ? value : '');
const readNullableString = (value: unknown): string | null => (typeof value === 'string' ? value : null);

const normalizeSystemSuggestions = (value: unknown): SystemSuggestion[] => {
  if (!Array.isArray(value)) return [];
  const suggestions: SystemSuggestion[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const status = row.status;
    const nodeType = row.node_type;
    if (!isSuggestionStatus(status)) continue;
    if (nodeType !== 'system' && nodeType !== 'edition' && nodeType !== 'variant' && nodeType !== 'subsystem') continue;
    suggestions.push({
      kind: 'system',
      id: readString(row.id),
      user_id: readString(row.user_id),
      name: readString(row.name),
      description: readNullableString(row.description),
      parent_id: readNullableString(row.parent_id),
      node_type: nodeType,
      status,
      rejection_reason: readNullableString(row.rejection_reason),
      created_at: readString(row.created_at),
      reviewed_at: readNullableString(row.reviewed_at),
      reviewed_by: readNullableString(row.reviewed_by),
    });
  }
  return suggestions.filter(s => s.id && s.name);
};

const normalizeScenarioSuggestions = (value: unknown): ScenarioSuggestion[] => {
  if (!Array.isArray(value)) return [];
  const suggestions: ScenarioSuggestion[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const status = row.status;
    if (!isSuggestionStatus(status)) continue;
    suggestions.push({
      kind: 'scenario',
      id: readString(row.id),
      user_id: readString(row.user_id),
      name: readString(row.name),
      description: readNullableString(row.description),
      status,
      rejection_reason: readNullableString(row.rejection_reason),
      created_at: readString(row.created_at),
      reviewed_at: readNullableString(row.reviewed_at),
      reviewed_by: readNullableString(row.reviewed_by),
    });
  }
  return suggestions.filter(s => s.id && s.name);
};

const getSuggestionEndpoint = (suggestion: CatalogSuggestion, action: 'approve' | 'reject') => {
  const resource = suggestion.kind === 'system' ? 'system-suggestions' : 'scenario-suggestions';
  return `/api/v1/admin/${resource}/${suggestion.id}/${action}`;
};

type FilterType = 'pending' | 'approved' | 'rejected' | 'all' | 'historico';

export function ComunidadeSection() {
  const { isAuthenticated } = useAuth();
  const [suggestions, setSuggestions] = useState<CatalogSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('pending');
  const [approvingSuggestionId, setApprovingSuggestionId] = useState<string | null>(null);
  const [rejectingSuggestionId, setRejectingSuggestionId] = useState<string | null>(null);
  const [resolvingSuggestion, setResolvingSuggestion] = useState<SystemSuggestion | null>(null);
  const [selectedSuggestionIds, setSelectedSuggestionIds] = useState<string[]>([]);
  const [bulkRejectingSuggestions, setBulkRejectingSuggestions] = useState(false);

  const fetchSuggestions = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const apiFilter = filter === 'historico' ? 'all' : filter;
      const query = apiFilter === 'all' ? '' : `?status=${apiFilter}`;
      const systemResponse = await authGet(`/api/v1/admin/system-suggestions${query}`);
      const scenarioResponse = await authGet(`/api/v1/admin/scenario-suggestions${query}`);

      const nextSuggestions: CatalogSuggestion[] = [];
      if (systemResponse.ok) {
        const data: unknown = await systemResponse.json();
        const rows = data && typeof data === 'object' ? (data as Record<string, unknown>).data : [];
        nextSuggestions.push(...normalizeSystemSuggestions(rows));
      }
      if (scenarioResponse.ok) {
        const data: unknown = await scenarioResponse.json();
        const rows = data && typeof data === 'object' ? (data as Record<string, unknown>).data : [];
        nextSuggestions.push(...normalizeScenarioSuggestions(rows));
      }
      nextSuggestions.sort((a, b) => b.created_at.localeCompare(a.created_at));
      setSuggestions(nextSuggestions);
      const validPendingIds = new Set(
        nextSuggestions.filter(s => s.status === 'pending').map(s => s.id),
      );
      setSelectedSuggestionIds(cur => cur.filter(id => validPendingIds.has(id)));
    } catch (error) {
      console.error('[ComunidadeSection] Erro ao buscar sugestões:', error);
    } finally {
      setLoading(false);
    }
  }, [filter, isAuthenticated]);

  useEffect(() => {
    let active = true;
    // Usar setTimeout para evitar setState síncrono no effect (react-hooks/set-state-in-effect)
    const timer = setTimeout(() => {
      if (!active) return;
      void fetchSuggestions();
    }, 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [fetchSuggestions]);

  const maybePublishPendingDrafts = async (pending: unknown) => {
    if (!Array.isArray(pending) || pending.length === 0) return;
    const drafts = pending as Array<{ id: string; title: string | null }>;
    const results = await Promise.allSettled(
      drafts.map(d => authPost(`/api/v1/admin/discord/drafts/${d.id}/sync`)),
    );
    const succeeded = results.filter(r => r.status === 'fulfilled' && (r.value as Response).ok).length;
    toast.success(`${succeeded}/${drafts.length} mesa(s) publicada(s)!`);
  };

  const handleResolved = (data: { system_name?: string; pending_drafts?: unknown }) => {
    setResolvingSuggestion(null);
    setSelectedSuggestionIds(cur =>
      resolvingSuggestion ? cur.filter(id => id !== resolvingSuggestion.id) : cur,
    );
    fetchSuggestions();
    void maybePublishPendingDrafts(data.pending_drafts ?? []);
  };

  const handleApprove = async (suggestion: CatalogSuggestion, editedData?: { name: string; description: string | null }) => {
    if (!isAuthenticated) return;
    setApprovingSuggestionId(suggestion.id);
    try {
      const response = await authPatch(getSuggestionEndpoint(suggestion, 'approve'), editedData || {});
      if (response.ok) {
        const result = await response.json();
        const data = result.data ?? {};
        const label = data.system_name ? `"${data.system_name}"` : suggestion.kind === 'system' ? 'Sistema' : 'Cenário';
        toast.success(`${label} aprovado e adicionado ao catálogo.`);
        fetchSuggestions();
        if (suggestion.kind === 'system') {
          await maybePublishPendingDrafts(data.pending_drafts ?? []);
        }
      } else {
        const errData = await response.json();
        toast.error(`Erro: ${errData.error}`);
      }
    } catch (error) {
      console.error('[ComunidadeSection] Erro ao aprovar:', error);
      toast.error('Erro ao aprovar sistema');
    } finally {
      setApprovingSuggestionId(null);
    }
  };

  const handleReject = async (suggestion: CatalogSuggestion) => {
    if (!isAuthenticated) return;
    setRejectingSuggestionId(suggestion.id);
    try {
      const response = await authPatch(getSuggestionEndpoint(suggestion, 'reject'), {});
      if (response.ok) {
        toast.success(`${suggestion.kind === 'system' ? 'Sistema' : 'Cenário'} rejeitado!`);
        setSelectedSuggestionIds(cur => cur.filter(id => id !== suggestion.id));
        fetchSuggestions();
      } else {
        const data = await response.json();
        toast.error(`Erro: ${data.error}`);
      }
    } catch (error) {
      console.error('[ComunidadeSection] Erro ao rejeitar:', error);
      toast.error('Erro ao rejeitar sistema');
    } finally {
      setRejectingSuggestionId(null);
    }
  };

  const toggleSuggestionSelection = (id: string) => {
    setSelectedSuggestionIds(cur =>
      cur.includes(id) ? cur.filter(sid => sid !== id) : [...cur, id],
    );
  };

  const handleSelectAllPending = () => {
    const pendingIds = suggestions.filter(s => s.status === 'pending').map(s => s.id);
    const allSelected = pendingIds.length > 0 && pendingIds.every(id => selectedSuggestionIds.includes(id));
    setSelectedSuggestionIds(allSelected ? [] : pendingIds);
  };

  const handleRejectSelected = async () => {
    if (!isAuthenticated || selectedSuggestionIds.length === 0) return;
    setBulkRejectingSuggestions(true);
    try {
      const results = await Promise.allSettled(
        suggestions
          .filter(s => selectedSuggestionIds.includes(s.id))
          .map(s => authPatch(getSuggestionEndpoint(s, 'reject'), {})),
      );
      const succeeded = results.filter(r => r.status === 'fulfilled' && r.value.ok).length;
      const failed = selectedSuggestionIds.length - succeeded;
      if (succeeded > 0) toast.success(`${succeeded} sugestão(ões) rejeitada(s).`);
      if (failed > 0) toast.error(`${failed} sugestão(ões) não foram rejeitadas.`);
      setSelectedSuggestionIds([]);
      fetchSuggestions();
    } catch (error) {
      console.error('[ComunidadeSection] Erro ao rejeitar lote:', error);
      toast.error('Erro ao rejeitar sugestões selecionadas');
    } finally {
      setBulkRejectingSuggestions(false);
    }
  };

  const pendingSuggestionIds = suggestions.filter(s => s.status === 'pending').map(s => s.id);
  const allPendingSelected = pendingSuggestionIds.length > 0
    && pendingSuggestionIds.every(id => selectedSuggestionIds.includes(id));

  // Client-side filter for "histórico" (já decididas)
  const displayedSuggestions = filter === 'historico'
    ? suggestions.filter(s => s.status !== 'pending')
    : suggestions;

  const filterBtnClass = (f: FilterType, color: string) =>
    `px-4 py-2 rounded-lg transition-all ${
      filter === f
        ? `${color} text-white`
        : 'bg-white/5 text-white/60 hover:bg-white/10'
    }`;

  return (
    <div>
      {/* Filtros */}
      <div className="flex gap-3 mb-6 flex-wrap items-center">
        <button onClick={() => setFilter('pending')} className={filterBtnClass('pending', 'bg-yellow-600')} aria-pressed={filter === 'pending'}>
          Pendentes
        </button>
        <button onClick={() => setFilter('approved')} className={filterBtnClass('approved', 'bg-green-600')} aria-pressed={filter === 'approved'}>
          Aprovadas
        </button>
        <button onClick={() => setFilter('rejected')} className={filterBtnClass('rejected', 'bg-red-600')} aria-pressed={filter === 'rejected'}>
          Rejeitadas
        </button>
        <button onClick={() => setFilter('historico')} className={filterBtnClass('historico', 'bg-purple-600')} aria-pressed={filter === 'historico'}>
          Histórico de decisões
        </button>
        <button onClick={() => setFilter('all')} className={filterBtnClass('all', 'bg-blue-600')} aria-pressed={filter === 'all'}>
          Todas
        </button>
        {pendingSuggestionIds.length > 0 && (
          <div className="ml-auto flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-white/80 cursor-pointer">
              <input
                type="checkbox"
                checked={allPendingSelected}
                onChange={handleSelectAllPending}
                className="h-4 w-4"
              />
              Selecionar todas pendentes
            </label>
            <button
              onClick={handleRejectSelected}
              disabled={selectedSuggestionIds.length === 0 || bulkRejectingSuggestions}
              className="px-4 py-2 rounded-lg bg-red-600 text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {bulkRejectingSuggestions
                ? 'Rejeitando...'
                : `Rejeitar selecionadas (${selectedSuggestionIds.length})`}
            </button>
          </div>
        )}
      </div>

      {/* Lista de sugestões */}
      {loading ? (
        <div className="text-white/60 text-center py-8">Carregando...</div>
      ) : (
        <div className="space-y-3">
          {displayedSuggestions.map(suggestion => (
            <div key={suggestion.id} className="bg-white/5 border border-white/10 rounded-lg p-4">
              <div className="flex justify-between items-start gap-4">
                <div className="flex min-w-0 gap-3">
                  {suggestion.status === 'pending' && (
                    <input
                      type="checkbox"
                      checked={selectedSuggestionIds.includes(suggestion.id)}
                      onChange={() => toggleSuggestionSelection(suggestion.id)}
                      className="mt-1 h-4 w-4 shrink-0"
                      aria-label={`Selecionar sugestão ${suggestion.name}`}
                    />
                  )}
                  <div className="min-w-0">
                    <h3 className="text-white font-semibold">{suggestion.name}</h3>
                    {suggestion.description && (
                      <p className="text-white/60 text-sm mt-1">{suggestion.description}</p>
                    )}
                    <p className="text-white/40 text-xs mt-2">
                      Tipo: {suggestion.kind === 'system' ? suggestion.node_type : 'cenário'} | Status: {suggestion.status}
                      {suggestion.reviewed_at && <> | Revisado: {new Date(suggestion.reviewed_at).toLocaleDateString('pt-BR')}{suggestion.reviewed_by ? ` por ${suggestion.reviewed_by}` : ''}</>}
                      {suggestion.rejection_reason && <> | Motivo: {suggestion.rejection_reason}</>}
                    </p>
                  </div>
                </div>
                {suggestion.status === 'pending' && (
                  <div className="flex gap-2 shrink-0">
                    {suggestion.kind === 'system' ? (
                      <button
                        onClick={() => setResolvingSuggestion(suggestion)}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors text-white text-sm"
                      >
                        Resolver
                      </button>
                    ) : (
                      <button
                        onClick={() => handleApprove(suggestion)}
                        disabled={approvingSuggestionId === suggestion.id}
                        className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded-lg transition-colors text-white text-sm disabled:opacity-50"
                      >
                        {approvingSuggestionId === suggestion.id ? 'Aprovando...' : 'Aprovar'}
                      </button>
                    )}
                    <button
                      onClick={() => handleReject(suggestion)}
                      disabled={rejectingSuggestionId === suggestion.id}
                      className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded-lg transition-colors text-white text-sm disabled:opacity-50"
                    >
                      {rejectingSuggestionId === suggestion.id ? 'Rejeitando...' : 'Rejeitar'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Resolution drawer */}
      {resolvingSuggestion && (
        <SystemSuggestionResolutionDrawer
          suggestion={{
            id: resolvingSuggestion.id,
            name: resolvingSuggestion.name,
            description: resolvingSuggestion.description,
            node_type: resolvingSuggestion.node_type,
            parent_id: resolvingSuggestion.parent_id,
          }}
          onClose={() => setResolvingSuggestion(null)}
          onResolved={handleResolved}
        />
      )}
    </div>
  );
}
