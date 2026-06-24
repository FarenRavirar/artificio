import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/useAuth';
import { useNavigate } from 'react-router-dom';
import { SystemsAdminView } from './SystemsAdminView';
import { ScenariosAdminView } from './ScenariosAdminView';
import { PlatformsPage } from '../modules/admin/platforms/PlatformsPage';
import { ActivityPanel } from '../modules/admin/activity/components/ActivityPanel';
import { ScenarioEditModal } from '../components/ScenarioEditModal';
import toast from 'react-hot-toast';
import { HydrationAdminPanel } from '../modules/admin/hydration/HydrationAdminPanel';
import { InlineDeleteConfirmation } from '../components/InlineDeleteConfirmation';
import { DiscordSyncPanel } from '../features/discord-sync/components/DiscordSyncPanel';
import { SystemSuggestionResolutionDrawer } from '../components/SystemSuggestionResolutionDrawer';
import { DevFeedbackPanel } from '../modules/admin/dev-feedback/DevFeedbackPanel';
import { InboxPanel } from '../features/inbox/components/InboxPanel';
import { authGet, authPost, authPatch, authPut, authDelete } from '../services/apiClient';

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

interface ScenarioEditTarget {
  id: string;
  name: string;
  name_pt?: string | null;
  slug: string;
  subgenres: string[];
}

interface AdminTableRow {
  id: string;
  title: string;
  status: string;
  created_at: string;
  is_covil?: boolean;
}

const isSuggestionStatus = (value: unknown): value is CatalogSuggestion['status'] => {
  return value === 'pending' || value === 'approved' || value === 'rejected';
};

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

  return suggestions.filter((suggestion) => suggestion.id && suggestion.name);
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

  return suggestions.filter((suggestion) => suggestion.id && suggestion.name);
};

const getSuggestionEndpoint = (suggestion: CatalogSuggestion, action: 'approve' | 'reject') => {
  const resource = suggestion.kind === 'system' ? 'system-suggestions' : 'scenario-suggestions';
  return `/api/v1/admin/${resource}/${suggestion.id}/${action}`;
};

export const GestaoPage = () => {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [suggestions, setSuggestions] = useState<CatalogSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [activeTab, setActiveTab] = useState<'systems' | 'crud' | 'activity' | 'hydration' | 'discord' | 'inbox' | 'dev'>('crud');
  const [crudSubTab, setCrudSubTab] = useState<'systems' | 'platforms' | 'scenarios' | 'tables'>('systems');
  const [scenarioEditModal, setScenarioEditModal] = useState<ScenarioEditTarget | null>(null);
  const [allTables, setAllTables] = useState<AdminTableRow[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConfirmTableId, setDeleteConfirmTableId] = useState<string | null>(null);
  const [deletingTableId, setDeletingTableId] = useState<string | null>(null);

  const [approvingSuggestionId, setApprovingSuggestionId] = useState<string | null>(null);
  const [rejectingSuggestionId, setRejectingSuggestionId] = useState<string | null>(null);
  const [resolvingSuggestion, setResolvingSuggestion] = useState<SystemSuggestion | null>(null);
  const [selectedSuggestionIds, setSelectedSuggestionIds] = useState<string[]>([]);
  const [bulkRejectingSuggestions, setBulkRejectingSuggestions] = useState(false);

  const fetchSuggestions = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const query = filter === 'all' ? '' : `?status=${filter}`;

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
        nextSuggestions
          .filter((suggestion) => suggestion.status === 'pending')
          .map((suggestion) => suggestion.id),
      );
      setSelectedSuggestionIds((current) => current.filter((id) => validPendingIds.has(id)));
    } catch (error) {
      console.error('[GestaoPage] Erro ao buscar sugestões:', error);
    } finally {
      setLoading(false);
    }
  }, [filter, isAuthenticated]);


  const fetchAllTables = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const response = await authGet('/api/v1/tables');
      if (response.ok) {
        const data = await response.json();
        setAllTables(data.data || []);
      }
    } catch (error) {
      console.error('[GestaoPage] Erro ao buscar mesas:', error);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/');
      return;
    }
    // Fetches deferidos p/ fora do corpo síncrono do effect.
    void (async () => {
      if (activeTab === 'systems') {
        await fetchSuggestions();
      } else if (activeTab === 'crud' && crudSubTab === 'tables') {
        await fetchAllTables();
      }
    })();
  }, [user, navigate, activeTab, crudSubTab, fetchSuggestions, fetchAllTables]);

  const maybePublishPendingDrafts = async (pending: Array<{ id: string; title: string | null }>) => {
    if (!pending || pending.length === 0) return;
    const list = pending.map((d) => `• ${d.title ?? 'Mesa sem título'}`).join('\n');
    const publish = window.confirm(
      `${pending.length} mesa(s) pronta(s) para publicar:\n${list}\n\nPublicar agora?`,
    );
    if (!publish) return;
    const results = await Promise.allSettled(
      pending.map((d) =>
        authPost(`/api/v1/admin/discord-sync/drafts/${d.id}/sync`),
      ),
    );
    const succeeded = results.filter((r) => r.status === 'fulfilled' && (r.value as Response).ok).length;
    toast.success(`${succeeded}/${pending.length} mesa(s) publicada(s)!`);
  };

  const handleResolved = (data: { system_name?: string; pending_drafts?: Array<{ id: string; title: string | null }> }) => {
    setResolvingSuggestion(null);
    setSelectedSuggestionIds((current) =>
      resolvingSuggestion ? current.filter((selectedId) => selectedId !== resolvingSuggestion.id) : current,
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
      console.error('[GestaoPage] Erro ao aprovar:', error);
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
        setSelectedSuggestionIds((current) => current.filter((selectedId) => selectedId !== suggestion.id));
        fetchSuggestions();
      } else {
        const data = await response.json();
        toast.error(`Erro: ${data.error}`);
      }
    } catch (error) {
      console.error('[GestaoPage] Erro ao rejeitar:', error);
      toast.error('Erro ao rejeitar sistema');
    } finally {
      setRejectingSuggestionId(null);
    }
  };

  const toggleSuggestionSelection = (id: string) => {
    setSelectedSuggestionIds((current) =>
      current.includes(id)
        ? current.filter((selectedId) => selectedId !== id)
        : [...current, id],
    );
  };

  const handleSelectAllPendingSuggestions = () => {
    const pendingIds = suggestions
      .filter((suggestion) => suggestion.status === 'pending')
      .map((suggestion) => suggestion.id);
    const allSelected = pendingIds.length > 0 && pendingIds.every((id) => selectedSuggestionIds.includes(id));
    setSelectedSuggestionIds(allSelected ? [] : pendingIds);
  };

  const handleRejectSelectedSuggestions = async () => {
    if (!isAuthenticated || selectedSuggestionIds.length === 0) return;
    setBulkRejectingSuggestions(true);

    try {
      const results = await Promise.allSettled(
        suggestions
          .filter((suggestion) => selectedSuggestionIds.includes(suggestion.id))
          .map((suggestion) =>
          authPatch(getSuggestionEndpoint(suggestion, 'reject'), {}),
        ),
      );
      const succeeded = results.filter((result) => result.status === 'fulfilled' && result.value.ok).length;
      const failed = selectedSuggestionIds.length - succeeded;
      if (succeeded > 0) toast.success(`${succeeded} sugestão(ões) rejeitada(s).`);
      if (failed > 0) toast.error(`${failed} sugestão(ões) não foram rejeitadas.`);
      setSelectedSuggestionIds([]);
      fetchSuggestions();
    } catch (error) {
      console.error('[GestaoPage] Erro ao rejeitar sugestões em lote:', error);
      toast.error('Erro ao rejeitar sugestões selecionadas');
    } finally {
      setBulkRejectingSuggestions(false);
    }
  };

  const handleDeleteTable = async (id: string) => {
    if (!isAuthenticated) return;

    setDeletingTableId(id);
    try {
      // CORREÇÃO DT-013: Rota correta é /api/v1/admin/tables/:id
      const response = await authDelete(`/api/v1/admin/tables/${id}`);

      if (response.ok) {
        toast.success('Mesa deletada!');
        setDeleteConfirmTableId(null);
        fetchAllTables();
      } else {
        // CORREÇÃO: Tratamento robusto de erro (pode retornar HTML em vez de JSON)
        let errorMessage = 'Erro ao deletar mesa';
        
        try {
          const contentType = response.headers.get('content-type');
          
          if (contentType?.includes('application/json')) {
            const data = await response.json();
            errorMessage = data.error || errorMessage;
          } else {
            const text = await response.text();
            errorMessage = text.slice(0, 200) || errorMessage;
          }
        } catch {
          // Se falhar ao parsear, usar mensagem padrão
        }
        
        toast.error(errorMessage);
      }
    } catch (error) {
      console.error('[GestaoPage] Erro ao deletar mesa:', error);
      toast.error('Erro ao deletar mesa');
    } finally {
      setDeletingTableId(null);
    }
  };

  const handleToggleTableStatus = async (id: string, currentStatus: string, title: string) => {
    if (!isAuthenticated) return;
    const newStatus = currentStatus === 'active' ? 'cancelled' : 'active';
    const action = newStatus === 'active' ? 'ativar' : 'cancelar';
    
    if (!confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} mesa "${title}"?`)) return;

    try {
      // CORREÇÃO DT-013: Rota correta é /api/v1/admin/tables/:id
      const response = await authPut(`/api/v1/admin/tables/${id}`, { status: newStatus });

      if (response.ok) {
        toast.success(`Mesa ${action === 'ativar' ? 'ativada' : 'desativada'}!`);
        fetchAllTables();
      } else {
        // CORREÇÃO: Tratamento robusto de erro (pode retornar HTML em vez de JSON)
        let errorMessage = `Erro ao ${action} mesa`;
        
        try {
          const contentType = response.headers.get('content-type');
          
          if (contentType?.includes('application/json')) {
            const data = await response.json();
            errorMessage = data.error || errorMessage;
          } else {
            const text = await response.text();
            errorMessage = text.slice(0, 200) || errorMessage;
          }
        } catch {
          // Se falhar ao parsear, usar mensagem padrão
        }
        
        toast.error(errorMessage);
      }
    } catch (error) {
      console.error('[GestaoPage] Erro ao alterar status da mesa:', error);
      toast.error(`Erro ao ${action} mesa`);
    }
  };

  if (!user || user.role !== 'admin') {
    return null;
  }

  const filteredTables = allTables.filter(t =>
    t.title.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const pendingSuggestionIds = suggestions
    .filter((suggestion) => suggestion.status === 'pending')
    .map((suggestion) => suggestion.id);
  const allPendingSuggestionsSelected = pendingSuggestionIds.length > 0
    && pendingSuggestionIds.every((id) => selectedSuggestionIds.includes(id));

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0F1A2E] via-[#1B2A4A] to-[#0F1A2E] py-8">
      <div className="container mx-auto px-6 max-w-6xl">
        <h1 className="text-3xl font-bold text-white mb-2">Gestão Administrativa</h1>
        <p className="text-white/60 mb-8">Aprove ou rejeite conteúdo enviado pela comunidade</p>

        {/* Abas de navegação */}
        <div className="flex gap-3 mb-6 border-b border-white/10">
          <button
            onClick={() => setActiveTab('crud')}
            className={`px-6 py-3 font-semibold transition-all ${
              activeTab === 'crud'
                ? 'text-white border-b-2 border-blue-500'
                : 'text-white/60 hover:text-white/80'
            }`}
          >
            Gerenciar Conteúdo
          </button>
          <button
            onClick={() => setActiveTab('systems')}
            className={`px-6 py-3 font-semibold transition-all ${
              activeTab === 'systems'
                ? 'text-white border-b-2 border-blue-500'
                : 'text-white/60 hover:text-white/80'
            }`}
          >
            Sugestões de Sistemas
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            className={`px-6 py-3 font-semibold transition-all ${
              activeTab === 'activity'
                ? 'text-white border-b-2 border-blue-500'
                : 'text-white/60 hover:text-white/80'
            }`}
          >
            Atividades
          </button>
          <button
            onClick={() => setActiveTab('hydration')}
            className={`px-6 py-3 font-semibold transition-all ${
              activeTab === 'hydration'
                ? 'text-white border-b-2 border-blue-500'
                : 'text-white/60 hover:text-white/80'
            }`}
          >
            Hidratação de Dados
          </button>
          <button
            onClick={() => setActiveTab('discord')}
            className={`px-6 py-3 font-semibold transition-all ${
              activeTab === 'discord'
                ? 'text-white border-b-2 border-blue-500'
                : 'text-white/60 hover:text-white/80'
            }`}
          >
            Discord Sync
          </button>
          <button
            onClick={() => setActiveTab('inbox')}
            className={`px-6 py-3 font-semibold transition-all ${
              activeTab === 'inbox'
                ? 'text-white border-b-2 border-blue-500'
                : 'text-white/60 hover:text-white/80'
            }`}
          >
            Inbox
          </button>
          <button
            onClick={() => setActiveTab('dev')}
            className={`px-6 py-3 font-semibold transition-all ${
              activeTab === 'dev'
                ? 'text-white border-b-2 border-blue-500'
                : 'text-white/60 hover:text-white/80'
            }`}
          >
            Desenvolvimento
          </button>
        </div>

        {/* Conteúdo das abas */}
        {activeTab === 'crud' && (
          <div>
            <div className="flex flex-wrap items-center gap-3 mb-6">
              <button
                onClick={() => setCrudSubTab('systems')}
                className={`px-4 py-2 rounded-lg transition-all ${
                  crudSubTab === 'systems'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white/5 text-white/60 hover:bg-white/10'
                }`}
              >
                Sistemas
              </button>
              <button
                onClick={() => setCrudSubTab('platforms')}
                className={`px-4 py-2 rounded-lg transition-all ${
                  crudSubTab === 'platforms'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white/5 text-white/60 hover:bg-white/10'
                }`}
              >
                Plataformas
              </button>
              <button
                onClick={() => setCrudSubTab('scenarios')}
                className={`px-4 py-2 rounded-lg transition-all ${
                  crudSubTab === 'scenarios'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white/5 text-white/60 hover:bg-white/10'
                }`}
              >
                Cenários
              </button>
              <button
                onClick={() => setCrudSubTab('tables')}
                className={`px-4 py-2 rounded-lg transition-all ${
                  crudSubTab === 'tables'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white/5 text-white/60 hover:bg-white/10'
                }`}
              >
                Mesas
              </button>
            </div>

            {crudSubTab === 'systems' && (
              <SystemsAdminView />
            )}
            {crudSubTab === 'platforms' && <PlatformsPage />}

            {crudSubTab === 'scenarios' && (
              <ScenariosAdminView />
            )}

            {crudSubTab === 'tables' && (
              <div>
                <div className="mb-4">
                  <input
                    type="text"
                    placeholder="Buscar mesas..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40"
                  />
                </div>
                {loading ? (
                  <div className="text-white/60 text-center py-8">Carregando...</div>
                ) : (
                  <div className="space-y-3">
                    {filteredTables.map((table) => (
                      <div key={table.id} className="bg-white/5 border border-white/10 rounded-lg p-4">
                        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div>
                          <h3 className="text-white font-semibold">{table.title}</h3>
                          <p className="text-white/60 text-sm mt-1">
                            Status: {table.status} | Criada em: {new Date(table.created_at).toLocaleDateString('pt-BR')}
                          </p>
                          {/* REQ-05: Checkbox Covil do Lich (admin only) */}
                          <label className="flex items-center gap-2 mt-2 text-sm text-white/80 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={table.is_covil || false}
                              onChange={async (e) => {
                                const newValue = e.target.checked;
                                try {
                                  const res = await authPut(`/api/v1/admin/tables/${table.id}`, { is_covil: newValue });
                                  if (!res.ok) throw new Error('Erro ao atualizar');
                                  toast.success(newValue ? 'Mesa marcada como Covil do Lich' : 'Marca Covil removida');
                                  fetchAllTables();
                                } catch (error) {
                                  toast.error('Erro ao atualizar mesa');
                                  console.error(error);
                                }
                              }}
                              className="w-4 h-4"
                            />
                            🏰 Covil do Lich
                          </label>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleToggleTableStatus(table.id, table.status, table.title)}
                            className="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 rounded-lg transition-colors text-white text-sm"
                          >
                            {table.status === 'active' ? 'Cancelar' : 'Ativar'}
                          </button>
                          <InlineDeleteConfirmation
                            title={table.title}
                            isOpen={deleteConfirmTableId === table.id}
                            onOpen={() => setDeleteConfirmTableId(table.id)}
                            onCancel={() => setDeleteConfirmTableId(null)}
                            onConfirm={() => handleDeleteTable(table.id)}
                            isProcessing={deletingTableId === table.id}
                            triggerLabel=""
                            className="min-w-10"
                            compact
                          />
                        </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'activity' && (
          <ActivityPanel />
        )}

        {activeTab === 'hydration' && (
          <HydrationAdminPanel />
        )}

        {activeTab === 'discord' && (
          <DiscordSyncPanel />
        )}

        {activeTab === 'inbox' && (
          <InboxPanel />
        )}

        {activeTab === 'dev' && (
          <DevFeedbackPanel />
        )}

        {activeTab === 'systems' && (
          <div>
            <div className="flex gap-3 mb-6">
              <button
                onClick={() => setFilter('pending')}
                className={`px-4 py-2 rounded-lg transition-all ${
                  filter === 'pending'
                    ? 'bg-yellow-600 text-white'
                    : 'bg-white/5 text-white/60 hover:bg-white/10'
                }`}
              >
                Pendentes
              </button>
              <button
                onClick={() => setFilter('approved')}
                className={`px-4 py-2 rounded-lg transition-all ${
                  filter === 'approved'
                    ? 'bg-green-600 text-white'
                    : 'bg-white/5 text-white/60 hover:bg-white/10'
                }`}
              >
                Aprovadas
              </button>
              <button
                onClick={() => setFilter('rejected')}
                className={`px-4 py-2 rounded-lg transition-all ${
                  filter === 'rejected'
                    ? 'bg-red-600 text-white'
                    : 'bg-white/5 text-white/60 hover:bg-white/10'
                }`}
              >
                Rejeitadas
              </button>
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 rounded-lg transition-all ${
                  filter === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white/5 text-white/60 hover:bg-white/10'
                }`}
              >
                Todas
              </button>
              {pendingSuggestionIds.length > 0 && (
                <div className="ml-auto flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 text-sm text-white/80">
                    <input
                      type="checkbox"
                      checked={allPendingSuggestionsSelected}
                      onChange={handleSelectAllPendingSuggestions}
                      className="h-4 w-4"
                    />
                    Selecionar todas pendentes
                  </label>
                  <button
                    onClick={handleRejectSelectedSuggestions}
                    disabled={selectedSuggestionIds.length === 0 || bulkRejectingSuggestions}
                    className="px-4 py-2 rounded-lg bg-red-600 text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {bulkRejectingSuggestions ? 'Descartando...' : `Descartar selecionadas (${selectedSuggestionIds.length})`}
                  </button>
                </div>
              )}
            </div>

            {loading ? (
              <div className="text-white/60 text-center py-8">Carregando...</div>
            ) : (
              <div className="space-y-3">
                {suggestions.map((suggestion) => (
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
                          </p>
                        </div>
                      </div>
                      {suggestion.status === 'pending' && (
                        <div className="flex gap-2">
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
          </div>
        )}
      </div>

      {scenarioEditModal && (
        <ScenarioEditModal
          scenario={scenarioEditModal}
          onClose={() => setScenarioEditModal(null)}
          onSuccess={() => {
            setScenarioEditModal(null);
          }}
        />
      )}

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
};
