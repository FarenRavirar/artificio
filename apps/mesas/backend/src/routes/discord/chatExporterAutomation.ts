import { access, mkdir } from 'fs/promises';
import path from 'path';
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../../db';
import type { NewDiscordImportRun, NewDiscordSetting } from '../../db/types';
import { DISCORD_CHAT_EXPORTER_RETENTION } from '../../discord/chatExporterAutomationConfig';
import { buildChatExporterCliCommand, redactedChatExporterCliCommand, runChatExporterCli } from '../../discord/chatExporterCliRunner';
import { processDiscordChatExporterFolder } from '../../discord/chatExporterFolderImportService';
import { encryptDiscordSetting, decryptDiscordSetting, DiscordSettingsSecretUnavailableError, DiscordSettingsDecryptError } from '../../discord/settingsCrypto';
import { requireAdmin } from '../../middleware/auth';

const router = Router();

const CONFIG_KEY = 'chat_exporter_config';
const TOKEN_KEY = 'chat_exporter_token';
const COOKIES_KEY = 'chat_exporter_cookies';

const frequencySchema = z.enum(['hourly', 'daily', 'weekly']);

const configSchema = z.object({
  enabled: z.boolean().default(false),
  frequency: frequencySchema.default('daily'),
  time: z.string().regex(/^\d{2}:\d{2}$/, 'Horário deve estar em HH:MM.').default('03:20'),
  timezone: z.string().trim().min(1).default('America/Sao_Paulo'),
  binary: z.string().trim().min(1).default('DiscordChatExporter.Cli'),
  importDir: z.string().trim().min(1),
  channelId: z.string().trim().regex(/^\d{5,30}$/, 'Canal Discord inválido.'),
  after: z.string().trim().optional(),
});

const updateSchema = configSchema.partial().extend({
  token: z.string().trim().min(10).optional(),
  cookies: z.string().trim().min(3).optional(),
  clearToken: z.boolean().optional(),
  clearCookies: z.boolean().optional(),
});

type ChatExporterConfig = z.infer<typeof configSchema>;

function defaultConfig(): Partial<ChatExporterConfig> {
  return {
    enabled: false,
    frequency: 'daily',
    time: '03:20',
    timezone: 'America/Sao_Paulo',
    binary: 'DiscordChatExporter.Cli',
  };
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
  cookies: string | null;
  tokenUpdatedAt: Date | null;
  cookiesUpdatedAt: Date | null;
  configUpdatedAt: Date | null;
  decryptError: boolean;
}> {
  const [configRow, tokenRow, cookiesRow] = await Promise.all([
    getSetting(CONFIG_KEY),
    getSetting(TOKEN_KEY),
    getSetting(COOKIES_KEY),
  ]);

  let token: string | null = null;
  let cookies: string | null = null;
  let decryptError = false;
  try {
    token = tokenRow ? decryptDiscordSetting(tokenRow.value) : null;
    cookies = cookiesRow ? decryptDiscordSetting(cookiesRow.value) : null;
  } catch (error: unknown) {
    if (error instanceof DiscordSettingsDecryptError) decryptError = true;
    else throw error;
  }

  return {
    config: { ...defaultConfig(), ...parseStoredConfig(configRow?.value) },
    token,
    cookies,
    tokenUpdatedAt: tokenRow?.updated_at ?? null,
    cookiesUpdatedAt: cookiesRow?.updated_at ?? null,
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
    cookies: {
      is_set: Boolean(loaded.cookies),
      preview: loaded.cookies ? maskSecret(loaded.cookies) : null,
      updated_at: loaded.cookiesUpdatedAt,
    },
    updated_at: loaded.configUpdatedAt,
    decrypt_error: loaded.decryptError,
  };
}

function configErrors(config: Partial<ChatExporterConfig>, token: string | null): string[] {
  const errors: string[] = [];
  const parsed = configSchema.safeParse(config);
  if (!parsed.success) errors.push(...parsed.error.issues.map((issue) => issue.message));
  if (!token) errors.push('Token do DiscordChatExporter ausente.');
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

async function runFolderImport(rootDir: string, userId: string | undefined) {
  const result = await processDiscordChatExporterFolder({
    rootDir,
    retention: DISCORD_CHAT_EXPORTER_RETENTION,
  });
  const totals = result.files.reduce(
    (acc, file) => {
      acc.total += file.result?.total ?? 0;
      acc.inserted += file.result?.inserted ?? 0;
      acc.updated += file.result?.updated ?? 0;
      acc.ignored += file.result?.ignored ?? 0;
      acc.failed += file.result?.failed ?? 0;
      if (file.status === 'error') acc.failed += 1;
      return acc;
    },
    { total: 0, inserted: 0, updated: 0, ignored: 0, failed: 0 },
  );

  await db.insertInto('discord_import_runs')
    .values({
      source_kind: 'discord_chat_exporter_manual',
      total_messages: totals.total,
      drafts_created: totals.inserted,
      drafts_updated: totals.updated,
      messages_ignored: totals.ignored,
      messages_failed: totals.failed,
      ended_at: new Date(),
      note: `manual folder=${result.rootDir}; files=${result.incoming}; processed=${result.processed}; errors=${result.errors}`,
      created_by: userId ?? null,
    } as NewDiscordImportRun)
    .execute();

  return result;
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
    const { token, cookies, clearToken, clearCookies, ...patch } = parsed.data;
    const nextConfig = { ...current.config, ...patch };
    const safeConfig = configSchema.partial().parse(nextConfig);
    await upsertSetting(CONFIG_KEY, JSON.stringify(safeConfig));
    if (token) await upsertSetting(TOKEN_KEY, encryptDiscordSetting(token));
    if (cookies) await upsertSetting(COOKIES_KEY, encryptDiscordSetting(cookies));
    if (clearToken) await deleteSetting(TOKEN_KEY);
    if (clearCookies) await deleteSetting(COOKIES_KEY);
    return res.json({ data: publicConfig(await loadConfig()) });
  } catch (error: unknown) {
    return sendError(res, error, '[PUT /admin/discord/chat-exporter/config]');
  }
});

router.post('/test', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const loaded = await loadConfig();
    const errors = configErrors(loaded.config, loaded.token);
    const parsed = configSchema.safeParse(loaded.config);
    if (parsed.success) {
      const binaryError = await validateBinary(parsed.data.binary);
      if (binaryError) errors.push(binaryError);
    }
    const command = parsed.success && loaded.token
      ? redactedChatExporterCliCommand(buildChatExporterCliCommand({
          binary: parsed.data.binary,
          token: loaded.token,
          channelId: parsed.data.channelId,
          outputDir: path.join(parsed.data.importDir, 'incoming'),
          cookies: loaded.cookies ?? undefined,
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
    const binaryError = await validateBinary(parsed.data.binary);
    if (binaryError) return res.status(422).json({ error: binaryError });

    const incomingDir = path.join(parsed.data.importDir, 'incoming');
    await mkdir(incomingDir, { recursive: true });
    const exportResult = await runChatExporterCli({
      binary: parsed.data.binary,
      token: loaded.token,
      channelId: parsed.data.channelId,
      outputDir: incomingDir,
      cookies: loaded.cookies ?? undefined,
      after: parsed.data.after,
    });
    const importResult = await runFolderImport(parsed.data.importDir, req.user?.userId);
    return res.json({ data: { exported: exportResult, imported: importResult } });
  } catch (error: unknown) {
    return sendError(res, error, '[POST /admin/discord/chat-exporter/run]');
  }
});

export default router;
