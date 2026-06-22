import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import type { DiscordSourceChannelType, NewDiscordSetting } from '../db/types';
import { authMiddleware } from '../middleware/auth';
import type { DiscordImportMessageStatus, DiscordImportDraftStatus } from '../discord';
import { DiscordDiscoveryError, DiscordDraftSyncValidationError, DiscordIngestError, DraftNotFoundError, DraftStateError, assertDraftReadyTransition, discoverDiscordChannels, discoverDiscordGuilds, ingestForumMessages, ingestMessages, refreshDiscordDraftImage, syncDiscordDraftToTable, parseDiscordAnnouncement, normalizeDiscordTableDraft, normalizeDraftPayload } from '../discord';
import type { SystemEntry } from '../discord';
import { requireDiscordBotToken } from '../discord/config';
import { encryptDiscordSetting, decryptDiscordSetting, DiscordSettingsSecretUnavailableError } from '../discord/settingsCrypto';
import { notifyAdmins } from '../services/adminNotifications';

const router = Router();
const DISCORD_API_BASE = 'https://discord.com/api/v10';

function isAdmin(req: Request, res: Response): boolean {
  if ((req as any).user?.role !== 'admin') {
    res.status(403).json({ error: 'Acesso restrito a administradores.' });
    return false;
  }
  return true;
}

// ─── Schemas de validacao ────────────────────────────────────────────────────

const createSourceSchema = z.object({
  guild_id: z.string().min(1),
  channel_id: z.string().min(1),
  channel_name: z.string().optional(),
  channel_type: z.enum(['text', 'announcement', 'forum']).optional(),
  enabled: z.boolean().optional(),
  auto_sync_enabled: z.boolean().optional(),
});

const updateSourceSchema = z.object({
  channel_name: z.string().optional(),
  enabled: z.boolean().optional(),
  auto_sync_enabled: z.boolean().optional(),
});

const updateDraftSchema = z.object({
  normalized_payload: z.record(z.string(), z.unknown()).optional(),
  status: z.enum(['draft', 'ready', 'needs_review', 'rejected']).optional(),
  review_notes: z.string().optional(),
});

const updateMessageSchema = z.object({
  status: z.enum(['pending', 'parsed', 'needs_review', 'synced', 'ignored', 'error']),
});

const fetchSchema = z.object({
  source_id: z.string().uuid(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  before_message_id: z.string().optional(),
  since: z.coerce.date().optional(),
  until: z.coerce.date().optional(),
}).refine((value) => !value.since || !value.until || value.since <= value.until, {
  message: 'Janela de tempo inválida.',
  path: ['until'],
});

const reingestForceSchema = z.object({
  since: z.coerce.date().optional(),
  until: z.coerce.date().optional(),
}).refine((value) => !value.since || !value.until || value.since <= value.until, {
  message: 'Janela de tempo inválida.',
  path: ['until'],
});

const snowflakeParamSchema = z.object({
  guildId: z.string().regex(/^\d{5,30}$/, 'Servidor Discord inválido.'),
});

const botTokenSchema = z.object({
  token: z.string().trim().min(50, 'Token deve ter pelo menos 50 caracteres.').regex(/^\S+$/, 'Token não pode conter espaços.'),
});

const discordMessageDiagnosticSchema = z.object({
  id: z.string(),
  content: z.string().optional().default(''),
  attachments: z.array(z.unknown()).optional().default([]),
  embeds: z.array(z.unknown()).optional().default([]),
  message_reference: z.unknown().optional(),
  flags: z.number().optional(),
});

/** Carrega todos os sistemas e seus aliases do banco para o parser. */
// Embeds/attachments podem vir como array (novo) ou JSON string (dados antigos)
function parseJsonField(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (Array.isArray(record.items)) return record.items;
    if (Array.isArray(record.data)) return record.data;
    return Object.values(record);
  }
  if (typeof value === 'string') {
    try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
  }
  return [];
}

async function fetchDiscordMessageDiagnostic(channelId: string, messageId: string) {
  const token = (await requireDiscordBotToken()).trim();
  const response = await fetch(
    `${DISCORD_API_BASE}/channels/${encodeURIComponent(channelId)}/messages/${encodeURIComponent(messageId)}`,
    { headers: { Authorization: `Bot ${token}` } }
  );
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message = payload && typeof payload === 'object' && 'message' in payload
      ? String((payload as { message?: unknown }).message)
      : 'Discord não respondeu como esperado.';
    throw new DiscordIngestError(message, response.status === 403 ? 403 : 502);
  }

  const parsed = discordMessageDiagnosticSchema.safeParse(payload);
  if (!parsed.success) {
    throw new DiscordIngestError('Discord retornou mensagem em formato inesperado.', 502);
  }

  return parsed.data;
}

async function loadSystemsForParser(): Promise<SystemEntry[]> {
  const systems = await db
    .selectFrom('systems')
    .select(['id', 'name', 'name_pt'])
    .execute();

  const aliases = await db
    .selectFrom('system_aliases')
    .select(['system_id', 'alias'])
    .execute();

  const aliasMap = new Map<string, string[]>();
  for (const a of aliases) {
    const list = aliasMap.get(a.system_id) ?? [];
    list.push(a.alias);
    aliasMap.set(a.system_id, list);
  }

  return systems.map((s) => ({
    id: s.id,
    name: s.name,
    name_pt: s.name_pt,
    aliases: aliasMap.get(s.id) ?? [],
  }));
}

function getUnmatchedSystemHint(draft: ReturnType<typeof normalizeDiscordTableDraft>['draft']): string | null {
  if (draft.table.system_id) return null;
  const hint = draft.table.raw_system_hint ?? draft.table.system_name;
  const normalized = typeof hint === 'string' ? hint.trim() : '';
  return normalized.length > 0 ? normalized : null;
}

async function ensureSystemSuggestionForDraft(
  draft: ReturnType<typeof normalizeDiscordTableDraft>['draft'],
  adminId: string | undefined,
  sourceLabel: string | null | undefined,
): Promise<void> {
  const rawHint = getUnmatchedSystemHint(draft);
  if (!rawHint || !adminId) return;

  const existing = await db
    .selectFrom('system_suggestions')
    .select('id')
    .where('name', '=', rawHint)
    .where('status', 'in', ['pending', 'approved'])
    .executeTakeFirst();

  if (existing) return;

  const createdSuggestion = await db
    .insertInto('system_suggestions')
    .values({
      user_id: adminId,
      name: rawHint,
      name_pt: null,
      node_type: 'system',
      parent_id: null,
      description: `Sugestão automática gerada ao parsear mensagem Discord: "${sourceLabel ?? rawHint}"`,
      aliases: [rawHint],
      status: 'pending',
      reviewed_by: null,
      reviewed_at: null,
      rejection_reason: null,
    })
    .returning(['id', 'name'])
    .executeTakeFirst();

  // Sugestao vinda do Discord: avisa todos os admins para revisarem (origem nao e autoria do admin).
  if (createdSuggestion) {
    await notifyAdmins({
      type: 'system_suggestion',
      title: 'Nova sugestão de sistema (Discord)',
      message: `Sugestão automática "${createdSuggestion.name}" detectada no Discord.`,
      action_url: '/gestao',
      metadata: {
        suggestion_id: createdSuggestion.id,
        suggestion_kind: 'system',
        source: 'discord',
      },
    });
  }
}

async function createOrUpdateDraftFromMessage(
  message: any,
  systems: SystemEntry[],
  adminId?: string,
): Promise<'draft' | 'ignored'> {
  const parsed = parseDiscordAnnouncement({
    source_kind: message.source_kind,
    discord_message_id: message.discord_message_id,
    discord_channel_id: message.discord_channel_id,
    discord_guild_id: message.discord_guild_id,
    discord_parent_channel_id: message.discord_parent_channel_id,
    discord_thread_id: message.discord_thread_id,
    discord_thread_name: message.discord_thread_name,
    discord_author_id: message.discord_author_id,
    discord_author_name: message.discord_author_name,
    discord_message_url: message.discord_message_url,
    content_raw: message.content_raw,
    attachments: parseJsonField(message.attachments),
    embeds: parseJsonField(message.embeds),
    message_created_at: message.message_created_at,
    message_edited_at: message.message_edited_at,
  }, systems);

  if (!parsed) {
    await db.updateTable('discord_import_messages')
      .set({ status: 'ignored', parse_error: null, updated_at: new Date() })
      .where('id', '=', message.id)
      .execute();
    return 'ignored';
  }

  const normalized = normalizeDiscordTableDraft(parsed, systems);
  const existingDraft = await db
    .selectFrom('discord_import_table_drafts')
    .select(['id', 'status'])
    .where('discord_message_id', '=', message.id)
    .executeTakeFirst();

  if (existingDraft && existingDraft.status !== 'synced' && existingDraft.status !== 'rejected') {
    await db
      .updateTable('discord_import_table_drafts')
      .set({
        parsed_payload: parsed,
        normalized_payload: normalized.draft,
        confidence: normalized.draft.confidence,
        status: normalized.status,
        review_notes: null,
        updated_at: new Date(),
      })
      .where('id', '=', existingDraft.id)
      .execute();
  } else if (!existingDraft) {
    await db
      .insertInto('discord_import_table_drafts')
      .values({
        discord_message_id: message.id,
        table_id: null,
        parsed_payload: parsed,
        normalized_payload: normalized.draft,
        confidence: normalized.draft.confidence,
        status: normalized.status,
        review_notes: null,
      })
      .execute();
  }

  await db.updateTable('discord_import_messages')
    .set({ status: 'parsed', parse_error: null, updated_at: new Date() })
    .where('id', '=', message.id)
    .execute();

  await ensureSystemSuggestionForDraft(
    normalized.draft,
    adminId,
    message.discord_thread_name ?? message.discord_message_id,
  );

  return 'draft';
}

async function parsePendingMessagesForSource(
  sourceId: string,
  since?: Date,
  until?: Date,
  adminId?: string,
): Promise<{ processed: number; succeeded: number; ignored: number; failed: number }> {
  let query = db
    .selectFrom('discord_import_messages')
    .selectAll()
    .where('source_id', '=', sourceId)
    .where('status', 'in', ['pending', 'error'])
    .orderBy('message_created_at', 'desc')
    .limit(200);

  if (since) query = query.where('message_created_at', '>=', since);
  if (until) query = query.where('message_created_at', '<=', until);

  const messages = await query.execute();
  if (messages.length === 0) return { processed: 0, succeeded: 0, ignored: 0, failed: 0 };

  const systems = await loadSystemsForParser();
  let succeeded = 0;
  let ignored = 0;
  let failed = 0;

  for (const message of messages) {
    try {
      const result = await createOrUpdateDraftFromMessage(message, systems, adminId);
      if (result === 'draft') succeeded++;
      else ignored++;
    } catch (error: unknown) {
      await db.updateTable('discord_import_messages')
        .set({
          status: 'error',
          parse_error: error instanceof Error ? error.message : 'Erro no parse automatico',
          updated_at: new Date(),
        })
        .where('id', '=', message.id)
        .execute();
      failed++;
    }
  }

  return { processed: messages.length, succeeded, ignored, failed };
}

function maskToken(token: string): string {
  return `${token.slice(0, 4)}...${token.slice(-4)}`;
}

function sendSettingsError(res: Response, error: unknown, fallbackMessage: string): Response {
  if (error instanceof DiscordSettingsSecretUnavailableError) {
    return res.status(503).json({ error: error.message });
  }
  console.error(fallbackMessage, error);
  return res.status(500).json({ error: 'Erro ao acessar configurações do Discord.' });
}

function sendDiscordDiscoveryError(res: Response, error: unknown, fallbackMessage: string): Response {
  if (error instanceof DiscordSettingsSecretUnavailableError) {
    return res.status(503).json({ error: error.message });
  }
  if (error instanceof DiscordDiscoveryError) {
    return res.status(error.statusCode).json({ error: error.message });
  }
  if (error instanceof Error && error.message.includes('DISCORD_BOT_TOKEN não configurado')) {
    return res.status(422).json({ error: 'Configure o token do bot antes de descobrir servidores e canais.' });
  }
  console.error(fallbackMessage, error);
  return res.status(502).json({ error: 'Não foi possível consultar o Discord agora. Tente novamente em instantes.' });
}

function normalizeSourceChannelType(value: unknown): DiscordSourceChannelType {
  return value === 'announcement' || value === 'forum' ? value : 'text';
}

function sendDiscordFetchError(res: Response, error: unknown): Response {
  if (error instanceof DiscordSettingsSecretUnavailableError) {
    return res.status(503).json({ error: error.message });
  }
  if (error instanceof DiscordIngestError) {
    return res.status(error.statusCode).json({ error: error.message });
  }
  if (error instanceof Error && error.message.includes('DISCORD_BOT_TOKEN não configurado')) {
    return res.status(422).json({ error: error.message });
  }
  console.error('[POST /admin/discord-sync/fetch]', error);
  return res.status(500).json({ error: 'Erro ao buscar mensagens.' });
}

// ─── Configuracoes ───────────────────────────────────────────────────────────

// GET /settings
router.get('/settings', authMiddleware, async (req: Request, res: Response) => {
  if (!isAdmin(req, res)) return;
  try {
    const setting = await db
      .selectFrom('discord_settings')
      .select(['value', 'updated_at'])
      .where('guild_id', 'is', null)
      .where('key', '=', 'bot_token')
      .executeTakeFirst();

    if (!setting) {
      return res.json({ data: { bot_token: { is_set: false, preview: null, updated_at: null } } });
    }

    const token = decryptDiscordSetting(setting.value);
    return res.json({
      data: {
        bot_token: {
          is_set: true,
          preview: maskToken(token),
          updated_at: setting.updated_at,
        },
      },
    });
  } catch (error: unknown) {
    return sendSettingsError(res, error, '[GET /admin/discord-sync/settings]');
  }
});

// PUT /settings/bot-token
router.put('/settings/bot-token', authMiddleware, async (req: Request, res: Response) => {
  if (!isAdmin(req, res)) return;
  const parsed = botTokenSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Token inválido.', details: parsed.error.flatten() });
  }

  try {
    const encryptedValue = encryptDiscordSetting(parsed.data.token);
    const existing = await db
      .selectFrom('discord_settings')
      .select('id')
      .where('guild_id', 'is', null)
      .where('key', '=', 'bot_token')
      .executeTakeFirst();

    const now = new Date();
    const setting = existing
      ? await db
          .updateTable('discord_settings')
          .set({ value: encryptedValue, updated_at: now })
          .where('id', '=', existing.id)
          .returning(['updated_at'])
          .executeTakeFirstOrThrow()
      : await db
          .insertInto('discord_settings')
          .values({
            guild_id: null,
            key: 'bot_token',
            value: encryptedValue,
            updated_at: now,
          } satisfies NewDiscordSetting)
          .returning(['updated_at'])
          .executeTakeFirstOrThrow();

    return res.json({
      data: {
        is_set: true,
        preview: maskToken(parsed.data.token),
        updated_at: setting.updated_at,
      },
    });
  } catch (error: unknown) {
    return sendSettingsError(res, error, '[PUT /admin/discord-sync/settings/bot-token]');
  }
});

// DELETE /settings/bot-token
router.delete('/settings/bot-token', authMiddleware, async (req: Request, res: Response) => {
  if (!isAdmin(req, res)) return;
  try {
    await db
      .deleteFrom('discord_settings')
      .where('guild_id', 'is', null)
      .where('key', '=', 'bot_token')
      .execute();
    return res.status(204).send();
  } catch (error: unknown) {
    return sendSettingsError(res, error, '[DELETE /admin/discord-sync/settings/bot-token]');
  }
});

// ─── Descoberta de servidores/canais ─────────────────────────────────────────

// GET /discovery/guilds
router.get('/discovery/guilds', authMiddleware, async (req: Request, res: Response) => {
  if (!isAdmin(req, res)) return;
  try {
    const guilds = await discoverDiscordGuilds();
    return res.json({ data: guilds });
  } catch (error: unknown) {
    return sendDiscordDiscoveryError(res, error, '[GET /admin/discord-sync/discovery/guilds]');
  }
});

// GET /discovery/guilds/:guildId/channels
router.get('/discovery/guilds/:guildId/channels', authMiddleware, async (req: Request, res: Response) => {
  if (!isAdmin(req, res)) return;
  const parsed = snowflakeParamSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Servidor Discord inválido.', details: parsed.error.flatten() });
  }

  try {
    const channels = await discoverDiscordChannels(parsed.data.guildId);
    return res.json({ data: channels });
  } catch (error: unknown) {
    return sendDiscordDiscoveryError(res, error, '[GET /admin/discord-sync/discovery/guilds/:guildId/channels]');
  }
});

// ─── Fontes (canais autorizados) ─────────────────────────────────────────────

// GET /sources
router.get('/sources', authMiddleware, async (req: Request, res: Response) => {
  if (!isAdmin(req, res)) return;
  try {
    const sources = await db
      .selectFrom('discord_import_sources')
      .selectAll()
      .orderBy('created_at', 'desc')
      .execute();
    return res.json({ data: sources });
  } catch (error: unknown) {
    console.error('[GET /admin/discord-sync/sources]', error);
    return res.status(500).json({ error: 'Erro ao listar fontes.' });
  }
});

// POST /sources
router.post('/sources', authMiddleware, async (req: Request, res: Response) => {
  if (!isAdmin(req, res)) return;
  const parsed = createSourceSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Dados inválidos.', details: parsed.error.flatten() });
  }
  try {
    const existing = await db
      .selectFrom('discord_import_sources')
      .select('id')
      .where('channel_id', '=', parsed.data.channel_id)
      .executeTakeFirst();
    if (existing) {
      return res.status(409).json({ error: 'Canal já cadastrado.' });
    }
    const [source] = await db
      .insertInto('discord_import_sources')
      .values({
        ...parsed.data,
        channel_type: parsed.data.channel_type ?? 'text',
      })
      .returningAll()
      .execute();
    return res.status(201).json({ data: source });
  } catch (error: unknown) {
    console.error('[POST /admin/discord-sync/sources]', error);
    return res.status(500).json({ error: 'Erro ao criar fonte.' });
  }
});

// PATCH /sources/:id
router.patch('/sources/:id', authMiddleware, async (req: Request, res: Response) => {
  if (!isAdmin(req, res)) return;
  const { id } = req.params;
  const parsed = updateSourceSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Dados inválidos.', details: parsed.error.flatten() });
  }
  if (Object.keys(parsed.data).length === 0) {
    return res.status(400).json({ error: 'Nenhum dado para atualizar.' });
  }
  try {
    const [source] = await db
      .updateTable('discord_import_sources')
      .set({ ...parsed.data, updated_at: new Date() })
      .where('id', '=', id)
      .returningAll()
      .execute();
    if (!source) return res.status(404).json({ error: 'Fonte não encontrada.' });
    return res.json({ data: source });
  } catch (error: unknown) {
    console.error('[PATCH /admin/discord-sync/sources/:id]', error);
    return res.status(500).json({ error: 'Erro ao atualizar fonte.' });
  }
});

// DELETE /sources/:id
router.delete('/sources/:id', authMiddleware, async (req: Request, res: Response) => {
  if (!isAdmin(req, res)) return;
  const { id } = req.params;
  try {
    const source = await db
      .selectFrom('discord_import_sources')
      .select('id')
      .where('id', '=', id)
      .executeTakeFirst();
    if (!source) return res.status(404).json({ error: 'Fonte não encontrada.' });
    await db.deleteFrom('discord_import_sources').where('id', '=', id).execute();
    return res.json({ data: { message: 'Fonte removida.' } });
  } catch (error: unknown) {
    console.error('[DELETE /admin/discord-sync/sources/:id]', error);
    return res.status(500).json({ error: 'Erro ao remover fonte.' });
  }
});

// ─── Ingestao REST ────────────────────────────────────────────────────────────

// POST /fetch — busca mensagens de um canal via REST API Discord
router.post('/fetch', authMiddleware, async (req: Request, res: Response) => {
  if (!isAdmin(req, res)) return;

  const parsed = fetchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Dados inválidos.', details: parsed.error.flatten() });
  }

  const { source_id, limit, before_message_id, since, until } = parsed.data;

  try {
    const source = await db
      .selectFrom('discord_import_sources')
      .selectAll()
      .where('id', '=', source_id)
      .where('enabled', '=', true)
      .executeTakeFirst();

    if (!source) {
      return res.status(404).json({ error: 'Fonte não encontrada ou desabilitada.' });
    }

    const sourceChannelType = normalizeSourceChannelType(source.channel_type);
    const result = sourceChannelType === 'forum'
      ? await ingestForumMessages({
          sourceId: source_id,
          forumChannelId: source.channel_id,
          guildId: source.guild_id,
          limit,
          since,
          until,
        })
      : await ingestMessages({
          sourceId: source_id,
          channelId: source.channel_id,
          guildId: source.guild_id,
          limit,
          beforeMessageId: before_message_id,
          since,
          until,
        });

    // Atualiza last_synced_at apenas se a chamada ao Discord foi concluida com sucesso
    if (result.inserted > 0 || result.updated > 0 || result.total === 0) {
      await db
        .updateTable('discord_import_sources')
        .set({ last_synced_at: new Date(), updated_at: new Date() })
        .where('id', '=', source_id)
        .execute();
    }

    const parse = await parsePendingMessagesForSource(source_id, since, until, req.user?.userId);
    return res.json({ data: { ...result, parse } });
  } catch (error: unknown) {
    return sendDiscordFetchError(res, error);
  }
});

// POST /sources/:sourceId/reingest-force — apaga mensagens pendentes e rebusca no Discord
router.post('/sources/:sourceId/reingest-force', authMiddleware, async (req: Request, res: Response) => {
  if (!isAdmin(req, res)) return;
  const parsed = reingestForceSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: 'Dados inválidos.', details: parsed.error.flatten() });
  }
  try {
    const source = await db
      .selectFrom('discord_import_sources')
      .selectAll()
      .where('id', '=', req.params.sourceId)
      .executeTakeFirst();

    if (!source) return res.status(404).json({ error: 'Fonte não encontrada.' });
    const { since, until } = parsed.data;

    // Apaga mensagens não-sincronizadas para forçar reingestão
    let deleteQuery = db
      .deleteFrom('discord_import_messages')
      .where('source_id', '=', source.id)
      .where('status', 'not in', ['synced']);

    if (since) deleteQuery = deleteQuery.where('message_created_at', '>=', since);
    if (until) deleteQuery = deleteQuery.where('message_created_at', '<=', until);

    const deleted = await deleteQuery.executeTakeFirst();

    const sourceChannelType = normalizeSourceChannelType(source.channel_type);
    const result = sourceChannelType === 'forum'
      ? await ingestForumMessages({ sourceId: source.id, forumChannelId: source.channel_id, guildId: source.guild_id, since, until })
      : await ingestMessages({ sourceId: source.id, channelId: source.channel_id, guildId: source.guild_id, since, until });

    await db.updateTable('discord_import_sources')
      .set({ last_synced_at: new Date(), updated_at: new Date() })
      .where('id', '=', source.id)
      .execute();

    const parse = await parsePendingMessagesForSource(source.id, since, until, req.user?.userId);
    return res.json({ data: { deleted: Number(deleted.numDeletedRows ?? 0), ...result, parse } });
  } catch (error: unknown) {
    return sendDiscordFetchError(res, error);
  }
});

// POST /messages/parse-batch — parseia todas as mensagens pendentes em lote
router.post('/messages/parse-batch', authMiddleware, async (req: Request, res: Response) => {
  if (!isAdmin(req, res)) return;
  try {
    const messages = await db
      .selectFrom('discord_import_messages')
      .selectAll()
      .where('status', 'in', ['pending', 'error'])
      .limit(200)
      .execute();

    if (messages.length === 0) return res.json({ data: { processed: 0, succeeded: 0, failed: 0 } });

    const systems = await loadSystemsForParser();
    let succeeded = 0;
    let failed = 0;

    for (const message of messages) {
      try {
        const parsed = parseDiscordAnnouncement({
          source_kind: message.source_kind,
          discord_message_id: message.discord_message_id,
          discord_channel_id: message.discord_channel_id,
          discord_guild_id: message.discord_guild_id,
          discord_parent_channel_id: message.discord_parent_channel_id,
          discord_thread_id: message.discord_thread_id,
          discord_thread_name: message.discord_thread_name,
          discord_author_id: message.discord_author_id,
          discord_author_name: message.discord_author_name,
          discord_message_url: message.discord_message_url,
          content_raw: message.content_raw,
          attachments: parseJsonField(message.attachments),
          embeds: parseJsonField(message.embeds),
          message_created_at: message.message_created_at,
          message_edited_at: message.message_edited_at,
        }, systems);
        if (!parsed) {
          await db.updateTable('discord_import_messages')
            .set({ status: 'ignored', parse_error: null, updated_at: new Date() })
            .where('id', '=', message.id)
            .execute();
          continue;
        }
        const normalized = normalizeDiscordTableDraft(parsed, systems);

        const existing = await db.selectFrom('discord_import_table_drafts')
          .select('id')
          .where('discord_message_id', '=', message.id)
          .executeTakeFirst();

        if (existing) {
          await db.updateTable('discord_import_table_drafts')
            .set({
              parsed_payload: parsed,
              normalized_payload: normalized.draft,
              confidence: normalized.draft.confidence,
              status: normalized.status,
              updated_at: new Date(),
            })
            .where('id', '=', existing.id)
            .execute();
        } else {
          await db.insertInto('discord_import_table_drafts')
            .values({
              discord_message_id: message.id,
              parsed_payload: parsed,
              normalized_payload: normalized.draft,
              confidence: normalized.draft.confidence,
              status: normalized.status,
            })
            .execute();
        }

        await db.updateTable('discord_import_messages')
          .set({ status: 'parsed', parse_error: null, updated_at: new Date() })
          .where('id', '=', message.id)
          .execute();

        await ensureSystemSuggestionForDraft(
          normalized.draft,
          req.user?.userId,
          message.discord_thread_name ?? message.discord_message_id,
        );

        succeeded++;
      } catch {
        await db.updateTable('discord_import_messages')
          .set({ status: 'error', parse_error: 'Erro no parse em lote', updated_at: new Date() })
          .where('id', '=', message.id)
          .execute();
        failed++;
      }
    }

    return res.json({ data: { processed: messages.length, succeeded, failed } });
  } catch (error: any) {
    console.error('[POST /messages/parse-batch]', error);
    return res.status(500).json({ error: 'Erro ao processar mensagens em lote.' });
  }
});

// ─── Mensagens ────────────────────────────────────────────────────────────────

// GET /messages
router.get('/messages', authMiddleware, async (req: Request, res: Response) => {
  if (!isAdmin(req, res)) return;
  try {
    const { source_id, status, limit = '50', offset = '0', since, until } = req.query as Record<string, string>;
    const sinceDate = since ? new Date(since) : null;
    const untilDate = until ? new Date(until) : null;

    if ((sinceDate && Number.isNaN(sinceDate.getTime())) || (untilDate && Number.isNaN(untilDate.getTime()))) {
      return res.status(400).json({ error: 'Janela de tempo inválida.' });
    }
    if (sinceDate && untilDate && sinceDate > untilDate) {
      return res.status(400).json({ error: 'Janela de tempo inválida.' });
    }

    let query = db
      .selectFrom('discord_import_messages')
      .selectAll()
      .orderBy('message_created_at', 'desc')
      .limit(Math.min(Number(limit) || 50, 100))
      .offset(Number(offset) || 0);

    if (source_id) query = query.where('source_id', '=', source_id);
    if (sinceDate) query = query.where('message_created_at', '>=', sinceDate);
    if (untilDate) query = query.where('message_created_at', '<=', untilDate);
    const validMessageStatuses: DiscordImportMessageStatus[] = ['pending', 'parsed', 'needs_review', 'synced', 'ignored', 'error'];
    if (status && validMessageStatuses.includes(status as DiscordImportMessageStatus)) {
      query = query.where('status', '=', status as DiscordImportMessageStatus);
    }

    const messages = await query.execute();
    return res.json({ data: messages });
  } catch (error: unknown) {
    console.error('[GET /admin/discord-sync/messages]', error);
    return res.status(500).json({ error: 'Erro ao listar mensagens.' });
  }
});

// PATCH /messages/:id
router.patch('/messages/:id', authMiddleware, async (req: Request, res: Response) => {
  if (!isAdmin(req, res)) return;
  const parsed = updateMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Dados inválidos.', details: parsed.error.flatten() });
  }

  try {
    const [message] = await db
      .updateTable('discord_import_messages')
      .set({ status: parsed.data.status, parse_error: null, updated_at: new Date() })
      .where('id', '=', req.params.id)
      .returningAll()
      .execute();
    if (!message) return res.status(404).json({ error: 'Mensagem não encontrada.' });
    return res.json({ data: message });
  } catch (error: unknown) {
    console.error('[PATCH /admin/discord-sync/messages/:id]', error);
    return res.status(500).json({ error: 'Erro ao atualizar mensagem.' });
  }
});

// POST /messages/:id/diagnose-content — compara DB vs API Discord sem expor token
router.post('/messages/:id/diagnose-content', authMiddleware, async (req: Request, res: Response) => {
  if (!isAdmin(req, res)) return;
  try {
    const message = await db
      .selectFrom('discord_import_messages')
      .selectAll()
      .where('id', '=', req.params.id)
      .executeTakeFirst();

    if (!message) return res.status(404).json({ error: 'Mensagem não encontrada.' });

    const apiMessage = await fetchDiscordMessageDiagnostic(message.discord_channel_id, message.discord_message_id);
    const apiContentLength = apiMessage.content.trim().length;
    const dbContentLength = message.content_raw.trim().length;
    const likelyMissingMessageContentIntent =
      apiContentLength === 0 &&
      dbContentLength === 0 &&
      Boolean(message.discord_thread_name) &&
      apiMessage.attachments.length === 0 &&
      apiMessage.embeds.length === 0;

    return res.json({
      data: {
        discord_message_id: message.discord_message_id,
        discord_channel_id: message.discord_channel_id,
        discord_thread_name: message.discord_thread_name,
        db_content_length: dbContentLength,
        api_content_length: apiContentLength,
        api_attachments_count: apiMessage.attachments.length,
        api_embeds_count: apiMessage.embeds.length,
        api_content_preview: apiMessage.content.trim().slice(0, 240),
        likely_missing_message_content_intent: likelyMissingMessageContentIntent,
        diagnosis: likelyMissingMessageContentIntent
          ? 'A API do Discord entregou o starter do tópico sem corpo, anexos ou embeds. O post existe, mas o bot não recebeu o conteúdo pela API; verifique o Message Content Intent no Developer Portal e permissões do canal/tópico.'
          : 'A API do Discord entregou algum conteúdo para esta mensagem.',
      },
    });
  } catch (error: unknown) {
    return sendDiscordFetchError(res, error);
  }
});

// ─── Drafts ───────────────────────────────────────────────────────────────────

// GET /drafts
router.get('/drafts', authMiddleware, async (req: Request, res: Response) => {
  if (!isAdmin(req, res)) return;
  try {
    const { status, limit = '50', offset = '0' } = req.query as Record<string, string>;

    let query = db
      .selectFrom('discord_import_table_drafts')
      .selectAll()
      .where('discord_message_id', 'is not', null)
      .orderBy('created_at', 'desc')
      .limit(Math.min(Number(limit) || 50, 100))
      .offset(Number(offset) || 0);

    const validDraftStatuses: DiscordImportDraftStatus[] = ['draft', 'ready', 'needs_review', 'synced', 'rejected'];
    if (status && validDraftStatuses.includes(status as DiscordImportDraftStatus)) {
      query = query.where('status', '=', status as DiscordImportDraftStatus);
    }

    const drafts = await query.execute();
    return res.json({ data: drafts });
  } catch (error: unknown) {
    console.error('[GET /admin/discord-sync/drafts]', error);
    return res.status(500).json({ error: 'Erro ao listar drafts.' });
  }
});

// GET /drafts/:id
router.get('/drafts/:id', authMiddleware, async (req: Request, res: Response) => {
  if (!isAdmin(req, res)) return;
  try {
    const draft = await db
      .selectFrom('discord_import_table_drafts')
      .selectAll()
      .where('id', '=', req.params.id)
      .executeTakeFirst();
    if (!draft) return res.status(404).json({ error: 'Draft não encontrado.' });
    return res.json({ data: draft });
  } catch (error: unknown) {
    console.error('[GET /admin/discord-sync/drafts/:id]', error);
    return res.status(500).json({ error: 'Erro ao buscar draft.' });
  }
});

// GET /image-uploads/summary
router.get('/image-uploads/summary', authMiddleware, async (req: Request, res: Response) => {
  if (!isAdmin(req, res)) return;
  try {
    const rows = await db
      .selectFrom('discord_import_table_drafts')
      .select(['image_upload_status'])
      .select((eb) => eb.fn.countAll<string>().as('count'))
      .where('discord_message_id', 'is not', null)
      .groupBy('image_upload_status')
      .execute();

    const summary = {
      pending: 0,
      success: 0,
      expired_url: 0,
      network: 0,
      cloudinary: 0,
      permanent_fail: 0,
      none: 0,
    };

    for (const row of rows) {
      const count = Number(row.count);
      switch (row.image_upload_status) {
        case 'pending':
        case 'success':
        case 'expired_url':
        case 'network':
        case 'cloudinary':
        case 'permanent_fail':
          summary[row.image_upload_status] = count;
          break;
        default:
          summary.none = count;
          break;
      }
    }

    return res.json({ data: summary });
  } catch (error: unknown) {
    console.error('[GET /admin/discord-sync/image-uploads/summary]', error);
    return res.status(500).json({ error: 'Erro ao listar uploads de imagem.' });
  }
});

// POST /drafts/:id/refresh-image
router.post('/drafts/:id/refresh-image', authMiddleware, async (req: Request, res: Response) => {
  if (!isAdmin(req, res)) return;
  try {
    const result = await refreshDiscordDraftImage(req.params.id);
    return res.json({ data: result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao reenviar imagem.';
    console.error('[POST /admin/discord-sync/drafts/:id/refresh-image]', error);
    if (message.includes('não encontrado') || message.includes('sem payload')) {
      return res.status(422).json({ error: message });
    }
    return res.status(500).json({ error: message });
  }
});

// PATCH /drafts/:id
router.patch('/drafts/:id', authMiddleware, async (req: Request, res: Response) => {
  if (!isAdmin(req, res)) return;
  const parsed = updateDraftSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Dados inválidos.', details: parsed.error.flatten() });
  }
  if (Object.keys(parsed.data).length === 0) {
    return res.status(400).json({ error: 'Nenhum dado para atualizar.' });
  }
  try {
    const current = await db
      .selectFrom('discord_import_table_drafts')
      .select(['id', 'normalized_payload'])
      .where('id', '=', req.params.id)
      .executeTakeFirst();
    if (!current) return res.status(404).json({ error: 'Draft não encontrado.' });

    // T-F1-03: invariante status='ready' => missing_fields=[] aplicado em runtime,
    // espelhando o CHECK CONSTRAINT da migration 118 com mensagem clara para a UI.
    const patchPayload = normalizeDraftPayload(parsed.data.normalized_payload) as { missing_fields?: unknown } | undefined;
    const currentPayload = normalizeDraftPayload(current.normalized_payload) as { missing_fields?: unknown } | null;
    const transition = assertDraftReadyTransition({
      patchStatus: parsed.data.status,
      patchPayloadMissing: patchPayload?.missing_fields,
      currentPayloadMissing: currentPayload?.missing_fields,
    });
    if (!transition.allowed) {
      return res.status(422).json({
        error: transition.reason ?? "Draft não pode ser marcado como 'ready'.",
        details: { missing_fields: transition.missingFields ?? [] },
      });
    }

    const [draft] = await db
      .updateTable('discord_import_table_drafts')
      .set({ ...parsed.data, updated_at: new Date() })
      .where('id', '=', req.params.id)
      .returningAll()
      .execute();
    if (!draft) return res.status(404).json({ error: 'Draft não encontrado.' });
    return res.json({ data: draft });
  } catch (error: unknown) {
    console.error('[PATCH /admin/discord-sync/drafts/:id]', error);
    return res.status(500).json({ error: 'Erro ao atualizar draft.' });
  }
});

// POST /messages/:id/parse — parseia mensagem e cria (ou atualiza) um draft
router.post('/messages/:id/parse', authMiddleware, async (req: Request, res: Response) => {
  if (!isAdmin(req, res)) return;
  try {
    const message = await db
      .selectFrom('discord_import_messages')
      .selectAll()
      .where('id', '=', req.params.id)
      .executeTakeFirst();

    if (!message) return res.status(404).json({ error: 'Mensagem não encontrada.' });
    if (message.status === 'synced') {
      return res.status(422).json({ error: 'Mensagem já sincronizada como mesa. Não pode ser reparseada.' });
    }

    const systems = await loadSystemsForParser();
        const parsed = parseDiscordAnnouncement({
      source_kind: message.source_kind,
      discord_message_id: message.discord_message_id,
      discord_channel_id: message.discord_channel_id,
      discord_guild_id: message.discord_guild_id,
      discord_parent_channel_id: message.discord_parent_channel_id,
      discord_thread_id: message.discord_thread_id,
      discord_thread_name: message.discord_thread_name,
      discord_author_id: message.discord_author_id,
      discord_author_name: message.discord_author_name,
      discord_message_url: message.discord_message_url,
      content_raw: message.content_raw,
      attachments: parseJsonField(message.attachments),
      embeds: parseJsonField(message.embeds),
      message_created_at: message.message_created_at,
      message_edited_at: message.message_edited_at,
    }, systems);
    if (!parsed) return res.status(422).json({ error: 'Mensagem sem conteudo elegivel para virar draft.' });
    const normalized = normalizeDiscordTableDraft(parsed, systems);

    // Verifica se já existe draft para esta mensagem
    const existingDraft = await db
      .selectFrom('discord_import_table_drafts')
      .select(['id', 'status'])
      .where('discord_message_id', '=', message.id)
      .executeTakeFirst();

    let draft;
    if (existingDraft && existingDraft.status !== 'synced' && existingDraft.status !== 'rejected') {
      // Atualiza draft existente
      [draft] = await db
        .updateTable('discord_import_table_drafts')
        .set({
          parsed_payload: parsed,
          normalized_payload: normalized.draft,
          confidence: normalized.draft.confidence,
          status: normalized.status,
          review_notes: null,
          updated_at: new Date(),
        })
        .where('id', '=', existingDraft.id)
        .returningAll()
        .execute();
    } else {
      // Cria novo draft
      [draft] = await db
        .insertInto('discord_import_table_drafts')
        .values({
          discord_message_id: message.id,
          table_id: null,
          parsed_payload: parsed,
          normalized_payload: normalized.draft,
          confidence: normalized.draft.confidence,
          status: normalized.status,
          review_notes: null,
        })
        .returningAll()
        .execute();
    }

    // Atualiza status da mensagem para 'parsed'
    await db
      .updateTable('discord_import_messages')
      .set({ status: 'parsed', parse_error: null, updated_at: new Date() })
      .where('id', '=', message.id)
      .execute();

    await ensureSystemSuggestionForDraft(
      normalized.draft,
      req.user?.userId,
      message.discord_thread_name ?? message.discord_message_id,
    );

    return res.json({ data: draft });
  } catch (error: unknown) {
    console.error('[POST /admin/discord-sync/messages/:id/parse]', error);
    const msg = error instanceof Error ? error.message : 'Erro ao parsear mensagem.';
    await db
      .updateTable('discord_import_messages')
      .set({ parse_error: msg, updated_at: new Date() })
      .where('id', '=', req.params.id)
      .execute();
    return res.status(500).json({ error: msg });
  }
});

// POST /drafts/:id/reparse — re-parseia a mensagem de origem e atualiza o draft
router.post('/drafts/:id/reparse', authMiddleware, async (req: Request, res: Response) => {
  if (!isAdmin(req, res)) return;
  try {
    const draft = await db
      .selectFrom('discord_import_table_drafts')
      .selectAll()
      .where('id', '=', req.params.id)
      .executeTakeFirst();

    if (!draft) return res.status(404).json({ error: 'Draft não encontrado.' });
    if (draft.status === 'synced') {
      return res.status(422).json({ error: 'Draft já sincronizado. Não pode ser reparseado.' });
    }
    if (!draft.discord_message_id) {
      return res.status(422).json({ error: 'Draft de inbox não suporta reparse via Discord.' });
    }

    const message = await db
      .selectFrom('discord_import_messages')
      .selectAll()
      .where('id', '=', draft.discord_message_id)
      .executeTakeFirst();

    if (!message) return res.status(404).json({ error: 'Mensagem de origem não encontrada.' });

    const systems = await loadSystemsForParser();
    const parsed = parseDiscordAnnouncement({
      source_kind: message.source_kind,
      discord_message_id: message.discord_message_id,
      discord_channel_id: message.discord_channel_id,
      discord_guild_id: message.discord_guild_id,
      discord_parent_channel_id: message.discord_parent_channel_id,
      discord_thread_id: message.discord_thread_id,
      discord_thread_name: message.discord_thread_name,
      discord_author_id: message.discord_author_id,
      discord_author_name: message.discord_author_name,
      discord_message_url: message.discord_message_url,
      content_raw: message.content_raw,
      attachments: parseJsonField(message.attachments),
      embeds: parseJsonField(message.embeds),
      message_created_at: message.message_created_at,
      message_edited_at: message.message_edited_at,
    }, systems);
    if (!parsed) return res.status(422).json({ error: 'Mensagem sem conteudo elegivel para virar draft.' });
    const normalized = normalizeDiscordTableDraft(parsed, systems);

    const [updated] = await db
      .updateTable('discord_import_table_drafts')
      .set({
        parsed_payload: parsed,
        normalized_payload: normalized.draft,
        confidence: normalized.draft.confidence,
        status: normalized.status,
        updated_at: new Date(),
      })
      .where('id', '=', req.params.id)
      .returningAll()
      .execute();

    await ensureSystemSuggestionForDraft(
      normalized.draft,
      req.user?.userId,
      message.discord_thread_name ?? message.discord_message_id,
    );

    return res.json({ data: updated });
  } catch (error: unknown) {
    console.error('[POST /admin/discord-sync/drafts/:id/reparse]', error);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Erro ao reparsar draft.' });
  }
});

// POST /drafts/:id/sync
router.post('/drafts/:id/sync', authMiddleware, async (req: Request, res: Response) => {
  if (!isAdmin(req, res)) return;
  try {
    const draft = await db
      .selectFrom('discord_import_table_drafts')
      .select(['id', 'discord_message_id'])
      .where('id', '=', req.params.id)
      .executeTakeFirst();

    if (!draft) return res.status(404).json({ error: 'Draft não encontrado.' });
    if (!draft.discord_message_id) {
      return res.status(422).json({ error: 'Draft de inbox não suporta sync via Discord.' });
    }

    const result = await syncDiscordDraftToTable(req.params.id);
    return res.json({ data: result });
  } catch (error: unknown) {
    if (error instanceof DraftNotFoundError) {
      return res.status(404).json({ error: error.message });
    }
    if (error instanceof DiscordDraftSyncValidationError) {
      return res.status(422).json({ error: error.message, details: { missingFields: error.missingFields } });
    }
    if (error instanceof DraftStateError) {
      return res.status(422).json({ error: error.message });
    }
    console.error('[POST /admin/discord-sync/drafts/:id/sync]', error);
    const message = error instanceof Error ? error.message : 'Erro ao sincronizar draft.';
    return res.status(500).json({ error: message });
  }
});

// POST /sync-ready — sincroniza todos os drafts com status 'ready' em lote
router.post('/sync-ready', authMiddleware, async (req: Request, res: Response) => {
  if (!isAdmin(req, res)) return;
  try {
    const readyDrafts = await db
      .selectFrom('discord_import_table_drafts')
      .select('id')
      .where('status', '=', 'ready' as DiscordImportDraftStatus)
      .where('discord_message_id', 'is not', null)
      .execute();

    const results = { synced: 0, failed: 0, errors: [] as string[] };

    for (const draft of readyDrafts) {
      try {
        await syncDiscordDraftToTable(draft.id);
        results.synced++;
      } catch (err: unknown) {
        results.failed++;
        results.errors.push(`${draft.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return res.json({ data: results });
  } catch (error: unknown) {
    console.error('[POST /admin/discord-sync/sync-ready]', error);
    return res.status(500).json({ error: 'Erro ao sincronizar drafts em lote.' });
  }
});

export default router;

