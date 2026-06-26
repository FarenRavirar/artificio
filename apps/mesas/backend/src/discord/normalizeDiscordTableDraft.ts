import type { ImportTableDraft, DiscordTableDraftTable } from './types';
import type { SystemEntry } from './parseDiscordAnnouncement';

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

function getMissingFields(table: DiscordTableDraftTable): string[] {
  const missing: string[] = [];
  if (!table.title) missing.push('title');
  if (!table.system_id) missing.push(table.raw_system_hint ? 'system_name:unmatched_hint' : 'system_name');
  if (!table.type) missing.push('type');
  if (!table.modality) missing.push('modality');
  if (!table.price_type) missing.push('price_type');
  if (table.slots_total == null && table.slots_open == null) missing.push('slots_total');
  if (table._slots_ambiguity) missing.push('slots_open:ambiguous_x_of_y');
  // DEB-048-29: suspeita de sistema autoral força needs_review (badge "autoral?").
  if (table._homebrew_suspect) missing.push('system_name:homebrew_suspect');
  if (!table.contact_url && !table.contact_discord) missing.push('contact_url');
  return missing;
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
