import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import toast from 'react-hot-toast';
import { buildForm, buildUpdatedPayload, flattenSystems, formatFileSize, isRecord, asString, asRecord, asStringArray, asSlotsAmbiguity, validateForm, loadSystems, MAX_COVER_FILE_SIZE_BYTES, COVER_MIME_TYPES } from './draftFormUtils';
import type { DraftForm } from './draftFormUtils';
import type { DiscordDraft, DiscordImportDraftStatus, DiscordSlotsAmbiguity, DraftApiOperations } from './types';
import type { SystemTreeNode } from '../../types/systems';

type SlotsInterpretation = 'filled_total' | 'open_total';

export function useDraftForm(draft: DiscordDraft, draftApi: DraftApiOperations, onUpdate: (d: DiscordDraft) => void) {
  const initialPayload = useMemo(
    () => buildForm(draft.normalized_payload ?? draft.parsed_payload),
    [draft.normalized_payload, draft.parsed_payload]
  );

  const [form, setForm] = useState<DraftForm>(initialPayload);
  const [systems, setSystems] = useState<SystemTreeNode[]>([]);
  const [systemsLoading, setSystemsLoading] = useState(false);
  const [savingFields, setSavingFields] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [reparsing, setReparsing] = useState(false);
  const [editingStatus, setEditingStatus] = useState(false);
  const [newStatus, setNewStatus] = useState<DiscordImportDraftStatus>(draft.status);
  const [reviewNotes, setReviewNotes] = useState(draft.review_notes ?? '');
  const [savingStatus, setSavingStatus] = useState(false);
  const [activeTab, setActiveTab] = useState<'editor' | 'parsed' | 'normalized'>('editor');
  const [coverUploading, setCoverUploading] = useState(false);
  const [coverError, setCoverError] = useState<string | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState('');
  const [slotsInterpretation, setSlotsInterpretation] = useState<SlotsInterpretation>('filled_total');
  const [prevDraftId, setPrevDraftId] = useState(draft.id);
  const [prevDraftStatus, setPrevDraftStatus] = useState(draft.status);
  const [prevDraftReviewNotes, setPrevDraftReviewNotes] = useState(draft.review_notes ?? '');
  const coverInputRef = useRef<HTMLInputElement | null>(null);

  if (draft.id !== prevDraftId || draft.status !== prevDraftStatus || draft.review_notes !== prevDraftReviewNotes) {
    const p = buildForm(draft.normalized_payload ?? draft.parsed_payload);
    setForm(p);
    setNewStatus(draft.status);
    setReviewNotes(draft.review_notes ?? '');
    setCoverPreviewUrl(p.cover_url.trim() || p.cover_url_source.trim());
    setPrevDraftId(draft.id);
    setPrevDraftStatus(draft.status);
    setPrevDraftReviewNotes(draft.review_notes ?? '');
  }

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

  const missingFields = validateForm(form);
  const canSync = draft.status === 'ready' && missingFields.length === 0;

  const updateForm = <K extends keyof DraftForm>(key: K, value: DraftForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSystemChange = (systemId: string) => {
    const selected = systems.find((s) => s.id === systemId);
    setForm((prev) => ({
      ...prev,
      system_id: systemId,
      system_name: selected?.name_pt || selected?.name || prev.system_name,
    }));
  };

  const handleSaveFields = async () => {
    setSavingFields(true);
    try {
      const nextMissing = validateForm(form);
      const updated = await draftApi.updateDraft(draft.id, {
        normalized_payload: buildUpdatedPayload(
          draft.normalized_payload ?? draft.parsed_payload,
          form
        ),
        status: nextMissing.length === 0 ? 'ready' : 'needs_review',
        review_notes: nextMissing.length === 0 ? reviewNotes || undefined : `Campos pendentes: ${nextMissing.join(', ')}`,
      });
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
      const apiBase = (import.meta.env.VITE_API_URL || '').replace(/\/api\/v1$/, '');
      const response = await fetch(`${apiBase}/api/v1/upload`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      const payload: unknown = await response.json();
      const secureUrl = isRecord(payload) ? asString(payload.secure_url) : '';
      if (!response.ok || !secureUrl) {
        throw new Error(isRecord(payload) ? asString(payload.error) || 'Falha ao enviar imagem.' : 'Falha ao enviar imagem.');
      }
      setForm((prev) => ({
        ...prev,
        cover_url: secureUrl,
        cover_url_source: '',
        cover_quality: 'standard',
      }));
      setCoverPreviewUrl(secureUrl);
    } catch (err) {
      setCoverError(err instanceof Error ? err.message : 'Erro ao substituir capa.');
    } finally {
      setCoverUploading(false);
    }
  };

  const handleRemoveCover = () => {
    setCoverError(null);
    setForm((prev) => ({ ...prev, cover_url: '', cover_url_source: '', cover_quality: '' }));
    setCoverPreviewUrl('');
  };

  const handleConfirmSlots = async () => {
    if (!slotsAmbiguity) return;
    setSavingFields(true);
    try {
      const total = Math.max(slotsAmbiguity.first, slotsAmbiguity.second);
      const filled = slotsInterpretation === 'filled_total' ? slotsAmbiguity.first : Math.max(0, total - slotsAmbiguity.first);
      const open = slotsInterpretation === 'filled_total' ? Math.max(0, total - slotsAmbiguity.first) : slotsAmbiguity.first;
      const nextForm = {
        ...form,
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
        review_notes: missing.length === 0 ? reviewNotes || undefined : `Campos pendentes: ${missing.join(', ')}`,
      });
      toast.success('Vagas desambiguadas.');
      onUpdate(updated);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar interpretação de vagas.');
    } finally {
      setSavingFields(false);
    }
  };

  const handleSync = async (onBeforeSync?: (d: DiscordDraft) => Promise<{ tableId: string; created: boolean } | null>) => {
    setSyncing(true);
    try {
      if (onBeforeSync) {
        const beforeResult = await onBeforeSync(draft);
        if (beforeResult) {
          toast.success(`Mesa ${beforeResult.created ? 'criada' : 'atualizada'}: ${beforeResult.tableId}`);
          if (draftApi.getDraft) {
            const updated = await draftApi.getDraft(draft.id);
            onUpdate(updated);
          }
          return;
        }
      }

      const result = await draftApi.syncDraft(draft.id);
      toast.success(`Mesa ${result.created ? 'criada' : 'atualizada'}: ${result.tableId}`);
      if (draftApi.getDraft) {
        const updated = await draftApi.getDraft(draft.id);
        onUpdate(updated);
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
        status: newStatus,
        review_notes: reviewNotes || undefined,
      });
      toast.success('Status atualizado.');
      setEditingStatus(false);
      onUpdate(updated);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar status.');
    } finally {
      setSavingStatus(false);
    }
  };

  const payload = draft.normalized_payload ?? draft.parsed_payload;
  const payloadMissingFields = asStringArray(payload ? asRecord(payload).missing_fields : []);
  const slotsAmbiguity: DiscordSlotsAmbiguity | null = asSlotsAmbiguity(asRecord(asRecord(payload).table)._slots_ambiguity);

  return {
    form, setForm, updateForm,
    systems, systemsLoading,
    missingFields, canSync,
    syncing, reparsing,
    savingFields, savingStatus,
    editingStatus, setEditingStatus,
    newStatus, setNewStatus,
    reviewNotes, setReviewNotes,
    activeTab, setActiveTab,
    coverUploading, coverError,
    coverPreviewUrl, coverInputRef,
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
