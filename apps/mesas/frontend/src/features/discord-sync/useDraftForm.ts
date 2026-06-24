import { useEffect, useMemo, useReducer, useRef, useState, type ChangeEvent } from 'react';
import toast from 'react-hot-toast';
import { buildForm, buildUpdatedPayload, flattenSystems, formatFileSize, isRecord, asString, asRecord, asStringArray, asSlotsAmbiguity, validateForm, loadSystems, MAX_COVER_FILE_SIZE_BYTES, COVER_MIME_TYPES } from './draftFormUtils';
import { authPost } from '../../services/apiClient';
import type { DraftForm } from './draftFormUtils';
import type { DiscordDraft, DiscordImportDraftStatus, DiscordSlotsAmbiguity, DraftApiOperations } from './types';
import type { SystemTreeNode } from '../../types/systems';

type SlotsInterpretation = 'filled_total' | 'open_total';

interface DraftEditorState {
  form: DraftForm;
  newStatus: DiscordImportDraftStatus;
  reviewNotes: string;
  coverPreviewUrl: string;
  dirty: boolean;
}

type DraftEditorAction =
  | { type: 'RESET'; draft: DiscordDraft }
  | { type: 'SET_FIELD'; key: keyof DraftForm; value: DraftForm[keyof DraftForm] }
  | { type: 'SET_SYSTEM'; systemId: string; systemName: string }
  | { type: 'SET_COVER'; secureUrl: string }
  | { type: 'REMOVE_COVER' }
  | { type: 'SET_STATUS_FIELD'; key: 'newStatus' | 'reviewNotes'; value: string }
  | { type: 'MARK_PERSISTED' };

function buildEditorState(draft: DiscordDraft): DraftEditorState {
  const p = buildForm(draft.normalized_payload ?? draft.parsed_payload);
  return {
    form: p,
    newStatus: draft.status,
    reviewNotes: draft.review_notes ?? '',
    coverPreviewUrl: p.cover_url.trim() || p.cover_url_source.trim(),
    dirty: false,
  };
}

function editorReducer(state: DraftEditorState, action: DraftEditorAction): DraftEditorState {
  switch (action.type) {
    case 'RESET':
      return buildEditorState(action.draft);
    case 'SET_FIELD':
      return { ...state, form: { ...state.form, [action.key]: action.value }, dirty: true };
    case 'SET_SYSTEM':
      return { ...state, form: { ...state.form, system_id: action.systemId, system_name: action.systemName }, dirty: true };
    case 'SET_COVER':
      return {
        ...state,
        form: { ...state.form, cover_url: action.secureUrl, cover_url_source: '', cover_quality: 'standard' },
        coverPreviewUrl: action.secureUrl,
        dirty: true,
      };
    case 'REMOVE_COVER':
      return {
        ...state,
        form: { ...state.form, cover_url: '', cover_url_source: '', cover_quality: '' },
        coverPreviewUrl: '',
        dirty: true,
      };
    case 'SET_STATUS_FIELD':
      return { ...state, [action.key]: action.value, dirty: true };
    case 'MARK_PERSISTED':
      return { ...state, dirty: false };
  }
}

export function useDraftForm(draft: DiscordDraft, draftApi: DraftApiOperations, onUpdate: (d: DiscordDraft) => void) {
  const [state, dispatch] = useReducer(editorReducer, draft, buildEditorState);
  const [systems, setSystems] = useState<SystemTreeNode[]>([]);
  const [systemsLoading, setSystemsLoading] = useState(false);
  const [savingFields, setSavingFields] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [reparsing, setReparsing] = useState(false);
  const [editingStatus, setEditingStatus] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [activeTab, setActiveTab] = useState<'editor' | 'parsed' | 'normalized'>('editor');
  const [coverUploading, setCoverUploading] = useState(false);
  const [coverError, setCoverError] = useState<string | null>(null);
  const [slotsInterpretation, setSlotsInterpretation] = useState<SlotsInterpretation>('filled_total');
  const coverInputRef = useRef<HTMLInputElement | null>(null);

  const missingFields = useMemo(() => validateForm(state.form), [state.form]);
  const canSync = draft.status === 'ready' && !state.dirty && missingFields.length === 0;

  const payload = useMemo(() => draft.normalized_payload ?? draft.parsed_payload, [draft.normalized_payload, draft.parsed_payload]);
  const payloadMissingFields = useMemo(
    () => asStringArray(payload ? asRecord(payload).missing_fields : []),
    [payload]
  );
  const slotsAmbiguity = useMemo<DiscordSlotsAmbiguity | null>(
    () => asSlotsAmbiguity(asRecord(asRecord(payload).table)._slots_ambiguity),
    [payload]
  );

  useEffect(() => {
    dispatch({ type: 'RESET', draft });
  // Draft como objeto muda de referência a cada render do pai. Props individuais são as dependências reais.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.id, draft.status, draft.review_notes, draft.normalized_payload, draft.parsed_payload]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      if (cancelled) return;
      setSystemsLoading(true);
      try {
        const items = await loadSystems();
        if (!cancelled) setSystems(flattenSystems(items));
      } catch (err) {
        if (!cancelled) toast.error(err instanceof Error ? err.message : 'Erro ao carregar sistemas.');
      } finally {
        if (!cancelled) setSystemsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const updateForm = <K extends keyof DraftForm>(key: K, value: DraftForm[K]) => {
    dispatch({ type: 'SET_FIELD', key, value });
  };

  const handleSystemChange = (systemId: string) => {
    const selected = systems.find((s) => s.id === systemId);
    dispatch({ type: 'SET_SYSTEM', systemId, systemName: selected?.name_pt || selected?.name || state.form.system_name });
  };

  const handleSaveFields = async () => {
    setSavingFields(true);
    try {
      const nextMissing = validateForm(state.form);
      const updated = await draftApi.updateDraft(draft.id, {
        normalized_payload: buildUpdatedPayload(
          draft.normalized_payload ?? draft.parsed_payload,
          state.form
        ),
        status: nextMissing.length === 0 ? 'ready' : 'needs_review',
        review_notes: nextMissing.length === 0
          ? (state.reviewNotes === '' ? '' : state.reviewNotes || undefined)
          : `Campos pendentes: ${nextMissing.join(', ')}`,
      });
      dispatch({ type: 'MARK_PERSISTED' });
      toast.success(nextMissing.length === 0 ? 'Draft pronto para sincronizar.' : 'Draft salvo para revisão.');
      onUpdate(updated);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar campos do draft.');
    } finally {
      setSavingFields(false);
    }
  };

  const handleCoverUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!COVER_MIME_TYPES.includes(file.type)) {
      setCoverError('Formato inválido. Envie JPG, PNG ou WEBP.');
      return;
    }
    if (file.size > MAX_COVER_FILE_SIZE_BYTES) {
      setCoverError(`Arquivo muito grande (${formatFileSize(file.size)}). Limite de 5 MB.`);
      return;
    }

    setCoverUploading(true);
    setCoverError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await authPost('/api/v1/upload', formData);
      if (!response.ok) {
        let errorMsg = 'Falha ao enviar imagem.';
        try { const errPayload: unknown = await response.json(); errorMsg = asString(isRecord(errPayload) ? errPayload.error : '') || errorMsg; } catch { /* corpo vazio */ }
        throw new Error(errorMsg);
      }
      const responsePayload: unknown = await response.json();
      const secureUrl = isRecord(responsePayload) ? asString(responsePayload.secure_url) : '';
      if (!secureUrl) {
        throw new Error('Falha ao enviar imagem.');
      }
      dispatch({ type: 'SET_COVER', secureUrl });
    } catch (err) {
      setCoverError(err instanceof Error ? err.message : 'Erro ao substituir capa.');
    } finally {
      setCoverUploading(false);
    }
  };

  const handleRemoveCover = () => {
    setCoverError(null);
    dispatch({ type: 'REMOVE_COVER' });
  };

  const handleConfirmSlots = async () => {
    if (!slotsAmbiguity) return;
    setSavingFields(true);
    try {
      const total = Math.max(slotsAmbiguity.first, slotsAmbiguity.second);
      const filled = slotsInterpretation === 'filled_total' ? slotsAmbiguity.first : Math.max(0, total - slotsAmbiguity.first);
      const open = slotsInterpretation === 'filled_total' ? Math.max(0, total - slotsAmbiguity.first) : slotsAmbiguity.first;
      const nextForm = {
        ...state.form,
        slots_total: String(total),
        slots_open: String(open),
      };
      const basePayload = buildUpdatedPayload(draft.normalized_payload ?? draft.parsed_payload, nextForm);
      const baseTable = asRecord(basePayload.table);
      const missing = asStringArray(basePayload.missing_fields).filter(
        (field) => field !== 'slots_open:ambiguous_x_of_y' && field !== 'slots_total'
      );
      const normalized_payload = {
        ...basePayload,
        missing_fields: missing,
        table: {
          ...baseTable,
          slots_total: total,
          slots_filled: filled,
          slots_open: open,
          _slots_ambiguity: null,
        },
      };
      const updated = await draftApi.updateDraft(draft.id, {
        normalized_payload,
        status: missing.length === 0 ? 'ready' : 'needs_review',
        review_notes: missing.length === 0
          ? (state.reviewNotes === '' ? '' : state.reviewNotes || undefined)
          : `Campos pendentes: ${missing.join(', ')}`,
      });
      dispatch({ type: 'MARK_PERSISTED' });
      toast.success('Vagas desambiguadas.');
      onUpdate(updated);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar interpretação de vagas.');
    } finally {
      setSavingFields(false);
    }
  };

  const handleSync = async (onBeforeSync?: (d: DiscordDraft) => Promise<{ tableId: string; created: boolean } | null>) => {
    if (state.dirty) {
      toast.error('Salve as alterações antes de sincronizar.');
      return;
    }
    setSyncing(true);
    try {
      if (onBeforeSync) {
        const beforeResult = await onBeforeSync(draft);
        if (beforeResult) {
          toast.success(`Mesa ${beforeResult.created ? 'criada' : 'atualizada'}: ${beforeResult.tableId}`);
          if (draftApi.getDraft) {
            const refetched = await draftApi.getDraft(draft.id);
            onUpdate(refetched);
          }
          return;
        }
      }

      const result = await draftApi.syncDraft(draft.id);
      toast.success(`Mesa ${result.created ? 'criada' : 'atualizada'}: ${result.tableId}`);
      if (draftApi.getDraft) {
        const refetched = await draftApi.getDraft(draft.id);
        onUpdate(refetched);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao sincronizar draft.');
    } finally {
      setSyncing(false);
    }
  };

  const handleReparse = async () => {
    setReparsing(true);
    try {
      const updated = await draftApi.reparseDraft(draft.id);
      toast.success('Draft reparseado.');
      onUpdate(updated);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao reparsar draft.');
    } finally {
      setReparsing(false);
    }
  };

  const handleSaveStatus = async () => {
    setSavingStatus(true);
    try {
      const updated = await draftApi.updateDraft(draft.id, {
        status: state.newStatus,
        review_notes: state.reviewNotes === '' ? '' : (state.reviewNotes || undefined),
      });
      toast.success('Status atualizado.');
      setEditingStatus(false);
      onUpdate(updated);
      /* Intencional: NÃO dispara MARK_PERSISTED — handleSaveStatus só persiste
         status/review_notes, não o form. Se dirty fosse zerado aqui, sync poderia
         usar normalized_payload desatualizado (REV-045). */
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar status.');
    } finally {
      setSavingStatus(false);
    }
  };

  return {
    form: state.form, updateForm,
    dirty: state.dirty,
    systems, systemsLoading,
    missingFields, canSync,
    syncing, reparsing,
    savingFields, savingStatus,
    editingStatus, setEditingStatus,
    newStatus: state.newStatus, setNewStatus: (v: DiscordImportDraftStatus) => dispatch({ type: 'SET_STATUS_FIELD', key: 'newStatus', value: v }),
    reviewNotes: state.reviewNotes, setReviewNotes: (v: string) => dispatch({ type: 'SET_STATUS_FIELD', key: 'reviewNotes', value: v }),
    activeTab, setActiveTab,
    coverUploading, coverError,
    coverPreviewUrl: state.coverPreviewUrl, coverInputRef,
    slotsInterpretation, setSlotsInterpretation,
    slotsAmbiguity,
    payloadMissingFields,
    handleSystemChange,
    handleSaveFields,
    handleCoverUpload, handleRemoveCover,
    handleConfirmSlots,
    handleSync, handleReparse,
    handleSaveStatus,
  };
}
