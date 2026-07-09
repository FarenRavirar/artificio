import { db } from '../db';
import { Insertable } from 'kysely';
import { TablesTable, TableContactsTable, TableSchedulesTable, DayOfWeek, ScheduleFrequency, TableContactChannel } from '../db/types';
import { TableRepository } from '../repositories/tableRepository';
import { TableService } from '../services/tableService';
import type { DiscordImageUploadStatus, ImportTableDraft } from './types';
import { uploadDiscordImageToCloudinary } from './uploadDiscordImage';
import { getDiscordBotToken } from './config';
import { extractDraftScope, recordParseFeedback } from './parseLearning';
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

// DEB-058-06 (2026-07-08): renomeado de hasPositiveNumber (v > 0) pra
// hasNonNegativeNumber (v >= 0) — "Vagas: 0" é mesa fechada/em andamento
// (estado legítimo, spec 017 Fase E), não campo faltando. v>0 rejeitava esse
// caso; só null/undefined/negativo/não-número devem contar como ausente.
// Frontend já tratava 0 como válido (parseOptionalNonNegativeInt), só o
// backend divergia — achado ao unificar getMissingFields (parse) com esta
// função (sync) em normalizeDiscordTableDraft.ts.
export function hasNonNegativeNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0;
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
  const result = `${h}:${m}`;
  return isValidTime(result) ? result : null;
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
  _homebrew_suspect: z.unknown(),
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

// Pick<...,'table'> (achado CodeRabbit PR #135): a função só lê draft.table;
// assinatura estreita permite normalizeDiscordTableDraft chamar sem cast e
// sem inventar source/confidence — se um dia precisar de outro campo, o
// compilador aponta os chamadores em vez de cast mascarar.
export function validateDraftForSync(draft: Pick<ImportTableDraft, 'table'>): string[] {
  const missing: string[] = [];
  const t = draft.table;

  if (!hasText(t.title)) missing.push('title');
  if (!hasText(t.description)) missing.push('description');
  if (!hasText(t.system_id)) missing.push('system_id');
  if (!hasText(t.type) || !VALID_TABLE_TYPES.includes(t.type)) missing.push('type');
  if (!hasText(t.modality) || !VALID_MODALITIES.includes(t.modality)) missing.push('modality');
  if (!hasText(t.price_type) || !VALID_PRICE_TYPES.includes(t.price_type)) missing.push('price_type');
  if (!hasNonNegativeNumber(t.slots_total) && !hasNonNegativeNumber(t.slots_open)) missing.push('slots_total');
  if (!hasText(t.contact_url) && !hasText(t.contact_discord) && !hasText(t.host_discord_id)) {
    missing.push('contact_url/contact_discord');
  }
  if (!isDayOfWeek(t.day_of_week)) missing.push('day_of_week');
  if (!isValidTime(t.start_time)) missing.push('start_time');

  return missing;
}

// Local-part e domínio como sequência de segmentos SEM `.` unidos por `.` (em vez
// de `[^\s@]+@[^\s@]+\.[^\s@]+`, onde os dois `[^\s@]+` gulosos se sobrepõem e o
// motor backtracka exponencialmente em texto longo sem `@`/`.` válido).
const EMAIL_PATTERN = /[^\s@.]+(?:\.[^\s@.]+)*@[^\s@.]+(?:\.[^\s@.]+)+/;
const BR_PHONE_PATTERN = /\(?\d{2}\)?\s?9?\d{4}-?\d{4}/;

/**
 * Fase F (spec 058): categoriza URL/texto de contato no enum real de `TableContactChannel`
 * (whatsapp | discord | phone | email | facebook | instagram | form), em vez de tudo que não
 * é Discord cair em `'form'` genérico.
 */
// Domínios facebook/instagram também são reconhecidos em services/linkService.ts
// (detectLinkType) para outro enum (LinkType). Duplicado por serem enums/propósitos
// diferentes (canal de contato de mesa vs link de perfil) — se adicionar domínio
// alternativo aqui (ex.: fb.watch), replicar lá também.
function classifyContactChannel(rawUrl: string): TableContactChannel {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol === 'mailto:') return 'email';
    if (parsed.protocol === 'tel:') return 'phone';
    const host = parsed.hostname;
    if (host === 'discord.com' || host.endsWith('.discord.com') || host === 'discord.gg' || host.endsWith('.discord.gg')) {
      return 'discord';
    }
    if (host === 'wa.me' || host.endsWith('.wa.me') || host === 'api.whatsapp.com' || host === 'chat.whatsapp.com') {
      return 'whatsapp';
    }
    if (host === 'facebook.com' || host.endsWith('.facebook.com') || host === 'fb.com' || host.endsWith('.fb.com')) {
      return 'facebook';
    }
    if (host === 'instagram.com' || host.endsWith('.instagram.com')) {
      return 'instagram';
    }
    return 'form';
  } catch {
    if (EMAIL_PATTERN.test(rawUrl)) return 'email';
    if (BR_PHONE_PATTERN.test(rawUrl)) return 'phone';
    return 'form';
  }
}

export function extractContacts(
  draft: ImportTableDraft
): Array<Omit<Insertable<TableContactsTable>, 'table_id'>> {
  const contacts: Array<Omit<Insertable<TableContactsTable>, 'table_id'>> = [];

  if (draft.table.contact_discord) {
    // Snowflake ID cru (fallback de autor) ou mention <@id> (extraída do texto)
    // não são legíveis na UI sem rótulo — value vira o link/menção, label vira
    // o texto exibido (achado do mantenedor 2026-07-07: nome de exibição != contato).
    const label = /^(\d{17,20}|<@!?\d{17,20}>)$/.test(draft.table.contact_discord) ? 'Perfil Discord' : null;
    contacts.push({ channel: 'discord', value: draft.table.contact_discord, label, discord_server_url: null });
  }

  if (draft.table.contact_url) {
    const rawUrl = draft.table.contact_url;
    const channel = classifyContactChannel(rawUrl);
    if (!contacts.some((c) => c.channel === channel && c.value === rawUrl)) {
      contacts.push({ channel, value: rawUrl, label: 'Ticket / Inscrição', discord_server_url: null });
    }
  }

  // Fase G (spec 058): "o usuario do discord se tiver nada" — sem contact_url/contact_discord
  // explícito extraído, o autor Discord da mensagem original (host_discord_id) vira contato
  // de fallback, em vez do draft ficar sem nenhum canal de contato.
  if (contacts.length === 0 && draft.table.host_discord_id) {
    contacts.push({ channel: 'discord', value: draft.table.host_discord_id, label: 'Autor da mensagem (Discord)', discord_server_url: null });
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
  return {
    ...buildTableDraftFields(draft, source.gmName, coverUrl),
    slug,
    gm_id: null,
    audience: 'livre',
    language: 'pt-BR',
    publisher_role: 'announcer',
    origin: 'imported',
    source_id: source.sourceId,
    source_url: source.sourceUrl ?? null,
    status: 'draft',
    rules_notes: null,
    is_ddal: false,
  };
}

// Legado (achado do mantenedor 2026-07-08): pipeline Discord gravou age_rating
// no formato invertido `18+` (enum Postgres real é `+18`) em drafts antigos —
// payload já persistido continua estourando o sync mesmo após o fix do parser.
// Normaliza `NN+` para `+NN`; valor não reconhecido vira null (não trava sync,
// campo é opcional).
const VALID_AGE_RATINGS = new Set(['livre', '+10', '+12', '+14', '+16', '+18']);
function normalizeAgeRating(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (VALID_AGE_RATINGS.has(trimmed)) return trimmed;
  const inverted = /^(\d{2})\+$/.exec(trimmed);
  if (inverted && VALID_AGE_RATINGS.has(`+${inverted[1]}`)) return `+${inverted[1]}`;
  return null;
}

// CHECK check_slots_valid (Postgres): slots_open >= 0 AND slots_filled >= 0
// AND slots_open <= slots_total. Parser pode extrair valores ambíguos onde
// slots_open > slots_total (ex.: "vagas 5/3" mal interpretado) — sem clamp
// o insert quebrava 500 direto do Postgres em vez de dado consistente
// (achado do mantenedor 2026-07-08, mesma classe do bug age_rating/gm_name).
function normalizeSlots(
  rawTotal: number | null | undefined,
  rawFilled: number | null | undefined,
  rawOpen: number | null | undefined,
): { slots_total: number; slots_filled: number; slots_open: number } {
  const total = Math.max(0, rawTotal ?? rawOpen ?? 0);
  const open = Math.min(Math.max(0, rawOpen ?? rawTotal ?? 0), total);
  const filled = Math.min(Math.max(0, rawFilled ?? 0), total);
  return { slots_total: total, slots_filled: filled, slots_open: open };
}

function buildTableDraftFields(
  draft: ImportTableDraft,
  gmName: string | null,
  coverUrl: string | null,
): Omit<Insertable<TablesTable>,
  'slug' | 'gm_id' | 'audience' | 'language' | 'publisher_role' | 'origin' | 'source_id' | 'source_url' | 'status' | 'rules_notes' | 'is_ddal'
> {
  const t = draft.table;
  if (!t.title) throw new DraftStateError('Título obrigatório para sync.');

  return {
    system_id: t.system_id ?? null,
    scenario_id: t.scenario_id ?? null,
    title: t.title,
    description: t.description ?? null,
    type: t.type ?? 'campanha',
    age_rating: normalizeAgeRating(t.age_rating) as Insertable<TablesTable>['age_rating'],
    modality: t.modality ?? 'online',
    vtt_platform_id: t.vtt_platform_id ?? null,
    communication_platform_id: t.communication_platform_id ?? null,
    price_type: t.price_type ?? 'gratuita',
    price_value: t.price_value ?? null,
    price_frequency: t.price_type === 'paga' ? 'sessao' : null,
    ...normalizeSlots(t.slots_total, t.slots_filled, t.slots_open),
    experience_level: t.experience_level ?? 'todos',
    table_level: t.table_level ?? null,
    setting_name: t.setting_name ?? null,
    setting_styles: t.setting_styles ?? null,
    requires_pc: t.requires_pc ?? false,
    requires_camera: t.requires_camera ?? false,
    requires_microphone: t.requires_microphone ?? false,
    session_zero_free: t.session_zero_free ?? false,
    actual_gm_name: gmName,
    // Bug reportado pelo mantenedor 2026-07-08: mesa sincronizada do Discord
    // nascia marcada como "Covil do Lich" sem checagem de origem — draft não
    // carrega esse dado, badge deve ser opt-in manual do admin (PUT
    // /api/v1/admin/tables/:id aceita is_covil), nunca default automático.
    is_covil: false,
    cover_url: coverUrl,
    banner_url: coverUrl,
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
  coverPublicId: string | null;
  status: DiscordImageUploadStatus | null;
  attempts: number;
  error: string | null;
}> {
  const existingCover = typeof payload.table.cover_url === 'string' && payload.table.cover_url.trim()
    ? payload.table.cover_url.trim()
    : null;
  if (existingCover) {
    return { payload, coverUrl: existingCover, coverPublicId: null, status: null, attempts: currentAttempts, error: null };
  }

  const sourceUrl = readCoverSource(payload);
  if (!sourceUrl) {
    return { payload, coverUrl: null, coverPublicId: null, status: null, attempts: currentAttempts, error: null };
  }

  const attempts = currentAttempts + 1;
  const botToken = await getDiscordBotToken().catch(() => null);
  const result = await uploadDiscordImageToCloudinary(sourceUrl, { botToken });
  if (result.status === 'success') {
    return {
      payload: withCoverUrl(payload, result.url),
      coverUrl: result.url,
      coverPublicId: result.public_id,
      status: 'success',
      attempts,
      error: null,
    };
  }

  console.warn('[discord-image-upload] upload failed', { draftId, status: result.status, error: result.error });
  return {
    payload: withCoverUrl(payload, null),
    coverUrl: null,
    coverPublicId: null,
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
  coverPublicId?: string | null,
): Promise<void> {
  const setValues: Record<string, unknown> = {
    normalized_payload: payload,
    image_upload_status: status,
    image_upload_attempts: attempts,
    image_upload_last_error: error,
    image_upload_last_at: new Date(),
    updated_at: new Date(),
  };
  if (coverPublicId !== undefined) {
    setValues.cover_public_id = coverPublicId;
  }
  await db
    .updateTable('discord_import_table_drafts')
    .set(setValues as any)
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

  // REV-026: persiste o cover_public_id ANTES da etapa de sync, que ainda pode
  // falhar. Sem isso, uma falha entre o upload e a transação final deixaria o
  // asset Cloudinary órfão sem handle — o cron de limpeza (TTL 30d) não o
  // encontraria. A transação final zera cover_public_id ao consumir a imagem.
  if (imageUpload.coverPublicId) {
    await updateDraftImageUploadState(
      draftId,
      payload,
      imageUpload.status ?? 'success',
      imageUpload.attempts,
      imageUpload.error,
      imageUpload.coverPublicId,
    );
  }

  const sourceId = config.getSourceId(messageRow);
  const sourceUrl = config.getSourceUrl(messageRow);
  const gmName = config.getGmName(payload, adminDisplayName);

  // CHECK tables_announcer_requires_name (Postgres): publisher_role='announcer'
  // (sempre, nesse pipeline) exige actual_gm_name não-nulo com >=2 chars após
  // trim. gmName vem de payload.source.author_name (Discord API não garante
  // presença) ou adminDisplayName — nenhum dos dois validado antes. Sem esse
  // check, insert quebrava com 500 do Postgres em vez de 422 com mensagem
  // clara (achado do mantenedor 2026-07-08, mesma classe do bug age_rating).
  if (!gmName || gmName.trim().length < 2) {
    throw new config.ValidationError(['gm_name']);
  }

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
      if (!payload.table.title) throw new config.ValidationError(['title']);
      await trx
        .updateTable('tables')
        .set({
          ...buildTableDraftFields(payload, gmName, coverUrl),
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
        cover_public_id: null,   // WS1: imagem já consumida pela mesa, sai do escopo de órfãs
        updated_at: new Date(),
      })
      .where('id', '=', draftId)
      .execute();

    await (trx as any)
      .updateTable(config.messageTable)
      .set({ status: 'synced', updated_at: new Date() })
      .where('id', '=', messageRow.id as string)
      .execute();

    // Codex P2 (T-G7): fecha o outcome real da decisão shadow (no-op p/ inbox, sem linha shadow).
    await trx
      .updateTable('discord_shadow_decisions')
      .set({ actual_outcome: 'synced', actual_at: new Date() })
      .where('draft_id', '=', draftId)
      .where('actual_outcome', 'is', null)
      .execute();
  });

  if (imageUpload.status && imageUpload.status !== 'success') {
    await notifyAdminsAboutImageFailure(tableId, payload.table.title ?? 'Mesa sem título', imageUpload.status, imageUpload.error);
  }

  await recordParseFeedback({
    draftId,
    feedbackType: 'publish',
    beforeValue: draft.status,
    afterValue: 'synced',
    reason: created ? 'sync_created_table' : 'sync_updated_table',
    scope: extractDraftScope(payload),
    adminUserId: null,
  });

  return { tableId, created };
}
