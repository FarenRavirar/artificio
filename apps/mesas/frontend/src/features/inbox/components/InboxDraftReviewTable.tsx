import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import type { DiscordDraft, DiscordImportDraftStatus } from '../../discord-sync/types';
import { DiscordDraftPreview } from '../../discord-sync/components/DiscordDraftPreview';
import { inboxApi } from '../api/inboxApi';
import type { InboxDraftSummary } from '../types';
import { buildInboxDraftApi, inboxDraftToDiscordDraft, isRecord } from '../adapters/draftAdapter';

const DRAFT_STATUS_LABELS: Record<string, string> = {
  draft: 'Rascunho',
  ready: 'Pronto',
  needs_review: 'Revisar',
  synced: 'Sincronizado',
  rejected: 'Rejeitado',
};

const DRAFT_STATUS_COLORS: Record<string, string> = {
  draft: 'bg-white/10 text-white/50',
  ready: 'bg-green-700/40 text-green-300',
  needs_review: 'bg-orange-700/40 text-orange-300',
  synced: 'bg-blue-700/40 text-blue-300',
  rejected: 'bg-red-700/40 text-red-300',
};

export function InboxDraftReviewTable() {
  const [drafts, setDrafts] = useState<InboxDraftSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<DiscordImportDraftStatus | ''>('');
  const [selectedDraft, setSelectedDraft] = useState<DiscordDraft | null>(null);
  const originalPayloadRef = useRef<Record<string, unknown> | null>(null);

  const loadDrafts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await inboxApi.listDrafts({
        status: statusFilter || undefined,
        limit: 100,
      });
      setDrafts(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar drafts.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void (async () => { await loadDrafts(); })();
  }, [loadDrafts]);

  const handleSelectDraft = async (draft: InboxDraftSummary) => {
    try {
      const full = await inboxApi.getDraft(draft.id);
      const converted = inboxDraftToDiscordDraft(full);
      originalPayloadRef.current = isRecord(full.normalized_payload) ? full.normalized_payload : null;
      setSelectedDraft(converted);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar detalhes do draft.');
    }
  };

  const handleBeforeSync = useCallback(async (current: DiscordDraft): Promise<{ tableId: string; created: boolean } | null> => {
    const originalNormalized = originalPayloadRef.current;
    if (!originalNormalized) {
      return null;
    }

    const currentNormalized = isRecord(current.normalized_payload) ? current.normalized_payload : null;
    if (!currentNormalized) {
      return null;
    }

    const diff: Record<string, unknown> = {};
    const originalTable = isRecord(originalNormalized.table) ? originalNormalized.table : {};
    const currentTable = isRecord(currentNormalized.table) ? currentNormalized.table : {};

    for (const key of Object.keys(currentTable)) {
      const before = originalTable[key];
      const after = currentTable[key];
      if (JSON.stringify(before) !== JSON.stringify(after)) {
        diff[key] = after;
      }
    }

    if (Object.keys(diff).length === 0) {
      return null;
    }

    const result = await inboxApi.registerCorrection(current.id, diff, 'Edição humana antes da sincronização', { before: originalTable });
    if (result.fields_corrected === 0) {
      return null;
    }

    const syncResult = await inboxApi.syncDraft(current.id);
    return syncResult;
  }, []);

  const handleDraftUpdate = (updated: DiscordDraft) => {
    setSelectedDraft(updated);
    loadDrafts();
  };

  const inboxDraftApi = buildInboxDraftApi();

  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as DiscordImportDraftStatus | '')}
          className="app-select"
        >
          <option value="">Todos os status</option>
          {(Object.keys(DRAFT_STATUS_LABELS) as string[]).map(s => (
            <option key={s} value={s}>{DRAFT_STATUS_LABELS[s]}</option>
          ))}
        </select>

        <button
          onClick={loadDrafts}
          className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg transition-colors"
        >
          Recarregar
        </button>
      </div>

      {loading ? (
        <p className="text-white/40 text-sm py-4 text-center">Carregando...</p>
      ) : drafts.length === 0 ? (
        <p className="text-white/40 text-sm py-4 text-center">Nenhum draft encontrado.</p>
      ) : (
        <div className="space-y-2">
          {drafts.map(draft => {
            const colorClass = DRAFT_STATUS_COLORS[draft.status] ?? 'bg-white/10 text-white/50';
            const label = DRAFT_STATUS_LABELS[draft.status] ?? draft.status;
            return (
            <button
              key={draft.id}
              type="button"
              className="w-full text-left bg-white/5 border border-white/10 rounded-lg px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-white/[0.08] transition-colors"
              onClick={() => handleSelectDraft(draft)}
            >
              <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md border border-white/10 bg-white/5 flex items-center justify-center text-white/20 text-xs">
                📋
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`px-2 py-0.5 text-xs rounded-full ${colorClass}`}>
                    {label}
                  </span>
                  {draft.confidence != null && (
                    <span className="text-white/30 text-xs">{Math.round(draft.confidence * 100)}%</span>
                  )}
                </div>
                <p className="text-white font-medium text-sm truncate">{draft.title ?? '—'}</p>
                <div className="flex items-center gap-2">
                  <p className="text-white/40 text-xs truncate">{draft.source_type}</p>
                </div>
              </div>
              <div className="text-white/30 text-xs shrink-0 text-right">
                <p>{new Date(draft.created_at).toLocaleDateString('pt-BR')}</p>
              </div>
            </button>
            );
          })}
        </div>
      )}

      {selectedDraft && (
        <DiscordDraftPreview
          draft={selectedDraft}
          onUpdate={handleDraftUpdate}
          onClose={() => setSelectedDraft(null)}
          api={inboxDraftApi}
          onBeforeSync={handleBeforeSync}
        />
      )}
    </div>
  );
}
