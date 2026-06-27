import { db } from '../db';
import type { DiscordImageUploadStatus } from './types';
import {
  syncDraftToTable,
  uploadCoverForDraft,
  readCoverSource,
  withCoverUrl,
  updateDraftImageUploadState,
  normalizeImportTableDraft,
} from './syncHelpers';
import type { SyncDraftCoreConfig } from './syncHelpers';

export interface SyncResult {
  tableId: string;
  created: boolean;
}

export interface DiscordImageRefreshResult {
  draftId: string;
  tableId: string | null;
  status: DiscordImageUploadStatus;
  url: string | null;
  error: string | null;
}

export class DiscordDraftSyncValidationError extends Error {
  constructor(public readonly missingFields: string[]) {
    super(`Draft incompleto para sincronização: ${missingFields.join(', ')}.`);
    this.name = 'DiscordDraftSyncValidationError';
  }
}

export async function refreshDiscordDraftImage(draftId: string): Promise<DiscordImageRefreshResult> {
  const draft = await db
    .selectFrom('discord_import_table_drafts')
    .selectAll()
    .where('id', '=', draftId)
    .executeTakeFirst();

  if (!draft) throw new Error(`Draft ${draftId} não encontrado.`);

  const payload = normalizeImportTableDraft(draft.normalized_payload ?? draft.parsed_payload);
  if (!payload?.table) throw new Error(`Draft ${draftId} sem payload válido para upload de imagem.`);

  const upload = await uploadCoverForDraft(draftId, withCoverUrl(payload, null), draft.image_upload_attempts ?? 0);
  const status = upload.status ?? (upload.coverUrl ? 'success' : 'pending');
  await updateDraftImageUploadState(draftId, upload.payload, status, upload.attempts, upload.error, upload.coverPublicId);

  if (upload.coverUrl && draft.table_id) {
    await db
      .updateTable('tables')
      .set({ cover_url: upload.coverUrl, banner_url: upload.coverUrl, updated_at: new Date() })
      .where('id', '=', draft.table_id)
      .execute();
  }

  return {
    draftId,
    tableId: draft.table_id,
    status,
    url: upload.coverUrl,
    error: upload.error,
  };
}

const discordSyncConfig: SyncDraftCoreConfig = {
  messageFk: 'discord_message_id',
  sourceName: 'Discord',
  messageTable: 'discord_import_messages',
  requireFk: false,
  // source_id é uuid (FK lógico p/ a mensagem interna). Usar o id interno da
  // mensagem, NÃO o snowflake do Discord (discord_message_id) — o snowflake
  // estoura "invalid input syntax for type uuid" no dedup/insert de `tables`.
  // Paridade com inbox (getSourceId: message.id). O snowflake já vai em source_url.
  getSourceId: (message) => message.id as string,
  getSourceUrl: (message) => (message.discord_message_url as string) ?? null,
  getGmName: (payload) => payload.source.author_name ?? null,
  ValidationError: DiscordDraftSyncValidationError,
};

export async function syncDiscordDraftToTable(draftId: string): Promise<SyncResult> {
  return syncDraftToTable(draftId, discordSyncConfig);
}
