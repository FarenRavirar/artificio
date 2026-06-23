import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import toast from 'react-hot-toast';
import type { DiscordCoverQuality, DiscordDraft, DiscordDraftPayload, DiscordDraftTablePayload, DiscordImportDraftStatus, DiscordSlotsAmbiguity, DraftApiOperations } from '../types';
import { discordSyncApi } from '../api/discordSyncApi';
import type { SystemTreeNode } from '../../../types/systems';

interface Props {
  draft: DiscordDraft;
  onUpdate: (updated: DiscordDraft) => void;
  onClose: () => void;
  api?: DraftApiOperations;
  onBeforeSync?: (draft: DiscordDraft) => Promise<{ tableId: string; created: boolean } | null>;
}

type DraftTableType = 'campanha' | 'one-shot' | 'oneshot-serie' | 'aberta';
type DraftModality = 'online' | 'presencial' | 'hibrida';
type DraftPriceType = 'gratuita' | 'paga';
type DraftDayOfWeek = 'segunda' | 'terça' | 'quarta' | 'quinta' | 'sexta' | 'sábado' | 'domingo';
type DraftFrequency = 'semanal' | 'quinzenal' | 'mensal' | 'avulsa' | 'outra';
type SlotsInterpretation = 'filled_total' | 'open_total';

interface DraftForm {
  title: string;
  description: string;
  system_id: string;
  system_name: string;
  type: DraftTableType;
  modality: DraftModality;
  price_type: DraftPriceType;
  price_value: string;
  slots_total: string;
  slots_open: string;
  day_of_week: '' | DraftDayOfWeek;
  start_time: string;
  frequency: DraftFrequency;
  contact_url: string;
  contact_discord: string;
  cover_url: string;
  cover_url_source: string;
  cover_quality: '' | DiscordCoverQuality;
}

const STATUS_OPTIONS: DiscordImportDraftStatus[] = ['draft', 'ready', 'needs_review', 'rejected'];
const API_BASE = import.meta.env.VITE_API_URL || '';
const MAX_COVER_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const COVER_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asNumberString(value: unknown): string {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : '';
}

function normalizePayload(value: unknown): DiscordDraftPayload {
  return isRecord(value) ? value : {};
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function asSlotsAmbiguity(value: unknown): DiscordSlotsAmbiguity | null {
  if (!isRecord(value)) return null;
  return typeof value.first === 'number' && typeof value.second === 'number' && value.source === 'x_slash_y'
    ? { first: value.first, second: value.second, source: 'x_slash_y' }
    : null;
}

function getDraftTable(payload: DiscordDraftPayload): DiscordDraftTablePayload {
  return isRecord(payload.table) ? payload.table : {};
}

function buildForm(payload: DiscordDraftPayload): DraftForm {
  const table = asRecord(payload.table);
  return {
    title: asString(table.title),
    description: asString(table.description),
    system_id: asString(table.system_id),
    system_name: asString(table.system_name) || asString(table.raw_system_hint),
    type: (asString(table.type) as DraftTableType) || 'campanha',
    modality: (asString(table.modality) as DraftModality) || 'online',
    price_type: (asString(table.price_type) as DraftPriceType) || 'gratuita',
    price_value: asNumberString(table.price_value),
    slots_total: asNumberString(table.slots_total),
    slots_open: asNumberString(table.slots_open),
    day_of_week: (asString(table.day_of_week) as DraftForm['day_of_week']) || '',
    start_time: asString(table.start_time),
    frequency: (asString(table.frequency) as DraftFrequency) || 'semanal',
    contact_url: asString(table.contact_url),
    contact_discord: asString(table.contact_discord),
    cover_url: asString(table.cover_url),
    cover_url_source: asString(table.cover_url_source),
    cover_quality: (asString(table.cover_quality) as DraftForm['cover_quality']) || '',
  };
}

function parseOptionalNonNegativeInt(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function parseOptionalMoney(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function validateForm(form: DraftForm): string[] {
  const missing: string[] = [];
  if (!form.title.trim()) missing.push('Título');
  if (!form.description.trim()) missing.push('Descrição');
  if (!form.system_id.trim()) missing.push('Sistema');
  if (!form.type.trim()) missing.push('Tipo');
  if (!form.modality.trim()) missing.push('Modalidade');
  if (!form.price_type.trim()) missing.push('Preço');
  if (parseOptionalNonNegativeInt(form.slots_total) == null && parseOptionalNonNegativeInt(form.slots_open) == null) missing.push('Vagas');
  if (!form.contact_url.trim() && !form.contact_discord.trim()) missing.push('Contato');
  if (!form.day_of_week) missing.push('Dia');
  if (!form.start_time.trim()) missing.push('Horário');
  if (form.frequency === 'outra') missing.push('Frequência');
  return missing;
}

function buildMissingFields(base: DiscordDraftPayload, form: DraftForm): string[] {
  const table = getDraftTable(base);
  const missing = new Set(asStringArray(base.missing_fields));
  const setByState = (field: string, isMissing: boolean) => {
    if (isMissing) missing.add(field);
    else missing.delete(field);
  };

  setByState('title', !form.title.trim());
  setByState('description', !form.description.trim());
  setByState('system_name', !form.system_id.trim() && !form.system_name.trim());
  setByState('system_name:unmatched_hint', !form.system_id.trim() && Boolean(table.raw_system_hint));
  setByState('type', !form.type.trim());
  setByState('modality', !form.modality.trim());
  setByState('price_type', !form.price_type.trim());
  setByState('slots_total', parseOptionalNonNegativeInt(form.slots_total) == null && parseOptionalNonNegativeInt(form.slots_open) == null);
  setByState('contact_url', !form.contact_url.trim() && !form.contact_discord.trim());
  setByState('day_of_week', !form.day_of_week);
  setByState('start_time', !form.start_time.trim());
  setByState('frequency', form.frequency === 'outra');

  return Array.from(missing);
}

function buildUpdatedPayload(base: DiscordDraftPayload, form: DraftForm): Record<string, unknown> {
  const baseTable = asRecord(base.table);
  const slotsTotal = parseOptionalNonNegativeInt(form.slots_total);
  const slotsOpen = parseOptionalNonNegativeInt(form.slots_open);
  const priceValue = parseOptionalMoney(form.price_value);
  const table = {
    ...baseTable,
    title: form.title.trim() || null,
    description: form.description.trim() || null,
    system_id: form.system_id.trim() || null,
    system_name: form.system_name.trim() || null,
    type: form.type,
    modality: form.modality,
    price_type: form.price_type,
    price_value: form.price_type === 'paga' ? priceValue : null,
    slots_total: slotsTotal,
    slots_open: slotsOpen ?? slotsTotal,
    day_of_week: form.day_of_week || null,
    start_time: form.start_time.trim() || null,
    frequency: form.frequency,
    contact_url: form.contact_url.trim() || null,
    contact_discord: form.contact_discord.trim() || null,
    cover_url: form.cover_url.trim() || null,
    cover_url_source: form.cover_url_source.trim() || null,
    cover_quality: form.cover_quality || null,
  };

  return {
    ...base,
    kind: base.kind ?? 'table_draft',
    source: asRecord(base.source),
    table,
    missing_fields: buildMissingFields(base, form),
  };
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function flattenSystems(nodes: SystemTreeNode[]): SystemTreeNode[] {
  const result: SystemTreeNode[] = [];
  const walk = (items: SystemTreeNode[]) => {
    for (const node of items) {
      result.push(node);
      if (Array.isArray(node.children)) walk(node.children);
    }
  };
  walk(nodes);
  return result;
}

async function loadSystems(): Promise<SystemTreeNode[]> {
  const res = await fetch(`${API_BASE}/api/v1/systems?view=tree`, { credentials: 'include' });
  const json: unknown = await res.json();
  if (!res.ok) throw new Error('Erro ao carregar sistemas.');
  const data = asRecord(json).data;
  return Array.isArray(data) ? data.filter(isRecord) as unknown as SystemTreeNode[] : [];
}

export function DiscordDraftPreview({ draft, onUpdate, onClose, api, onBeforeSync }: Props) {
  const draftApi = api ?? discordSyncApi;
  const initialPayload = useMemo(
    () => normalizePayload(draft.normalized_payload ?? draft.parsed_payload),
    [draft.normalized_payload, draft.parsed_payload]
  );
  const [form, setForm] = useState<DraftForm>(() => buildForm(initialPayload));
  const [systems, setSystems] = useState<SystemTreeNode[]>([]);
  const [systemsLoading, setSystemsLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [reparsing, setReparsing] = useState(false);
  const [editingStatus, setEditingStatus] = useState(false);
  const [newStatus, setNewStatus] = useState<DiscordImportDraftStatus>(draft.status);
  const [reviewNotes, setReviewNotes] = useState(draft.review_notes ?? '');
  const [savingStatus, setSavingStatus] = useState(false);
  const [savingFields, setSavingFields] = useState(false);
  const [activeTab, setActiveTab] = useState<'editor' | 'parsed' | 'normalized'>('editor');
  const [coverUploading, setCoverUploading] = useState(false);
  const [coverError, setCoverError] = useState<string | null>(null);
  const [slotsInterpretation, setSlotsInterpretation] = useState<SlotsInterpretation>('filled_total');
  const coverInputRef = useRef<HTMLInputElement | null>(null);

  // Sincroniza os campos com o draft/payload — ajuste durante o render (sem effect).
  const syncKey = `${draft.id}|${draft.status}|${draft.review_notes ?? ''}`;
  const [prevSync, setPrevSync] = useState({ syncKey, initialPayload });
  if (prevSync.syncKey !== syncKey || prevSync.initialPayload !== initialPayload) {
    setPrevSync({ syncKey, initialPayload });
    setForm(buildForm(initialPayload));
    setNewStatus(draft.status);
    setReviewNotes(draft.review_notes ?? '');
  }

  useEffect(() => {
    let cancelled = false;
    // setState deferido p/ fora do corpo síncrono do effect.
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
    return () => {
      cancelled = true;
    };
  }, []);

  const missingFields = validateForm(form);
  const canSync = draft.status === 'ready' && missingFields.length === 0;
  const selectedPayload = activeTab === 'parsed' ? draft.parsed_payload : (draft.normalized_payload ?? draft.parsed_payload);
  const tablePayload = getDraftTable(initialPayload);
  const payloadMissingFields = asStringArray(initialPayload.missing_fields);
  const slotsAmbiguity = asSlotsAmbiguity(tablePayload._slots_ambiguity);
  const shouldShowSlotsDisambiguation = Boolean(slotsAmbiguity && payloadMissingFields.includes('slots_open:ambiguous_x_of_y'));
  const coverPreviewUrl = form.cover_url.trim() || form.cover_url_source.trim();

  const updateForm = <K extends keyof DraftForm>(key: K, value: DraftForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSystemChange = (systemId: string) => {
    const selected = systems.find((system) => system.id === systemId);
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
        normalized_payload: buildUpdatedPayload(initialPayload, form),
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
      const apiBase = API_BASE.replace(/\/api\/v1$/, '');
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
    } catch (err) {
      setCoverError(err instanceof Error ? err.message : 'Erro ao substituir capa.');
    } finally {
      setCoverUploading(false);
    }
  };

  const handleRemoveCover = () => {
    setCoverError(null);
    setForm((prev) => ({ ...prev, cover_url: '', cover_url_source: '', cover_quality: '' }));
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
      const basePayload = buildUpdatedPayload(initialPayload, nextForm);
      const baseTable = asRecord(basePayload.table);
      const missing = asStringArray(basePayload.missing_fields).filter((field) => field !== 'slots_open:ambiguous_x_of_y' && field !== 'slots_total');
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

  const handleSync = async () => {
    setSyncing(true);
    try {
      if (onBeforeSync) {
        const beforeResult = await onBeforeSync(draft);
        if (beforeResult) {
          toast.success(`Mesa ${beforeResult.created ? 'criada' : 'atualizada'}: ${beforeResult.tableId}`);
          const updated = draftApi.getDraft
            ? await draftApi.getDraft(draft.id)
            : await discordSyncApi.getDraft(draft.id);
          onUpdate(updated);
          return;
        }
      }

      const result = await draftApi.syncDraft(draft.id);
      toast.success(`Mesa ${result.created ? 'criada' : 'atualizada'}: ${result.tableId}`);
      const updated = draftApi.getDraft
        ? await draftApi.getDraft(draft.id)
        : await discordSyncApi.getDraft(draft.id);
      onUpdate(updated);
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

  const tabClass = (tab: typeof activeTab) =>
    `px-3 py-1 text-xs rounded-lg transition-colors ${
      activeTab === tab ? 'bg-blue-600 text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'
    }`;

  const inputClass = 'w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/30';
  const labelClass = 'block text-white/60 text-xs mb-1';

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
          {editingStatus ? (
            <>
              <select value={newStatus} onChange={(e) => setNewStatus(e.target.value as DiscordImportDraftStatus)} className="app-select py-1">
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
              <input
                placeholder="Notas de revisão..."
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                className="flex-1 px-2 py-1 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/30"
              />
              <button onClick={handleSaveStatus} disabled={savingStatus} className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg disabled:opacity-50">
                {savingStatus ? '...' : 'Salvar'}
              </button>
              <button onClick={() => setEditingStatus(false)} className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg">
                Cancelar
              </button>
            </>
          ) : (
            <>
              <span className="text-white/60 text-sm">Status:</span>
              <span className="text-white text-sm font-medium">
                {canSync ? 'Pronto' : draft.status === 'synced' ? 'Sincronizado' : draft.status === 'rejected' ? 'Rejeitado' : 'Revisar'}
              </span>
              {draft.status === 'ready' && !canSync && (
                <span className="text-amber-300 text-xs">({missingFields.length} pendência{missingFields.length === 1 ? '' : 's'})</span>
              )}
              {draft.confidence != null && <span className="text-white/40 text-xs">confiança: {(draft.confidence * 100).toFixed(0)}%</span>}
              <button onClick={() => setEditingStatus(true)} className="ml-auto px-2 py-1 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-xs rounded-lg transition-colors">
                Editar status
              </button>
            </>
          )}
        </div>

        <div className="flex gap-2 px-5 pt-3">
          <button className={tabClass('editor')} onClick={() => setActiveTab('editor')}>Campos</button>
          <button className={tabClass('normalized')} onClick={() => setActiveTab('normalized')}>Normalizado</button>
          <button className={tabClass('parsed')} onClick={() => setActiveTab('parsed')}>Bruto</button>
        </div>

        <div className="flex-1 overflow-auto px-5 py-3">
          {activeTab === 'editor' ? (
            <div className="space-y-4">
              {missingFields.length > 0 && (
                <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-amber-100 text-sm">
                  Campos pendentes: {missingFields.join(', ')}
                </div>
              )}

              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <div className="flex items-start gap-3">
                  <div className="h-24 w-40 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-black/30">
                    {coverPreviewUrl ? (
                      <img src={coverPreviewUrl} alt="Capa do draft" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-white/30">Sem capa</div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="text-sm font-medium text-white">Capa</span>
                      {form.cover_quality === 'low' && <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-200">baixa resolução</span>}
                    </div>
                    <p className="truncate text-xs text-white/50">{coverPreviewUrl || 'Nenhuma imagem associada.'}</p>
                    {coverError && <p className="mt-1 text-xs text-red-300">{coverError}</p>}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <input ref={coverInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleCoverUpload} className="hidden" />
                      <button type="button" onClick={() => coverInputRef.current?.click()} disabled={coverUploading} className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs rounded-lg transition-colors disabled:opacity-50">
                        {coverUploading ? 'Enviando...' : 'Substituir'}
                      </button>
                      {coverPreviewUrl && (
                        <button type="button" onClick={handleRemoveCover} className="px-3 py-1.5 bg-red-500/15 hover:bg-red-500/25 text-red-100 text-xs rounded-lg transition-colors">
                          Remover
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {shouldShowSlotsDisambiguation && slotsAmbiguity && (
                <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-50">
                  <p className="font-medium">Como interpretar {slotsAmbiguity.first}/{slotsAmbiguity.second} deste post?</p>
                  <div className="mt-3 space-y-2">
                    <label className="flex items-center gap-2">
                      <input type="radio" checked={slotsInterpretation === 'filled_total'} onChange={() => setSlotsInterpretation('filled_total')} className="accent-amber-400" />
                      <span>{slotsAmbiguity.first} inscritos / {Math.max(slotsAmbiguity.first, slotsAmbiguity.second)} total</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="radio" checked={slotsInterpretation === 'open_total'} onChange={() => setSlotsInterpretation('open_total')} className="accent-amber-400" />
                      <span>{slotsAmbiguity.first} disponíveis / {Math.max(slotsAmbiguity.first, slotsAmbiguity.second)} máximo</span>
                    </label>
                  </div>
                  <button type="button" onClick={handleConfirmSlots} disabled={savingFields} className="mt-3 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-medium rounded-lg transition-colors disabled:opacity-50">
                    Confirmar
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label>
                  <span className={labelClass}>Título</span>
                  <input value={form.title} onChange={(e) => updateForm('title', e.target.value)} className={inputClass} />
                </label>
                <label>
                  <span className={labelClass}>Sistema</span>
                  <select value={form.system_id} onChange={(e) => handleSystemChange(e.target.value)} className="app-select w-full">
                    <option value="">{systemsLoading ? 'Carregando sistemas...' : 'Selecione um sistema'}</option>
                    {systems.map((system) => (
                      <option key={system.id} value={system.id}>{system.name_pt || system.name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className={labelClass}>Tipo</span>
                  <select value={form.type} onChange={(e) => updateForm('type', e.target.value as DraftTableType)} className="app-select w-full">
                    <option value="campanha">Campanha</option>
                    <option value="one-shot">One-shot</option>
                    <option value="oneshot-serie">Série de one-shots</option>
                    <option value="aberta">Aberta</option>
                  </select>
                </label>
                <label>
                  <span className={labelClass}>Modalidade</span>
                  <select value={form.modality} onChange={(e) => updateForm('modality', e.target.value as DraftModality)} className="app-select w-full">
                    <option value="online">Online</option>
                    <option value="presencial">Presencial</option>
                    <option value="hibrida">Híbrida</option>
                  </select>
                </label>
                <label>
                  <span className={labelClass}>Preço</span>
                  <select value={form.price_type} onChange={(e) => updateForm('price_type', e.target.value as DraftPriceType)} className="app-select w-full">
                    <option value="gratuita">Gratuita</option>
                    <option value="paga">Paga</option>
                  </select>
                </label>
                <label>
                  <span className={labelClass}>Valor</span>
                  <input value={form.price_value} onChange={(e) => updateForm('price_value', e.target.value)} className={inputClass} placeholder="0" disabled={form.price_type === 'gratuita'} />
                </label>
                <label>
                  <span className={labelClass}>Vagas totais</span>
                  <input value={form.slots_total} onChange={(e) => updateForm('slots_total', e.target.value)} className={inputClass} inputMode="numeric" />
                </label>
                <label>
                  <span className={labelClass}>Vagas abertas</span>
                  <input value={form.slots_open} onChange={(e) => updateForm('slots_open', e.target.value)} className={inputClass} inputMode="numeric" />
                </label>
                <label>
                  <span className={labelClass}>Dia</span>
                  <select value={form.day_of_week} onChange={(e) => updateForm('day_of_week', e.target.value as DraftForm['day_of_week'])} className="app-select w-full">
                    <option value="">Selecione</option>
                    <option value="segunda">Segunda</option>
                    <option value="terça">Terça</option>
                    <option value="quarta">Quarta</option>
                    <option value="quinta">Quinta</option>
                    <option value="sexta">Sexta</option>
                    <option value="sábado">Sábado</option>
                    <option value="domingo">Domingo</option>
                  </select>
                </label>
                <label>
                  <span className={labelClass}>Horário</span>
                  <input value={form.start_time} onChange={(e) => updateForm('start_time', e.target.value)} className={inputClass} placeholder="19:00" />
                </label>
                <label>
                  <span className={labelClass}>Frequência</span>
                  <select value={form.frequency} onChange={(e) => updateForm('frequency', e.target.value as DraftFrequency)} className="app-select w-full">
                    <option value="semanal">Semanal</option>
                    <option value="quinzenal">Quinzenal</option>
                    <option value="mensal">Mensal</option>
                    <option value="avulsa">Única</option>
                    <option value="outra">Outra</option>
                  </select>
                </label>
                <label>
                  <span className={labelClass}>Contato Discord</span>
                  <input value={form.contact_discord} onChange={(e) => updateForm('contact_discord', e.target.value)} className={inputClass} />
                </label>
                <label className="md:col-span-2">
                  <span className={labelClass}>Link de inscrição/contato</span>
                  <input value={form.contact_url} onChange={(e) => updateForm('contact_url', e.target.value)} className={inputClass} />
                </label>
                <label className="md:col-span-2">
                  <span className={labelClass}>Descrição</span>
                  <textarea value={form.description} onChange={(e) => updateForm('description', e.target.value)} className={`${inputClass} min-h-28 resize-y`} />
                </label>
              </div>
            </div>
          ) : (
            <pre className="text-xs text-green-300 bg-black/30 rounded-lg p-4 overflow-auto whitespace-pre-wrap break-words">
              {JSON.stringify(selectedPayload, null, 2)}
            </pre>
          )}
        </div>

        {draft.review_notes && !editingStatus && (
          <div className="px-5 py-2 border-t border-white/10">
            <p className="text-white/50 text-xs">Notas: {draft.review_notes}</p>
          </div>
        )}

        <div className="px-5 py-4 border-t border-white/10 flex flex-wrap gap-2 justify-end">
          <button onClick={handleReparse} disabled={reparsing} className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg transition-colors disabled:opacity-40">
            {reparsing ? 'Reparseando...' : 'Reparsar'}
          </button>
          <button onClick={handleSaveFields} disabled={savingFields} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors disabled:opacity-50">
            {savingFields ? 'Salvando...' : 'Salvar campos'}
          </button>
          <button
            onClick={handleSync}
            disabled={!canSync || syncing}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors disabled:opacity-40"
            title={!canSync ? 'Salve todos os campos obrigatórios e deixe o draft como ready.' : undefined}
          >
            {syncing ? 'Sincronizando...' : 'Sincronizar como mesa'}
          </button>
          {draft.status === 'synced' && draft.table_id && <span className="text-green-400 text-sm self-center">Mesa: {draft.table_id}</span>}
        </div>
      </div>
    </div>
  );
}
