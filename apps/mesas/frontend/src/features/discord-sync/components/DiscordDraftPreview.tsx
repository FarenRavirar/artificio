import type { DiscordDraft, DiscordImportDraftStatus, DraftApiOperations } from '../types';
import { STATUS_OPTIONS } from '../constants';
import { discordSyncApi } from '../api/discordSyncApi';
import { useDraftForm } from '../useDraftForm';
import { DraftEditorTab } from './DraftEditorTab';

interface Props {
  readonly draft: DiscordDraft;
  readonly onUpdate: (updated: DiscordDraft) => void;
  readonly onClose: () => void;
  readonly api?: DraftApiOperations;
  readonly onBeforeSync?: (draft: DiscordDraft) => Promise<{ tableId: string; created: boolean } | null>;
}

export function DiscordDraftPreview({ draft, onUpdate, onClose, api, onBeforeSync }: Props) {
  const draftApi = api ?? discordSyncApi;
  const h = useDraftForm(draft, draftApi, onUpdate);

  const shouldShowSlotsDisambiguation = Boolean(h.slotsAmbiguity && h.payloadMissingFields.includes('slots_open:ambiguous_x_of_y'));
  const selectedPayload = h.activeTab === 'parsed' ? draft.parsed_payload : (draft.normalized_payload ?? draft.parsed_payload);

  const tabClass = (tab: typeof h.activeTab) =>
    `px-3 py-1 text-xs rounded-lg transition-colors ${
      h.activeTab === tab ? 'bg-blue-600 text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'
    }`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1B2A4A] border border-white/10 rounded-xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div>
            <h3 className="text-white font-semibold">Draft de mesa</h3>
            <p className="text-white/40 text-xs mt-0.5">{draft.id}</p>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors text-lg leading-none">
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
              <button onClick={h.handleSaveStatus} disabled={h.savingStatus} className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg disabled:opacity-50">
                {h.savingStatus ? '...' : 'Salvar'}
              </button>
              <button onClick={() => h.setEditingStatus(false)} className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg">
                Cancelar
              </button>
            </>
          ) : (
            <>
              <span className="text-white/60 text-sm">Status:</span>
              <span className="text-white text-sm font-medium">
                {h.canSync ? 'Pronto' : draft.status === 'synced' ? 'Sincronizado' : draft.status === 'rejected' ? 'Rejeitado' : 'Revisar'}
              </span>
              {draft.status === 'ready' && !h.canSync && (
                <span className="text-amber-300 text-xs">({h.missingFields.length} pendência{h.missingFields.length === 1 ? '' : 's'})</span>
              )}
              {draft.confidence != null && <span className="text-white/40 text-xs">confiança: {(draft.confidence * 100).toFixed(0)}%</span>}
              {draft.status !== 'synced' && (
                <button onClick={() => h.setEditingStatus(true)} className="ml-auto px-2 py-1 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-xs rounded-lg transition-colors">
                  Editar status
                </button>
              )}
            </>
          )}
        </div>

        <div className="flex gap-2 px-5 pt-3">
          <button className={tabClass('editor')} onClick={() => h.setActiveTab('editor')}>Campos</button>
          <button className={tabClass('normalized')} onClick={() => h.setActiveTab('normalized')}>Normalizado</button>
          <button className={tabClass('parsed')} onClick={() => h.setActiveTab('parsed')}>Bruto</button>
        </div>

        <div className="flex-1 overflow-auto px-5 py-3">
          {h.activeTab === 'editor' ? (
            <DraftEditorTab
              form={h.form}
              missingFields={h.missingFields}
              systems={h.systems}
              systemsLoading={h.systemsLoading}
              coverPreviewUrl={h.coverPreviewUrl}
              coverError={h.coverError}
              coverUploading={h.coverUploading}
              coverInputRef={h.coverInputRef}
              shouldShowSlotsDisambiguation={shouldShowSlotsDisambiguation}
              slotsAmbiguity={h.slotsAmbiguity}
              slotsInterpretation={h.slotsInterpretation}
              savingFields={h.savingFields}
              onUpdateForm={h.updateForm}
              onSystemChange={h.handleSystemChange}
              onCoverUpload={h.handleCoverUpload}
              onRemoveCover={h.handleRemoveCover}
              onSetSlotsInterpretation={h.setSlotsInterpretation}
              onConfirmSlots={h.handleConfirmSlots}
            />
          ) : (
            <pre className="text-xs text-green-300 bg-black/30 rounded-lg p-4 overflow-auto whitespace-pre-wrap break-words">
              {JSON.stringify(selectedPayload, null, 2)}
            </pre>
          )}
        </div>

        {draft.review_notes && !h.editingStatus && (
          <div className="px-5 py-2 border-t border-white/10">
            <p className="text-white/50 text-xs">Notas: {draft.review_notes}</p>
          </div>
        )}

        <div className="px-5 py-4 border-t border-white/10 flex flex-wrap gap-2 justify-end">
          <button onClick={h.handleReparse} disabled={h.reparsing} className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg transition-colors disabled:opacity-40">
            {h.reparsing ? 'Reparseando...' : 'Reparsar'}
          </button>
          <button onClick={h.handleSaveFields} disabled={h.savingFields} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors disabled:opacity-50">
            {h.savingFields ? 'Salvando...' : 'Salvar campos'}
          </button>
          <button
            onClick={() => h.handleSync(onBeforeSync)}
            disabled={!h.canSync || h.syncing}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors disabled:opacity-40"
            title={!h.canSync ? (h.dirty ? 'Salve as alterações primeiro.' : 'Preencha todos os campos obrigatórios e deixe o draft como ready.') : undefined}
          >
            {h.syncing ? 'Sincronizando...' : 'Sincronizar como mesa'}
          </button>
          {draft.status === 'synced' && draft.table_id && <span className="text-green-400 text-sm self-center">Mesa: {draft.table_id}</span>}
        </div>
      </div>
    </div>
  );
}
