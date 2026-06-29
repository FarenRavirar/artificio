import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import type { DiscordDraft, DiscordImportDraftStatus, DraftApiOperations } from '../types';
import { discordSyncApi } from '../api/discordSyncApi';
import { DiscordDraftPreview } from './DiscordDraftPreview';
import { isRecord } from '../draftFormUtils';

// REV-038: alias p/ a união repetida do filtro de origem.
type OriginFilter = 'discord' | 'inbox' | 'all';

interface Props {
  readonly api?: DraftApiOperations;
  /** API alternativa para drafts de origem Inbox (sync/reparse/get). Se omitida, usa a api default (discordSyncApi). */
  readonly inboxApi?: DraftApiOperations;
  readonly listDrafts?: (params?: { status?: DiscordImportDraftStatus; limit?: number; offset?: number; origin?: OriginFilter }) => Promise<DiscordDraft[]>;
  readonly syncReadyAction?: () => Promise<{ synced: number; failed: number; errors: string[] }>;
  readonly showSyncReady?: boolean;
  /** Callback antes de sincronizar draft (ex.: registerCorrection do inbox). Retorna resultado p/ toast. */
  readonly onBeforeSync?: (draft: DiscordDraft) => Promise<{ tableId: string; created: boolean } | null>;
  /** Ação de rejeição em lote (endpoint unificado). Injetável p/ mock/cliente custom; default = discordSyncApi. */
  readonly updateDraftsBatch?: (ids: string[], status: 'draft' | 'needs_review' | 'rejected') => Promise<{ updated: number }>;
}

const DRAFT_STATUS_LABELS: Record<DiscordImportDraftStatus, string> = {
  draft: 'Rascunho',
  ready: 'Pronto',
  needs_review: 'Revisar',
  synced: 'Sincronizado',
  rejected: 'Rejeitado',
};

// WS2: origem do draft (Discord vs Inbox)
type DraftOrigin = 'discord' | 'inbox';
function draftOrigin(draft: DiscordDraft): DraftOrigin {
  return draft.discord_message_id ? 'discord' : 'inbox';
}
const ORIGIN_LABELS: Record<DraftOrigin, string> = { discord: 'Discord', inbox: 'Inbox' };
const ORIGIN_COLORS: Record<DraftOrigin, string> = { discord: 'bg-blue-700/30 text-blue-300', inbox: 'bg-purple-700/30 text-purple-300' };

// T-G1: cor por tier de confiança (thresholds sincronizados com classifyConfidence em parseDiscordAnnouncement.ts)
function confidenceColor(score: number): string {
  if (score >= 0.85) return 'text-green-400';
  if (score >= 0.65) return 'text-lime-400';
  if (score >= 0.4) return 'text-yellow-400';
  return 'text-red-400';
}

const DRAFT_STATUS_COLORS: Record<DiscordImportDraftStatus, string> = {
  draft: 'bg-white/10 text-white/50',
  ready: 'bg-green-700/40 text-green-300',
  needs_review: 'bg-orange-700/40 text-orange-300',
  synced: 'bg-blue-700/40 text-blue-300',
  rejected: 'bg-red-700/40 text-red-300',
};

function readDraftTable(draft: DiscordDraft): Record<string, unknown> {
  const normalizedTable = isRecord(draft.normalized_payload?.table) ? draft.normalized_payload.table : null;
  if (normalizedTable) return normalizedTable;
  return isRecord(draft.parsed_payload?.table) ? draft.parsed_payload.table : {};
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

export function DiscordDraftReviewTable({ api, inboxApi, listDrafts: listDraftsProp, syncReadyAction, showSyncReady = true, onBeforeSync, updateDraftsBatch }: Props) {
  const draftApi = api ?? discordSyncApi;
  const batchReject = updateDraftsBatch ?? discordSyncApi.updateDraftsBatch;
  // Para drafts de Inbox, usa inboxApi se fornecida; senão fallback para draftApi (compat retroativa).
  const resolveApi = (draft: DiscordDraft): DraftApiOperations =>
    !draft.discord_message_id && inboxApi ? inboxApi : draftApi;
  const [drafts, setDrafts] = useState<DiscordDraft[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<DiscordImportDraftStatus | ''>('');
  const [originFilter, setOriginFilter] = useState<OriginFilter>('all');
  const [selectedDraft, setSelectedDraft] = useState<DiscordDraft | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);
  // Multi-seleção p/ ação em lote (rejeitar).
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [rejectingAll, setRejectingAll] = useState(false);

  const loadDrafts = useCallback(async () => {
    setLoading(true);
    setSelectedIds(new Set());
    try {
      const fetchFn = listDraftsProp ?? ((params) => discordSyncApi.getDrafts(params));
      const data = await fetchFn({
        status: statusFilter || undefined,
        limit: 100,
        origin: originFilter,
      });
      setDrafts(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar drafts.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, originFilter, listDraftsProp]);

  useEffect(() => {
    void (async () => { await loadDrafts(); })();
  }, [loadDrafts]);

  const handleSyncReady = async () => {
    if (!confirm('Sincronizar todos os drafts com status "pronto" como mesas reais?')) return;
    setSyncingAll(true);
    try {
      // Se houver onBeforeSync, aplica correction-tracking draft a draft antes do sync
      if (onBeforeSync) {
        const readyDrafts = drafts.filter(d => d.status === 'ready');
        let synced = 0;
        let failed = 0;
        const errors: string[] = [];
        for (const draft of readyDrafts) {
          try {
            await onBeforeSync(draft);
            await resolveApi(draft).syncDraft(draft.id);
            synced++;
          } catch (err) {
            failed++;
            errors.push(err instanceof Error ? err.message : String(err));
          }
        }
        toast.success(`${synced} sincronizadas, ${failed} falhas.`);
        if (errors.length > 0) {
          console.warn('[DiscordDraftReviewTable] erros de sync em lote:', errors);
        }
      } else {
        const action = syncReadyAction ?? discordSyncApi.syncReady;
        const result = await action();
        toast.success(`${result.synced} sincronizadas, ${result.failed} falhas.`);
        if (result.errors.length > 0) {
          console.warn('[DiscordDraftReviewTable] erros de sync:', result.errors);
        }
      }
      loadDrafts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao sincronizar em lote.');
    } finally {
      setSyncingAll(false);
    }
  };

  const toggleSelected = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Rejeitáveis = drafts ainda não sincronizados/rejeitados (rejeitar synced não faz sentido).
  const rejectableDrafts = drafts.filter(d => d.status !== 'synced' && d.status !== 'rejected');
  // Seleção efetiva = só ids ainda visíveis/rejeitáveis (um draft pode ter saído da fila pelo preview).
  const selectedRejectable = rejectableDrafts.filter(d => selectedIds.has(d.id));
  const allSelected = rejectableDrafts.length > 0 && selectedRejectable.length === rejectableDrafts.length;

  const toggleSelectAll = () => {
    setSelectedIds(prev => {
      if (rejectableDrafts.every(d => prev.has(d.id)) && rejectableDrafts.length > 0) {
        return new Set();
      }
      return new Set(rejectableDrafts.map(d => d.id));
    });
  };

  const rejectDraftIds = useCallback(async (ids: string[], confirmMsg: string) => {
    if (ids.length === 0) return;
    if (!confirm(confirmMsg)) return;
    setRejectingAll(true);
    try {
      // Tabela unificada (Discord+Inbox) → 1 chamada batch cobre as duas origens.
      const result = await batchReject(ids, 'rejected');
      toast.success(`${result.updated} rejeitado(s).`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao rejeitar em lote.');
    } finally {
      setRejectingAll(false);
      loadDrafts();
    }
  }, [loadDrafts, batchReject]);

  const handleRejectAll = () =>
    rejectDraftIds(
      rejectableDrafts.map(d => d.id),
      `Limpar todos os ${rejectableDrafts.length} rascunho(s)? Eles serão rejeitados.`,
    );

  const handleDraftUpdate = (updated: DiscordDraft) => {
    setDrafts(prev => prev.map(d => (d.id === updated.id ? updated : d)));
    setSelectedDraft(updated);
  };

  // T-F1-06: o backend agora garante (CHECK CONSTRAINT) que status='ready' implica
  // missing_fields=[]. A UI usa o mesmo gate para nunca prometer um sync que o
  // backend negaria (spec 016 §9 item 4, anti-regressão de E166).
  const draftMissing = (draft: DiscordDraft): string[] => {
    const payload = draft.normalized_payload;
    if (!payload) return [];
    const raw = (payload as { missing_fields?: unknown }).missing_fields;
    if (!Array.isArray(raw)) return [];
    return raw.filter((item): item is string => typeof item === 'string');
  };
  const isReady = (draft: DiscordDraft) =>
    draft.status === 'ready' && draftMissing(draft).length === 0;
  const readyCount = drafts.filter(isReady).length;

  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <select
          value={originFilter}
          onChange={e => setOriginFilter(e.target.value as OriginFilter)}
          className="app-select"
          aria-label="Filtrar por origem"
        >
          <option value="all">Todas origens</option>
          <option value="discord">Discord</option>
          <option value="inbox">Inbox</option>
        </select>

        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as DiscordImportDraftStatus | '')}
          className="app-select"
          aria-label="Filtrar por status"
        >
          <option value="">Todos os status</option>
          {(Object.keys(DRAFT_STATUS_LABELS) as DiscordImportDraftStatus[]).map(s => (
            <option key={s} value={s}>{DRAFT_STATUS_LABELS[s]}</option>
          ))}
        </select>

        <button
          onClick={loadDrafts}
          className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg transition-colors"
        >
          Recarregar
        </button>

        {showSyncReady && readyCount > 0 && (
          <button
            onClick={handleSyncReady}
            disabled={syncingAll}
            className="ml-auto px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
          >
            {syncingAll ? 'Sincronizando...' : `Sincronizar todos prontos (${readyCount})`}
          </button>
        )}
      </div>

      {/* Barra de seleção em lote */}
      {rejectableDrafts.length > 0 && (
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <label className="flex items-center gap-2 text-white/60 text-sm cursor-pointer select-none">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleSelectAll}
              aria-label="Selecionar todos os rascunhos"
              className="h-4 w-4 accent-blue-600"
            />
            Selecionar todos ({rejectableDrafts.length})
          </label>
          {selectedRejectable.length > 0 && (
            <>
              <span className="text-white/40 text-sm">{selectedRejectable.length} selecionado(s)</span>
              <button
                onClick={() => rejectDraftIds(
                  selectedRejectable.map(d => d.id),
                  `Rejeitar ${selectedRejectable.length} rascunho(s) selecionado(s)?`,
                )}
                disabled={rejectingAll}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
              >
                {rejectingAll ? 'Rejeitando...' : `Rejeitar selecionados (${selectedRejectable.length})`}
              </button>
            </>
          )}
          <button
            onClick={handleRejectAll}
            disabled={rejectingAll}
            className="ml-auto px-4 py-2 bg-red-700/80 hover:bg-red-700 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
          >
            {rejectingAll ? 'Limpando...' : `Limpar todos (${rejectableDrafts.length})`}
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-white/40 text-sm py-4 text-center">Carregando...</p>
      ) : drafts.length === 0 ? (
        <p className="text-white/40 text-sm py-4 text-center">Nenhum draft encontrado.</p>
      ) : (
        <div className="space-y-2">
          {drafts.map(draft => {
            const table = readDraftTable(draft);
            const title = readString(table.title) ?? '—';
            const system = readString(table.system_name);
            const coverUrl = readString(table.cover_url) ?? readString(table.cover_url_source);
            const coverQuality = readString(table.cover_quality);

            return (
              <div
                key={draft.id}
                className="bg-white/5 border border-white/10 rounded-lg px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-white/[0.08] transition-colors"
                onClick={() => setSelectedDraft(draft)}
              >
                {draft.status !== 'synced' && draft.status !== 'rejected' && (
                  <input
                    type="checkbox"
                    checked={selectedIds.has(draft.id)}
                    onChange={() => toggleSelected(draft.id)}
                    onClick={e => e.stopPropagation()}
                    aria-label={`Selecionar rascunho ${readString(readDraftTable(draft).title) ?? draft.id}`}
                    className="h-4 w-4 shrink-0 accent-blue-600"
                  />
                )}
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md border border-white/10 bg-white/5">
                  {coverUrl ? (
                    <img src={coverUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="h-full w-full bg-white/5" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`px-2 py-0.5 text-xs rounded-full ${ORIGIN_COLORS[draftOrigin(draft)]}`}>
                      {ORIGIN_LABELS[draftOrigin(draft)]}
                    </span>
                    {(() => {
                      const effectiveStatus: DiscordImportDraftStatus =
                        draft.status === 'ready' && !isReady(draft) ? 'needs_review' : draft.status;
                      return (
                        <span className={`px-2 py-0.5 text-xs rounded-full ${DRAFT_STATUS_COLORS[effectiveStatus]}`}>
                          {DRAFT_STATUS_LABELS[effectiveStatus]}
                        </span>
                      );
                    })()}
                    {draft.confidence != null && (
                      <span className={`text-xs ${typeof draft.confidence === 'number' ? confidenceColor(draft.confidence) : 'text-white/30'}`}>
                        {(Number(draft.confidence) * 100).toFixed(0)}%
                      </span>
                    )}
                    {/* DEB-048-29: anúncio ambíguo p/ sistema autoral */}
                    {draftMissing(draft).includes('system_name:homebrew_suspect') && (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-amber-500/20 text-amber-300" title="Possível sistema autoral — revisar e decidir">
                        ⚠ autoral?
                      </span>
                    )}
                  </div>
                  <p className="text-white font-medium text-sm truncate">{title}</p>
                  <div className="flex items-center gap-2">
                    {system && <p className="text-white/40 text-xs truncate">{system}</p>}
                    {coverQuality === 'low' && <span className="text-amber-300 text-xs">capa baixa</span>}
                  </div>
                </div>
                <div className="text-white/30 text-xs shrink-0 text-right">
                  <p>{new Date(draft.created_at).toLocaleDateString('pt-BR')}</p>
                  {draft.table_id && <p className="text-blue-400/60">mesa vinculada</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedDraft && (
        <DiscordDraftPreview
          draft={selectedDraft}
          onUpdate={handleDraftUpdate}
          onClose={() => setSelectedDraft(null)}
          api={resolveApi(selectedDraft)}
          onBeforeSync={onBeforeSync}
        />
      )}
    </div>
  );
}
