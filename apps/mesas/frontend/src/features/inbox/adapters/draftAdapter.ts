import type { DiscordDraft, DiscordImportDraftStatus, DraftApiOperations } from '../../discord-sync/types';
import type { InboxDraft, InboxSyncResult } from '../types';
import { isRecord } from '../../discord-sync/draftFormUtils';
import { inboxApi } from '../api/inboxApi';

export function inboxDraftToDiscordDraft(raw: InboxDraft): DiscordDraft {
  return {
    id: raw.id,
    discord_message_id: raw.discord_message_id,
    import_message_id: raw.import_message_id,
    table_id: raw.table_id,
    parsed_payload: isRecord(raw.parsed_payload) ? raw.parsed_payload : {},
    normalized_payload: isRecord(raw.normalized_payload) ? raw.normalized_payload : null,
    confidence: raw.confidence,
    status: raw.status as DiscordImportDraftStatus,
    review_notes: raw.review_notes,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
  };
}

export function buildInboxDraftApi(): DraftApiOperations {
  return {
    updateDraft: async (id, body) =>
      inboxDraftToDiscordDraft(await inboxApi.updateDraft(id, body)),
    syncDraft: async (id): Promise<{ tableId: string; created: boolean }> =>
      inboxApi.syncDraft(id) as Promise<InboxSyncResult>,
    reparseDraft: async (id) =>
      inboxDraftToDiscordDraft(await inboxApi.reparseDraft(id)),
    getDraft: async (id) =>
      inboxDraftToDiscordDraft(await inboxApi.getDraft(id)),
    submitCorrection: async (id, body) =>
      inboxApi.registerCorrection(id, body.corrections, body.reason, { before: body.before }) as Promise<unknown>,
  };
}
