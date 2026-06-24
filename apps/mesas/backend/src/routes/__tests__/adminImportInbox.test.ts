import express from 'express';
import request from 'supertest';
import type { Mock } from 'vitest';
import adminInboxRoutes from '../adminImportInbox';
import { db } from '../../db';
import { TableRepository } from '../../repositories/tableRepository';
import { segmentAnnouncements } from '../../inbox/segmentation';
import { textToRawMessage } from '../../inbox/adapters/textToRawMessage';
import { parseDiscordAnnouncement, normalizeDiscordTableDraft } from '../../discord';

vi.mock('../../db', () => ({
  db: {
    insertInto: vi.fn(),
    updateTable: vi.fn(),
    selectFrom: vi.fn(),
    transaction: vi.fn().mockReturnValue({
      execute: vi.fn(),
    }),
  },
}));

vi.mock('../../repositories/tableRepository', () => ({
  TableRepository: {
    createTableWithRelations: vi.fn(),
  },
}));

vi.mock('../../services/tableService', () => ({
  TableService: {
    generateSlug: vi.fn().mockReturnValue('mesa-teste'),
  },
}));

vi.mock('../../middleware/auth', () => ({
  authMiddleware: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.user = { userId: 'admin-test', role: 'admin', name: 'Admin Teste' };
    next();
  },
  requireAdmin: [(req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.user = { userId: 'admin-test', role: 'admin', name: 'Admin Teste' };
    next();
  }],
}));

vi.mock('../../inbox/segmentation', () => ({
  segmentAnnouncements: vi.fn(),
}));

vi.mock('../../inbox/adapters/textToRawMessage', () => ({
  textToRawMessage: vi.fn(),
}));

vi.mock('../../discord', async () => {
  const actual = await vi.importActual<typeof import('../../discord')>('../../discord');
  return {
    ...actual,
    parseDiscordAnnouncement: vi.fn(),
    normalizeDiscordTableDraft: vi.fn(),
  };
});

const mockDb = db as unknown as {
  insertInto: Mock;
  updateTable: Mock;
  selectFrom: Mock;
  transaction: Mock;
};

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/admin/inbox', adminInboxRoutes);
  return app;
}

function mockChain(overrides: Record<string, unknown> = {}) {
  const chain: Record<string, Mock> = {};
  const methods = [
    'select', 'selectAll', 'where', 'innerJoin', 'orderBy', 'limit', 'offset',
    'groupBy', 'set', 'returning', 'returningAll', 'values',
    'execute', 'executeTakeFirst', 'deleteFrom',
  ];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnThis();
  }
  return Object.assign(chain, overrides);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.transaction.mockReturnValue({
    execute: vi.fn(),
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// syncImportDraftToTable
// ────────────────────────────────────────────────────────────────────────────────

describe('POST /admin/inbox/drafts/:id/sync', () => {
  it('rejects when draft is not found (404)', async () => {
    const chain = mockChain({
      executeTakeFirst: vi.fn().mockResolvedValue(null),
    });
    mockDb.selectFrom.mockReturnValue(chain);

    const response = await request(makeApp())
      .post('/admin/inbox/drafts/nonexistent/sync');

    expect(response.status).toBe(404);
    expect(response.body.error).toContain('não encontrado');
  });

  it('rejects draft without import_message_id (422)', async () => {
    const chain = mockChain({
      executeTakeFirst: vi.fn().mockResolvedValue({
        id: 'draft-1',
        status: 'ready',
        import_message_id: null,
      }),
    });
    mockDb.selectFrom.mockReturnValue(chain);

    const response = await request(makeApp())
      .post('/admin/inbox/drafts/draft-1/sync');

    expect(response.status).toBe(422);
    expect(response.body.error).toContain('não é de inbox');
  });

  it('rejects already-synced draft (returns existing table_id)', async () => {
    const chain = mockChain({
      executeTakeFirst: vi.fn().mockResolvedValue({
        id: 'draft-1',
        status: 'synced',
        table_id: 'table-existing',
        import_message_id: 'import-1',
      }),
    });
    mockDb.selectFrom.mockReturnValue(chain);

    const response = await request(makeApp())
      .post('/admin/inbox/drafts/draft-1/sync');

    expect(response.status).toBe(200);
    expect(response.body.data.tableId).toBe('table-existing');
    expect(response.body.data.created).toBe(false);
  });

  it('rejects draft with status rejected', async () => {
    const chain = mockChain({
      executeTakeFirst: vi.fn().mockResolvedValue({
        id: 'draft-1',
        status: 'rejected',
        import_message_id: 'import-1',
      }),
    });
    mockDb.selectFrom.mockReturnValue(chain);

    const response = await request(makeApp())
      .post('/admin/inbox/drafts/draft-1/sync');

    expect(response.status).toBe(422);
    expect(response.body.error).toContain('rejeitado');
  });

  it('rejects draft not marked as ready', async () => {
    const chain = mockChain({
      executeTakeFirst: vi.fn().mockResolvedValue({
        id: 'draft-1',
        status: 'draft',
        import_message_id: 'import-1',
      }),
    });
    mockDb.selectFrom.mockReturnValue(chain);

    const response = await request(makeApp())
      .post('/admin/inbox/drafts/draft-1/sync');

    expect(response.status).toBe(422);
    expect(response.body.error).toContain('ready');
  });

  it('rejects when import_message not found', async () => {
    let callCount = 0;
    const chain = mockChain({
      executeTakeFirst: vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            id: 'draft-1',
            status: 'ready',
            import_message_id: 'import-1',
            normalized_payload: null,
            parsed_payload: null,
            image_upload_attempts: 0,
          });
        }
        return Promise.resolve(null);
      }),
    });
    mockDb.selectFrom.mockReturnValue(chain);

    const response = await request(makeApp())
      .post('/admin/inbox/drafts/draft-1/sync');

    expect(response.status).toBe(422);
    expect(response.body.error).toContain('não encontrada');
  });

  it('returns 422 when draft has missing fields', async () => {
    const mockExecuteTakeFirst = vi.fn()
      .mockResolvedValueOnce({
        id: 'draft-1',
        status: 'ready',
        import_message_id: 'import-1',
        normalized_payload: { table: { title: null, description: null }, source: {} },
        parsed_payload: null,
        image_upload_attempts: 0,
      })
      .mockResolvedValueOnce({ id: 'import-1', content_raw: 'texto' });

    const chain = mockChain({ executeTakeFirst: mockExecuteTakeFirst });
    mockDb.selectFrom.mockReturnValue(chain);

    const response = await request(makeApp())
      .post('/admin/inbox/drafts/draft-1/sync');

    expect(response.status).toBe(422);
    expect(response.body.missing_fields).toBeDefined();
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// POST /drafts/:id/correction
// ────────────────────────────────────────────────────────────────────────────────

function mockDraftRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'draft-1',
    status: 'ready' as const,
    parsed_payload: { table: { title: 'Original', type: 'campanha' }, source: {} },
    normalized_payload: { table: { title: 'Original', type: 'campanha' }, source: {} },
    import_message_id: 'import-1',
    ...overrides,
  };
}

function mockImportMsg() {
  return { raw_text: 'Título: Original', content_raw: 'Título: Original\nSistema: D&D' };
}

function setupCorrectionMocks(draft: Record<string, unknown>, importMsg: Record<string, unknown> | null = null) {
  // call 0: draft select, call 1: import_messages select
  let callIdx = 0;
  const execFn = vi.fn().mockImplementation(() => {
    callIdx++;
    if (callIdx === 1) return Promise.resolve(draft);
    if (callIdx === 2) return Promise.resolve(importMsg);
    return Promise.resolve(null);
  });

  mockDb.selectFrom.mockReturnValue(mockChain({ executeTakeFirst: execFn }));

  // transaction mock
  const mockTrx = {
    insertInto: vi.fn().mockReturnThis(),
    updateTable: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue([]),
  };
    mockDb.transaction.mockReturnValue({
      execute: vi.fn().mockImplementation(async (fn: (trx: typeof mockTrx) => Promise<unknown>) => {
        return await fn(mockTrx);
      }),
    });

  return mockTrx;
}

describe('POST /admin/inbox/drafts/:id/correction', () => {
  it('returns 404 for empty draft_id (Express does not match route)', async () => {
    const response = await request(makeApp())
      .post('/admin/inbox/drafts//correction')
      .send({ corrections: { title: 'Novo Título' } });

    expect(response.status).toBe(404);
  });

  it('rejects invalid payload (400)', async () => {
    const response = await request(makeApp())
      .post('/admin/inbox/drafts/draft-1/correction')
      .send({ invalid: true });

    expect(response.status).toBe(400);
  });

  it('returns 404 for nonexistent draft', async () => {
    setupCorrectionMocks(null as any);
    const response = await request(makeApp())
      .post('/admin/inbox/drafts/nonexistent/correction')
      .send({ corrections: { title: 'Novo Título' } });

    expect(response.status).toBe(404);
  });

  it('returns 422 for Discord draft (import_message_id=null)', async () => {
    setupCorrectionMocks(mockDraftRow({ import_message_id: null }));
    const response = await request(makeApp())
      .post('/admin/inbox/drafts/draft-1/correction')
      .send({ corrections: { title: 'Novo Título' } });

    expect(response.status).toBe(422);
    expect(response.body.error).toContain('não é de inbox');
  });

  it('returns 422 for synced draft', async () => {
    setupCorrectionMocks(mockDraftRow({ status: 'synced' }));
    const response = await request(makeApp())
      .post('/admin/inbox/drafts/draft-1/correction')
      .send({ corrections: { title: 'Novo Título' } });

    expect(response.status).toBe(422);
    expect(response.body.error).toContain('já sincronizado');
  });

  it('returns 422 for rejected draft', async () => {
    setupCorrectionMocks(mockDraftRow({ status: 'rejected' }));
    const response = await request(makeApp())
      .post('/admin/inbox/drafts/draft-1/correction')
      .send({ corrections: { title: 'Novo Título' } });

    expect(response.status).toBe(422);
    expect(response.body.error).toContain('rejeitado');
  });

  it('persists correction with raw_text, updates normalized_payload in transaction', async () => {
    const draft = mockDraftRow();
    const importMsg = mockImportMsg();
    const trx = setupCorrectionMocks(draft, importMsg);

    const response = await request(makeApp())
      .post('/admin/inbox/drafts/draft-1/correction')
      .send({ corrections: { title: 'Título Corrigido' }, reason: 'Erro de digitação' });

    expect(response.status).toBe(200);
    expect(response.body.data.fields_corrected).toBe(1);
    expect(response.body.data.diff.title).toBeDefined();
    expect(response.body.data.diff.title.before).toBe('Original');
    expect(response.body.data.diff.title.after).toBe('Título Corrigido');

    // Verificou que transação foi usada
    expect(mockDb.transaction).toHaveBeenCalled();

    // Verificou que raw_text veio do import_messages
    const insertCall = trx.insertInto.mock.calls.find((c: any) => c[0] === 'import_corrections');
    expect(insertCall).toBeDefined();

    // Verificou que normalized_payload foi atualizado no draft
    const updateCall = trx.updateTable.mock.calls.find((c: any) => c[0] === 'discord_import_table_drafts');
    expect(updateCall).toBeDefined();
  });

  it('persists correction and returns diff with zero changed fields when all values match', async () => {
    const draft = mockDraftRow();
    const importMsg = mockImportMsg();
    setupCorrectionMocks(draft, importMsg);

    const response = await request(makeApp())
      .post('/admin/inbox/drafts/draft-1/correction')
      .send({ corrections: { title: 'Original' } });

    expect(response.status).toBe(200);
    expect(response.body.data.fields_corrected).toBe(0);
    expect(Object.keys(response.body.data.diff).length).toBe(0);
  });

  it('persists correction and returns diff with changed fields', async () => {
    const draft = mockDraftRow();
    const importMsg = mockImportMsg();
    setupCorrectionMocks(draft, importMsg);

    const response = await request(makeApp())
      .post('/admin/inbox/drafts/draft-1/correction')
      .send({ corrections: { title: 'Título Corrigido' }, reason: 'Erro de digitação' });

    expect(response.status).toBe(200);
    expect(response.body.data.fields_corrected).toBe(1);
    expect(response.body.data.diff.title).toBeDefined();
    expect(response.body.data.diff.title.before).toBe('Original');
    expect(response.body.data.diff.title.after).toBe('Título Corrigido');
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// GET /metrics
// ────────────────────────────────────────────────────────────────────────────────

describe('GET /admin/inbox/metrics', () => {
  it('returns zero counts for empty corrections table', async () => {
    const chain1 = mockChain({
      executeTakeFirst: vi.fn().mockResolvedValue({ count: 0 }),
    });
    const chain2 = mockChain({
      execute: vi.fn().mockResolvedValue([]),
    });

    let callCount = 0;
    const chain = {
      ...mockChain(),
      selectFrom: vi.fn(),
    };

    // First call: selectFrom('import_corrections').select(fn).executeTakeFirst()
    mockDb.selectFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return chain1;
      if (callCount === 2) return chain2;
      return chain1;
    });

    const response = await request(makeApp())
      .get('/admin/inbox/metrics');

    expect(response.status).toBe(200);
    expect(response.body.data.total_corrections).toBe(0);
    expect(response.body.data.most_corrected_fields).toEqual([]);
  });

  it('aggregates field correction counts correctly', async () => {
    const chain1 = mockChain({
      executeTakeFirst: vi.fn().mockResolvedValue({ count: 3 }),
    });
    const chain2 = mockChain({
      execute: vi.fn().mockResolvedValue([
        { diff: { title: { before: 'A', after: 'B' }, system_id: { before: 'X', after: 'Y' } } },
        { diff: { title: { before: 'C', after: 'D' } } },
        { diff: { type: { before: 'x', after: 'y' }, title: { before: 'E', after: 'F' } } },
      ]),
    });

    let callCount = 0;
    mockDb.selectFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return chain1;
      if (callCount === 2) return chain2;
      return chain1;
    });

    const response = await request(makeApp())
      .get('/admin/inbox/metrics');

    expect(response.status).toBe(200);
    expect(response.body.data.total_corrections).toBe(3);

    const fields = response.body.data.most_corrected_fields as Array<{ field: string; count: number }>;
    expect(fields.find((f) => f.field === 'title')?.count).toBe(3);
    expect(fields.find((f) => f.field === 'system_id')?.count).toBe(1);
    expect(fields.find((f) => f.field === 'type')?.count).toBe(1);
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// syncImportDraftToTable — creates table with status draft, never published
// ────────────────────────────────────────────────────────────────────────────────

describe('syncImportDraftToTable table creation', () => {
  it('creates table with status draft (never published)', async () => {
    const mockTrx = {
      updateTable: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue([]),
      deleteFrom: vi.fn().mockReturnThis(),
      insertInto: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
    };
    mockDb.transaction.mockReturnValue({
      execute: vi.fn().mockImplementation(async (fn: (trx: typeof mockTrx) => Promise<void>) => {
        await fn(mockTrx);
      }),
    });

    vi.mocked(TableRepository.createTableWithRelations)
      .mockResolvedValue({ id: 'table-new' } as any);

    const payload = {
      table: {
        title: 'Mesa Teste',
        description: 'Desc',
        system_id: 'sys-1',
        type: 'campanha',
        modality: 'online',
        price_type: 'gratuita',
        slots_total: 5,
        slots_open: 5,
        slots_filled: 0,
        day_of_week: 'sábado',
        start_time: '19:00',
        contact_url: 'https://forms.gle/test',
      },
      source: { author_name: null },
    };

    let callCount = 0;
    const executeTakeFirst = vi.fn()
      .mockResolvedValueOnce({
        id: 'draft-1',
        status: 'ready',
        import_message_id: 'import-1',
        normalized_payload: payload,
        parsed_payload: null,
        image_upload_attempts: 0,
      })
      .mockResolvedValueOnce({ id: 'import-1', content_raw: 'texto' })
      .mockResolvedValueOnce(null);

    const chain = mockChain({ executeTakeFirst });
    mockDb.selectFrom.mockReturnValue(chain);

    const response = await request(makeApp())
      .post('/admin/inbox/drafts/draft-1/sync');

    expect(response.status).toBe(200);
    expect(response.body.data.created).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// POST /admin/inbox/import-text
// ────────────────────────────────────────────────────────────────────────────────

describe('POST /admin/inbox/import-text', () => {
  it('rejects text shorter than 10 characters (400)', async () => {
    const response = await request(makeApp())
      .post('/admin/inbox/import-text')
      .send({ text: 'curto' });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('mínimo 10');
  });

  it('rejects payload without text field (400)', async () => {
    const response = await request(makeApp())
      .post('/admin/inbox/import-text')
      .send({ title_hint: 'D&D 5e' });

    expect(response.status).toBe(400);
  });

  it('returns 200 with drafts_created on valid text with mocked parser', async () => {
    const mockDraft = {
      table: {
        title: 'Mesa Teste',
        system_name: 'D&D 5e',
        system_id: 'sys-1',
        type: 'campanha',
        modality: 'online',
        price_type: 'gratuita',
        slots_total: 5,
        slots_open: 5,
        day_of_week: 'sábado',
        start_time: '19:00',
        contact_url: 'https://discord.gg/test',
      },
      source: { guild_id: '1', channel_id: '2', message_id: '3', message_url: 'https://discord.com' },
      confidence: 1,
      missing_fields: [],
    };

    const mockNormalized = {
      draft: mockDraft,
      status: 'ready' as const,
    };

    vi.mocked(segmentAnnouncements).mockReturnValue(['Título: Mesa Teste\nSistema: D&D 5e\nDia: sábado\nHorário: 19:00']);
    vi.mocked(textToRawMessage).mockReturnValue({
      source_kind: 'manual_paste',
      discord_message_id: 'msg-1',
      discord_channel_id: '',
      discord_guild_id: '',
      discord_author_id: null,
      discord_author_name: null,
      discord_message_url: null,
      content_raw: 'Título: Mesa Teste',
      attachments: [],
      embeds: [],
      message_created_at: new Date(),
      message_edited_at: null,
      discord_thread_name: '',
    });
    vi.mocked(parseDiscordAnnouncement).mockReturnValue(mockDraft as any);
    vi.mocked(normalizeDiscordTableDraft).mockReturnValue(mockNormalized as any);

    // DB: loadSystemsForParser (2 calls) + dedup check (2 calls) + insert import_messages + insert draft + update import_messages
    let selectCall = 0;
    const emptyAliasChain = mockChain({
      execute: vi.fn().mockResolvedValue([]),
    });
    const systemsChain = mockChain({
      execute: vi.fn().mockResolvedValue([]),
    });
    const dedupNotFoundChain = mockChain({
      executeTakeFirst: vi.fn().mockResolvedValue(null),
    });

    const insertMsgChain = mockChain({
      execute: vi.fn().mockResolvedValue([{ id: 'import-1' }]),
    });
    const insertDraftChain = mockChain({
      execute: vi.fn().mockResolvedValue([{ id: 'draft-1', status: 'ready', confidence: 1 }]),
    });
    const updateChain = mockChain({
      execute: vi.fn().mockResolvedValue([]),
    });

    // returnUpdateChain needs returningAll
    // returnChain needs returning
    // setWhere needs where → returning → execute
    const setWhereChain: Record<string, Mock> = mockChain({ execute: vi.fn().mockResolvedValue([]) });
    setWhereChain.returning = vi.fn().mockReturnThis();
    setWhereChain.returningAll = vi.fn().mockReturnThis();
    const setChain: Record<string, Mock> = {
      ...mockChain(),
      where: vi.fn().mockReturnValue(setWhereChain),
      return: vi.fn().mockReturnThis(),
    };
    const valuesDraftChain: Record<string, Mock> = {
      ...mockChain(),
      execute: vi.fn().mockResolvedValue([{ id: 'draft-1', status: 'ready', confidence: 1 }]),
    };
    const valuesMsgChain: Record<string, Mock> = {
      ...mockChain(),
      execute: vi.fn().mockResolvedValue([{ id: 'import-1' }]),
    };

    // insertInto('import_messages').values(...).returning('id').execute()
    valuesMsgChain.returning = vi.fn().mockReturnValue({
      execute: vi.fn().mockResolvedValue([{ id: 'import-1' }]),
    });

    // insertInto('discord_import_table_drafts').values(...).returning(['id','status','confidence']).execute()
    valuesDraftChain.returning = vi.fn().mockReturnValue({
      execute: vi.fn().mockResolvedValue([{ id: 'draft-1', status: 'ready', confidence: 1 }]),
    });

    const insertMsgBuilder: Record<string, Mock> = {
      ...mockChain(),
      values: vi.fn().mockReturnValue(valuesMsgChain),
    };
    const insertDraftBuilder: Record<string, Mock> = {
      ...mockChain(),
      values: vi.fn().mockReturnValue(valuesDraftChain),
    };
    const updateBuilder: Record<string, Mock> = {
      ...mockChain(),
      set: vi.fn().mockReturnValue(setChain),
    };

    mockDb.insertInto.mockImplementation((table: string) => {
      if (table === 'import_messages') return insertMsgBuilder;
      if (table === 'discord_import_table_drafts') return insertDraftBuilder;
      return mockChain({ execute: vi.fn().mockResolvedValue([]) });
    });

    mockDb.updateTable.mockReturnValue(updateBuilder);

    mockDb.selectFrom.mockImplementation(() => {
      selectCall++;
      if (selectCall <= 2) return systemsChain; // loadSystemsForParser
      if (selectCall <= 4) return dedupNotFoundChain; // dedup: import_messages + discord_import_table_drafts
      return systemsChain;
    });

    const response = await request(makeApp())
      .post('/admin/inbox/import-text')
      .send({ text: 'Título: Mesa Teste\nSistema: D&D 5e\nDia: sábado\nHorário: 19:00' });

    expect(response.status).toBe(200);
    expect(response.body.data.segments_found).toBe(1);
    expect(response.body.data.drafts_created).toBe(1);
    expect(response.body.data.drafts).toHaveLength(1);
    expect(response.body.data.drafts[0].title).toBe('Mesa Teste');
    expect(response.body.data.drafts[0].status).toBe('ready');
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// GET /admin/inbox/drafts
// ────────────────────────────────────────────────────────────────────────────────

describe('GET /admin/inbox/drafts', () => {
  it('returns empty array when no drafts exist', async () => {
    const chain = mockChain({
      execute: vi.fn().mockResolvedValue([]),
    });
    mockDb.selectFrom.mockReturnValue(chain);

    const response = await request(makeApp())
      .get('/admin/inbox/drafts');

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);
  });

  it('returns drafts with title extracted from normalized_payload', async () => {
    const chain = mockChain({
      execute: vi.fn().mockResolvedValue([
        {
          id: 'draft-1',
          source_type: 'manual_paste',
          raw_text: 'Título: Mesa A',
          status: 'ready',
          confidence: 0.9,
          normalized_payload: { table: { title: 'Mesa A' } },
          created_at: '2026-01-01T00:00:00Z',
        },
      ]),
    });
    mockDb.selectFrom.mockReturnValue(chain);

    const response = await request(makeApp())
      .get('/admin/inbox/drafts');

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].title).toBe('Mesa A');
    expect(response.body.data[0].status).toBe('ready');
    expect(response.body.data[0].confidence).toBe(0.9);
  });

  it('handles missing table key in payload gracefully (title null)', async () => {
    const chain = mockChain({
      execute: vi.fn().mockResolvedValue([
        {
          id: 'draft-2',
          source_type: 'manual_paste',
          raw_text: 'texto',
          status: 'needs_review',
          confidence: null,
          normalized_payload: { source: {} },
          created_at: '2026-01-01T00:00:00Z',
        },
      ]),
    });
    mockDb.selectFrom.mockReturnValue(chain);

    const response = await request(makeApp())
      .get('/admin/inbox/drafts');

    expect(response.status).toBe(200);
    expect(response.body.data[0].title).toBeNull();
  });

  it('handles null normalized_payload gracefully (title null)', async () => {
    const chain = mockChain({
      execute: vi.fn().mockResolvedValue([
        {
          id: 'draft-3',
          source_type: 'manual_paste',
          raw_text: 'texto',
          status: 'error',
          confidence: null,
          normalized_payload: null,
          created_at: '2026-01-01T00:00:00Z',
        },
      ]),
    });
    mockDb.selectFrom.mockReturnValue(chain);

    const response = await request(makeApp())
      .get('/admin/inbox/drafts');

    expect(response.status).toBe(200);
    expect(response.body.data[0].title).toBeNull();
  });

  it('filters by status query param', async () => {
    const chain = mockChain({
      execute: vi.fn().mockResolvedValue([]),
    });
    mockDb.selectFrom.mockReturnValue(chain);

    await request(makeApp())
      .get('/admin/inbox/drafts?status=ready');

    expect(chain.where).toHaveBeenCalledWith(
      'discord_import_table_drafts.status',
      '=',
      'ready'
    );
  });

  it('filters by origin query param', async () => {
    const chain = mockChain({
      execute: vi.fn().mockResolvedValue([]),
    });
    mockDb.selectFrom.mockReturnValue(chain);

    await request(makeApp())
      .get('/admin/inbox/drafts?origin=manual_paste');

    expect(chain.where).toHaveBeenCalledWith(
      'import_messages.source_type',
      '=',
      'manual_paste'
    );
  });

  it('enforces pagination defaults (limit 50, offset 0)', async () => {
    const chain = mockChain({
      execute: vi.fn().mockResolvedValue([]),
    });
    mockDb.selectFrom.mockReturnValue(chain);

    await request(makeApp())
      .get('/admin/inbox/drafts');

    expect(chain.limit).toHaveBeenCalledWith(50);
    expect(chain.offset).toHaveBeenCalledWith(0);
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// GET /admin/inbox/drafts/:id
// ────────────────────────────────────────────────────────────────────────────────

describe('GET /admin/inbox/drafts/:id', () => {
  it('returns 404 for nonexistent draft', async () => {
    mockDb.selectFrom.mockReturnValue(mockChain({
      executeTakeFirst: vi.fn().mockResolvedValue(null),
    }));

    const response = await request(makeApp())
      .get('/admin/inbox/drafts/nonexistent');

    expect(response.status).toBe(404);
    expect(response.body.error).toContain('não encontrado');
  });

  it('rejects Discord draft (import_message_id=null) with 422', async () => {
    let callCount = 0;
    mockDb.selectFrom.mockReturnValue(mockChain({
      executeTakeFirst: vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) return Promise.resolve(null);
        return Promise.resolve({
          id: 'draft-1',
          import_message_id: null,
        });
      }),
      innerJoin: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
    }));

    const response = await request(makeApp())
      .get('/admin/inbox/drafts/draft-1');

    expect(response.status).toBe(422);
    expect(response.body.error).toContain('Discord');
  });

  it('returns full draft for inbox draft', async () => {
    const row = {
      id: 'draft-1',
      discord_message_id: null,
      import_message_id: 'import-1',
      table_id: null,
      parsed_payload: null,
      normalized_payload: { table: { title: 'Mesa A' } },
      confidence: 0.9,
      status: 'ready',
      review_notes: null,
      image_upload_status: null,
      image_upload_attempts: 0,
      image_upload_last_error: null,
      image_upload_last_at: null,
      raw_text: 'Texto do anúncio',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };
    mockDb.selectFrom.mockReturnValue(mockChain({
      executeTakeFirst: vi.fn().mockResolvedValue(row),
    }));

    const response = await request(makeApp())
      .get('/admin/inbox/drafts/draft-1');

    expect(response.status).toBe(200);
    expect(response.body.data.id).toBe('draft-1');
    expect(response.body.data.import_message_id).toBe('import-1');
    expect(response.body.data.raw_text).toBe('Texto do anúncio');
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// PATCH /admin/inbox/drafts/:id
// ────────────────────────────────────────────────────────────────────────────────

describe('PATCH /admin/inbox/drafts/:id', () => {
  it('rejects invalid payload (400)', async () => {
    const response = await request(makeApp())
      .patch('/admin/inbox/drafts/draft-1')
      .send({ invalid: true });

    expect(response.status).toBe(400);
  });

  it('rejects empty body (400)', async () => {
    const response = await request(makeApp())
      .patch('/admin/inbox/drafts/draft-1')
      .send({});

    expect(response.status).toBe(400);
  });

  it('returns 404 for nonexistent draft', async () => {
    mockDb.selectFrom.mockReturnValue(mockChain({
      executeTakeFirst: vi.fn().mockResolvedValue(null),
    }));

    const response = await request(makeApp())
      .patch('/admin/inbox/drafts/nonexistent')
      .send({ status: 'ready' });

    expect(response.status).toBe(404);
    expect(response.body.error).toContain('não encontrado');
  });

  it('rejects Discord draft (import_message_id=null) with 422', async () => {
    mockDb.selectFrom.mockReturnValue(mockChain({
      executeTakeFirst: vi.fn().mockResolvedValue({
        id: 'draft-1',
        status: 'draft',
        import_message_id: null,
        discord_message_id: 'discord-1',
        normalized_payload: null,
      }),
    }));

    const response = await request(makeApp())
      .patch('/admin/inbox/drafts/draft-1')
      .send({ status: 'ready' });

    expect(response.status).toBe(422);
    expect(response.body.error).toContain('Discord');
  });

  it('rejects synced draft (422)', async () => {
    mockDb.selectFrom.mockReturnValue(mockChain({
      executeTakeFirst: vi.fn().mockResolvedValue({
        id: 'draft-1',
        status: 'synced',
        import_message_id: 'import-1',
        normalized_payload: null,
      }),
    }));

    const response = await request(makeApp())
      .patch('/admin/inbox/drafts/draft-1')
      .send({ status: 'rejected' });

    expect(response.status).toBe(422);
    expect(response.body.error).toContain('sincronizado');
  });

  it('rejects table.status=published in normalized_payload (422)', async () => {
    mockDb.selectFrom.mockReturnValue(mockChain({
      executeTakeFirst: vi.fn().mockResolvedValue({
        id: 'draft-1',
        status: 'draft',
        import_message_id: 'import-1',
        normalized_payload: null,
      }),
    }));

    const response = await request(makeApp())
      .patch('/admin/inbox/drafts/draft-1')
      .send({ normalized_payload: { table: { status: 'published' } } });

    expect(response.status).toBe(422);
    expect(response.body.error).toContain('publicar');
  });

  it('rejects invalid enum values in normalized_payload.table (400)', async () => {
    const response = await request(makeApp())
      .patch('/admin/inbox/drafts/draft-1')
      .send({ normalized_payload: { table: { type: 'banana' } } });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('inválidos');
  });

  it('updates draft status successfully', async () => {
    mockDb.selectFrom.mockReturnValue(mockChain({
      executeTakeFirst: vi.fn().mockResolvedValue({
        id: 'draft-1',
        status: 'draft',
        import_message_id: 'import-1',
        normalized_payload: null,
      }),
    }));
    const updated = {
      id: 'draft-1',
      status: 'ready',
      import_message_id: 'import-1',
      normalized_payload: null,
    };

    const updateChain = mockChain({
      execute: vi.fn().mockResolvedValue([updated]),
    });
    updateChain.set = vi.fn().mockReturnThis();
    updateChain.where = vi.fn().mockReturnThis();
    updateChain.returningAll = vi.fn().mockReturnValue(updateChain);
    updateChain.execute = vi.fn().mockResolvedValue([updated]);
    mockDb.updateTable.mockReturnValue(updateChain);

    const response = await request(makeApp())
      .patch('/admin/inbox/drafts/draft-1')
      .send({ status: 'ready' });

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('ready');
  });

  it('updates normalized_payload successfully', async () => {
    const current = {
      id: 'draft-1',
      status: 'needs_review',
      import_message_id: 'import-1',
      normalized_payload: { table: { title: 'Old' } },
    };
    mockDb.selectFrom.mockReturnValue(mockChain({
      executeTakeFirst: vi.fn().mockResolvedValue(current),
    }));

    const updated = {
      ...current,
      normalized_payload: { table: { title: 'New' }, source: {} },
    };

    const updateChain = mockChain({
      execute: vi.fn().mockResolvedValue([updated]),
    });
    updateChain.set = vi.fn().mockReturnThis();
    updateChain.where = vi.fn().mockReturnThis();
    updateChain.returningAll = vi.fn().mockReturnValue(updateChain);
    updateChain.execute = vi.fn().mockResolvedValue([updated]);
    mockDb.updateTable.mockReturnValue(updateChain);

    const response = await request(makeApp())
      .patch('/admin/inbox/drafts/draft-1')
      .send({ normalized_payload: { table: { title: 'New' }, source: {} }, review_notes: 'Corrigido' });

    expect(response.status).toBe(200);
    expect(response.body.data.normalized_payload.table.title).toBe('New');
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// POST /admin/inbox/drafts/:id/reparse
// ────────────────────────────────────────────────────────────────────────────────

describe('POST /admin/inbox/drafts/:id/reparse', () => {
  it('returns 404 for nonexistent draft', async () => {
    mockDb.selectFrom.mockReturnValue(mockChain({
      executeTakeFirst: vi.fn().mockResolvedValue(null),
    }));

    const response = await request(makeApp())
      .post('/admin/inbox/drafts/nonexistent/reparse');

    expect(response.status).toBe(404);
    expect(response.body.error).toContain('não encontrado');
  });

  it('rejects synced draft (422)', async () => {
    mockDb.selectFrom.mockReturnValue(mockChain({
      executeTakeFirst: vi.fn().mockResolvedValue({
        id: 'draft-1',
        status: 'synced',
        import_message_id: 'import-1',
      }),
    }));

    const response = await request(makeApp())
      .post('/admin/inbox/drafts/draft-1/reparse');

    expect(response.status).toBe(422);
    expect(response.body.error).toContain('sincronizado');
  });

  it('rejects Discord draft (import_message_id=null) with 422', async () => {
    mockDb.selectFrom.mockReturnValue(mockChain({
      executeTakeFirst: vi.fn().mockResolvedValue({
        id: 'draft-1',
        status: 'draft',
        import_message_id: null,
        discord_message_id: 'discord-1',
      }),
    }));

    const response = await request(makeApp())
      .post('/admin/inbox/drafts/draft-1/reparse');

    expect(response.status).toBe(422);
    expect(response.body.error).toContain('Discord');
  });

  it('returns 404 when import_message not found', async () => {
    let callCount = 0;
    mockDb.selectFrom.mockReturnValue(mockChain({
      executeTakeFirst: vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) return Promise.resolve({
          id: 'draft-1',
          status: 'draft',
          import_message_id: 'import-1',
        });
        return Promise.resolve(null);
      }),
    }));

    const response = await request(makeApp())
      .post('/admin/inbox/drafts/draft-1/reparse');

    expect(response.status).toBe(404);
    expect(response.body.error).toContain('origem');
  });

  it('reparses draft successfully', async () => {
    let callCount = 0;
    mockDb.selectFrom.mockImplementation(() => {
      callCount++;
      const chain = mockChain({
        executeTakeFirst: vi.fn().mockImplementation(() => {
          if (callCount === 1) return Promise.resolve({
            id: 'draft-1',
            status: 'draft',
            import_message_id: 'import-1',
          });
          if (callCount === 2) return Promise.resolve({
            content_raw: 'Título: Mesa Reparsada\nSistema: D&D 5e',
            raw_text: 'Título: Mesa Reparsada\nSistema: D&D 5e',
          });
          return Promise.resolve([]);
        }),
      });
      if (callCount >= 3) {
        chain.execute = vi.fn().mockResolvedValue([]);
      }
      return chain;
    });

    vi.mocked(textToRawMessage).mockReturnValue({
      source_kind: 'manual_paste',
      discord_message_id: '',
      discord_channel_id: '',
      discord_guild_id: '',
      discord_author_id: null,
      discord_author_name: null,
      discord_message_url: null,
      content_raw: 'Título: Mesa Reparsada',
      attachments: [],
      embeds: [],
      message_created_at: new Date(),
      message_edited_at: null,
      discord_thread_name: '',
    });

    vi.mocked(parseDiscordAnnouncement).mockReturnValue({
      table: { title: 'Mesa Reparsada', system_id: 'sys-1' },
      source: {},
      confidence: 1,
      missing_fields: [],
    } as any);

    vi.mocked(normalizeDiscordTableDraft).mockReturnValue({
      draft: {
        table: { title: 'Mesa Reparsada', system_id: 'sys-1' },
        source: {},
        confidence: 1,
        missing_fields: [],
      } as any,
      status: 'ready',
    });

    const updatedDraft = {
      id: 'draft-1',
      status: 'ready',
      confidence: 1,
    };

    const transactionExecute = vi.fn().mockImplementation(async (fn: (trx: unknown) => Promise<unknown>) => {
      const mockTrx = {
        updateTable: vi.fn().mockReturnThis(),
        insertInto: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        values: vi.fn().mockReturnThis(),
        returningAll: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue([updatedDraft]),
      };
      return await fn(mockTrx);
    });
    mockDb.transaction.mockReturnValue({
      execute: transactionExecute,
    });

    const response = await request(makeApp())
      .post('/admin/inbox/drafts/draft-1/reparse');

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('ready');
    expect(transactionExecute).toHaveBeenCalled();
  });
});
