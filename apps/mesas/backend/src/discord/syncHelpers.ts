import { db } from '../db';
import { Insertable } from 'kysely';
import { TablesTable, TableContactsTable, TableSchedulesTable, DayOfWeek, ScheduleFrequency, TableContactChannel } from '../db/types';
import { TableRepository } from '../repositories/tableRepository';
import { TableService } from '../services/tableService';
import type { DiscordImageUploadStatus, ImportTableDraft } from './types';
import { uploadDiscordImageToCloudinary } from './uploadDiscordImage';
import { z } from 'zod';

export class DraftNotFoundError extends Error {
  constructor(draftId: string) {
    super(`Draft ${draftId} não encontrado.`);
    this.name = 'DraftNotFoundError';
  }
}

export class DraftStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DraftStateError';
  }
}

export const VALID_DAYS: DayOfWeek[] = ['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo'];
export const VALID_FREQ: ScheduleFrequency[] = ['semanal', 'quinzenal', 'mensal', 'avulsa'];
export const VALID_CHANNELS: TableContactChannel[] = ['whatsapp', 'discord', 'phone', 'email', 'facebook', 'instagram', 'form'];
export const VALID_TABLE_TYPES = ['campanha', 'one-shot', 'oneshot-serie', 'aberta'];
export const VALID_MODALITIES = ['online', 'presencial', 'hibrida'];
export const VALID_PRICE_TYPES = ['gratuita', 'paga'];

export function isDayOfWeek(v: unknown): v is DayOfWeek {
  return typeof v === 'string' && (VALID_DAYS as string[]).includes(v);
}

export function isScheduleFrequency(v: unknown): v is ScheduleFrequency {
  return typeof v === 'string' && (VALID_FREQ as string[]).includes(v);
}

export function isTableContactChannel(v: unknown): v is TableContactChannel {
  return typeof v === 'string' && (VALID_CHANNELS as string[]).includes(v);
}

export function hasText(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

export function hasPositiveNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0;
}

const TIME_REGEX = /^\d{2}:\d{2}(:\d{2})?$/;

export function isValidTime(v: unknown): v is string {
  if (typeof v !== 'string') return false;
  const m = TIME_REGEX.exec(v.trim());
  if (!m) return false;
  const [h, min] = m[0].split(':').map(Number);
  return h >= 0 && h <= 23 && min >= 0 && min <= 59;
}

export function normalizeTime(raw: string): string | null {
  const match = raw.match(/\b(\d{1,2})[hH:](\d{0,2})\b/);
  if (!match) return null;
  const h = match[1].padStart(2, '0');
  const m = (match[2] || '00').padStart(2, '0');
  return `${h}:${m}`;
}

const draftTableSchema = z.object({
  title: z.unknown(),
  system_name: z.unknown(),
  system_id: z.unknown(),
  raw_system_hint: z.unknown(),
  type: z.unknown(),
  modality: z.unknown(),
  price_type: z.unknown(),
  price_value: z.unknown(),
  slots_total: z.unknown(),
  slots_filled: z.unknown(),
  slots_open: z.unknown(),
  day_of_week: z.unknown(),
  start_time: z.unknown(),
  frequency: z.unknown(),
  description: z.unknown(),
  contact_discord: z.unknown(),
  contact_url: z.unknown(),
  host_discord_id: z.unknown(),
  cover_url: z.unknown(),
  cover_url_source: z.unknown(),
  cover_quality: z.unknown(),
  _slots_ambiguity: z.unknown(),
  _notes: z.unknown(),
}).partial().passthrough();

const importTableDraftSchema = z.object({
  source: z.record(z.string(), z.unknown()),
  table: draftTableSchema,
  confidence: z.number(),
  missing_fields: z.array(z.string()),
}).partial().passthrough();

export function normalizeImportTableDraft(raw: unknown): ImportTableDraft {
  if (raw === null || raw === undefined) {
    throw new DraftStateError('Payload JSONB está nulo.');
  }
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw new DraftStateError('Payload JSONB não é um objeto.');
  }
  const result = importTableDraftSchema.safeParse(raw);
  if (!result.success) {
    throw new DraftStateError(`Payload JSONB malformado: ${result.error.issues.map((i) => i.message).join('; ')}`);
  }
  return result.data as unknown as ImportTableDraft;
}

const recordSchema = z.record(z.string(), z.unknown());

export function normalizeDraftPayload(raw: unknown): Record<string, unknown> {
  if (raw === null || raw === undefined) return {};
  if (typeof raw !== 'object' || Array.isArray(raw)) return {};
  const result = recordSchema.safeParse(raw);
  if (!result.success) return {};
  return result.data;
}

export function validateDraftForSync(draft: ImportTableDraft): string[] {
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
  if (!isValidTime(t.start_time)) missing.push('start_time');

  return missing;
}

export function extractContacts(
  draft: ImportTableDraft
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
      const isDiscordHost =
        parsed.hostname === 'discord.com' ||
        parsed.hostname.endsWith('.discord.com') ||
        parsed.hostname === 'discord.gg' ||
        parsed.hostname.endsWith('.discord.gg');
      channel = isDiscordHost ? 'discord' : 'form';
    } catch {
      channel = 'form';
    }
    if (!contacts.some((c) => c.channel === channel && c.value === rawUrl)) {
      contacts.push({ channel, value: rawUrl, label: 'Ticket / Inscrição', discord_server_url: null });
    }
  }

  return contacts;
}

export function extractSchedules(
  draft: ImportTableDraft
): Array<Omit<Insertable<TableSchedulesTable>, 'table_id'>> {
  const { day_of_week, start_time, frequency } = draft.table;

  if (!isDayOfWeek(day_of_week) || !start_time) return [];

  const normalized = normalizeTime(start_time);
  if (!normalized) return [];

  return [
    {
      day_of_week,
      start_time: normalized,
      end_time: null,
      frequency: isScheduleFrequency(frequency) ? frequency : 'semanal',
      slots_per_session: null,
      notes: null,
    },
  ];
}

export function buildTableData(
  draft: ImportTableDraft,
  source: { sourceId: string; sourceUrl: string | null; gmName: string | null },
  slug: string,
  coverUrl: string | null
): Insertable<TablesTable> {
  const t = draft.table;
  if (!t.title) throw new DraftStateError('Título obrigatório para sync.');

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
    actual_gm_name: source.gmName ?? null,
    is_covil: true,
    origin: 'imported',
    source_id: source.sourceId,
    source_url: source.sourceUrl ?? null,
    status: 'draft',
    rules_notes: null,
    cover_url: coverUrl,
    banner_url: coverUrl,
    is_ddal: false,
  };
}

export function readCoverSource(payload: ImportTableDraft): string | null {
  return typeof payload.table.cover_url_source === 'string' && payload.table.cover_url_source.trim()
    ? payload.table.cover_url_source.trim()
    : null;
}

export function withCoverUrl(payload: ImportTableDraft, coverUrl: string | null): ImportTableDraft {
  return {
    ...payload,
    table: {
      ...payload.table,
      cover_url: coverUrl,
    },
  };
}

export async function notifyAdminsAboutImageFailure(tableId: string, title: string, status: DiscordImageUploadStatus, error: string | null): Promise<void> {
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
      message: `A mesa "${title}" foi sincronizada sem imagem porque o upload da imagem falhou.`,
      action_url: '/gestao',
      metadata: JSON.stringify({
        table_id: tableId,
        image_upload_status: status,
        error,
      }),
    })))
    .execute();
}

export async function uploadCoverForDraft(draftId: string, payload: ImportTableDraft, currentAttempts: number): Promise<{
  payload: ImportTableDraft;
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

export async function updateDraftImageUploadState(
  draftId: string,
  payload: ImportTableDraft,
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

export interface SyncDraftCoreConfig {
  messageFk: string;
  sourceName: string;
  messageTable: string;
  requireFk: boolean;
  getSourceId: (message: Record<string, unknown>) => string;
  getSourceUrl: (message: Record<string, unknown>) => string | null;
  getGmName: (payload: ImportTableDraft, adminDisplayName?: string) => string | null;
  ValidationError: new (missingFields: string[]) => Error;
}

export async function syncDraftToTable(
  draftId: string,
  config: SyncDraftCoreConfig,
  adminDisplayName?: string
): Promise<{ tableId: string; created: boolean }> {
  const draft = await db
    .selectFrom('discord_import_table_drafts')
    .selectAll()
    .where('id', '=', draftId)
    .executeTakeFirst();

  if (!draft) throw new DraftNotFoundError(draftId);
  if (draft.status === 'synced') {
    if (!draft.table_id) throw new DraftStateError(`Draft ${draftId} marcado como synced mas sem table_id.`);
    return { tableId: draft.table_id, created: false };
  }
  if (draft.status === 'rejected')     throw new DraftStateError(`Draft ${draftId} foi rejeitado e não pode ser sincronizado.`);
  if (draft.status !== 'ready')     throw new DraftStateError(`Draft ${draftId} precisa estar com status ready antes de sincronizar.`);

  if (config.requireFk) {
    const fkValue = (draft as Record<string, unknown>)[config.messageFk];
    if (!fkValue) {
      throw new DraftStateError(`Draft ${draftId} não é de ${config.sourceName} (${config.messageFk} nulo).`);
    }
  }

  const messageId = (draft as Record<string, unknown>)[config.messageFk] as string;
  const message = await (db as any)
    .selectFrom(config.messageTable)
    .selectAll()
    .where('id', '=', messageId)
    .executeTakeFirst();

  const messageRow = message as Record<string, unknown> | undefined;
  if (!messageRow) throw new DraftStateError(`Mensagem referenciada pelo draft ${draftId} não encontrada.`);

  let payload = normalizeImportTableDraft(draft.normalized_payload ?? draft.parsed_payload);
  if (!payload?.table) throw new DraftStateError(`Draft ${draftId} sem payload válido para sincronização.`);

  const missingFields = validateDraftForSync(payload);
  if (missingFields.length > 0) {
    throw new config.ValidationError(missingFields);
  }

  const contacts = extractContacts(payload);
  const schedules = extractSchedules(payload);
  const imageUpload = await uploadCoverForDraft(draftId, payload, draft.image_upload_attempts ?? 0);
  payload = imageUpload.payload;
  const coverUrl = imageUpload.coverUrl;

  const sourceId = config.getSourceId(messageRow);
  const sourceUrl = config.getSourceUrl(messageRow);
  const gmName = config.getGmName(payload, adminDisplayName);

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
      if (!t.title) throw new config.ValidationError(['title']);
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
    if (!payload.table.title) throw new config.ValidationError(['title']);
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

    await (trx as any)
      .updateTable(config.messageTable)
      .set({ status: 'synced', updated_at: new Date() })
      .where('id', '=', messageRow.id as string)
      .execute();
  });

  if (imageUpload.status && imageUpload.status !== 'success') {
    await notifyAdminsAboutImageFailure(tableId, payload.table.title ?? 'Mesa sem título', imageUpload.status, imageUpload.error);
  }

  return { tableId, created };
}
