import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import type { DiscordSourceChannelType } from '../db/types';
import { authMiddleware } from '../middleware/auth';
import type { DiscordImportMessageStatus } from '../discord';
import { DiscordDiscoveryError, DiscordIngestError, discoverDiscordChannels, discoverDiscordGuilds, ingestForumMessages, ingestMessages, parseDiscordAnnouncement, normalizeDiscordTableDraft, normalizeDraftPayload } from '../discord';
import type { SystemEntry } from '../discord';
import { requireDiscordBotToken } from '../discord/config';
import { DiscordSettingsSecretUnavailableError } from '../discord/settingsCrypto';
import { parseJsonField, loadSystemsForParser, ensureSystemSuggestionForDraft } from './discord/utils';

import previewRouter from './discord/preview';
import importRouter from './discord/import';
import syncRouter from './discord/sync';
import settingsRouter from './discord/settings';
import draftsRouter from './discord/drafts';
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

const discordMessageDiagnosticSchema = z.object({
  id: z.string(),
  content: z.string().optional().default(''),
  attachments: z.array(z.unknown()).optional().default([]),
  embeds: z.array(z.unknown()).optional().default([]),
  message_reference: z.unknown().optional(),
  flags: z.number().optional(),
});

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

router.use('/settings', settingsRouter);
router.use('/drafts', draftsRouter);
router.use('/messages', draftsRouter);

router.use('/', syncRouter);

router.use('/import-json', previewRouter);
router.use('/import-json', importRouter);

export default router;
