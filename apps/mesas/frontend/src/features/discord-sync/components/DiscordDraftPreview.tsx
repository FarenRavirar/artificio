import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useConfirm } from '@artificio/ui';
import type { DiscordDraft, DiscordImportDraftStatus, DraftApiOperations } from '../types';
import { STATUS_OPTIONS } from '../constants';
import { useDraftForm } from '../useDraftForm';
import { DraftEditorTab } from './DraftEditorTab';
import { DuplicatesTab } from './DuplicatesTab';
import { authPut } from '../../../services/apiClient';

// T-G1: cor por tier de confiança
function confidenceColor(score: number): string {
  if (score >= 0.85) return 'text-green-400';
  if (score >= 0.65) return 'text-lime-400';
  if (score >= 0.4) return 'text-yellow-400';
  return 'text-red-400';
}

// Achado Sonar (PR #131): ternario aninhado extraido pra funcao nomeada.
function buildSyncTitle(canSync: boolean, dirty: boolean, missingFields: string[]): string | undefined {
  if (canSync) return undefined;
  if (dirty) return 'Salve as alterações primeiro.';
  if (missingFields.length > 0) return `Campos obrigatórios pendentes: ${missingFields.join(', ')}.`;
  return 'Preencha todos os campos obrigatórios e deixe o draft como ready.';
}

interface Props {
  readonly draft: DiscordDraft;
  readonly onUpdate: (updated: DiscordDraft) => void;
  readonly onClose: () => void;
  readonly api: DraftApiOperations;
  readonly onBeforeSync?: (draft: DiscordDraft) => Promise<{ tableId: string; created: boolean } | null>;
}

export function DiscordDraftPreview({ draft, onUpdate, onClose, api, onBeforeSync }: Props) {
  const { confirm } = useConfirm();
  const h = useDraftForm(draft, api, onUpdate);
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [refreshingImage, setRefreshingImage] = useState(false);
  const [detailLoadFailedDraftId, setDetailLoadFailedDraftId] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);

  // Publica direto a mesa vinculada (spec 060: PUT /admin/tables/:id não
  // exige gm_id, funciona pra mesa importada). Achado do mantenedor
  // 2026-07-08: link pra outra tela não serve -- publicar tem que ser um
  // botão aqui mesmo, no padrão dos outros (Reparsar/Salvar campos/etc).
  const handlePublishTable = useCallback(async () => {
    if (!draft.table_id) return;
    setPublishing(true);
    try {
      const response = await authPut(`/api/v1/admin/tables/${draft.table_id}`, { status: 'active' });
      if (!response.ok) {
        const error = await response.json().catch(() => null) as { error?: string } | null;
        toast.error(error?.error || 'Erro ao publicar mesa.');
        return;
      }
      toast.success('Mesa publicada.');
    } catch {
      toast.error('Erro ao publicar mesa. Tente novamente.');
    } finally {
      setPublishing(false);
    }
  }, [draft.table_id]);

  const shouldShowSlotsDisambiguation = Boolean(h.slotsAmbiguity && h.payloadMissingFields.includes('slots_open:ambiguous_x_of_y'));
  // DEB-048-29: badge "autoral?" — anúncio ambíguo p/ sistema próprio. Revisor decide
  // Sincronizar (manter) ou rejeitar (descartar).
  const isHomebrewSuspect = h.payloadMissingFields.includes('system_name:homebrew_suspect');
  const selectedPayload = h.activeTab === 'parsed' ? draft.parsed_payload : (draft.normalized_payload ?? draft.parsed_payload);

  const statusLabel = h.canSync ? 'Pronto'
    : draft.status === 'synced' ? 'Sincronizado'
    : draft.status === 'rejected' ? 'Rejeitado'
    : 'Revisar';

  const syncTitle = buildSyncTitle(h.canSync, h.dirty, h.missingFields);

  const tabClass = (tab: typeof h.activeTab) =>
    `px-3 py-1 text-xs rounded-lg transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400 ${
      h.activeTab === tab ? 'bg-blue-600 text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'
    }`;

  const requestClose = useCallback(async () => {
    if (h.dirty) {
      const confirmed = await confirm({
        title: 'Descartar alterações?',
        message: 'Há alterações não salvas neste draft. Fechar agora descarta o que ainda não foi salvo.',
        variant: 'warning',
        confirmText: 'Descartar',
      });
      if (!confirmed) return;
    }
    onClose();
  }, [confirm, h.dirty, onClose]);

  const requestCloseSafely = useCallback(() => {
    requestClose().catch(() => undefined);
  }, [requestClose]);

  const handleRefreshImage = useCallback(async () => {
    if (!api.refreshDraftImage) return;
    setRefreshingImage(true);
    try {
      const result = await api.refreshDraftImage(draft.id);
      if (api.getDraft) {
        onUpdate(await api.getDraft(draft.id));
      }
      if (result.status === 'success') {
        toast.success('Imagem rebaixada e atualizada.');
      } else if (result.error) {
        // Só é erro de verdade quando o backend reporta uma causa.
        toast.error(result.error);
      } else {
        // Estado intermediário (reenfileirado/pendente) não é falha.
        toast('Imagem enviada para nova tentativa.');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao rebaixar imagem.');
    } finally {
      setRefreshingImage(false);
    }
  }, [api, draft.id, onUpdate]);

  useEffect(() => {
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();

    return () => {
      document.body.style.overflow = originalOverflow;
      previousFocusRef.current?.focus();
    };
  }, []);

  useEffect(() => {
    // Guard cobre falha anterior (detailLoadFailedDraftId) pra não repetir fetch/toast
    // a cada re-render do pai enquanto content_raw continuar undefined (onUpdate/
    // handleDraftUpdate não é memoizado em DiscordDraftReviewTable).
    if (draft.content_raw !== undefined || !api.getDraft || detailLoadFailedDraftId === draft.id) return;
    let cancelled = false;
    api.getDraft(draft.id)
      .then((detail) => {
        if (!cancelled) onUpdate(detail);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setDetailLoadFailedDraftId(draft.id);
          toast.error(error instanceof Error ? error.message : 'Erro ao carregar detalhe do draft.');
        }
      });
    return () => { cancelled = true; };
  }, [api, draft.content_raw, draft.id, detailLoadFailedDraftId, onUpdate]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const dialog = dialogRef.current;
      if (!dialog) return;
      const activeElement = document.activeElement;
      if (activeElement instanceof Node && !dialog.contains(activeElement)) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        requestCloseSafely();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (document.activeElement === dialogRef.current) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [requestCloseSafely]);

  return (
    <dialog
      open
      ref={dialogRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      aria-labelledby="discord-draft-preview-title"
      aria-describedby="discord-draft-preview-description"
      tabIndex={-1}
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Fechar preview do draft"
        onClick={requestCloseSafely}
      />
      <div
        className="relative z-10 bg-[#1B2A4A] border border-white/10 rounded-xl w-full max-w-5xl max-h-[90vh] flex flex-col focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div>
            <h3 id="discord-draft-preview-title" className="text-white font-semibold">Draft de mesa</h3>
            <p id="discord-draft-preview-description" className="text-white/40 text-xs mt-0.5">{draft.id}</p>
          </div>
          <button
            onClick={requestCloseSafely}
            className="text-white/40 hover:text-white transition-colors text-lg leading-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400"
            aria-label="Fechar preview do draft"
          >
            X
          </button>
        </div>

        <div className="px-5 py-3 border-b border-white/10 flex items-center gap-3">
          {h.editingStatus ? (
            <>
              <select value={h.newStatus} onChange={(e) => h.setNewStatus(e.target.value as DiscordImportDraftStatus)} className="app-select py-1">
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
              <input
                placeholder="Notas de revisão..."
                value={h.reviewNotes}
                onChange={(e) => h.setReviewNotes(e.target.value)}
                className="flex-1 px-2 py-1 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/30"
              />
              <button onClick={h.handleSaveStatus} disabled={h.savingStatus} className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400">
                {h.savingStatus ? '...' : 'Salvar'}
              </button>
              <button onClick={() => h.setEditingStatus(false)} className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400">
                Cancelar
              </button>
            </>
          ) : (
            <>
              <span className="text-white/60 text-sm">Status:</span>
              <span className="text-white text-sm font-medium">{statusLabel}</span>
              {draft.status === 'ready' && !h.canSync && (
                <span className="text-amber-300 text-xs">({h.missingFields.length} pendência{h.missingFields.length === 1 ? '' : 's'})</span>
              )}
              {draft.confidence != null && <span className={`text-xs ${confidenceColor(Number(draft.confidence))}`}>confiança: {(Number(draft.confidence) * 100).toFixed(0)}%</span>}
              {isHomebrewSuspect && (
                <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-xs font-medium" title="O sistema pode ser autoral/próprio. Decida: sincronizar (manter) ou rejeitar (descartar).">
                  ⚠ Possível sistema autoral
                </span>
              )}
              {draft.status !== 'synced' && (
                <button onClick={() => h.setEditingStatus(true)} className="ml-auto px-2 py-1 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-xs rounded-lg transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400">
                  Editar status
                </button>
              )}
            </>
          )}
        </div>

        <div className="flex gap-2 px-5 pt-3" role="tablist" aria-label="Visualizações do draft">
          <button className={tabClass('editor')} onClick={() => h.setActiveTab('editor')} role="tab" aria-selected={h.activeTab === 'editor'}>Campos</button>
          <button className={tabClass('normalized')} onClick={() => h.setActiveTab('normalized')} role="tab" aria-selected={h.activeTab === 'normalized'}>Normalizado</button>
          <button className={tabClass('parsed')} onClick={() => h.setActiveTab('parsed')} role="tab" aria-selected={h.activeTab === 'parsed'}>Bruto</button>
          {api.listDuplicateCandidates && api.resolveDuplicateCandidate && (
            <button className={tabClass('duplicates')} onClick={() => h.setActiveTab('duplicates')} role="tab" aria-selected={h.activeTab === 'duplicates'}>Duplicatas</button>
          )}
        </div>

        <div className="flex-1 overflow-auto px-5 py-3">
          {h.activeTab === 'editor' && (
            <DraftEditorTab
              form={h.form}
              authorName={h.authorName}
              missingFields={h.missingFields}
              systems={h.systems}
              systemsLoading={h.systemsLoading}
              scenarios={h.scenarios}
              scenariosLoading={h.scenariosLoading}
              vttPlatforms={h.vttPlatforms}
              vttPlatformsLoading={h.vttPlatformsLoading}
              communicationPlatforms={h.communicationPlatforms}
              communicationPlatformsLoading={h.communicationPlatformsLoading}
              contentRaw={draft.content_raw}
              contentRawLoading={draft.content_raw === undefined && Boolean(api.getDraft) && detailLoadFailedDraftId !== draft.id}
              coverPreviewUrl={h.coverPreviewUrl}
              coverError={h.coverError}
              coverUploading={h.coverUploading}
              coverInputRef={h.coverInputRef}
              shouldShowSlotsDisambiguation={shouldShowSlotsDisambiguation}
              slotsAmbiguity={h.slotsAmbiguity}
              slotsInterpretation={h.slotsInterpretation}
              fieldInsights={h.fieldInsights}
              aiConfig={h.aiConfig}
              llmActivity={h.llmActivity}
              auditingCompleteness={h.auditingCompleteness}
              auditingFields={h.auditingFields}
              completenessSuggestions={h.completenessSuggestions}
              savingFields={h.savingFields}
              onUpdateForm={h.updateForm}
              onApplySuggestion={h.applySuggestion}
              onAuditCompleteness={api.auditCompleteness ? h.handleAuditCompleteness : undefined}
              onAuditField={api.auditField ? h.handleAuditField : undefined}
              onSystemChange={h.handleSystemChange}
              onRefreshSystems={h.refreshSystems}
              onCoverUpload={h.handleCoverUpload}
              onRemoveCover={h.handleRemoveCover}
              onSetSlotsInterpretation={h.setSlotsInterpretation}
              onConfirmSlots={h.handleConfirmSlots}
            />
          )}
          {(h.activeTab === 'normalized' || h.activeTab === 'parsed') && (
            <pre className="text-xs text-green-300 bg-black/30 rounded-lg p-4 overflow-auto whitespace-pre-wrap break-words">
              {JSON.stringify(selectedPayload, null, 2)}
            </pre>
          )}
          {h.activeTab === 'duplicates' && api.listDuplicateCandidates && api.resolveDuplicateCandidate && (
            <DuplicatesTab
              draftId={draft.id}
              listDuplicateCandidates={api.listDuplicateCandidates}
              resolveDuplicateCandidate={api.resolveDuplicateCandidate}
            />
          )}
        </div>

        {draft.review_notes && !h.editingStatus && (
          <div className="px-5 py-2 border-t border-white/10">
            <p className="text-white/50 text-xs">Notas: {draft.review_notes}</p>
          </div>
        )}

        <div className="px-5 py-4 border-t border-white/10 flex flex-wrap gap-2 justify-end">
          <button onClick={h.handleReparse} disabled={h.reparsing} className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg transition-colors disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400">
            {h.reparsing ? 'Reparseando...' : 'Reparsar'}
          </button>
          {draft.discord_message_id && api.refreshDraftImage && (
            <button
              onClick={handleRefreshImage}
              disabled={refreshingImage}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg transition-colors disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400"
            >
              {refreshingImage ? 'Rebaixando imagem...' : 'Rebaixar imagem'}
            </button>
          )}
          <button onClick={h.handleSaveFields} disabled={h.savingFields} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400">
            {h.savingFields ? 'Salvando...' : 'Salvar campos'}
          </button>
          <button
            onClick={() => h.handleSync(onBeforeSync)}
            disabled={!h.canSync || h.syncing}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400"
            title={syncTitle}
          >
            {h.syncing ? 'Sincronizando...' : 'Sincronizar como mesa'}
          </button>
          {draft.status === 'synced' && draft.table_id && (
            <button
              onClick={handlePublishTable}
              disabled={publishing}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400"
              title="Publica a mesa (status draft → active) via PUT /admin/tables — funciona mesmo sem gm_id (spec 060)"
            >
              {publishing ? 'Publicando...' : 'Publicar mesa'}
            </button>
          )}
        </div>
      </div>
    </dialog>
  );
}
