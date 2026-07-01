import { access, mkdir } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { sql } from 'kysely';
import { db } from '../../db';
import type {
  DiscordChatExporterProfile,
  NewDiscordChatExporterProfile,
  NewDiscordSetting,
} from '../../db/types';
import { buildChatExporterCliCommand, redactedChatExporterCliCommand, runChatExporterCli } from '../../discord/chatExporterCliRunner';
import { discoverChannelDelta, DiscordDiscoveryError } from '../../discord/discovery';
import { resolveChatExporterBinary, runFolderImport, runProfileExport } from '../../discord/chatExporterProfileRunner';
import { getDiscordBotToken } from '../../discord/config';
import { encryptDiscordSetting, decryptDiscordSetting, DiscordSettingsSecretUnavailableError, DiscordSettingsDecryptError } from '../../discord/settingsCrypto';
import { requireAdmin } from '../../middleware/auth';

const router = Router();

const CONFIG_KEY = 'chat_exporter_config';
const TOKEN_KEY = 'chat_exporter_token';

const frequencySchema = z.enum(['hourly', 'daily', 'weekly']);
const includeThreadsSchema = z.enum(['none', 'active', 'all']);
const authTypeSchema = z.enum(['global', 'user', 'bot']);
const uuidParamSchema = z.object({ id: z.uuid() });

const configSchema = z.object({
  enabled: z.boolean().default(false),
  authType: authTypeSchema.default('user'),
  frequency: frequencySchema.default('daily'),
  time: z.string().regex(/^\d{2}:\d{2}$/, 'Horário deve estar em HH:MM.').default('03:20'),
  timezone: z.string().trim().min(1).default('America/Sao_Paulo'),
  importDir: z.string().trim().min(1),
  channelId: z.string().trim().regex(/^\d{5,30}$/, 'Canal Discord inválido.'),
  after: z.string().trim().optional(),
});

const updateSchema = configSchema.partial().extend({
  token: z.string().trim().min(10).optional(),
  clearToken: z.boolean().optional(),
});

const profileCreateSchema = z.object({
  label: z.string().trim().min(2).max(80),
  guild_id: z.string().trim().regex(/^\d{1,30}$/, 'Servidor Discord inválido.'),
  guild_name: z.string().trim().max(120).nullable().optional(),
  channel_id: z.string().trim().regex(/^\d{5,30}$/, 'Canal Discord inválido.'),
  channel_name: z.string().trim().max(120).nullable().optional(),
  auth_type: authTypeSchema.default('global'),
  token: z.string().trim().min(10).optional(),
  include_threads: includeThreadsSchema.default('active'),
  after: z.string().trim().optional(),
  media: z.boolean().default(false),
  schedule_enabled: z.boolean().default(false),
  frequency: frequencySchema.default('daily'),
  time: z.string().regex(/^\d{2}:\d{2}$/, 'Horário deve estar em HH:MM.').default('03:20'),
  timezone: z.string().trim().min(1).default('America/Sao_Paulo'),
  enabled: z.boolean().default(true),
});

const profileUpdateSchema = profileCreateSchema.partial().extend({
  clearToken: z.boolean().optional(),
});

type ChatExporterConfig = z.infer<typeof configSchema>;

function defaultConfig(): Partial<ChatExporterConfig> {
  return {
    enabled: false,
    authType: 'user',
    frequency: 'daily',
    time: '03:20',
    timezone: 'America/Sao_Paulo',
  };
}

function defaultImportDir(profileId: string): string {
  const base = process.env.DISCORD_CHAT_EXPORTER_IMPORT_BASE_DIR?.trim()
    || process.env.DISCORD_CHAT_EXPORTER_IMPORT_DIR?.trim()
    || '/data/chat-exporter';
  return path.join(base, profileId);
}

function maskSecret(value: string): string {
  return value.length <= 8 ? '****' : `${value.slice(0, 4)}...${value.slice(-4)}`;
}

async function getSetting(key: string): Promise<{ value: string; updated_at: Date } | undefined> {
  return db
    .selectFrom('discord_settings')
    .select(['value', 'updated_at'])
    .where('guild_id', 'is', null)
    .where('key', '=', key)
    .executeTakeFirst();
}

async function upsertSetting(key: string, value: string): Promise<Date> {
  const existing = await db
    .selectFrom('discord_settings')
    .select('id')
    .where('guild_id', 'is', null)
    .where('key', '=', key)
    .executeTakeFirst();
  const now = new Date();
  const row = existing
    ? await db.updateTable('discord_settings')
        .set({ value, updated_at: now })
        .where('id', '=', existing.id)
        .returning(['updated_at'])
        .executeTakeFirstOrThrow()
    : await db.insertInto('discord_settings')
        .values({ guild_id: null, key, value, updated_at: now } satisfies NewDiscordSetting)
        .returning(['updated_at'])
        .executeTakeFirstOrThrow();
  return row.updated_at;
}

async function deleteSetting(key: string): Promise<void> {
  await db.deleteFrom('discord_settings')
    .where('guild_id', 'is', null)
    .where('key', '=', key)
    .execute();
}

function toNullableDate(value: string | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getTimeZoneOffsetMs(timeZone: string, date: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);
  const map: Record<string, string> = {};
  for (const part of parts) map[part.type] = part.value;
  const asUtc = Date.UTC(Number(map.year), Number(map.month) - 1, Number(map.day), Number(map.hour), Number(map.minute), Number(map.second));
  return asUtc - date.getTime();
}

// "after" chega sem offset (ex.: datetime-local "2026-07-01T09:00"); interpretar
// como horário local do timezone do perfil evita deslocar o cutoff quando o
// runtime do servidor não está na mesma timezone (E-tz-after).
function toNullableDateInZone(value: string | undefined, timeZone: string): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!match) return toNullableDate(value);
  const [, year, month, day, hour, minute, second] = match;
  const guessUtcMs = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second ?? '0'));
  const offsetMs = getTimeZoneOffsetMs(timeZone, new Date(guessUtcMs));
  const date = new Date(guessUtcMs - offsetMs);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseStoredConfig(value: string | undefined): Partial<ChatExporterConfig> {
  if (!value) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    const safe = configSchema.partial().safeParse(parsed);
    return safe.success ? safe.data : {};
  } catch {
    return {};
  }
}

async function loadConfig(): Promise<{
  config: Partial<ChatExporterConfig>;
  token: string | null;
  tokenUpdatedAt: Date | null;
  configUpdatedAt: Date | null;
  decryptError: boolean;
}> {
  const [configRow, tokenRow] = await Promise.all([
    getSetting(CONFIG_KEY),
    getSetting(TOKEN_KEY),
  ]);

  let token: string | null = null;
  let decryptError = false;
  try {
    token = tokenRow ? decryptDiscordSetting(tokenRow.value) : null;
  } catch (error: unknown) {
    if (error instanceof DiscordSettingsDecryptError) decryptError = true;
    else throw error;
  }

  return {
    config: { ...defaultConfig(), ...parseStoredConfig(configRow?.value) },
    token,
    tokenUpdatedAt: tokenRow?.updated_at ?? null,
    configUpdatedAt: configRow?.updated_at ?? null,
    decryptError,
  };
}

function publicConfig(loaded: Awaited<ReturnType<typeof loadConfig>>) {
  const config = loaded.config;
  return {
    ...config,
    token: {
      is_set: Boolean(loaded.token),
      preview: loaded.token ? maskSecret(loaded.token) : null,
      updated_at: loaded.tokenUpdatedAt,
    },
    updated_at: loaded.configUpdatedAt,
    decrypt_error: loaded.decryptError,
  };
}

function publicProfile(row: DiscordChatExporterProfile) {
  // Nunca vazar o token cifrado: remover token_enc do payload público.
  const { token_enc, ...rest } = row;
  return {
    ...rest,
    token: {
      is_set: Boolean(token_enc),
      preview: token_enc ? '****' : null,
      updated_at: row.updated_at,
    },
  };
}

async function decryptProfileToken(row: DiscordChatExporterProfile): Promise<string | null> {
  if (!row.token_enc) return null;
  return decryptDiscordSetting(row.token_enc);
}

async function resolveProfileToken(row: DiscordChatExporterProfile, loaded: Awaited<ReturnType<typeof loadConfig>>): Promise<{
  token: string | null;
  mode: 'user' | 'bot';
  source: 'profile' | 'global' | 'env' | 'missing';
}> {
  const configuredGlobalMode = loaded.config.authType === 'bot' ? 'bot' : 'user';
  const mode = row.auth_type === 'global' ? configuredGlobalMode : row.auth_type;
  const profileToken = await decryptProfileToken(row);
  if (profileToken) return { token: profileToken, mode, source: 'profile' };
  if (mode === 'user') {
    return { token: loaded.token, mode, source: loaded.token ? 'global' : 'missing' };
  }
  const botToken = await getDiscordBotToken();
  return { token: botToken ?? null, mode, source: botToken ? 'global' : 'missing' };
}

async function loadProfile(id: string): Promise<DiscordChatExporterProfile | undefined> {
  return db
    .selectFrom('discord_chat_exporter_profiles')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst();
}

function configErrors(config: Partial<ChatExporterConfig>, token: string | null): string[] {
  const errors: string[] = [];
  const parsed = configSchema.safeParse(config);
  if (!parsed.success) errors.push(...parsed.error.issues.map((issue) => issue.message));
  if (!token) errors.push('Token do DiscordChatExporter ausente.');
  return errors;
}

function profileErrors(profile: DiscordChatExporterProfile, token: string | null): string[] {
  const errors: string[] = [];
  if (!profile.enabled) errors.push('Perfil desativado.');
  if (!token) errors.push('Token ausente: salve a credencial global escolhida ou um token neste perfil.');
  if (!profile.import_dir) errors.push('Diretório de importação ausente.');
  return errors;
}

async function validateBinary(binary: string): Promise<string | null> {
  if (!binary.includes('/') && !binary.includes('\\')) return null;
  try {
    await access(binary);
    return null;
  } catch {
    return `Binário não encontrado: ${binary}`;
  }
}

function sendError(res: Response, error: unknown, fallbackMessage: string): Response {
  if (error instanceof DiscordSettingsSecretUnavailableError) {
    return res.status(503).json({ error: error.message });
  }
  console.error(fallbackMessage, error);
  return res.status(500).json({ error: 'Erro na automação do DiscordChatExporter.' });
}

router.get('/config', requireAdmin, async (_req: Request, res: Response) => {
  try {
    return res.json({ data: publicConfig(await loadConfig()) });
  } catch (error: unknown) {
    return sendError(res, error, '[GET /admin/discord/chat-exporter/config]');
  }
});

router.put('/config', requireAdmin, async (req: Request, res: Response) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Configuração inválida.', details: z.flattenError(parsed.error) });
  }

  try {
    const current = await loadConfig();
    const { token, clearToken, ...patch } = parsed.data;
    const nextConfig = { ...current.config, ...patch };
    const safeConfig = configSchema.partial().parse(nextConfig);
    await upsertSetting(CONFIG_KEY, JSON.stringify(safeConfig));
    if (token) await upsertSetting(TOKEN_KEY, encryptDiscordSetting(token));
    if (clearToken) await deleteSetting(TOKEN_KEY);
    return res.json({ data: publicConfig(await loadConfig()) });
  } catch (error: unknown) {
    return sendError(res, error, '[PUT /admin/discord/chat-exporter/config]');
  }
});

router.get('/profiles', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const rows = await db
      .selectFrom('discord_chat_exporter_profiles')
      .selectAll()
      .orderBy('updated_at', 'desc')
      .execute();
    return res.json({ data: rows.map(publicProfile) });
  } catch (error: unknown) {
    return sendError(res, error, '[GET /admin/discord/chat-exporter/profiles]');
  }
});

router.post('/profiles', requireAdmin, async (req: Request, res: Response) => {
  const parsed = profileCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Perfil inválido.', details: z.flattenError(parsed.error) });
  }

  try {
    const { token, after, ...profile } = parsed.data;
    // Gerar o id no código p/ derivar import_dir num único INSERT (sem UPDATE extra).
    const id = randomUUID();
    const now = new Date();
    const row = await db.insertInto('discord_chat_exporter_profiles')
      .values({
        id,
        ...profile,
        guild_name: profile.guild_name ?? null,
        channel_name: profile.channel_name ?? null,
        auth_type: profile.auth_type,
        token_enc: token ? encryptDiscordSetting(token) : null,
        after: toNullableDateInZone(after, profile.timezone),
        import_dir: defaultImportDir(id),
        created_at: now,
        updated_at: now,
      } satisfies NewDiscordChatExporterProfile)
      .returningAll()
      .executeTakeFirstOrThrow();
    return res.status(201).json({ data: publicProfile(row) });
  } catch (error: unknown) {
    return sendError(res, error, '[POST /admin/discord/chat-exporter/profiles]');
  }
});

router.patch('/profiles/:id', requireAdmin, async (req: Request, res: Response) => {
  const params = uuidParamSchema.safeParse(req.params);
  const parsed = profileUpdateSchema.safeParse(req.body);
  if (!params.success) {
    return res.status(400).json({ error: 'Perfil inválido.', details: z.flattenError(params.error) });
  }
  if (!parsed.success) {
    return res.status(400).json({ error: 'Perfil inválido.', details: z.flattenError(parsed.error) });
  }

  try {
    const existing = await loadProfile(params.data.id);
    if (!existing) return res.status(404).json({ error: 'Perfil não encontrado.' });

    const { token, clearToken, after, ...patch } = parsed.data;
    const update: Record<string, unknown> = {
      ...patch,
      updated_at: new Date(),
    };
    if ('guild_name' in patch) update.guild_name = patch.guild_name ?? null;
    if ('channel_name' in patch) update.channel_name = patch.channel_name ?? null;
    if (after !== undefined) update.after = toNullableDateInZone(after, patch.timezone ?? existing.timezone);
    if (token) update.token_enc = encryptDiscordSetting(token);
    if (clearToken) update.token_enc = null;

    const row = await db.updateTable('discord_chat_exporter_profiles')
      .set(update)
      .where('id', '=', params.data.id)
      .returningAll()
      .executeTakeFirstOrThrow();
    return res.json({ data: publicProfile(row) });
  } catch (error: unknown) {
    return sendError(res, error, '[PATCH /admin/discord/chat-exporter/profiles/:id]');
  }
});

router.delete('/profiles/:id', requireAdmin, async (req: Request, res: Response) => {
  const params = uuidParamSchema.safeParse(req.params);
  if (!params.success) {
    return res.status(400).json({ error: 'Perfil inválido.', details: z.flattenError(params.error) });
  }

  try {
    await db.deleteFrom('discord_chat_exporter_profiles')
      .where('id', '=', params.data.id)
      .execute();
    return res.status(204).send();
  } catch (error: unknown) {
    return sendError(res, error, '[DELETE /admin/discord/chat-exporter/profiles/:id]');
  }
});

/**
 * Última mensagem já importada de um canal (maior snowflake em discord_import_messages).
 * Snowflake é string numérica → ordena por bigint para pegar a mais recente de verdade.
 */
async function lastImportedMessageId(channelId: string): Promise<string | null> {
  const row = await db
    .selectFrom('discord_import_messages')
    .select('discord_message_id')
    .where('discord_channel_id', '=', channelId)
    .orderBy(sql`discord_message_id::bigint`, 'desc')
    .limit(1)
    .executeTakeFirst();
  return row?.discord_message_id ?? null;
}

// GET /profiles/:id/delta — dry-read "a atualizar" por canal antes do run (T6.3/T6.8).
router.get('/profiles/:id/delta', requireAdmin, async (req: Request, res: Response) => {
  const params = uuidParamSchema.safeParse(req.params);
  if (!params.success) {
    return res.status(400).json({ error: 'Perfil inválido.', details: z.flattenError(params.error) });
  }

  try {
    const profile = await loadProfile(params.data.id);
    if (!profile) return res.status(404).json({ error: 'Perfil não encontrado.' });
    const afterMessageId = await lastImportedMessageId(profile.channel_id);
    const delta = await discoverChannelDelta(profile.channel_id, afterMessageId);
    return res.json({ data: delta });
  } catch (error: unknown) {
    if (error instanceof DiscordDiscoveryError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    return sendError(res, error, '[GET /admin/discord/chat-exporter/profiles/:id/delta]');
  }
});

router.post('/profiles/:id/test', requireAdmin, async (req: Request, res: Response) => {
  const params = uuidParamSchema.safeParse(req.params);
  if (!params.success) {
    return res.status(400).json({ error: 'Perfil inválido.', details: z.flattenError(params.error) });
  }

  try {
    const profile = await loadProfile(params.data.id);
    if (!profile) return res.status(404).json({ error: 'Perfil não encontrado.' });
    const loaded = await loadConfig();
    const resolved = await resolveProfileToken(profile, loaded);
    const errors = profileErrors(profile, resolved.token);
    const binaryError = await validateBinary(resolveChatExporterBinary());
    if (binaryError) errors.push(binaryError);
    const command = resolved.token
      ? redactedChatExporterCliCommand(buildChatExporterCliCommand({
          binary: resolveChatExporterBinary(),
          token: resolved.token,
          channelId: profile.channel_id,
          outputDir: path.join(profile.import_dir, 'incoming'),
          after: profile.after?.toISOString(),
          media: profile.media,
        }))
      : null;
    return res.json({ data: { ok: errors.length === 0, errors, command } });
  } catch (error: unknown) {
    return sendError(res, error, '[POST /admin/discord/chat-exporter/profiles/:id/test]');
  }
});

router.post('/profiles/:id/run', requireAdmin, async (req: Request, res: Response) => {
  const params = uuidParamSchema.safeParse(req.params);
  if (!params.success) {
    return res.status(400).json({ error: 'Perfil inválido.', details: z.flattenError(params.error) });
  }

  try {
    const profile = await loadProfile(params.data.id);
    if (!profile) return res.status(404).json({ error: 'Perfil não encontrado.' });
    const loaded = await loadConfig();
    const resolved = await resolveProfileToken(profile, loaded);
    const errors = profileErrors(profile, resolved.token);
    if (!resolved.token || errors.length > 0) {
      return res.status(422).json({ error: 'Perfil incompleto.', details: errors });
    }
    const binaryError = await validateBinary(resolveChatExporterBinary());
    if (binaryError) return res.status(422).json({ error: binaryError });
    return res.json({ data: await runProfileExport(profile, resolved.token, req.user?.userId) });
  } catch (error: unknown) {
    const id = uuidParamSchema.safeParse(req.params);
    if (id.success) {
      await db.updateTable('discord_chat_exporter_profiles')
        .set({ last_status: 'error', last_error: error instanceof Error ? error.message : 'Erro desconhecido.', updated_at: new Date() })
        .where('id', '=', id.data.id)
        .execute()
        .catch(() => undefined);
    }
    return sendError(res, error, '[POST /admin/discord/chat-exporter/profiles/:id/run]');
  }
});

router.post('/test', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const loaded = await loadConfig();
    const errors = configErrors(loaded.config, loaded.token);
    const parsed = configSchema.safeParse(loaded.config);
    const binary = resolveChatExporterBinary();
    if (parsed.success) {
      const binaryError = await validateBinary(binary);
      if (binaryError) errors.push(binaryError);
    }
    const command = parsed.success && loaded.token
      ? redactedChatExporterCliCommand(buildChatExporterCliCommand({
          binary,
          token: loaded.token,
          channelId: parsed.data.channelId,
          outputDir: path.join(parsed.data.importDir, 'incoming'),
          after: parsed.data.after,
        }))
      : null;
    return res.json({ data: { ok: errors.length === 0, errors, command } });
  } catch (error: unknown) {
    return sendError(res, error, '[POST /admin/discord/chat-exporter/test]');
  }
});

router.post('/run', requireAdmin, async (req: Request, res: Response) => {
  try {
    const loaded = await loadConfig();
    const parsed = configSchema.safeParse(loaded.config);
    const errors = configErrors(loaded.config, loaded.token);
    if (!parsed.success || !loaded.token || errors.length > 0) {
      return res.status(422).json({ error: 'Configuração incompleta.', details: errors });
    }
    const binary = resolveChatExporterBinary();
    const binaryError = await validateBinary(binary);
    if (binaryError) return res.status(422).json({ error: binaryError });

    const incomingDir = path.join(parsed.data.importDir, 'incoming');
    await mkdir(incomingDir, { recursive: true });
    const exportResult = await runChatExporterCli({
      binary,
      token: loaded.token,
      channelId: parsed.data.channelId,
      outputDir: incomingDir,
      after: parsed.data.after,
    });
    const importResult = await runFolderImport(parsed.data.importDir, req.user?.userId);
    return res.json({ data: { exported: exportResult, imported: importResult } });
  } catch (error: unknown) {
    return sendError(res, error, '[POST /admin/discord/chat-exporter/run]');
  }
});

export default router;
