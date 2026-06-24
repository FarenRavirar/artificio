import type { Mock } from 'vitest';

const { mockSqlExecute } = vi.hoisted(() => ({
  mockSqlExecute: vi.fn(),
}));

vi.mock('kysely', async (importOriginal) => {
  const kysely = await importOriginal<typeof import('kysely')>();
  return {
    ...kysely,
    sql: vi.fn(() => ({ execute: mockSqlExecute })),
  };
});

vi.mock('../../db', () => ({
  db: {
    selectFrom: vi.fn(),
    insertInto: vi.fn(),
  },
}));

vi.mock('../chatExporterAdapter', () => ({
  parseDiscordChatExporterJson: vi.fn(),
  adaptMessageToImportRaw: vi.fn(),
  DiscordChatExporterValidationError: class extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'DiscordChatExporterValidationError';
    }
  },
}));

vi.mock('../shared', () => ({
  getContentHash: vi.fn(() => 'test-hash'),
}));

import { importDiscordChatExporterJson } from '../chatExporterImportService';
import { parseDiscordChatExporterJson, adaptMessageToImportRaw, DiscordChatExporterValidationError } from '../chatExporterAdapter';
import { getContentHash } from '../shared';
import { db } from '../../db';

function mockChain(overrides: Record<string, Mock> = {}) {
  const methods = ['select', 'selectAll', 'where', 'returning', 'values', 'execute', 'executeTakeFirst', 'executeTakeFirstOrThrow'];
  const chain: Record<string, Mock> = {};
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnThis();
  }
  return Object.assign(chain, overrides);
}

function makeExportData(overrides: Record<string, unknown> = {}) {
  return {
    guild: { id: 'guild-1', name: 'Guild Teste' },
    channel: { id: 'channel-1', name: 'canal-teste', type: 'GuildTextChat' },
    messages: [
      {
        id: 'msg-1',
        timestamp: '2026-06-23T12:00:00.000+00:00',
        timestampEdited: null,
        author: { id: 'author-1', name: 'Fulano', discriminator: null, nickname: null, color: null },
        content: 'conteudo da mensagem',
        attachments: [],
        embeds: [],
      },
    ],
    ...overrides,
  };
}

function makeAdaptedMessage() {
  return {
    source_kind: 'discord_chat_exporter_json' as const,
    discord_message_id: 'msg-1',
    discord_channel_id: 'channel-1',
    discord_guild_id: 'guild-1',
    discord_parent_channel_id: null,
    discord_thread_id: null,
    discord_thread_name: null,
    discord_author_id: 'author-1',
    discord_author_name: 'Fulano',
    discord_message_url: 'https://discord.com/channels/guild-1/channel-1/msg-1',
    content_raw: 'conteudo da mensagem',
    attachments: [],
    embeds: [],
    message_created_at: new Date('2026-06-23T12:00:00.000+00:00'),
    message_edited_at: null,
    content_hash: 'test-hash',
  };
}

describe('importDiscordChatExporterJson', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSqlExecute.mockClear();
  });

  it('returns zero counts when messages array is empty', async () => {
    (parseDiscordChatExporterJson as Mock).mockReturnValue({ messages: [], guild: { id: 'g1' }, channel: { id: 'c1', name: 'ch', type: 'text' } });

    const result = await importDiscordChatExporterJson({});

    expect(result).toEqual({ total: 0, inserted: 0, updated: 0, ignored: 0, failed: 0 });
  });

  it('inserts messages and returns correct counts', async () => {
    const exportData = makeExportData();
    (parseDiscordChatExporterJson as Mock).mockReturnValue(exportData);
    (adaptMessageToImportRaw as Mock).mockReturnValue(makeAdaptedMessage());
    (getContentHash as Mock).mockReturnValue('test-hash');

    const srcChain = mockChain({ executeTakeFirst: vi.fn().mockResolvedValue(undefined) });
    (db.selectFrom as Mock).mockReturnValue(srcChain);

    const returningChain = mockChain({ execute: vi.fn().mockResolvedValue([{ id: 'source-1' }]) });
    const insertChain = mockChain({ returning: vi.fn().mockReturnValue(returningChain) });
    (db.insertInto as Mock).mockReturnValue(insertChain);

    mockSqlExecute.mockResolvedValue({ rows: [{ action: 'inserted' }] });

    const result = await importDiscordChatExporterJson({});

    expect(result.total).toBe(1);
    expect(result.inserted).toBe(1);
  });

  it('propagates DiscordChatExporterValidationError when adapter throws', async () => {
    const validationError = new DiscordChatExporterValidationError('Arquivo inválido');
    (parseDiscordChatExporterJson as Mock).mockImplementation(() => { throw validationError; });

    await expect(importDiscordChatExporterJson({})).rejects.toThrow(DiscordChatExporterValidationError);
  });

  it('uses existing source when source exists (does not insert new)', async () => {
    const exportData = makeExportData();
    (parseDiscordChatExporterJson as Mock).mockReturnValue(exportData);
    (adaptMessageToImportRaw as Mock).mockReturnValue(makeAdaptedMessage());
    (getContentHash as Mock).mockReturnValue('test-hash');

    const srcChain = mockChain({ executeTakeFirst: vi.fn().mockResolvedValue({ id: 'existing-source' }) });
    (db.selectFrom as Mock).mockReturnValue(srcChain);

    mockSqlExecute.mockResolvedValue({ rows: [{ action: 'inserted' }] });

    await importDiscordChatExporterJson({});

    expect(db.insertInto).not.toHaveBeenCalled();
    expect(mockSqlExecute).toHaveBeenCalled();
  });

  it('creates new source when source does not exist', async () => {
    const exportData = makeExportData();
    (parseDiscordChatExporterJson as Mock).mockReturnValue(exportData);
    (adaptMessageToImportRaw as Mock).mockReturnValue(makeAdaptedMessage());
    (getContentHash as Mock).mockReturnValue('test-hash');

    const srcSelectChain = mockChain({ executeTakeFirst: vi.fn().mockResolvedValue(undefined) });
    (db.selectFrom as Mock).mockReturnValue(srcSelectChain);

    const srcReturningChain = mockChain({ execute: vi.fn().mockResolvedValue([{ id: 'new-source' }]) });
    const srcInsertChain = mockChain({ returning: vi.fn().mockReturnValue(srcReturningChain) });
    (db.insertInto as Mock).mockReturnValue(srcInsertChain);

    mockSqlExecute.mockResolvedValue({ rows: [{ action: 'inserted' }] });

    await importDiscordChatExporterJson({});

    expect(db.insertInto).toHaveBeenCalled();
  });
});
