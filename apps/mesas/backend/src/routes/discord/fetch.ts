import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../../db';
import type { SystemEntry } from '../../discord';
import { ingestForumMessages, ingestMessages, parseDiscordAnnouncement, normalizeDiscordTableDraft } from '../../discord';
import { loadSystemsForParser } from '../../discord/shared';
import { requireAdmin } from '../../middleware/auth';
import { parseJsonField, ensureSystemSuggestionForDraft, normalizeSourceChannelType, sendDiscordFetchError } from './utils';

const router = Router();
const DISCORD_API_BASE = 'https://discord.com/api/v10';

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

// ─── POST /fetch — busca mensagens de um canal via REST API Discord
router.post('/fetch', requireAdmin, async (req: Request, res: Response) => {
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
    if (!source) return res.status(404).json({ error: 'Fonte não encontrada ou desabilitada.' });

    const sourceChannelType = normalizeSourceChannelType(source.channel_type);
    const result = sourceChannelType === 'forum'
      ? await ingestForumMessages({
          sourceId: source_id, forumChannelId: source.channel_id, guildId: source.guild_id,
          limit, since, until,
        })
      : await ingestMessages({
          sourceId: source_id, channelId: source.channel_id, guildId: source.guild_id,
          limit, beforeMessageId: before_message_id, since, until,
        });

    if (result.inserted > 0 || result.updated > 0 || result.total === 0) {
      await db.updateTable('discord_import_sources')
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

// ─── POST /sources/:sourceId/reingest-force
router.post('/sources/:sourceId/reingest-force', requireAdmin, async (req: Request, res: Response) => {
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

export default router;
