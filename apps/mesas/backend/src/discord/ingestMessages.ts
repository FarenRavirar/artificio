import crypto from 'node:crypto';
import { sql } from 'kysely';
import { z } from 'zod';
import { db } from '../db';
import type { DiscordImportSourceKind, DiscordSourceChannelType } from './types';
import { requireDiscordBotToken } from './config';

// BUG-004: pg driver converte arrays JS para literal de array Postgres ('{a,b,c}'),
// formato inválido para colunas JSONB. Serializamos como JSON e fazemos cast explícito.
function asJsonbArray(value: unknown): ReturnType<typeof sql<unknown[]>> {
  return sql<unknown[]>`${JSON.stringify(value ?? [])}::jsonb`;
}

const DISCORD_API_BASE = 'https://discord.com/api/v10';

const discordApiMessageSchema = z.object({
  id: z.string(),
  content: z.string().optional().default(''),
  timestamp: z.string().optional(),
  edited_timestamp: z.string().nullable().optional(),
  author: z.object({ id: z.string(), username: z.string() }).optional(),
  attachments: z.array(z.unknown()).optional(),
  embeds: z.array(z.unknown()).optional(),
});

const discordApiMessagesSchema = z.array(discordApiMessageSchema);

const discordThreadSchema = z.object({
  id: z.string(),
  parent_id: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  archived: z.boolean().optional(),
  thread_metadata: z.object({
    archive_timestamp: z.string().nullable().optional(),
  }).optional(),
});

const discordActiveThreadsSchema = z.object({
  threads: z.array(discordThreadSchema),
});

const discordArchivedThreadsSchema = z.object({
  threads: z.array(discordThreadSchema),
  has_more: z.boolean().optional(),
});

type DiscordApiMessage = z.infer<typeof discordApiMessageSchema>;
type DiscordApiThread = z.infer<typeof discordThreadSchema>;

export class DiscordIngestError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = 'DiscordIngestError';
  }
}

export interface IngestResult {
  inserted: number;
  updated: number;
  total: number;
  newestMessageId: string | null;
  threadsScanned: number;
  sourceKind: DiscordSourceChannelType;
}

type JsonbParam = ReturnType<typeof sql<unknown[]>>;

type InsertRow = {
  source_id: string;
  discord_message_id: string;
  discord_channel_id: string;
  discord_guild_id: string;
  discord_parent_channel_id: string | null;
  discord_thread_id: string | null;
  discord_thread_name: string | null;
  discord_author_id: string | null;
  discord_author_name: string | null;
  discord_message_url: string;
  content_raw: string;
  attachments: JsonbParam;
  embeds: JsonbParam;
  message_created_at: Date | null;
  message_edited_at: Date | null;
  content_hash: string;
  source_kind: DiscordImportSourceKind;
  status: 'pending';
};

type UpdateRow = { id: string; contentRaw: string; contentHash: string; embeds: JsonbParam; attachments: JsonbParam };

function getSnowflakeCreatedAt(id: string): Date | null {
  try {
    const timestamp = Number((BigInt(id) >> 22n) + 1420070400000n);
    if (!Number.isFinite(timestamp)) return null;
    return new Date(timestamp);
  } catch {
    return null;
  }
}

function filterMessagesByWindow(messages: DiscordApiMessage[], since?: Date, until?: Date): DiscordApiMessage[] {
  if (!since && !until) return messages;

  return messages.filter((message) => {
    if (!message.timestamp) return false;
    const createdAt = new Date(message.timestamp);
    if (Number.isNaN(createdAt.getTime())) return false;
    if (since && createdAt < since) return false;
    if (until && createdAt > until) return false;
    return true;
  });
}

function filterThreadsByWindow(threads: DiscordApiThread[], since?: Date, until?: Date): DiscordApiThread[] {
  if (!since && !until) return threads;

  return threads.filter((thread) => {
    const createdAt = getSnowflakeCreatedAt(thread.id);
    if (!createdAt) return false;
    if (since && createdAt < since) return false;
    if (until && createdAt > until) return false;
    return true;
  });
}

function mapDiscordStatus(status: number): DiscordIngestError {
  if (status === 401) {
    return new DiscordIngestError('Token do bot inválido ou revogado. Gere um novo token no Discord e salve novamente.', 502);
  }
  if (status === 403) {
    return new DiscordIngestError('O bot não tem permissão para ler esse canal, forum ou thread no Discord.', 403);
  }
  if (status === 404) {
    return new DiscordIngestError('Canal, forum ou thread não encontrado para o bot configurado.', 404);
  }
  if (status === 429) {
    return new DiscordIngestError('Discord limitou temporariamente as requisições. Aguarde um momento e tente novamente.', 502);
  }
  return new DiscordIngestError('Discord não respondeu como esperado. Tente novamente em instantes.', 502);
}

async function discordGetUnknown(path: string, token: string): Promise<unknown> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch(`${DISCORD_API_BASE}${path}`, {
      headers: { Authorization: `Bot ${token.trim()}` },
      signal: controller.signal,
    });

    if (!res.ok) {
      throw mapDiscordStatus(res.status);
    }

    return res.json() as Promise<unknown>;
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new DiscordIngestError('Discord demorou demais para responder. Tente novamente em instantes.', 502);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function getContentHash(msg: DiscordApiMessage): string {
  return crypto
    .createHash('sha256')
    .update(msg.content ?? '')
    .update(JSON.stringify(msg.embeds ?? []))
    .update(JSON.stringify(msg.attachments ?? []))
    .digest('hex');
}

async function fetchChannelMessages(params: {
  channelId: string;
  token: string;
  limit: number;
  beforeMessageId?: string;
  afterMessageId?: string;
}): Promise<DiscordApiMessage[]> {
  const qs = new URLSearchParams({ limit: String(Math.min(params.limit, 100)) });
  if (params.beforeMessageId) qs.set('before', params.beforeMessageId);
  if (params.afterMessageId) qs.set('after', params.afterMessageId);

  const payload = await discordGetUnknown(`/channels/${params.channelId}/messages?${qs}`, params.token);
  const parsed = discordApiMessagesSchema.safeParse(payload);
  if (!parsed.success) {
    throw new DiscordIngestError('Discord retornou mensagens em formato inesperado.', 502);
  }
  return parsed.data;
}

async function persistMessages(params: {
  sourceId: string;
  channelId: string;
  guildId: string;
  messages: DiscordApiMessage[];
  sourceKind: DiscordImportSourceKind;
  parentChannelId?: string | null;
  threadId?: string | null;
  threadName?: string | null;
}): Promise<Omit<IngestResult, 'threadsScanned' | 'sourceKind'>> {
  const {
    sourceId,
    channelId,
    guildId,
    messages,
    sourceKind,
    parentChannelId = null,
    threadId = null,
    threadName = null,
  } = params;

  const newestMessageId = messages[0]?.id ?? null;
  if (messages.length === 0) return { inserted: 0, updated: 0, total: 0, newestMessageId: null };

  const msgData = messages.map((msg) => ({
    msg,
    contentRaw: msg.content ?? '',
    contentHash: getContentHash(msg),
    messageUrl: `https://discord.com/channels/${guildId}/${channelId}/${msg.id}`,
  }));

  const existingRecords = await db
    .selectFrom('discord_import_messages')
    .select(['id', 'content_hash', 'discord_message_id'])
    .where('discord_channel_id', '=', channelId)
    .where('discord_message_id', 'in', msgData.map((m) => m.msg.id))
    .execute();

  const existingMap = new Map(existingRecords.map((e) => [e.discord_message_id, e]));
  const toInsert: InsertRow[] = [];
  const toUpdate: UpdateRow[] = [];

  for (const { msg, contentRaw, contentHash, messageUrl } of msgData) {
    const existing = existingMap.get(msg.id);
    if (!existing) {
      toInsert.push({
        source_id: sourceId,
        discord_message_id: msg.id,
        discord_channel_id: channelId,
        discord_guild_id: guildId,
        discord_parent_channel_id: parentChannelId,
        discord_thread_id: threadId,
        discord_thread_name: threadName,
        discord_author_id: msg.author?.id ?? null,
        discord_author_name: msg.author?.username ?? null,
        discord_message_url: messageUrl,
        content_raw: contentRaw,
        attachments: asJsonbArray(msg.attachments),
        embeds: asJsonbArray(msg.embeds),
        message_created_at: msg.timestamp ? new Date(msg.timestamp) : null,
        message_edited_at: msg.edited_timestamp ? new Date(msg.edited_timestamp) : null,
        content_hash: contentHash,
        source_kind: sourceKind,
        status: 'pending',
      });
    } else if (existing.content_hash !== contentHash) {
      toUpdate.push({
        id: existing.id,
        contentRaw,
        contentHash,
        embeds: asJsonbArray(msg.embeds),
        attachments: asJsonbArray(msg.attachments),
      });
    }
  }

  if (toInsert.length > 0) {
    await db.insertInto('discord_import_messages').values(toInsert).execute();
  }

  for (const upd of toUpdate) {
    await db
      .updateTable('discord_import_messages')
      .set({
        content_raw: upd.contentRaw,
        content_hash: upd.contentHash,
        embeds: upd.embeds,
        attachments: upd.attachments,
        status: 'pending',
        parse_error: null,
        updated_at: new Date(),
      })
      .where('id', '=', upd.id)
      .execute();
  }

  return { inserted: toInsert.length, updated: toUpdate.length, total: messages.length, newestMessageId };
}

export async function listForumThreads(params: {
  guildId: string;
  forumChannelId: string;
  token: string;
}): Promise<DiscordApiThread[]> {
  const activePayload = await discordGetUnknown(`/guilds/${encodeURIComponent(params.guildId)}/threads/active`, params.token);
  const activeParsed = discordActiveThreadsSchema.safeParse(activePayload);
  if (!activeParsed.success) {
    throw new DiscordIngestError('Discord retornou threads ativas em formato inesperado.', 502);
  }

  const archivedThreads: DiscordApiThread[] = [];
  let before: string | null = null;

  for (let page = 0; page < 20; page += 1) {
    const qs = new URLSearchParams({ limit: '100' });
    if (before) qs.set('before', before);

    const archivedPayload = await discordGetUnknown(
      `/channels/${encodeURIComponent(params.forumChannelId)}/threads/archived/public?${qs}`,
      params.token
    );
    const archivedParsed = discordArchivedThreadsSchema.safeParse(archivedPayload);
    if (!archivedParsed.success) {
      throw new DiscordIngestError('Discord retornou threads arquivadas em formato inesperado.', 502);
    }

    archivedThreads.push(...archivedParsed.data.threads);
    if (!archivedParsed.data.has_more || archivedParsed.data.threads.length === 0) break;

    const lastThread = archivedParsed.data.threads[archivedParsed.data.threads.length - 1];
    before = lastThread.thread_metadata?.archive_timestamp ?? getSnowflakeCreatedAt(lastThread.id)?.toISOString() ?? null;
    if (!before) break;
  }

  const byId = new Map<string, DiscordApiThread>();
  for (const thread of activeParsed.data.threads) {
    if (thread.parent_id === params.forumChannelId) byId.set(thread.id, thread);
  }
  for (const thread of archivedThreads) {
    byId.set(thread.id, thread);
  }

  return [...byId.values()].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'pt-BR'));
}

/**
 * Busca mensagens de um canal textual/anuncio via REST API Discord.
 */
export async function ingestMessages(params: {
  sourceId: string;
  channelId: string;
  guildId: string;
  botToken?: string;
  limit?: number;
  beforeMessageId?: string;
  afterMessageId?: string;
  sourceKind?: DiscordImportSourceKind;
  since?: Date;
  until?: Date;
}): Promise<IngestResult> {
  const {
    sourceId,
    channelId,
    guildId,
    botToken,
    limit = 50,
    beforeMessageId,
    afterMessageId,
    sourceKind = 'discord_bot',
    since,
    until,
  } = params;

  const resolvedToken = botToken ?? await requireDiscordBotToken();
  const trimmedToken = resolvedToken.trim();
  if (!trimmedToken) throw new DiscordIngestError('Token do bot Discord não pode ser vazio.', 422);

  const messages = await fetchChannelMessages({
    channelId,
    token: trimmedToken,
    limit,
    beforeMessageId,
    afterMessageId,
  });
  const result = await persistMessages({
    sourceId,
    channelId,
    guildId,
    messages: filterMessagesByWindow(messages, since, until),
    sourceKind,
  });
  return { ...result, threadsScanned: 0, sourceKind: 'text' };
}

export async function ingestForumMessages(params: {
  sourceId: string;
  forumChannelId: string;
  guildId: string;
  botToken?: string;
  limit?: number;
  sourceKind?: DiscordImportSourceKind;
  since?: Date;
  until?: Date;
}): Promise<IngestResult> {
  const {
    sourceId,
    forumChannelId,
    guildId,
    botToken,
    limit = 50,
    sourceKind = 'discord_bot',
    since,
    until,
  } = params;

  const resolvedToken = botToken ?? await requireDiscordBotToken();
  const trimmedToken = resolvedToken.trim();
  if (!trimmedToken) throw new DiscordIngestError('Token do bot Discord não pode ser vazio.', 422);

  const threads = filterThreadsByWindow(
    await listForumThreads({ guildId, forumChannelId, token: trimmedToken }),
    since,
    until
  );
  if (threads.length === 0) {
    return { inserted: 0, updated: 0, total: 0, newestMessageId: null, threadsScanned: 0, sourceKind: 'forum' };
  }

  let inserted = 0;
  let updated = 0;
  let total = 0;
  let newestMessageId: string | null = null;

  for (const thread of threads) {
    const messages = await fetchChannelMessages({
      channelId: thread.id,
      token: trimmedToken,
      limit,
    });
    const result = await persistMessages({
      sourceId,
      channelId: thread.id,
      guildId,
      messages: filterMessagesByWindow(messages, since, until),
      sourceKind,
      parentChannelId: forumChannelId,
      threadId: thread.id,
      threadName: thread.name ?? null,
    });

    inserted += result.inserted;
    updated += result.updated;
    total += result.total;
    newestMessageId ??= result.newestMessageId;
  }

  return { inserted, updated, total, newestMessageId, threadsScanned: threads.length, sourceKind: 'forum' };
}
