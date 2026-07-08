import { z } from 'zod';
import { authGet } from '../../services/apiClient';
import type { DiscordCoverQuality, DiscordDraftPayload, DiscordDraftTablePayload, DiscordSlotsAmbiguity } from './types';
import type { SystemTreeNode } from '../../types/systems';

export type DraftTableType = 'campanha' | 'one-shot' | 'oneshot-serie' | 'aberta';
export type DraftModality = 'online' | 'presencial' | 'hibrida';
export type DraftPriceType = 'gratuita' | 'paga';

// Espelha VALID_TABLE_TYPES/VALID_MODALITIES/VALID_PRICE_TYPES do backend
// (apps/mesas/backend/src/discord/syncHelpers.ts). Achado do mantenedor
// (2026-07-08): validateForm só checava .trim() truthy, não pertencimento ao
// enum — draft com valor fora da whitelist (correção manual, campo de outro
// parser, etc) passava no frontend como "Pronto" e só travava no sync com 422
// "type, price_type" sem indicar o valor inválido nem como corrigir.
const VALID_TABLE_TYPES: ReadonlySet<DraftTableType> = new Set(['campanha', 'one-shot', 'oneshot-serie', 'aberta']);
const VALID_MODALITIES: ReadonlySet<DraftModality> = new Set(['online', 'presencial', 'hibrida']);
const VALID_PRICE_TYPES: ReadonlySet<DraftPriceType> = new Set(['gratuita', 'paga']);
export type DraftDayOfWeek = 'segunda' | 'terça' | 'quarta' | 'quinta' | 'sexta' | 'sábado' | 'domingo';
export type DraftFrequency = 'semanal' | 'quinzenal' | 'mensal' | 'avulsa' | 'outra';
// Espelha VALID_DAYS do backend (mesmo motivo do bloco acima) — day_of_week
// sujo (fora do enum) travava sync como "day_of_week" sem explicação.
const VALID_DAYS: ReadonlySet<DraftDayOfWeek> = new Set(['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo']);
// Espelha isValidTime (TIME_REGEX) do backend — start_time é <input> de texto
// livre no editor (sem type="time"), então "19h"/"as 19" passava no front
// (.trim() truthy) e travava no sync (regex HH:MM do backend rejeita).
const TIME_REGEX = /^\d{2}:\d{2}(:\d{2})?$/;
function isValidTimeString(v: string): boolean {
  const trimmed = v.trim();
  const m = TIME_REGEX.exec(trimmed);
  if (!m) return false;
  const [h, min] = m[0].split(':').map(Number);
  return h >= 0 && h <= 23 && min >= 0 && min <= 59;
}
/** Fase D (spec 058): mesmos enums do draft (backend `types.ts`). */
// Formato do enum Postgres real: `+18` (sinal ANTES do número). `18+` invertido
// causou 500 "invalid input value for enum age_rating" no sync (2026-07-08).
// VALID_AGE_RATINGS (achado CodeRabbit PR #135): única fonte pro union type,
// options do select e validador de legado — evita 3 listas divergirem de novo.
export const VALID_AGE_RATINGS = ['livre', '+10', '+12', '+14', '+16', '+18'] as const;
export type DraftAgeRating = (typeof VALID_AGE_RATINGS)[number];
export type DraftExperienceLevel = 'todos' | 'iniciante' | 'intermediario' | 'veterano';
export type DraftTableLevel = 'iniciante' | 'intermediario' | 'avancado';

export interface DraftForm {
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
  /** Fase D (spec 058): campos novos de auto-preenchimento — ver auto-preenchimento-draft.md. */
  age_rating: '' | DraftAgeRating;
  experience_level: '' | DraftExperienceLevel;
  table_level: '' | DraftTableLevel;
  setting_name: string;
  setting_styles: string;
  requires_pc: boolean;
  requires_camera: boolean;
  requires_microphone: boolean;
  session_zero_free: boolean;
  /** Pendência 2 (spec 058): FKs de cenário/VTT/comunicação — editáveis via combobox com busca. */
  scenario_id: string;
  vtt_platform_id: string;
  communication_platform_id: string;
}

export type DraftFieldKey = keyof Pick<DraftForm,
  | 'title'
  | 'description'
  | 'system_name'
  | 'type'
  | 'modality'
  | 'price_type'
  | 'price_value'
  | 'slots_total'
  | 'slots_open'
  | 'day_of_week'
  | 'start_time'
  | 'frequency'
  | 'contact_url'
  | 'contact_discord'
  | 'cover_url'
>;

export interface DraftFieldInsight {
  source: 'parser' | 'learning-store' | 'deepseek' | 'humano';
  evidence: string[];
  suggestion?: unknown;
  provider?: string;
  model?: string;
}

export const MAX_COVER_FILE_SIZE_BYTES = 5 * 1024 * 1024;
export const COVER_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

export function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function asNumberString(value: unknown): string {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : '';
}

export function normalizePayload(value: unknown): DiscordDraftPayload {
  return isRecord(value) ? value : {};
}

export function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

export function asSlotsAmbiguity(value: unknown): DiscordSlotsAmbiguity | null {
  if (!isRecord(value)) return null;
  return typeof value.first === 'number' && typeof value.second === 'number' && value.source === 'x_slash_y'
    ? { first: value.first, second: value.second, source: 'x_slash_y' }
    : null;
}

export function getDraftTable(payload: DiscordDraftPayload): DiscordDraftTablePayload {
  return isRecord(payload.table) ? payload.table : {};
}

function isFilled(value: unknown): boolean {
  return value !== null && value !== undefined && value !== '';
}

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

function classifySuggestionProvider(provider: string): DraftFieldInsight['source'] {
  const normalized = provider.toLowerCase();
  return normalized.includes('learning') ? 'learning-store' : 'deepseek';
}

function addEvidence(insights: Partial<Record<DraftFieldKey, DraftFieldInsight>>, field: DraftFieldKey, text: string) {
  const existing = insights[field] ?? { source: 'parser', evidence: [] };
  if (!existing.evidence.includes(text)) existing.evidence.push(text);
  insights[field] = existing;
}

const INSIGHT_FIELDS = [
  'title', 'description', 'system_name', 'type', 'modality', 'price_type',
  'price_value', 'slots_total', 'slots_open', 'day_of_week', 'start_time',
  'frequency', 'contact_url', 'contact_discord', 'cover_url',
] as const satisfies readonly DraftFieldKey[];

const INSIGHT_FIELD_SET = new Set<DraftFieldKey>(INSIGHT_FIELDS);

function addParserAndHumanInsights(
  insights: Partial<Record<DraftFieldKey, DraftFieldInsight>>,
  parsedTable: DiscordDraftTablePayload,
  currentTable: DiscordDraftTablePayload,
) {
  for (const field of INSIGHT_FIELDS) {
    if (isFilled(currentTable[field])) {
      insights[field] = { source: 'parser', evidence: ['Valor extraído do anúncio.'] };
    }
    if (!sameValue(parsedTable[field], currentTable[field]) && isFilled(currentTable[field])) {
      insights[field] = { source: 'humano', evidence: ['Valor alterado na revisão.'] };
    }
  }
}

function addSuggestionInsights(
  insights: Partial<Record<DraftFieldKey, DraftFieldInsight>>,
  currentTable: DiscordDraftTablePayload,
) {
  const aiSuggestions = asRecord(currentTable._ai_suggestions);
  const suggestionFields = asRecord(aiSuggestions.fields);
  const provider = asString(aiSuggestions.provider);
  const model = asString(aiSuggestions.model);
  if (!provider || Object.keys(suggestionFields).length === 0) return;

  for (const [field, suggestion] of Object.entries(suggestionFields)) {
    if (!INSIGHT_FIELD_SET.has(field as DraftFieldKey)) continue;
    insights[field as DraftFieldKey] = {
      source: classifySuggestionProvider(provider),
      provider,
      model: model || undefined,
      suggestion,
      evidence: [`Sugestão pendente de ${provider}.`],
    };
  }
}

function addConfirmedSuggestionInsights(
  insights: Partial<Record<DraftFieldKey, DraftFieldInsight>>,
  currentTable: DiscordDraftTablePayload,
) {
  const confirmed = asRecord(currentTable._ai_suggestions_confirmed);
  for (const [field, metadata] of Object.entries(confirmed)) {
    if (!INSIGHT_FIELD_SET.has(field as DraftFieldKey) || !isRecord(metadata)) continue;
    const provider = asString(metadata.provider);
    const model = asString(metadata.model);
    insights[field as DraftFieldKey] = {
      source: classifySuggestionProvider(provider || 'deepseek'),
      provider: provider || undefined,
      model: model || undefined,
      suggestion: metadata.value,
      evidence: [`Sugestão ${provider || 'IA'} confirmada pelo humano.`],
    };
  }
}

function addRawEvidenceInsights(
  insights: Partial<Record<DraftFieldKey, DraftFieldInsight>>,
  currentTable: DiscordDraftTablePayload,
) {
  const evidence = asRecord(currentTable._raw_evidence);
  const roleMentions = asStringArray(evidence.role_mentions);
  const userMentions = asStringArray(evidence.user_mentions);
  const attachments = Array.isArray(evidence.attachments) ? evidence.attachments : [];
  const embeds = Array.isArray(evidence.embeds) ? evidence.embeds : [];
  if (roleMentions.length > 0) addEvidence(insights, 'system_name', `${roleMentions.length} cargo(s) preservado(s) como evidência.`);
  if (userMentions.length > 0) addEvidence(insights, 'contact_discord', `${userMentions.length} menção(ões) de usuário no anúncio.`);
  if (attachments.length > 0) addEvidence(insights, 'cover_url', `${attachments.length} anexo(s) preservado(s).`);
  if (embeds.length > 0) addEvidence(insights, 'contact_url', `${embeds.length} embed(s) preservado(s).`);
}

export function buildDraftFieldInsights(
  parsedPayload: DiscordDraftPayload,
  currentPayload: DiscordDraftPayload,
): Partial<Record<DraftFieldKey, DraftFieldInsight>> {
  const parsedTable = getDraftTable(parsedPayload);
  const currentTable = getDraftTable(currentPayload);
  const insights: Partial<Record<DraftFieldKey, DraftFieldInsight>> = {};

  addParserAndHumanInsights(insights, parsedTable, currentTable);
  addSuggestionInsights(insights, currentTable);
  addConfirmedSuggestionInsights(insights, currentTable);
  addRawEvidenceInsights(insights, currentTable);

  return insights;
}

// Espelha normalizeAgeRating do backend (syncHelpers.ts) — converte o formato
// legado invertido `NN+` pro enum real `+NN`; valor irreconhecível vira ''.
// Exportada (achado CodeRabbit PR #135): mapAuditCandidateToForm também
// precisa normalizar — sugestão de auditoria com valor legado `18+` não
// casava nenhuma <option> do select, reproduzindo o mesmo bug por outro caminho.
export function normalizeLegacyAgeRating(value: string): string {
  const trimmed = value.trim();
  if ((VALID_AGE_RATINGS as readonly string[]).includes(trimmed)) return trimmed;
  const inverted = /^(\d{2})\+$/.exec(trimmed);
  return inverted ? `+${inverted[1]}` : '';
}

export function buildForm(payload: DiscordDraftPayload): DraftForm {
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
    // normalizeLegacyAgeRating: drafts antigos gravaram `18+` (formato invertido
    // pré-fix 2026-07-08); sem normalizar, o select não casa nenhuma option.
    age_rating: (normalizeLegacyAgeRating(asString(table.age_rating)) as DraftForm['age_rating']) || '',
    experience_level: (asString(table.experience_level) as DraftForm['experience_level']) || '',
    table_level: (asString(table.table_level) as DraftForm['table_level']) || '',
    setting_name: asString(table.setting_name),
    setting_styles: asStringArray(table.setting_styles).join(', '),
    requires_pc: table.requires_pc === true,
    requires_camera: table.requires_camera === true,
    requires_microphone: table.requires_microphone === true,
    session_zero_free: table.session_zero_free === true,
    scenario_id: asString(table.scenario_id),
    vtt_platform_id: asString(table.vtt_platform_id),
    communication_platform_id: asString(table.communication_platform_id),
  };
}

export function parseOptionalNonNegativeInt(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

export function parseOptionalMoney(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function validateForm(form: DraftForm, hostDiscordId?: string | null): string[] {
  const missing: string[] = [];
  if (!form.title.trim()) missing.push('Título');
  if (!form.description.trim()) missing.push('Descrição');
  if (!form.system_id.trim()) missing.push('Sistema');
  if (!VALID_TABLE_TYPES.has(form.type)) missing.push('Tipo');
  if (!VALID_MODALITIES.has(form.modality)) missing.push('Modalidade');
  if (!VALID_PRICE_TYPES.has(form.price_type)) missing.push('Preço');
  if (parseOptionalNonNegativeInt(form.slots_total) == null && parseOptionalNonNegativeInt(form.slots_open) == null) missing.push('Vagas');
  // Contato tambem e satisfeito por host_discord_id (autor Discord do anuncio),
  // igual ao backend (validateDraftForSync em syncHelpers.ts) — nao e editavel no
  // form, so preenchido automaticamente pelo parser.
  if (!form.contact_url.trim() && !form.contact_discord.trim() && !hostDiscordId?.trim()) missing.push('Contato');
  if (!form.day_of_week || !VALID_DAYS.has(form.day_of_week)) missing.push('Dia');
  if (!isValidTimeString(form.start_time)) missing.push('Horário');
  if (form.frequency === 'outra') missing.push('Frequência');
  return missing;
}

export function buildMissingFields(base: DiscordDraftPayload, form: DraftForm): string[] {
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
  setByState('type', !VALID_TABLE_TYPES.has(form.type));
  setByState('modality', !VALID_MODALITIES.has(form.modality));
  setByState('price_type', !VALID_PRICE_TYPES.has(form.price_type));
  setByState('slots_total', parseOptionalNonNegativeInt(form.slots_total) == null && parseOptionalNonNegativeInt(form.slots_open) == null);
  setByState('contact_url', !form.contact_url.trim() && !form.contact_discord.trim() && !table.host_discord_id?.trim());
  setByState('day_of_week', !form.day_of_week || !VALID_DAYS.has(form.day_of_week));
  setByState('start_time', !isValidTimeString(form.start_time));
  setByState('frequency', form.frequency === 'outra');

  return Array.from(missing);
}

export function buildUpdatedPayload(base: DiscordDraftPayload, form: DraftForm): Record<string, unknown> {
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
    age_rating: form.age_rating || null,
    experience_level: form.experience_level || null,
    table_level: form.table_level || null,
    setting_name: form.setting_name.trim() || null,
    setting_styles: form.setting_styles.trim()
      ? form.setting_styles.split(',').map((s) => s.trim()).filter(Boolean)
      : null,
    requires_pc: form.requires_pc,
    requires_camera: form.requires_camera,
    requires_microphone: form.requires_microphone,
    session_zero_free: form.session_zero_free,
    scenario_id: form.scenario_id || null,
    vtt_platform_id: form.vtt_platform_id || null,
    communication_platform_id: form.communication_platform_id || null,
  };
  const pendingSuggestions = asRecord(asRecord(baseTable._ai_suggestions).fields);
  const suggestionProvider = asString(asRecord(baseTable._ai_suggestions).provider);
  const suggestionModel = asString(asRecord(baseTable._ai_suggestions).model);
  const confirmedSuggestions = { ...asRecord(baseTable._ai_suggestions_confirmed) };
  for (const field of INSIGHT_FIELDS) {
    if (!(field in pendingSuggestions)) continue;
    if (sameValue((table as Record<string, unknown>)[field], pendingSuggestions[field])) {
      confirmedSuggestions[field] = {
        provider: suggestionProvider || 'deepseek',
        model: suggestionModel || null,
        value: pendingSuggestions[field],
        confirmed_at: new Date().toISOString(),
      };
    } else {
      // Achado CodeRabbit (PR #128): humano confirmou a sugestao antes, mas
      // editou o campo pra outro valor depois — a confirmacao antiga nao
      // reflete mais o valor atual. Sem isso, addConfirmedSuggestionInsights
      // mostrava "DeepSeek confirmado" com valor divergente do campo real.
      delete confirmedSuggestions[field];
    }
  }
  if (Object.keys(confirmedSuggestions).length > 0) {
    (table as Record<string, unknown>)._ai_suggestions_confirmed = confirmedSuggestions;
  }

  return {
    ...base,
    kind: base.kind ?? 'table_draft',
    source: asRecord(base.source),
    table,
    missing_fields: buildMissingFields(base, form),
  };
}

/**
 * Achado do mantenedor (2026-07-08): a auditoria de completude só IMPRIMIA os
 * candidatos — sem botão de aplicar, o relatório não servia pra nada ("ele ta
 * falando o que eu já poderia saber"). Mapeia candidate.field (nome do campo
 * no payload da table) pra atualização aplicável no DraftForm. Retorna null
 * pra campo que não existe no form (ex.: _notes, end_time, slots_filled) —
 * a UI mostra o candidato sem botão nesses casos.
 */
export function mapAuditCandidateToForm(
  field: string,
  value: unknown,
): { key: keyof DraftForm; value: DraftForm[keyof DraftForm] } | null {
  const asText = (): string => {
    if (value === null || value === undefined) return '';
    if (Array.isArray(value)) return value.filter((v) => typeof v === 'string').join(', ');
    // Achado CodeRabbit PR #135: objeto não tratado caía em String(value) =
    // "[object Object]" — candidato malformado do backend não deve aplicar
    // lixo no form; string/number/boolean são os únicos tipos esperados aqui.
    if (typeof value === 'object') return '';
    return String(value);
  };
  switch (field) {
    case 'title':
    case 'description':
    case 'setting_name':
    case 'start_time':
    case 'contact_url':
    case 'contact_discord':
    case 'system_name':
    case 'setting_styles':
      return { key: field, value: asText() };
    case 'slots_total':
    case 'slots_open':
    case 'price_value':
      return { key: field, value: asText() };
    // Selects de enum: aplica como veio; valor fora do enum é pego por
    // validateForm (fica precisamente visível como pendência, não silencioso).
    case 'type':
      return { key: 'type', value: asText() as DraftTableType };
    case 'modality':
      return { key: 'modality', value: asText() as DraftModality };
    case 'price_type':
      return { key: 'price_type', value: asText() as DraftPriceType };
    case 'day_of_week':
      return { key: 'day_of_week', value: asText() as DraftForm['day_of_week'] };
    case 'frequency':
      return { key: 'frequency', value: asText() as DraftFrequency };
    case 'age_rating':
      // normalizeLegacyAgeRating (achado CodeRabbit PR #135): sugestão de
      // auditoria em formato legado `18+` não casaria nenhuma <option>.
      return { key: 'age_rating', value: normalizeLegacyAgeRating(asText()) as DraftForm['age_rating'] };
    case 'experience_level':
      return { key: 'experience_level', value: asText() as DraftForm['experience_level'] };
    case 'table_level':
      return { key: 'table_level', value: asText() as DraftForm['table_level'] };
    case 'requires_pc':
    case 'requires_camera':
    case 'requires_microphone':
    case 'session_zero_free':
      return { key: field, value: value === true };
    default:
      return null;
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function flattenSystems(nodes: SystemTreeNode[]): SystemTreeNode[] {
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

const systemTreeNodeSchema: z.ZodType<SystemTreeNode> = z.lazy(() => z.object({
  id: z.string(),
  name: z.string(),
  name_pt: z.string().nullable(),
  slug: z.string(),
  parent_id: z.string().nullable(),
  node_type: z.enum(['system', 'edition', 'variant', 'subsystem']),
  depth: z.number().optional(),
  path_slug: z.string().nullable(),
  aliases: z.array(z.string()).optional(),
  has_children: z.boolean().optional(),
  children: z.array(systemTreeNodeSchema).optional(),
}));

function normalizeSystemTreeNode(raw: unknown): SystemTreeNode {
  const parsed = systemTreeNodeSchema.safeParse(raw);
  if (!parsed.success) throw new Error('Resposta de sistemas em formato inesperado.');
  return parsed.data;
}

function normalizeSystemTree(raw: unknown): SystemTreeNode[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    try { return normalizeSystemTreeNode(item); }
    catch { return null; }
  }).filter((x): x is SystemTreeNode => x !== null);
}

// TTL curto: catálogo pode mudar durante a sessão SPA (outro admin cadastra
// sistema novo); sem isso o cache serviria lista desatualizada indefinidamente.
const CATALOG_CACHE_TTL_MS = 5 * 60 * 1000;

// forceRefresh (2026-07-08): após criar sistema novo via SystemSuggestionModal
// no editor de draft, o cache de 5min serviria a árvore antiga sem o sistema
// recém-criado — sem opção de invalidar, o combobox só mostraria o novo
// sistema depois do TTL expirar sozinho.
export async function loadSystems(forceRefresh = false): Promise<SystemTreeNode[]> {
  if (forceRefresh || !systemsCache || Date.now() - systemsCacheLoadedAt > CATALOG_CACHE_TTL_MS) {
    systemsCacheLoadedAt = Date.now();
    systemsCache = fetchSystems().catch((error) => {
      systemsCache = null;
      throw error;
    });
  }
  return systemsCache;
}

let systemsCache: Promise<SystemTreeNode[]> | null = null;
let systemsCacheLoadedAt = 0;

async function fetchSystems(): Promise<SystemTreeNode[]> {
  const res = await authGet('/api/v1/systems?view=tree');
  if (!res.ok) throw new Error('Erro ao carregar sistemas.');
  const json: unknown = await res.json();
  const data = asRecord(json).data;
  return normalizeSystemTree(data);
}

/**
 * Fase D (spec 058) — item de catálogo simples (cenário, VTT, comunicação): sem
 * árvore/aliases, só id+nome pra select com busca (mesmo padrão de SystemSearchSelect).
 */
export interface SimpleCatalogEntry {
  id: string;
  name: string;
}

const simpleCatalogEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
});

function normalizeSimpleCatalog(raw: unknown): SimpleCatalogEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const parsed = simpleCatalogEntrySchema.safeParse(item);
    return parsed.success ? parsed.data : null;
  }).filter((x): x is SimpleCatalogEntry => x !== null);
}

const simpleCatalogCache = new Map<string, { promise: Promise<SimpleCatalogEntry[]>; loadedAt: number }>();

function createSimpleCatalogLoader(endpoint: string, errorMessage: string): () => Promise<SimpleCatalogEntry[]> {
  return async () => {
    const cached = simpleCatalogCache.get(endpoint);
    if (cached && Date.now() - cached.loadedAt <= CATALOG_CACHE_TTL_MS) return cached.promise;
    const promise = fetchSimpleCatalog(endpoint, errorMessage).catch((error) => {
      simpleCatalogCache.delete(endpoint);
      throw error;
    });
    simpleCatalogCache.set(endpoint, { promise, loadedAt: Date.now() });
    return promise;
  };
}

async function fetchSimpleCatalog(endpoint: string, errorMessage: string): Promise<SimpleCatalogEntry[]> {
  const res = await authGet(endpoint);
  if (!res.ok) throw new Error(errorMessage);
  const json: unknown = await res.json();
  return normalizeSimpleCatalog(asRecord(json).data);
}

export const loadScenarios = createSimpleCatalogLoader('/api/v1/scenarios', 'Erro ao carregar cenários.');
export const loadVttPlatforms = createSimpleCatalogLoader('/api/v1/vtt-platforms', 'Erro ao carregar plataformas VTT.');
export const loadCommunicationPlatforms = createSimpleCatalogLoader('/api/v1/communication-platforms', 'Erro ao carregar plataformas de comunicação.');
