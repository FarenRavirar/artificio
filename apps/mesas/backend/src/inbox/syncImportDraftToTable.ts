import { db } from '../db';
import { TableRepository } from '../repositories/tableRepository';
import { TableService } from '../services/tableService';
import type { ImportTableDraft } from '../inbox/types';
import {
  validateDraftForSync,
  extractContacts,
  extractSchedules,
  buildTableData,
  uploadCoverForDraft,
  notifyAdminsAboutImageFailure,
} from '../discord/syncHelpers';

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

export async function syncImportDraftToTable(
  draftId: string,
  adminDisplayName?: string
): Promise<SyncResult> {
  const draft = await db
    .selectFrom('discord_import_table_drafts')
    .selectAll()
    .where('id', '=', draftId)
    .executeTakeFirst();

  if (!draft) throw new Error(`Draft ${draftId} não encontrado.`);
  if (draft.status === 'synced') {
    if (!draft.table_id) throw new Error(`Draft ${draftId} marcado como synced mas sem table_id.`);
    return { tableId: draft.table_id, created: false };
  }
  if (draft.status === 'rejected') throw new Error(`Draft ${draftId} foi rejeitado e não pode ser sincronizado.`);
  if (draft.status !== 'ready') throw new Error(`Draft ${draftId} precisa estar com status ready antes de sincronizar.`);

  if (!draft.import_message_id) {
    throw new Error(`Draft ${draftId} não é de inbox (import_message_id nulo).`);
  }

  const importMessage = await db
    .selectFrom('import_messages')
    .select(['id', 'content_raw'])
    .where('id', '=', draft.import_message_id)
    .executeTakeFirst();

  if (!importMessage) throw new Error(`Mensagem de inbox referenciada pelo draft ${draftId} não encontrada.`);

  let payload = (draft.normalized_payload ?? draft.parsed_payload) as ImportTableDraft;
  if (!payload?.table) throw new Error(`Draft ${draftId} sem payload válido para sincronização.`);

  const missingFields = validateDraftForSync(payload);
  if (missingFields.length > 0) {
    throw new DraftSyncValidationError(missingFields);
  }

  const contacts = extractContacts(payload);
  const schedules = extractSchedules(payload);
  const imageUpload = await uploadCoverForDraft(draftId, payload, draft.image_upload_attempts ?? 0);
  payload = imageUpload.payload;
  const coverUrl = imageUpload.coverUrl;

  const sourceId = importMessage.id;
  const sourceUrl = null;
  const gmName = adminDisplayName ?? payload.source.author_name ?? null;

  const existingTable = await db
    .selectFrom('tables')
    .select(['id'])
    .where('source_id', '=', sourceId)
    .executeTakeFirst();

  let tableId: string;
  let created: boolean;

  if (existingTable) {
    tableId = existingTable.id;
    created = false;

    await db.transaction().execute(async (trx) => {
      const t = payload.table;
      if (!t.title) throw new DraftSyncValidationError(['title']);
      await trx
        .updateTable('tables')
        .set({
          title: t.title,
          description: t.description ?? null,
          type: t.type ?? 'campanha',
          modality: t.modality ?? 'online',
          price_type: t.price_type ?? 'gratuita',
          price_value: t.price_value ?? null,
          price_frequency: t.price_type === 'paga' ? 'sessao' : null,
          slots_total: t.slots_total ?? t.slots_open ?? 0,
          slots_filled: t.slots_filled ?? 0,
          slots_open: t.slots_open ?? t.slots_total ?? 0,
          system_id: t.system_id ?? null,
          cover_url: coverUrl,
          banner_url: coverUrl,
          actual_gm_name: gmName,
          is_covil: true,
          status: 'draft',
          updated_at: new Date(),
        })
        .where('id', '=', tableId)
        .execute();

      await trx.deleteFrom('table_contacts').where('table_id', '=', tableId).execute();
      const uniqueContacts = contacts.filter(
        (c, i, arr) => arr.findIndex((x) => x.channel === c.channel && x.value === c.value) === i
      );
      if (uniqueContacts.length > 0) {
        await trx
          .insertInto('table_contacts')
          .values(uniqueContacts.map((c, i) => ({ ...c, table_id: tableId, sort_order: i })))
          .execute();
      }

      await trx.deleteFrom('table_schedules').where('table_id', '=', tableId).execute();
      if (schedules.length > 0) {
        await trx
          .insertInto('table_schedules')
          .values(schedules.map((s, i) => ({ ...s, table_id: tableId, sort_order: i })))
          .execute();
      }
    });
  } else {
    created = true;
    if (!payload.table.title) throw new DraftSyncValidationError(['title']);
    const slug = TableService.generateSlug(payload.table.title);
    const tableData = buildTableData(payload, {
      sourceId,
      sourceUrl,
      gmName,
    }, slug, coverUrl);
    const inserted = await TableRepository.createTableWithRelations(tableData, contacts, schedules);
    tableId = inserted.id;
  }

  await db.transaction().execute(async (trx) => {
    await trx
      .updateTable('discord_import_table_drafts')
      .set({
        status: 'synced',
        table_id: tableId,
        normalized_payload: payload,
        image_upload_status: imageUpload.status,
        image_upload_attempts: imageUpload.attempts,
        image_upload_last_error: imageUpload.error,
        image_upload_last_at: imageUpload.status ? new Date() : null,
        updated_at: new Date(),
      })
      .where('id', '=', draftId)
      .execute();

    await trx
      .updateTable('import_messages')
      .set({ status: 'synced', updated_at: new Date() })
      .where('id', '=', importMessage.id)
      .execute();
  });

  if (imageUpload.status && imageUpload.status !== 'success') {
    await notifyAdminsAboutImageFailure(tableId, payload.table.title ?? 'Mesa sem título', imageUpload.status, imageUpload.error);
  }

  return { tableId, created };
}
