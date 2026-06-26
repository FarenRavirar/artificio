import type { Mock } from 'vitest';

const { mockSqlExecute, mockSqlTemplates } = vi.hoisted(() => ({
  mockSqlExecute: vi.fn(),
  mockSqlTemplates: [] as string[][],
}));

vi.mock('kysely', async (importOriginal) => {
  const kysely = await importOriginal<typeof import('kysely')>();
  return {
    ...kysely,
    sql: vi.fn((...args: unknown[]) => {
      const [strings] = args as [string[] | TemplateStringsArray];
      if (Array.isArray(strings) && strings.length > 0) {
        mockSqlTemplates.push([...strings]);
      }
      return { execute: mockSqlExecute };
    }),
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

import { importDiscordChatExporterJson, extractJsonPayload, MAX_IMPORT_MESSAGES } from '../chatExporterImportService';
import { parseDiscordChatExporterJson, adaptMessageToImportRaw, DiscordChatExporterValidationError } from '../chatExporterAdapter';
import { getContentHash } from '../shared';
import { db } from '../../db';
import { truncatedJsonString } from './fixtures/chatExporterSample';

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
    mockSqlTemplates.length = 0;
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

  // ─── T-F2: limite de mensagens ───

  it('rejects payload above MAX_IMPORT_MESSAGES', async () => {
    const manyMessages = Array.from({ length: MAX_IMPORT_MESSAGES + 1 }, (_, i) => ({
      id: `msg-${i}`,
      timestamp: '2026-06-23T12:00:00.000+00:00',
      timestampEdited: null,
      author: { id: `author-${i}`, name: `User${i}`, discriminator: null, nickname: null, color: null },
      content: `conteudo ${i}`,
      attachments: [],
      embeds: [],
    }));
    const exportData = { guild: { id: 'g1', name: 'G' }, channel: { id: 'c1', name: 'ch', type: 'text' }, messages: manyMessages };
    (parseDiscordChatExporterJson as Mock).mockReturnValue(exportData);

    await expect(importDiscordChatExporterJson({})).rejects.toThrow(/2501|2000/);
  });

  it('accepts payload at MAX_IMPORT_MESSAGES limit', async () => {
    const limitMessages = Array.from({ length: MAX_IMPORT_MESSAGES }, (_, i) => ({
      id: `msg-${i}`,
      timestamp: '2026-06-23T12:00:00.000+00:00',
      timestampEdited: null,
      author: { id: `author-${i}`, name: `User${i}`, discriminator: null, nickname: null, color: null },
      content: `conteudo ${i}`,
      attachments: [],
      embeds: [],
    }));
    const exportData = { guild: { id: 'g1', name: 'G' }, channel: { id: 'c1', name: 'ch', type: 'text' }, messages: limitMessages };
    (parseDiscordChatExporterJson as Mock).mockReturnValue(exportData);
    (adaptMessageToImportRaw as Mock).mockReturnValue(makeAdaptedMessage());
    (getContentHash as Mock).mockReturnValue('test-hash');

    const srcChain = mockChain({ executeTakeFirst: vi.fn().mockResolvedValue({ id: 'existing-source' }) });
    (db.selectFrom as Mock).mockReturnValue(srcChain);
    mockSqlExecute.mockResolvedValue({ rows: [{ action: 'inserted' }] });

    const result = await importDiscordChatExporterJson({});
    expect(result.total).toBe(MAX_IMPORT_MESSAGES);
  });

  // ─── T-F5: performance 100 msgs ───

  it('handles 100 messages without throw', async () => {
    const hundredMessages = Array.from({ length: 100 }, (_, i) => ({
      id: `msg-perf-${i}`,
      timestamp: '2026-06-23T12:00:00.000+00:00',
      timestampEdited: null,
      author: { id: `author-${i}`, name: `User${i}`, discriminator: null, nickname: null, color: null },
      content: `conteudo de performance ${i}`,
      attachments: [],
      embeds: [],
    }));
    const exportData = { guild: { id: 'g1', name: 'G' }, channel: { id: 'c1', name: 'ch', type: 'text' }, messages: hundredMessages };
    (parseDiscordChatExporterJson as Mock).mockReturnValue(exportData);
    (adaptMessageToImportRaw as Mock).mockReturnValue(makeAdaptedMessage());
    (getContentHash as Mock).mockReturnValue('test-hash');

    const srcChain = mockChain({ executeTakeFirst: vi.fn().mockResolvedValue({ id: 'existing-source' }) });
    (db.selectFrom as Mock).mockReturnValue(srcChain);
    mockSqlExecute.mockResolvedValue({ rows: [{ action: 'inserted' }] });

    const result = await importDiscordChatExporterJson({});
    expect(result.total).toBe(100);
  });

  // ─── T-F10: anti-regressão 047 ───
  // Status sempre 'pending' — validado no SQL template do serviço
  // (linha 87: 'discord_chat_exporter_json', 'pending' — hardcoded, sem rota de auto-publicação)

  it('inserts messages with status pending (never auto-publishes)', async () => {
    mockSqlTemplates.length = 0; // limpa antes do teste
    const exportData = makeExportData();
    (parseDiscordChatExporterJson as Mock).mockReturnValue(exportData);
    (adaptMessageToImportRaw as Mock).mockReturnValue(makeAdaptedMessage());
    (getContentHash as Mock).mockReturnValue('test-hash');

    const srcChain = mockChain({ executeTakeFirst: vi.fn().mockResolvedValue({ id: 'existing-source' }) });
    (db.selectFrom as Mock).mockReturnValue(srcChain);
    mockSqlExecute.mockResolvedValue({ rows: [{ action: 'inserted' }] });

    await importDiscordChatExporterJson({});

    // O template SQL deve conter 'pending' (status fixo, sem auto-publicação)
    expect(mockSqlTemplates.length).toBeGreaterThan(0);
    const fullSql = mockSqlTemplates[0].join('');
    expect(fullSql).toContain("'pending'");
  });
});

// ─── DEB-048-01: testes de JSON truncado/inválido ───

describe('extractJsonPayload', () => {
  it('rejeita string JSON truncada no campo json', () => {
    const result = extractJsonPayload({ json: truncatedJsonString });
    expect(result).toHaveProperty('error');
    expect(result).toHaveProperty('status', 400);
    if ('error' in result) {
      expect(result.error).toContain('não é um JSON válido');
    }
  });

  it('rejeita JSON string malformado (não-JSON)', () => {
    const result = extractJsonPayload({ json: 'isto não é json' });
    expect(result).toHaveProperty('error');
    expect(result).toHaveProperty('status', 400);
  });

  it('mensagem de erro NÃO contém o payload cru', () => {
    const result = extractJsonPayload({ json: truncatedJsonString });
    expect(result).toHaveProperty('error');
    if ('error' in result) {
      // A mensagem não deve conter o payload truncado nem stack trace
      expect(result.error).not.toContain('{"guild"');
      expect(result.error).not.toContain('SyntaxError');
    }
  });
});
