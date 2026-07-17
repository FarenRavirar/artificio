import crypto from 'node:crypto';
import { stripNullBytes } from '../../discord/parseDiscordAnnouncement.js';
import type { ImportRawMessage } from '../types.js';

export function textToRawMessage(rawText: string, threadName?: string): ImportRawMessage {
  return {
    source_kind: 'manual_paste',
    discord_message_id: crypto.randomUUID(),
    discord_channel_id: '',
    discord_guild_id: '',
    discord_author_id: null,
    discord_author_name: null,
    discord_message_url: null,
    // Achado 2026-07-16: mesma sanitização dos demais adapters de ingestão —
    // colagem manual também pode trazer 0x00 (copy/paste corrompido).
    content_raw: stripNullBytes(rawText.trim()),
    attachments: [],
    embeds: [],
    message_created_at: new Date(),
    message_edited_at: null,
    discord_thread_name: threadName ?? '',
  };
}
