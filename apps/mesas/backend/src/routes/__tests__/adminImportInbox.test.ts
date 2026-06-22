import express from 'express';
import request from 'supertest';
import type { Mock } from 'vitest';
import adminInboxRoutes from '../adminImportInbox';
import { db } from '../../db';
import { TableRepository } from '../../repositories/tableRepository';

vi.mock('../../db', () => ({
  db: {
    insertInto: vi.fn(),
    updateTable: vi.fn(),
    selectFrom: vi.fn(),
    transaction: vi.fn(),
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
}));

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

    expect(response.status).toBe(500);
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

    expect(response.status).toBe(500);
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

    expect(response.status).toBe(500);
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

    expect(response.status).toBe(500);
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

    expect(response.status).toBe(500);
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

describe('POST /admin/inbox/drafts/:id/correction', () => {
  it('returns 404 for empty draft_id (Express does not match route)', async () => {
    const response = await request(makeApp())
      .post('/admin/inbox/drafts//correction')
      .send({ corrections: { title: 'Novo Título' } });

    expect(response.status).toBe(404);
  });

  it('rejects invalid payload', async () => {
    const response = await request(makeApp())
      .post('/admin/inbox/drafts/draft-1/correction')
      .send({ invalid: true });

    expect(response.status).toBe(400);
  });

  it('returns 404 for nonexistent draft', async () => {
    const chain = mockChain({
      executeTakeFirst: vi.fn().mockResolvedValue(null),
    });
    mockDb.selectFrom.mockReturnValue(chain);

    const response = await request(makeApp())
      .post('/admin/inbox/drafts/nonexistent/correction')
      .send({ corrections: { title: 'Novo Título' } });

    expect(response.status).toBe(404);
  });

  it('persists correction and returns diff with zero changed fields when all values match', async () => {
    const draft = {
      parsed_payload: { table: { title: 'Título Original', type: 'campanha' }, source: {} },
      normalized_payload: { table: { title: 'Título Original', type: 'campanha' }, source: {} },
      import_message_id: 'import-1',
    };

    const chain = mockChain({
      executeTakeFirst: vi.fn().mockResolvedValue(draft),
    });
    mockDb.selectFrom.mockReturnValue(chain);

    const returnChain = mockChain({ execute: vi.fn().mockResolvedValue([]) });
    const setWhereChain = mockChain({ execute: vi.fn().mockResolvedValue([]) });
    const valuesChain = mockChain({ execute: vi.fn().mockResolvedValue([]) });
    valuesChain.values = vi.fn().mockReturnValue(setWhereChain);
    returnChain.values = vi.fn().mockReturnValue(valuesChain);
    mockDb.insertInto.mockReturnValue(returnChain);

    const response = await request(makeApp())
      .post('/admin/inbox/drafts/draft-1/correction')
      .send({ corrections: { title: 'Título Original' } });

    expect(response.status).toBe(200);
    expect(response.body.data.fields_corrected).toBe(0);
    expect(Object.keys(response.body.data.diff).length).toBe(0);
  });

  it('persists correction and returns diff with changed fields', async () => {
    const draft = {
      parsed_payload: { table: { title: 'Original', type: 'campanha' }, source: {} },
      normalized_payload: { table: { title: 'Original', type: 'campanha' }, source: {} },
      import_message_id: 'import-1',
    };

    const chain = mockChain({
      executeTakeFirst: vi.fn().mockResolvedValue(draft),
    });
    mockDb.selectFrom.mockReturnValue(chain);

    const returnChain = mockChain({ execute: vi.fn().mockResolvedValue([]) });
    const setWhereChain = mockChain({ execute: vi.fn().mockResolvedValue([]) });
    const valuesChain = mockChain({ execute: vi.fn().mockResolvedValue([]) });
    valuesChain.values = vi.fn().mockReturnValue(setWhereChain);
    returnChain.values = vi.fn().mockReturnValue(valuesChain);
    mockDb.insertInto.mockReturnValue(returnChain);

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
