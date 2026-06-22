import crypto from 'node:crypto';
import type { ImportRawMessage } from '../types';

export function textToRawMessage(rawText: string, threadName?: string): ImportRawMessage {
  return {
    source_kind: 'manual_paste',
    discord_message_id: crypto.randomUUID(),
    discord_channel_id: '',
    discord_guild_id: '',
    discord_author_id: null,
    discord_author_name: null,
    discord_message_url: null,
    content_raw: rawText.trim(),
    attachments: [],
    embeds: [],
    message_created_at: new Date(),
    message_edited_at: null,
    discord_thread_name: threadName ?? '',
  };
}
