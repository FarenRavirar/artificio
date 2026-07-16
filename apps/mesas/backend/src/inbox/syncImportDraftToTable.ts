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

export const inboxSyncConfig: SyncDraftCoreConfig = {
  messageFk: 'import_message_id',
  sourceName: 'inbox',
  messageTable: 'import_messages',
  requireFk: true,
  getSourceId: (message) => message.id as string,
  getSourceUrl: () => null,
  // Requisito 7 (spec 079): admin logado editando o draft (adminDisplayName)
  // continua tendo prioridade máxima — é confirmação humana explícita. Abaixo
  // disso, prefere o nome extraído do texto do anúncio (raw_gm_name) sobre o
  // autor da mensagem (que em texto colado manual é sempre null de qualquer
  // forma — textToRawMessage não inventa metadado Discord).
  getGmName: (payload, adminDisplayName) => adminDisplayName ?? payload.table.raw_gm_name ?? payload.source.author_name ?? null,
  ValidationError: DraftSyncValidationError,
};

export async function syncImportDraftToTable(
  draftId: string,
  adminDisplayName?: string
): Promise<SyncResult> {
  return syncDraftToTable(draftId, inboxSyncConfig, adminDisplayName);
}
