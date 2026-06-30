import type { ImportTableDraft, DiscordTableDraftTable } from './types';
import type { LlmExtractedFields } from './llmAssist';

const FIELD_MAP: Array<[keyof LlmExtractedFields, keyof DiscordTableDraftTable]> = [
  ['title', 'title'],
  ['system_hint', 'system_name'],
  ['day_of_week', 'day_of_week'],
  ['start_time', 'start_time'],
  ['slots_total', 'slots_total'],
  ['slots_open', 'slots_open'],
  ['price_value', 'price_value'],
  ['contact_url', 'contact_url'],
  ['description', 'description'],
];

export function buildAiSuggestionFields(
  extracted: LlmExtractedFields,
  table: DiscordTableDraftTable,
): Record<string, unknown> {
  const suggestions: Record<string, unknown> = {};

  for (const [sourceKey, targetKey] of FIELD_MAP) {
    const value = extracted[sourceKey];
    if (value === undefined || value === null || value === '') continue;
    const current = table[targetKey];
    if (current === null || current === undefined || current === '') {
      suggestions[targetKey] = value;
    }
  }

  if (extracted.price_type && !table.price_type) {
    suggestions.price_type = extracted.price_type;
  }

  return suggestions;
}

export function attachAiSuggestions(
  draft: ImportTableDraft,
  fields: Record<string, unknown>,
  provider: string,
  model: string,
): ImportTableDraft {
  if (Object.keys(fields).length === 0) return draft;
  return {
    ...draft,
    table: {
      ...draft.table,
      _ai_suggestions: {
        provider,
        model,
        fields,
      },
      _notes: [
        ...draft.table._notes,
        'Sugestões IA disponíveis; revisar antes de aplicar.',
      ],
    },
  };
}
