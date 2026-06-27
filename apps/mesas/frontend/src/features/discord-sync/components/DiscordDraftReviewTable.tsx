import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import type { DiscordDraft, DiscordImportDraftStatus, DraftApiOperations } from '../types';
import { discordSyncApi } from '../api/discordSyncApi';
import { DiscordDraftPreview } from './DiscordDraftPreview';
import { isRecord } from '../draftFormUtils';

interface Props {
  readonly api?: DraftApiOperations;
  readonly listDrafts?: (params?: { status?: DiscordImportDraftStatus; limit?: number; offset?: number }) => Promise<DiscordDraft[]>;
  readonly syncReadyAction?: () => Promise<{ synced: number; failed: number; errors: string[] }>;
  readonly showSyncReady?: boolean;
}

const DRAFT_STATUS_LABELS: Record<DiscordImportDraftStatus, string> = {
  draft: 'Rascunho',
  ready: 'Pronto',
  needs_review: 'Revisar',
  synced: 'Sincronizado',
  rejected: 'Rejeitado',
};

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

export function DiscordDraftReviewTable({ api, listDrafts: listDraftsProp, syncReadyAction, showSyncReady = true }: Props) {
  const draftApi = api ?? discordSyncApi;
  const [drafts, setDrafts] = useState<DiscordDraft[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<DiscordImportDraftStatus | ''>('');
  const [selectedDraft, setSelectedDraft] = useState<DiscordDraft | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);

  const loadDrafts = useCallback(async () => {
    setLoading(true);
    try {
      const fetchFn = listDraftsProp ?? ((params) => discordSyncApi.getDrafts(params));
      const data = await fetchFn({
        status: statusFilter || undefined,
        limit: 100,
      });
      setDrafts(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar drafts.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, listDraftsProp]);

  useEffect(() => {
    void (async () => { await loadDrafts(); })();
  }, [loadDrafts]);

  const handleSyncReady = async () => {
    if (!confirm('Sincronizar todos os drafts com status "pronto" como mesas reais?')) return;
    setSyncingAll(true);
    try {
      const action = syncReadyAction ?? discordSyncApi.syncReady;
      const result = await action();
      toast.success(`${result.synced} sincronizadas, ${result.failed} falhas.`);
      if (result.errors.length > 0) {
        console.warn('[DiscordDraftReviewTable] erros de sync:', result.errors);
      }
      loadDrafts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao sincronizar em lote.');
    } finally {
      setSyncingAll(false);
    }
  };

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
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as DiscordImportDraftStatus | '')}
          className="app-select"
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
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md border border-white/10 bg-white/5">
                  {coverUrl ? (
                    <img src={coverUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="h-full w-full bg-white/5" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
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
          api={draftApi}
        />
      )}
    </div>
  );
}
