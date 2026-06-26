import { discordChatExporterExportSchema } from './discordChatExporterTypes';
import { getContentHash } from './shared';
import type { DiscordChatExporterExport, DiscordChatExporterMessage } from './discordChatExporterTypes';
import type { ImportRawMessage } from './types';

export class DiscordChatExporterValidationError extends Error {
  constructor(message: string, public readonly details?: unknown) {
    super(message);
    this.name = 'DiscordChatExporterValidationError';
  }
}

export function parseDiscordChatExporterJson(raw: unknown): DiscordChatExporterExport {
  const parsed = discordChatExporterExportSchema.safeParse(raw);
  if (!parsed.success) {
    if (raw && typeof raw === 'object' && !('messages' in (raw as any))) {
      throw new DiscordChatExporterValidationError(
        'JSON inválido: o arquivo não parece ser um export do DiscordChatExporter (campo "messages" ausente).'
      );
    }
    const issues = parsed.error.issues.slice(0, 5).map((i) => `${i.path.join('.')}: ${i.message}`);
    throw new DiscordChatExporterValidationError(
      `JSON inválido ou incompatível com o formato esperado.${issues.length ? ` ${issues.join('; ')}` : ''}`
    );
  }
  return parsed.data;
}

export interface ImportResult {
  total: number;
  inserted: number;
  updated: number;
  ignored: number;
  failed: number;
}

export function adaptMessageToImportRaw(
  msg: DiscordChatExporterMessage,
  exportData: DiscordChatExporterExport,
): ImportRawMessage & { content_hash: string } {
  const author = msg.author;
  const authorName = author.nickname ?? author.name;
  const messageUrl = `https://discord.com/channels/${exportData.guild.id}/${exportData.channel.id}/${msg.id}`;

  return {
    source_kind: 'discord_chat_exporter_json',
    discord_message_id: msg.id,
    discord_channel_id: exportData.channel.id,
    discord_guild_id: exportData.guild.id,
    discord_parent_channel_id: null,
    discord_thread_id: null,
    discord_thread_name: null,
    discord_author_id: author.id ?? null,
    discord_author_name: authorName ?? null,
    discord_message_url: messageUrl,
    content_raw: msg.content ?? '',
    attachments: msg.attachments ?? [],
    embeds: msg.embeds ?? [],
    // reference já vem normalizado pelo Zod (discordChatExporterReferenceSchema):
    // messageId: string; channelId/guildId: string | undefined. Sem cast inseguro.
    reference: msg.reference ? {
      messageId: msg.reference.messageId,
      channelId: msg.reference.channelId,
      guildId: msg.reference.guildId,
    } : null,
    message_created_at: msg.timestamp ? new Date(msg.timestamp) : null,
    message_edited_at: msg.timestampEdited ? new Date(msg.timestampEdited) : null,
    content_hash: getContentHash(msg),
  };
}
