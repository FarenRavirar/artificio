import { sql } from 'kysely';
import { db } from '../db';
import { parseDiscordChatExporterJson, adaptMessageToImportRaw, DiscordChatExporterValidationError } from './chatExporterAdapter';
import { getContentHash } from './shared';
import type { ImportResult } from './chatExporterAdapter';
import type { DiscordChatExporterExport } from './discordChatExporterTypes';

/** Limite de segurança: número máximo de mensagens por importação (evita DoS / O(n) massivo). */
export const MAX_IMPORT_MESSAGES = 2000;
/** Limite de segurança: tamanho máximo do JSON bruto em bytes (≤ 12MB global do Express). */
export const MAX_IMPORT_JSON_BYTES = 10 * 1024 * 1024; // 10MB

/** REV-016 residual: valida buffer multer — DRY entre POST /file (import) e POST /preview/file (preview). */
export function parseUploadedJsonBuffer(file: { buffer: Buffer }):
  { parsed: unknown } | { error: string; status: number }
{
  const rawJson = file.buffer.toString('utf-8');

  if (rawJson.length > MAX_IMPORT_JSON_BYTES) {
    return {
      error: `JSON muito grande (${(rawJson.length / 1024 / 1024).toFixed(1)} MB). O limite é ${MAX_IMPORT_JSON_BYTES / 1024 / 1024} MB.`,
      status: 413,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return { error: 'JSON inválido: o arquivo não contém JSON válido.', status: 400 };
  }

  return { parsed };
}

function mapChannelType(type: string | undefined): 'text' | 'announcement' | 'forum' {
  switch (type) {
    case 'announcement':
    case 'news':
    case 'guild_announcement':
      return 'announcement';
    case 'forum':
    case 'guild_forum':
      return 'forum';
    default:
      return 'text';
  }
}

async function ensureDiscordImportSource(channelId: string, guildId: string, channelName: string | undefined, channelType: string | undefined): Promise<string> {
  const existing = await db
    .selectFrom('discord_import_sources')
    .select('id')
    .where('channel_id', '=', channelId)
    .executeTakeFirst();
  if (existing) return existing.id;
  const [source] = await db
    .insertInto('discord_import_sources')
    .values({
      guild_id: guildId,
      channel_id: channelId,
      channel_name: channelName ?? null,
      channel_type: mapChannelType(channelType),
      enabled: true,
      auto_sync_enabled: false,
    })
    .returning('id')
    .execute();
  return source.id;
}

export async function importDiscordChatExporterJson(raw: unknown): Promise<ImportResult> {
  const exportData = parseDiscordChatExporterJson(raw);
  const { messages } = exportData;

  if (!messages || messages.length === 0) {
    return { total: 0, inserted: 0, updated: 0, ignored: 0, failed: 0 };
  }

  if (messages.length > MAX_IMPORT_MESSAGES) {
    throw new DiscordChatExporterValidationError(
      `Importação muito grande: ${messages.length} mensagens (limite ${MAX_IMPORT_MESSAGES}). Divida o export em arquivos menores.`
    );
  }

  const channelId = exportData.channel.id;
  const guildId = exportData.guild.id;
  const channelName = exportData.channel.name;
  const channelType = exportData.channel.type;

  let sourceId: string;
  try {
    sourceId = await ensureDiscordImportSource(channelId, guildId, channelName, channelType);
  } catch (err) {
    console.error('[importDiscordChatExporterJson] Falha ao criar fonte de importação:', err instanceof Error ? err.message : 'unknown error');
    throw new Error('Erro interno ao criar fonte de importação.');
  }

  let inserted = 0;
  let updated = 0;
  let failed = 0;
  const importedMessages: { channelId: string; messageId: string }[] = [];

  // DEB-048-14/T-F8: reference é persistido em migration_130 e resolvido no parse
  // (parse-batch/reparse) via contentIndex. O import só insere — não resolve reply.

  for (const msg of messages) {
    const adapted = adaptMessageToImportRaw(msg, exportData);
    const contentHash = getContentHash(msg);

    try {
      const result = await sql<{ action: string }>`
        INSERT INTO discord_import_messages (
          source_id, discord_message_id, discord_channel_id, discord_guild_id,
          discord_parent_channel_id, discord_thread_id, discord_thread_name,
          discord_author_id, discord_author_name, discord_message_url,
          content_raw, attachments, embeds,
          message_created_at, message_edited_at,
          content_hash, source_kind, status, reference
        ) VALUES (
          ${sourceId}::uuid, ${msg.id}, ${channelId}, ${guildId},
          ${adapted.discord_parent_channel_id ?? null}, ${adapted.discord_thread_id ?? null}, ${adapted.discord_thread_name ?? null},
          ${adapted.discord_author_id ?? null}, ${adapted.discord_author_name ?? null}, ${adapted.discord_message_url ?? ''},
          ${adapted.content_raw}, ${JSON.stringify(adapted.attachments ?? [])}::jsonb, ${JSON.stringify(adapted.embeds ?? [])}::jsonb,
          ${adapted.message_created_at}::timestamptz, ${adapted.message_edited_at}::timestamptz,
          ${contentHash}, 'discord_chat_exporter_json', 'pending',
          ${adapted.reference ? JSON.stringify(adapted.reference) : null}::jsonb
        )
        ON CONFLICT (discord_channel_id, discord_message_id) DO UPDATE SET
          content_raw = EXCLUDED.content_raw,
          content_hash = EXCLUDED.content_hash,
          attachments = EXCLUDED.attachments,
          embeds = EXCLUDED.embeds,
          message_edited_at = EXCLUDED.message_edited_at,
          reference = EXCLUDED.reference,
          status = 'pending',
          parse_error = NULL,
          updated_at = NOW()
        WHERE discord_import_messages.content_hash IS DISTINCT FROM EXCLUDED.content_hash
           OR discord_import_messages.reference IS DISTINCT FROM EXCLUDED.reference
        RETURNING CASE WHEN xmax = 0 THEN 'inserted' ELSE 'updated' END AS action
      `.execute(db);

      const action = result.rows[0]?.action ?? 'ignored';
      if (action === 'inserted') inserted++;
      else if (action === 'updated') updated++;
      if (action === 'inserted' || action === 'updated') {
        importedMessages.push({ channelId, messageId: msg.id });
      }
    } catch (err) {
      failed++;
    }
  }

  return {
    total: messages.length,
    inserted,
    updated,
    ignored: messages.length - inserted - updated - failed,
    failed,
    importedMessages,
  };
}

/** Monta objeto de preview a partir de um export já parseado (DEB-048-24). */
export function buildPreviewFromExport(exportData: DiscordChatExporterExport) {
  const attachmentsCount = exportData.messages.reduce((sum, msg) => sum + (msg.attachments?.length ?? 0), 0);
  const embedsCount = exportData.messages.reduce((sum, msg) => sum + (msg.embeds?.length ?? 0), 0);
  const after = exportData.dateRange?.after;
  const before = exportData.dateRange?.before;
  const dateRange = after || before
    ? {
        ...(after ? { after } : {}),
        ...(before ? { before } : {}),
      }
    : null;
  return {
    guild: exportData.guild,
    channel: exportData.channel,
    dateRange,
    exportedAt: exportData.exportedAt ?? null,
    messageCount: exportData.messageCount ?? exportData.messages.length,
    totalAttachments: attachmentsCount,
    totalEmbeds: embedsCount,
  };
}

export function extractJsonPayload(rawBody: unknown): { payload: unknown } | { error: string; status: number } {
  if (rawBody && typeof rawBody === 'object' && 'json' in rawBody) {
    const rawJson = (rawBody as Record<string, unknown>).json;
    if (typeof rawJson === 'string') {
      if (rawJson.length > MAX_IMPORT_JSON_BYTES) {
        return { error: `Arquivo JSON muito grande (${(rawJson.length / (1024 * 1024)).toFixed(1)} MB). O limite é ${MAX_IMPORT_JSON_BYTES / (1024 * 1024)} MB.`, status: 413 };
      }
      try {
        return { payload: JSON.parse(rawJson) };
      } catch {
        return { error: 'JSON inválido: o conteúdo do campo "json" não é um JSON válido.', status: 400 };
      }
    }
    return { payload: rawJson };
  }
  if (rawBody && typeof rawBody === 'object' && 'messages' in rawBody) {
    return { payload: rawBody };
  }
  return { error: 'JSON inválido: envie um objeto com o campo "json" ou o próprio export do DiscordChatExporter.', status: 400 };
}
