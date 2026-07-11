import type { Mock } from 'vitest';
import request from 'supertest';
import express from 'express';
import type { UserRole } from '../db/types';

vi.mock('../db', () => ({
  db: {
    selectFrom: vi.fn(),
    updateTable: vi.fn(),
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

import adminTablesRoutes from './adminTables';
import { db } from '../db';
import { TableRepository } from '../repositories/tableRepository';

function mockChain(overrides: Record<string, Mock> = {}) {
  const methods = ['select', 'selectAll', 'where', 'returning', 'set', 'execute', 'executeTakeFirst', 'executeTakeFirstOrThrow'];
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
