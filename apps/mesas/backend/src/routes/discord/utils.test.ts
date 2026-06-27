import type { Mock } from 'vitest';

vi.mock('../../db', () => ({
  db: {
    selectFrom: vi.fn(),
    insertInto: vi.fn(),
    updateTable: vi.fn(),
  },
}));

vi.mock('../../discord', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../discord')>();
  return {
    ...actual,
    parseDiscordAnnouncement: vi.fn(),
    normalizeDiscordTableDraft: vi.fn(),
  };
});

vi.mock('../../discord/llmAssist', () => ({
  assistDiscordParse: vi.fn(),
}));

vi.mock('../../discord/syncHelpers', () => ({
  uploadCoverForDraft: vi.fn(),
  updateDraftImageUploadState: vi.fn(),
}));

vi.mock('../../discord/shared', () => ({
  loadSystemsForParser: vi.fn(),
}));

vi.mock('../../services/adminNotifications', () => ({
  notifyAdmins: vi.fn(),
}));

import { describe, expect, it, beforeEach, vi } from 'vitest';
import { processDiscordMessageToDraft } from './utils';
import { db } from '../../db';
import { parseDiscordAnnouncement, normalizeDiscordTableDraft } from '../../discord';
import { assistDiscordParse } from '../../discord/llmAssist';
import { uploadCoverForDraft, updateDraftImageUploadState } from '../../discord/syncHelpers';
import type { DiscordImportMessagesTable } from '../../db/types';
import type { Selectable } from 'kysely';

function chain(overrides: Record<string, Mock> = {}) {
  const methods = ['select', 'where', 'set', 'values', 'returning', 'execute', 'executeTakeFirst', 'executeTakeFirstOrThrow'];
  const value: Record<string, Mock> = {};
  for (const method of methods) value[method] = vi.fn().mockReturnThis();
  return Object.assign(value, overrides);
}

function message(): Selectable<DiscordImportMessagesTable> {
  return {
    id: 'message-uuid',
    source_id: 'source-1',
    source_kind: 'discord_chat_exporter_json',
    discord_message_id: '1441138618755448997',
    discord_channel_id: 'channel-1',
    discord_guild_id: 'guild-1',
    discord_parent_channel_id: null,
    discord_thread_id: null,
    discord_thread_name: 'Mesa sem título',
    discord_author_id: 'author-1',
    discord_author_name: 'GM',
    discord_message_url: 'https://discord.com/channels/guild-1/channel-1/1441138618755448997',
    content_raw: 'Anúncio grande o bastante para acionar o assistente LLM com baixa confiança e campos faltantes.',
    attachments: [],
    embeds: [],
    reference: null,
    content_hash: 'hash-1',
    message_created_at: new Date('2026-06-26T10:00:00Z'),
    message_edited_at: null,
    status: 'pending',
    parse_error: null,
    created_at: new Date('2026-06-26T10:00:00Z'),
    updated_at: new Date('2026-06-26T10:00:00Z'),
  };
}

describe('processDiscordMessageToDraft', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    (db.selectFrom as Mock).mockReturnValue(chain({ executeTakeFirst: vi.fn().mockResolvedValue(undefined) }));
    (db.updateTable as Mock).mockReturnValue(chain({ execute: vi.fn().mockResolvedValue(undefined) }));
    (db.insertInto as Mock).mockReturnValue(chain({ executeTakeFirstOrThrow: vi.fn().mockResolvedValue({ id: 'draft-uuid' }) }));
    (uploadCoverForDraft as Mock).mockResolvedValue(null);
    (updateDraftImageUploadState as Mock).mockResolvedValue(undefined);
  });

  it('awaits DeepSeek enrichment before inserting the draft', async () => {
    const parsed = {
      source: { guild_id: 'guild-1', channel_id: 'channel-1', message_id: '1441138618755448997', message_url: 'https://discord.com/channels/guild-1/channel-1/1441138618755448997' },
      table: {
        title: null,
        system_name: null,
        system_id: null,
        raw_system_hint: null,
        type: 'campanha',
        modality: 'online',
        price_type: null,
        price_value: null,
        slots_total: null,
        slots_filled: null,
        slots_open: null,
        day_of_week: null,
        start_time: null,
        frequency: null,
        description: null,
        contact_discord: null,
        contact_url: null,
        host_discord_id: null,
        cover_url: null,
        cover_url_source: null,
        cover_quality: null,
        _slots_ambiguity: null,
        _homebrew_suspect: null,
        _notes: [],
      },
      confidence: 0.25,
      confidence_tier: 'baixa',
      missing_fields: ['title', 'system_name', 'price_type', 'slots_total', 'contact_url'],
    };

    (parseDiscordAnnouncement as Mock).mockReturnValue(parsed);
    (normalizeDiscordTableDraft as Mock)
      .mockReturnValueOnce({ draft: parsed, status: 'needs_review' })
      .mockImplementationOnce((draft) => ({ draft, status: 'needs_review' }));
    (assistDiscordParse as Mock).mockResolvedValue({
      model: 'deepseek-chat',
      extracted: {
        title: 'A Torre Partida',
        system_hint: 'D&D 5E',
        price_type: 'gratuita',
        slots_total: 5,
        contact_url: 'https://forms.gle/teste',
      },
    });

    await expect(processDiscordMessageToDraft(message(), [], undefined, 'admin-1')).resolves.toBe('parsed');

    const insertChain = (db.insertInto as Mock).mock.results[0]?.value as { values: Mock };
    expect(insertChain.values).toHaveBeenCalledWith(expect.objectContaining({
      normalized_payload: expect.objectContaining({
        table: expect.objectContaining({
          title: 'A Torre Partida',
          system_name: 'D&D 5E',
          price_type: 'gratuita',
          slots_total: 5,
          contact_url: 'https://forms.gle/teste',
          _notes: expect.arrayContaining(['Campos incompletos enriquecidos por DeepSeek; revisar antes de sincronizar.']),
        }),
      }),
    }));
  });
});