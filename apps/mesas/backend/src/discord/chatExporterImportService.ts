import crypto from 'node:crypto';
import { sql } from 'kysely';
import { db } from '../db';
import { parseDiscordChatExporterJson, adaptMessageToImportRaw, DiscordChatExporterValidationError } from './chatExporterAdapter';
import type { ImportResult } from './chatExporterAdapter';
import type { DiscordChatExporterExport, DiscordChatExporterMessage } from './discordChatExporterTypes';

function asJsonbArray(value: unknown): ReturnType<typeof sql<unknown[]>> {
  return sql<unknown[]>`${JSON.stringify(value ?? [])}::jsonb`;
}

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
  attachments: ReturnType<typeof asJsonbArray>;
  embeds: ReturnType<typeof asJsonbArray>;
  message_created_at: Date | null;
  message_edited_at: Date | null;
  content_hash: string;
  source_kind: 'discord_chat_exporter_json';
  status: 'pending';
};

type UpdateRow = { id: string; contentRaw: string; contentHash: string; embeds: ReturnType<typeof asJsonbArray>; attachments: ReturnType<typeof asJsonbArray> };

function getContentHash(msg: DiscordChatExporterMessage): string {
  return crypto
    .createHash('sha256')
    .update(msg.content ?? '')
    .update(JSON.stringify(msg.embeds ?? []))
    .update(JSON.stringify(msg.attachments ?? []))
    .digest('hex');
}

export async function importDiscordChatExporterJson(raw: unknown): Promise<ImportResult> {
  const exportData = parseDiscordChatExporterJson(raw);
  const { messages } = exportData;

  if (!messages || messages.length === 0) {
    return { total: 0, inserted: 0, updated: 0, ignored: 0, failed: 0 };
  }

  const channelId = exportData.channel.id;
  const guildId = exportData.guild.id;

  const msgData = messages.map((msg) => {
    const adapted = adaptMessageToImportRaw(msg, exportData);
    return {
      msg,
      adapted,
      contentHash: getContentHash(msg),
    };
  });

  const existingRecords = await db
    .selectFrom('discord_import_messages')
    .select(['id', 'content_hash', 'discord_message_id'])
    .where('discord_channel_id', '=', channelId)
    .where('discord_message_id', 'in', msgData.map((m) => m.msg.id))
    .execute();

  const existingMap = new Map(existingRecords.map((e) => [e.discord_message_id, e]));
  const toInsert: InsertRow[] = [];
  const toUpdate: UpdateRow[] = [];

  for (const { msg, adapted, contentHash } of msgData) {
    const existing = existingMap.get(msg.id);
    if (!existing) {
      toInsert.push({
        source_id: `chat-exporter-${channelId}`,
        discord_message_id: msg.id,
        discord_channel_id: channelId,
        discord_guild_id: guildId,
        discord_parent_channel_id: adapted.discord_parent_channel_id ?? null,
        discord_thread_id: adapted.discord_thread_id ?? null,
        discord_thread_name: adapted.discord_thread_name ?? null,
        discord_author_id: adapted.discord_author_id ?? null,
        discord_author_name: adapted.discord_author_name ?? null,
        discord_message_url: adapted.discord_message_url ?? '',
        content_raw: adapted.content_raw,
        attachments: asJsonbArray(adapted.attachments),
        embeds: asJsonbArray(adapted.embeds),
        message_created_at: adapted.message_created_at,
        message_edited_at: adapted.message_edited_at,
        content_hash: contentHash,
        source_kind: 'discord_chat_exporter_json',
        status: 'pending',
      });
    } else if (existing.content_hash !== contentHash) {
      toUpdate.push({
        id: existing.id,
        contentRaw: adapted.content_raw,
        contentHash,
        embeds: asJsonbArray(adapted.embeds),
        attachments: asJsonbArray(adapted.attachments),
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

  return {
    total: messages.length,
    inserted: toInsert.length,
    updated: toUpdate.length,
    ignored: messages.length - toInsert.length - toUpdate.length,
    failed: 0,
  };
}
