import { db } from '../db';
import { Insertable } from 'kysely';
import { TablesTable, TableContactsTable, TableSchedulesTable, DayOfWeek, ScheduleFrequency, TableContactChannel } from '../db/types';
import { TableRepository } from '../repositories/tableRepository';
import { TableService } from '../services/tableService';
import type { DiscordImageUploadStatus, DiscordTableDraft } from './types';
import { uploadDiscordImageToCloudinary } from './uploadDiscordImage';

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

const VALID_DAYS: DayOfWeek[] = ['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo'];
const VALID_FREQ: ScheduleFrequency[] = ['semanal', 'quinzenal', 'mensal', 'avulsa'];
const VALID_CHANNELS: TableContactChannel[] = ['whatsapp', 'discord', 'phone', 'email', 'facebook', 'instagram', 'form'];
const VALID_TABLE_TYPES = ['campanha', 'one-shot', 'oneshot-serie', 'aberta'];
const VALID_MODALITIES = ['online', 'presencial', 'hibrida'];
const VALID_PRICE_TYPES = ['gratuita', 'paga'];

function isDayOfWeek(v: unknown): v is DayOfWeek {
  return typeof v === 'string' && (VALID_DAYS as string[]).includes(v);
}

function isScheduleFrequency(v: unknown): v is ScheduleFrequency {
  return typeof v === 'string' && (VALID_FREQ as string[]).includes(v);
}

function isTableContactChannel(v: unknown): v is TableContactChannel {
  return typeof v === 'string' && (VALID_CHANNELS as string[]).includes(v);
}

function hasText(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

function hasPositiveNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0;
}

function validateDraftForSync(draft: DiscordTableDraft): string[] {
  const missing: string[] = [];
  const t = draft.table;

  if (!hasText(t.title)) missing.push('title');
  if (!hasText(t.description)) missing.push('description');
  if (!hasText(t.system_id)) missing.push('system_id');
  if (!hasText(t.type) || !VALID_TABLE_TYPES.includes(t.type)) missing.push('type');
  if (!hasText(t.modality) || !VALID_MODALITIES.includes(t.modality)) missing.push('modality');
  if (!hasText(t.price_type) || !VALID_PRICE_TYPES.includes(t.price_type)) missing.push('price_type');
  if (!hasPositiveNumber(t.slots_total) && !hasPositiveNumber(t.slots_open)) missing.push('slots_total');
  if (!hasText(t.contact_url) && !hasText(t.contact_discord)) missing.push('contact_url/contact_discord');
  if (!isDayOfWeek(t.day_of_week)) missing.push('day_of_week');
  if (!hasText(t.start_time)) missing.push('start_time');

  return missing;
}

function extractContacts(
  draft: DiscordTableDraft
): Array<Omit<Insertable<TableContactsTable>, 'table_id'>> {
  const contacts: Array<Omit<Insertable<TableContactsTable>, 'table_id'>> = [];

  if (draft.table.contact_discord) {
    contacts.push({ channel: 'discord', value: draft.table.contact_discord, label: null, discord_server_url: null });
  }

  if (draft.table.contact_url) {
    const rawUrl = draft.table.contact_url;
    let channel: TableContactChannel = 'form';
    try {
      const parsed = new URL(rawUrl);
      channel =
        parsed.hostname === 'discord.com' || parsed.hostname.endsWith('.discord.com')
          ? 'discord'
          : 'form';
    } catch {
      channel = 'form';
    }
    if (!contacts.some((c) => c.channel === channel && c.value === rawUrl)) {
      contacts.push({ channel, value: rawUrl, label: 'Ticket / Inscrição', discord_server_url: null });
    }
  }

  return contacts;
}

function extractSchedules(
  draft: DiscordTableDraft
): Array<Omit<Insertable<TableSchedulesTable>, 'table_id'>> {
  const { day_of_week, start_time, frequency } = draft.table;

  if (!isDayOfWeek(day_of_week) || !start_time) return [];

  return [
    {
      day_of_week,
      start_time: start_time.includes(':') ? start_time : `${start_time}:00`,
      end_time: null,
      frequency: isScheduleFrequency(frequency) ? frequency : 'semanal',
      slots_per_session: null,
      notes: null,
    },
  ];
}

function buildTableData(
  draft: DiscordTableDraft,
  message: { discord_message_id: string; discord_message_url: string | null },
  slug: string,
  coverUrl: string | null
): Insertable<TablesTable> {
  const t = draft.table;
  if (!t.title) throw new DiscordDraftSyncValidationError(['title']);

  return {
    slug,
    gm_id: null,
    system_id: t.system_id ?? null,
    scenario_id: null,
    title: t.title,
    description: t.description ?? null,
    type: t.type ?? 'campanha',
    audience: 'livre',
    modality: t.modality ?? 'online',
    price_type: t.price_type ?? 'gratuita',
    price_value: t.price_value ?? null,
    price_frequency: t.price_type === 'paga' ? 'sessao' : null,
    slots_total: t.slots_total ?? t.slots_open ?? 0,
    slots_filled: t.slots_filled ?? 0,
    slots_open: t.slots_open ?? t.slots_total ?? 0,
    language: 'pt-BR',
    experience_level: 'todos',
    publisher_role: 'announcer',
    actual_gm_name: draft.source.author_name ?? null,
    is_covil: true,
    origin: 'imported',
    source_id: message.discord_message_id,
    source_url: message.discord_message_url ?? null,
    status: 'draft',
    rules_notes: null,
    cover_url: coverUrl,
    banner_url: coverUrl,
    is_ddal: false,
  };
}

function readCoverSource(payload: DiscordTableDraft): string | null {
  return typeof payload.table.cover_url_source === 'string' && payload.table.cover_url_source.trim()
    ? payload.table.cover_url_source.trim()
    : null;
}

function withCoverUrl(payload: DiscordTableDraft, coverUrl: string | null): DiscordTableDraft {
  return {
    ...payload,
    table: {
      ...payload.table,
      cover_url: coverUrl,
    },
  };
}

async function notifyAdminsAboutImageFailure(tableId: string, title: string, status: DiscordImageUploadStatus, error: string | null): Promise<void> {
  const admins = await db
    .selectFrom('users')
    .select('id')
    .where('role', '=', 'admin')
    .execute();

  if (admins.length === 0) return;

  await db
    .insertInto('notifications')
    .values(admins.map((admin) => ({
      user_id: admin.id,
      type: 'system',
      title: 'Mesa publicada sem imagem',
      message: `A mesa "${title}" foi sincronizada sem imagem porque o upload do Discord falhou.`,
      action_url: '/gestao',
      metadata: JSON.stringify({
        table_id: tableId,
        image_upload_status: status,
        error,
      }),
    })))
    .execute();
}

async function uploadCoverForDraft(draftId: string, payload: DiscordTableDraft, currentAttempts: number): Promise<{
  payload: DiscordTableDraft;
  coverUrl: string | null;
  status: DiscordImageUploadStatus | null;
  attempts: number;
  error: string | null;
}> {
  const existingCover = typeof payload.table.cover_url === 'string' && payload.table.cover_url.trim()
    ? payload.table.cover_url.trim()
    : null;
  if (existingCover) {
    return { payload, coverUrl: existingCover, status: null, attempts: currentAttempts, error: null };
  }

  const sourceUrl = readCoverSource(payload);
  if (!sourceUrl) {
    return { payload, coverUrl: null, status: null, attempts: currentAttempts, error: null };
  }

  const attempts = currentAttempts + 1;
  const result = await uploadDiscordImageToCloudinary(sourceUrl);
  if (result.status === 'success') {
    return {
      payload: withCoverUrl(payload, result.url),
      coverUrl: result.url,
      status: 'success',
      attempts,
      error: null,
    };
  }

  console.warn('[discord-image-upload] upload failed', { draftId, status: result.status, error: result.error });
  return {
    payload: withCoverUrl(payload, null),
    coverUrl: null,
    status: result.status,
    attempts,
    error: result.error,
  };
}

async function updateDraftImageUploadState(
  draftId: string,
  payload: DiscordTableDraft,
  status: DiscordImageUploadStatus,
  attempts: number,
  error: string | null,
): Promise<void> {
  await db
    .updateTable('discord_import_table_drafts')
    .set({
      normalized_payload: payload,
      image_upload_status: status,
      image_upload_attempts: attempts,
      image_upload_last_error: error,
      image_upload_last_at: new Date(),
      updated_at: new Date(),
    })
    .where('id', '=', draftId)
    .execute();
}

export async function refreshDiscordDraftImage(draftId: string): Promise<DiscordImageRefreshResult> {
  const draft = await db
    .selectFrom('discord_import_table_drafts')
    .selectAll()
    .where('id', '=', draftId)
    .executeTakeFirst();

  if (!draft) throw new Error(`Draft ${draftId} não encontrado.`);

  const payload = (draft.normalized_payload ?? draft.parsed_payload) as DiscordTableDraft;
  if (!payload?.table) throw new Error(`Draft ${draftId} sem payload válido para upload de imagem.`);

  const upload = await uploadCoverForDraft(draftId, withCoverUrl(payload, null), draft.image_upload_attempts ?? 0);
  const status = upload.status ?? (upload.coverUrl ? 'success' : 'pending');
  await updateDraftImageUploadState(draftId, upload.payload, status, upload.attempts, upload.error);

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

/**
 * Sincroniza um draft para a tabela `tables`.
 * Idempotente: se já existir mesa com source_id = discord_message_id, atualiza em vez de criar.
 */
export async function syncDiscordDraftToTable(draftId: string): Promise<SyncResult> {
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

  const message = await db
    .selectFrom('discord_import_messages')
    .select(['id', 'discord_message_id', 'discord_message_url'])
    .where('id', '=', draft.discord_message_id)
    .executeTakeFirst();

  if (!message) throw new Error(`Mensagem referenciada pelo draft ${draftId} não encontrada.`);

  let payload = (draft.normalized_payload ?? draft.parsed_payload) as DiscordTableDraft;
  if (!payload?.table) throw new Error(`Draft ${draftId} sem payload válido para sincronização.`);

  const missingFields = validateDraftForSync(payload);
  if (missingFields.length > 0) {
    throw new DiscordDraftSyncValidationError(missingFields);
  }

  const contacts = extractContacts(payload);
  const schedules = extractSchedules(payload);
  const imageUpload = await uploadCoverForDraft(draftId, payload, draft.image_upload_attempts ?? 0);
  payload = imageUpload.payload;
  const coverUrl = imageUpload.coverUrl;

  // Verifica idempotência pelo source_id
  const existingTable = await db
    .selectFrom('tables')
    .select(['id'])
    .where('source_id', '=', message.discord_message_id)
    .executeTakeFirst();

  let tableId: string;
  let created: boolean;

  if (existingTable) {
    // UPDATE: atualiza campos sem filtrar por gm_id (tabela importada pode ter gm_id null)
    tableId = existingTable.id;
    created = false;

    await db.transaction().execute(async (trx) => {
      const t = payload.table;
      if (!t.title) throw new DiscordDraftSyncValidationError(['title']);
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
          actual_gm_name: payload.source.author_name ?? null,
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
    // INSERT
    created = true;
    if (!payload.table.title) throw new DiscordDraftSyncValidationError(['title']);
    const slug = TableService.generateSlug(payload.table.title);
    const tableData = buildTableData(payload, message, slug, coverUrl);
    const inserted = await TableRepository.createTableWithRelations(tableData, contacts, schedules);
    tableId = inserted.id;
  }

  // Marca draft e mensagem como sincronizados
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
      .updateTable('discord_import_messages')
      .set({ status: 'synced', updated_at: new Date() })
      .where('id', '=', message.id)
      .execute();
  });

  if (imageUpload.status && imageUpload.status !== 'success') {
    await notifyAdminsAboutImageFailure(tableId, payload.table.title ?? 'Mesa sem título', imageUpload.status, imageUpload.error);
  }

  return { tableId, created };
}
