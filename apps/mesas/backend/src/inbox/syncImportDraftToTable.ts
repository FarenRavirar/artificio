import { syncDraftToTable } from '../discord/syncHelpers';
import type { SyncDraftCoreConfig } from '../discord/syncHelpers';

export interface SyncResult {
  tableId: string;
  created: boolean;
}

export class DraftSyncValidationError extends Error {
  constructor(public readonly missingFields: string[]) {
    super(`Draft incompleto para sincronização: ${missingFields.join(', ')}.`);
    this.name = 'DraftSyncValidationError';
  }
}

const inboxSyncConfig: SyncDraftCoreConfig = {
  messageFk: 'import_message_id',
  sourceName: 'inbox',
  messageTable: 'import_messages',
  requireFk: true,
  getSourceId: (message) => message.id as string,
  getSourceUrl: () => null,
  getGmName: (payload, adminDisplayName) => adminDisplayName ?? payload.source.author_name ?? null,
  ValidationError: DraftSyncValidationError,
};

export async function syncImportDraftToTable(
  draftId: string,
  adminDisplayName?: string
): Promise<SyncResult> {
  return syncDraftToTable(draftId, inboxSyncConfig, adminDisplayName);
}
