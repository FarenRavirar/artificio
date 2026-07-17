import { discordChatExporterExportSchema } from './discordChatExporterTypes.js';
import { getContentHash } from './shared.js';
import { stripNullBytes } from './parseDiscordAnnouncement.js';
import type { DiscordChatExporterExport, DiscordChatExporterMessage } from './discordChatExporterTypes.js';
import type { ImportRawMessage } from './types.js';

export class DiscordChatExporterValidationError extends Error {
  constructor(message: string, public readonly details?: unknown) {
    super(message);
    this.name = 'DiscordChatExporterValidationError';
  }
}

export function parseDiscordChatExporterJson(raw: unknown): DiscordChatExporterExport {
  const parsed = discordChatExporterExportSchema.safeParse(raw);
  if (!parsed.success) {
    if (raw && typeof raw === 'object' && !('messages' in raw)) {
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
  importedMessages?: { channelId: string; messageId: string }[];
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
    // Achado 2026-07-16: mesma sanitização de ingestMessages.ts — 0x00 no
    // conteúdo exportado quebra o INSERT em discord_import_messages antes de
    // qualquer parse.
    content_raw: stripNullBytes(msg.content ?? ''),
    attachments: msg.attachments ?? [],
    embeds: msg.embeds ?? [],
    // reference vem normalizado pelo Zod. channelId/guildId podem ser null
    // (ChatExporter emite null) → coage para undefined no contrato interno.
    reference: msg.reference ? {
      messageId: msg.reference.messageId,
      channelId: msg.reference.channelId ?? undefined,
      guildId: msg.reference.guildId ?? undefined,
    } : null,
    message_created_at: msg.timestamp ? new Date(msg.timestamp) : null,
    message_edited_at: msg.timestampEdited ? new Date(msg.timestampEdited) : null,
    content_hash: getContentHash(msg),
  };
}
