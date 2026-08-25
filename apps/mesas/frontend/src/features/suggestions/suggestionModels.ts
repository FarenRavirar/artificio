/**
 * Spec 096 / T4.0k — modelos e normalizadores da tela "Minhas sugestões".
 *
 * Consome APENAS API já existente (zero endpoint novo):
 * - GET /api/v1/system-suggestions/mine  (systemSuggestions.ts:189 → suggestionHelpers.listMineHandler)
 * - GET /api/v1/scenario-suggestions/mine (scenarioSuggestions.ts:98 → idem)
 * - POST /api/v1/vtt-platforms/suggest    (vttPlatforms.ts:124)
 *
 * Shapes espelhados do backend (apps/mesas/backend/src/db/types.ts):
 * - SystemSuggestionsTable (:395) e ScenarioSuggestionsTable (:436). O
 *   listMineHandler devolve `selectAll()` — todos os campos da tabela; aqui
 *   tipamos só o que a tela exibe.
 * - SuggestionStatus (:393) = 'pending' | 'approved' | 'rejected'.
 * - SystemNodeType (:5) = 'system' | 'edition' | 'variant'.
 * - `description` e `rejection_reason` chegam sanitizados pelo backend
 *   (suggestionHelpers.withSanitizedMarkdown) — o front só renderiza.
 *
 * Notificações são Fase 7 (T7.4b) — nada neste módulo referencia notifications.
 */
import type { BadgeVariant } from '@artificio/ui';

export type SuggestionStatus = 'pending' | 'approved' | 'rejected';
export type SystemNodeType = 'system' | 'edition' | 'variant';

export interface SystemSuggestion {
  id: string;
  name: string;
  name_pt: string | null;
  node_type: SystemNodeType;
  description: string | null;
  aliases: string[];
  status: SuggestionStatus;
  rejection_reason: string | null;
  created_at: string | null;
  reviewed_at: string | null;
  resolved_at: string | null;
}

export interface ScenarioSuggestion {
  id: string;
  name: string;
  name_pt: string | null;
  description: string | null;
  aliases: string[];
  subgenres: string[];
  status: SuggestionStatus;
  rejection_reason: string | null;
  created_at: string | null;
  reviewed_at: string | null;
}

export interface VttSuggestionResult {
  id: string;
  suggested_name: string;
  created_at: string | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const readNullableString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;

const readStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

/** ISO string válida (JSON serializa Date como ISO) ou null. */
const readIsoDate = (value: unknown): string | null => {
  if (typeof value !== 'string' || value.length === 0) return null;
  return Number.isNaN(Date.parse(value)) ? null : value;
};

/**
 * Status fora do union medido cai em 'pending' em vez de descartar a sugestão:
 * um enum novo no backend (ex.: 'changes_requested') não pode fazer a sugestão
 * do mestre SUMIR da lista. Exibir "Em análise" é o fallback menos pior e a
 * escrita continua tipada. Mesma lógica para node_type desconhecido → 'system'.
 */
const readStatus = (value: unknown): SuggestionStatus =>
  value === 'approved' || value === 'rejected' ? value : 'pending';

const readNodeType = (value: unknown): SystemNodeType =>
  value === 'edition' || value === 'variant' ? value : 'system';

export function normalizeSystemSuggestion(value: unknown): SystemSuggestion | null {
  if (!isRecord(value)) return null;
  const id = readNullableString(value.id);
  const name = readNullableString(value.name);
  if (!id || !name) return null;

  return {
    id,
    name,
    name_pt: readNullableString(value.name_pt),
    node_type: readNodeType(value.node_type),
    description: readNullableString(value.description),
    aliases: readStringArray(value.aliases),
    status: readStatus(value.status),
    rejection_reason: readNullableString(value.rejection_reason),
    created_at: readIsoDate(value.created_at),
    reviewed_at: readIsoDate(value.reviewed_at),
    resolved_at: readIsoDate(value.resolved_at),
  };
}

export function normalizeScenarioSuggestion(value: unknown): ScenarioSuggestion | null {
  if (!isRecord(value)) return null;
  const id = readNullableString(value.id);
  const name = readNullableString(value.name);
  if (!id || !name) return null;

  return {
    id,
    name,
    name_pt: readNullableString(value.name_pt),
    description: readNullableString(value.description),
    aliases: readStringArray(value.aliases),
    subgenres: readStringArray(value.subgenres),
    status: readStatus(value.status),
    rejection_reason: readNullableString(value.rejection_reason),
    created_at: readIsoDate(value.created_at),
    reviewed_at: readIsoDate(value.reviewed_at),
  };
}

/**
 * `{ data: [...] }` (listMineHandler, suggestionHelpers.ts:162) → itens
 * normalizados. Item que não passa no normalizador fica de fora com warn —
 * um item malformado não pode quebrar a lista inteira.
 */
export function normalizeSuggestionList<T>(
  payload: unknown,
  normalizeItem: (value: unknown) => T | null,
): T[] {
  if (!isRecord(payload) || !Array.isArray(payload.data)) return [];
  const items: T[] = [];
  for (const raw of payload.data) {
    const item = normalizeItem(raw);
    if (item) {
      items.push(item);
    } else {
      console.warn('[suggestions] Item descartado por shape inválido:', raw);
    }
  }
  return items;
}

export function readPayloadData(payload: unknown): unknown {
  return isRecord(payload) && 'data' in payload ? payload.data : null;
}

export function readBackendMessage(payload: unknown): string | null {
  if (isRecord(payload) && typeof payload.message === 'string' && payload.message.trim().length > 0) {
    return payload.message;
  }
  return null;
}

/**
 * Eco 201 do POST /vtt-platforms/suggest:
 * `{ data: { id, suggested_name, created_at }, message }` (vttPlatforms.ts:210-213).
 */
export function normalizeVttSuggestionResult(value: unknown): VttSuggestionResult | null {
  if (!isRecord(value)) return null;
  const id = readNullableString(value.id);
  const suggested_name = readNullableString(value.suggested_name);
  if (!id || !suggested_name) return null;
  return { id, suggested_name, created_at: readIsoDate(value.created_at) };
}

export const VTT_SUGGESTION_NAME_MAX = 100;

/**
 * Mesmas regras do backend (vttPlatforms.ts:130-138), com as MESMAS mensagens —
 * o erro do cliente nunca diverge do que o servidor responderia.
 */
export function validateVttSuggestionName(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return 'Nome da plataforma é obrigatório.';
  if (trimmed.length > VTT_SUGGESTION_NAME_MAX) {
    return 'Nome da plataforma muito longo (máximo 100 caracteres).';
  }
  return null;
}

/**
 * Extrai `{ error: string }` de uma Response não-ok. Fallback quando o corpo
 * não é JSON (proxy/HTML) — nunca exibe HTML cru.
 */
export async function readApiErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (isRecord(body) && typeof body.error === 'string' && body.error.trim().length > 0) {
      return body.error;
    }
  } catch {
    // corpo não-JSON — usa fallback
  }
  return fallback;
}

export const SUGGESTION_STATUS_LABELS: Record<
  SuggestionStatus,
  { label: string; variant: BadgeVariant }
> = {
  pending: { label: 'Em análise', variant: 'warning' },
  approved: { label: 'Aprovada', variant: 'success' },
  rejected: { label: 'Recusada', variant: 'danger' },
};

export const NODE_TYPE_LABELS: Record<SystemNodeType, string> = {
  system: 'Sistema',
  edition: 'Edição',
  variant: 'Variante',
};
