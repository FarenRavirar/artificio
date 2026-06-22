import { db } from '../db';
import { Insertable } from 'kysely';
import { TablesTable, TableContactsTable, TableSchedulesTable, DayOfWeek, ScheduleFrequency, TableContactChannel } from '../db/types';
import type { DiscordImageUploadStatus, ImportTableDraft } from './types';
import { uploadDiscordImageToCloudinary } from './uploadDiscordImage';

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
  if (!hasText(t.start_time)) missing.push('start_time');

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

export function extractSchedules(
  draft: ImportTableDraft
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

export function buildTableData(
  draft: ImportTableDraft,
  source: { sourceId: string; sourceUrl: string | null; gmName: string | null },
  slug: string,
  coverUrl: string | null
): Insertable<TablesTable> {
  const t = draft.table;
  if (!t.title) throw new Error('Título obrigatório para sync.');

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
