import type { ImportTableDraft, DiscordTableDraftTable } from './types.js';
import type { SystemEntry } from './parseDiscordAnnouncement.js';
import { validateDraftForSync } from './syncHelpers.js';

export type NormalizedDraftStatus = 'ready' | 'needs_review';

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchSystemName(value: string | null | undefined, systems: SystemEntry[]): SystemEntry | null {
  if (!value) return null;
  const target = normalizeText(value);
  if (!target) return null;

  for (const system of systems) {
    const candidates = [
      system.name,
      ...(system.name_pt ? [system.name_pt] : []),
      ...system.aliases,
    ];

    for (const candidate of candidates) {
      if (normalizeText(candidate) === target) {
        return system;
      }
    }
  }

  return null;
}

// DEB-058-06 (2026-07-08): getMissingFields (gate de status no PARSE) usava
// checagem própria, mais fraca que validateDraftForSync (gate real no SYNC) —
// só truthy em type/modality/price_type (sem checar enum) e NUNCA checava
// day_of_week/start_time. Um draft podia nascer do parse já com status=ready
// (badge "Pronto" na lista, liberado pro botão "Sincronizar drafts prontos"
// que synca direto da lista sem abrir o editor) e só estourar 422 no sync de
// verdade. Delegar pra validateDraftForSync (mesma função usada em
// syncDraftToTable) fecha o gap na fonte — parse e sync agora sempre
// concordam sobre o que falta. Mapeamento pros nomes de campo que a UI
// espera (badges "autoral?"/"sistema não encontrado"/vagas ambíguas) é feito
// à parte, pois validateDraftForSync não conhece esses metadados de UI.
function getMissingFields(table: DiscordTableDraftTable): string[] {
  const missing = validateDraftForSync({ table });
  // system_id é o nome real do campo pro validateDraftForSync; a UI usa
  // system_name/system_name:unmatched_hint como chave de badge.
  const withoutSystemId = missing.filter((field) => field !== 'system_id');
  if (missing.includes('system_id')) {
    withoutSystemId.push(table.raw_system_hint ? 'system_name:unmatched_hint' : 'system_name');
  }
  // contact_url/contact_discord (validateDraftForSync) vira só 'contact_url' na UI.
  const finalMissing = withoutSystemId
    .filter((field) => field !== 'contact_url/contact_discord')
    .concat(missing.includes('contact_url/contact_discord') ? ['contact_url'] : []);
  if (table._slots_ambiguity) finalMissing.push('slots_open:ambiguous_x_of_y');
  // DEB-048-29: suspeita de sistema autoral força needs_review (badge "autoral?").
  if (table._homebrew_suspect) finalMissing.push('system_name:homebrew_suspect');
  return finalMissing;
}

export function normalizeDiscordTableDraft(
  draft: ImportTableDraft,
  systems: SystemEntry[] = [],
): { draft: ImportTableDraft; status: NormalizedDraftStatus } {
  const table: DiscordTableDraftTable = { ...draft.table };

  if (!table.system_id) {
    const matched = matchSystemName(table.system_name, systems) ?? matchSystemName(table.raw_system_hint, systems);
    if (matched) {
      table.system_id = matched.id;
      table.system_name = matched.name;
      table.raw_system_hint = null;
    }
  }

  const missingFields = Array.from(new Set([...draft.missing_fields, ...getMissingFields(table)]));
  const normalized: ImportTableDraft = {
    ...draft,
    table,
    missing_fields: missingFields,
  };

  return {
    draft: normalized,
    status: missingFields.length === 0 ? 'ready' : 'needs_review',
  };
}
