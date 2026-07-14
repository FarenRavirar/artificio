import type { Mock } from 'vitest';
import request from 'supertest';
import express from 'express';
import type { UserRole } from '../db/types';

vi.mock('../db', () => ({
  db: {
    selectFrom: vi.fn(),
    updateTable: vi.fn(),
    transaction: vi.fn(),
  },
}));
vi.mock('../repositories/tableRepository', () => ({
  TableRepository: {
    deleteTableWithRelations: vi.fn(),
    findById: vi.fn(),
    findContactsByTableId: vi.fn(),
    findSchedulesByTableId: vi.fn(),
  },
}));
let mockRole: UserRole = 'admin';
vi.mock('../middleware/auth', () => ({
  authMiddleware: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.user = { userId: 'admin', role: mockRole };
    next();
  },
}));
vi.mock('../services/activityLogger', () => ({ logActivity: vi.fn() }));
vi.mock('../services/tableDuplicateDetection', () => ({ scanTableDuplicateCandidates: vi.fn() }));

import adminTablesRoutes from './adminTables';
import { db } from '../db';
import { TableRepository } from '../repositories/tableRepository';
import { scanTableDuplicateCandidates } from '../services/tableDuplicateDetection';

function mockTransaction(trxChain: Record<string, Mock>) {
  (db.transaction as Mock).mockReturnValue({
    execute: (callback: (trx: unknown) => Promise<unknown>) => callback(trxChain),
  });
}

function mockChain(overrides: Record<string, Mock> = {}) {
  const methods = ['select', 'selectAll', 'where', 'returning', 'returningAll', 'set', 'execute', 'executeTakeFirst', 'executeTakeFirstOrThrow', 'innerJoin', 'leftJoin', 'orderBy', 'updateTable'];
  const chain: Record<string, Mock> = {};
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnThis();
  }
  return Object.assign(chain, overrides);
}

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/admin', adminTablesRoutes);
  return app;
}

describe('DELETE /api/v1/admin/tables/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 404 when table not found', async () => {
    const chain = mockChain({ executeTakeFirst: vi.fn().mockResolvedValue(null) });
    (db.selectFrom as Mock).mockReturnValue(chain);

    const res = await request(makeApp()).delete('/api/v1/admin/tables/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body.error).toContain('não encontrada');
  });

  it('deletes table and returns success message', async () => {
    const chain = mockChain({ executeTakeFirst: vi.fn().mockResolvedValue({ id: 't1', title: 'Mesa Teste' }) });
    (db.selectFrom as Mock).mockReturnValue(chain);
    (TableRepository.deleteTableWithRelations as Mock).mockResolvedValue(undefined);

    const res = await request(makeApp()).delete('/api/v1/admin/tables/t1');
    expect(res.status).toBe(200);
    expect(res.body.data.message).toContain('Mesa Teste');
    expect(TableRepository.deleteTableWithRelations).toHaveBeenCalledWith('t1');
  });
});

describe('GET /api/v1/admin/tables', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRole = 'admin';
  });

  it('lists tables of any status, including draft (mesa importada sem gm_id)', async () => {
    const chain = mockChain({
      execute: vi.fn().mockResolvedValue([
        { id: 't1', slug: 'mesa-1', title: 'Mesa Importada', status: 'draft', gm_id: null, origin: 'imported', created_at: new Date(), is_covil: false },
      ]),
      orderBy: vi.fn().mockReturnThis(),
    });
    (db.selectFrom as Mock).mockReturnValue(chain);

    const res = await request(makeApp()).get('/api/v1/admin/tables');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].status).toBe('draft');
  });

  it('rejects non-admin', async () => {
    mockRole = 'gm';
    const res = await request(makeApp()).get('/api/v1/admin/tables');
    expect(res.status).toBe(403);
  });
});

describe('table duplicate candidates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRole = 'admin';
  });

  it('lists normalized candidates', async () => {
    const chain = mockChain({
      execute: vi.fn().mockResolvedValue([{
        id: 'dup-1', score: '0.8800', status: 'candidate',
        table_id: 't1', table_slug: 'mesa-a', table_title: 'Mesa A',
        candidate_table_id: 't2', candidate_table_slug: 'mesa-b', candidate_table_title: 'Mesa B',
      }]),
    });
    (db.selectFrom as Mock).mockReturnValue(chain);

    const res = await request(makeApp()).get('/api/v1/admin/tables/duplicates');
    expect(res.status).toBe(200);
    expect(res.body.data[0].score).toBe(0.88);
  });

  it('rejects invalid decision payload', async () => {
    const res = await request(makeApp())
      .patch('/api/v1/admin/table-duplicate-candidates/dup-1')
      .send({ status: 'delete' });
    expect(res.status).toBe(400);
  });

  it('rejects non-admin listing', async () => {
    mockRole = 'gm';
    const res = await request(makeApp()).get('/api/v1/admin/tables/duplicates');
    expect(res.status).toBe(403);
  });

  it('runs scan and returns pair counts', async () => {
    (scanTableDuplicateCandidates as Mock).mockResolvedValue({ tablePairs: 2, draftPairs: 1 });

    const res = await request(makeApp()).post('/api/v1/admin/tables/duplicates/scan');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ tablePairs: 2, draftPairs: 1 });
    expect(scanTableDuplicateCandidates).toHaveBeenCalledOnce();
  });

  it('resolves a candidate decision transactionally and inserts feedback', async () => {
    const existingChain = mockChain({
      executeTakeFirst: vi.fn().mockResolvedValue({
        id: 'dup-1', status: 'candidate', table_id: 't1', candidate_table_id: 't2',
        candidate_parse_case_id: 'case-1', score: '0.8800',
      }),
    });
    (db.selectFrom as Mock).mockReturnValue(existingChain);

    const insertChain = { execute: vi.fn().mockResolvedValue(undefined) };
    const trxChain = mockChain({
      executeTakeFirst: vi.fn().mockResolvedValue({ id: 'dup-1', status: 'confirmed_duplicate', score: '0.8800' }),
    });
    trxChain.insertInto = vi.fn().mockReturnValue({ values: vi.fn().mockReturnValue(insertChain) });
    mockTransaction(trxChain);

    const res = await request(makeApp())
      .patch('/api/v1/admin/table-duplicate-candidates/dup-1')
      .send({ status: 'confirmed_duplicate' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('confirmed_duplicate');
    expect(insertChain.execute).toHaveBeenCalledOnce();
  });

  it('returns 409 when candidate was already resolved concorrentemente', async () => {
    const existingChain = mockChain({
      executeTakeFirst: vi.fn().mockResolvedValue({
        id: 'dup-1', status: 'candidate', table_id: 't1', candidate_table_id: 't2',
        candidate_parse_case_id: null, score: '0.8800',
      }),
    });
    (db.selectFrom as Mock).mockReturnValue(existingChain);

    const trxChain = mockChain({ executeTakeFirst: vi.fn().mockResolvedValue(undefined) });
    mockTransaction(trxChain);

    const res = await request(makeApp())
      .patch('/api/v1/admin/table-duplicate-candidates/dup-1')
      .send({ status: 'confirmed_duplicate' });

    expect(res.status).toBe(409);
  });
});

describe('GET /api/v1/admin/tables/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRole = 'admin';
  });

  it('returns table with gm_id: null without requiring ownership', async () => {
    (TableRepository.findById as Mock).mockResolvedValue({ id: 't1', title: 'Mesa Importada', status: 'draft', gm_id: null });
    (TableRepository.findContactsByTableId as Mock).mockResolvedValue([]);
    (TableRepository.findSchedulesByTableId as Mock).mockResolvedValue([]);

    const res = await request(makeApp()).get('/api/v1/admin/tables/t1');
    expect(res.status).toBe(200);
    expect(res.body.data.gm_id).toBeNull();
    expect(TableRepository.findById).toHaveBeenCalledWith('t1');
  });

  it('returns 404 when table not found', async () => {
    (TableRepository.findById as Mock).mockResolvedValue(undefined);

    const res = await request(makeApp()).get('/api/v1/admin/tables/nonexistent');
    expect(res.status).toBe(404);
  });

  it('rejects non-admin', async () => {
    mockRole = 'gm';
    const res = await request(makeApp()).get('/api/v1/admin/tables/t1');
    expect(res.status).toBe(403);
  });
});

describe('PUT /api/v1/admin/tables/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRole = 'admin';
  });

  it('updates table status successfully', async () => {
    const selectChain = mockChain({ executeTakeFirst: vi.fn().mockResolvedValue({ id: 't1', published_at: new Date() }) });
    (db.selectFrom as Mock).mockReturnValue(selectChain);

    const returningChain = mockChain({ execute: vi.fn().mockResolvedValue([{ id: 't1', slug: 'mesa-teste', title: 'Mesa', status: 'active', is_covil: false }]) });
    const updateChain = mockChain({ returning: vi.fn().mockReturnValue(returningChain) });
    (db.updateTable as Mock).mockReturnValue(updateChain);

    const res = await request(makeApp())
      .put('/api/v1/admin/tables/t1')
      .send({ status: 'active' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('active');
  });

  it('rejects invalid status', async () => {
    const res = await request(makeApp())
      .put('/api/v1/admin/tables/t1')
      .send({ status: 'invalid' });
    expect(res.status).toBe(400);
  });

  it('rejects request with no update data', async () => {
    const res = await request(makeApp())
      .put('/api/v1/admin/tables/t1')
      .send({});
    expect(res.status).toBe(400);
  });
});
