import type { Mock } from 'vitest';
import request from 'supertest';
import express from 'express';

// Achado do mantenedor 2026-07-08: mesa via Discord sync (spec 060) nasce
// gm_id: null — GET/PUT /api/v1/gm/tables/:id sempre 404 nela, pq os dois
// filtravam por gm_id do GM logado. Fix: userRole==='admin' pula o filtro.
// Este teste cobre só esse bypass — não repete a suíte completa de update.

vi.mock('../db', () => ({
  db: {
    selectFrom: vi.fn(),
    updateTable: vi.fn(),
    transaction: vi.fn(),
  },
}));
vi.mock('../repositories/tableRepository', () => ({
  TableRepository: {
    findById: vi.fn(),
    findByIdAndGm: vi.fn(),
    findContactsByTableId: vi.fn().mockResolvedValue([]),
    findSchedulesByTableId: vi.fn().mockResolvedValue([]),
    updateTableWithRelations: vi.fn(),
  },
}));
vi.mock('../services/tableService', () => ({
  TableService: {
    isDdalEligibleSystem: vi.fn().mockResolvedValue(true),
    validateVttPlatform: vi.fn().mockResolvedValue(null),
    validateCommunicationPlatform: vi.fn().mockResolvedValue({ id: null, legacy: null }),
  },
}));
vi.mock('../services/benchmarkService', () => ({ BenchmarkService: {} }));
vi.mock('../services/activityLogger', () => ({ logActivity: vi.fn() }));
vi.mock('../services/adminNotifications', () => ({ notifyAdmins: vi.fn() }));
vi.mock('../services/actorNameResolver', () => ({ resolveActorName: vi.fn().mockResolvedValue('Admin Teste') }));

let mockRole = 'admin';
let mockUserId = 'admin-1';
vi.mock('../middleware/auth', () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    req.user = { userId: mockUserId, role: mockRole };
    next();
  },
}));

import gmPanelRoutes from './gmPanel';
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
  app.use('/api/v1/gm', gmPanelRoutes);
  return app;
}

const ORPHAN_TABLE = { id: 'table-orphan', gm_id: null, system_id: null, slug: 'mesa-orfa', title: 'Mesa Órfã', status: 'draft', updated_at: new Date() };

describe('GET /api/v1/gm/tables/:id — mesa órfã (gm_id: null)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRole = 'admin';
    mockUserId = 'admin-1';
  });

  it('admin carrega mesa órfã sem exigir gm_id', async () => {
    (TableRepository.findById as Mock).mockResolvedValue(ORPHAN_TABLE);

    const res = await request(makeApp()).get('/api/v1/gm/tables/table-orphan');

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe('table-orphan');
    expect(TableRepository.findById).toHaveBeenCalledWith('table-orphan');
    expect(TableRepository.findByIdAndGm).not.toHaveBeenCalled();
  });

  it('GM comum continua 404 em mesa que não é dele (findByIdAndGm)', async () => {
    mockRole = 'gm';
    const chain = mockChain({ executeTakeFirst: vi.fn().mockResolvedValue({ id: 'gm-profile-1' }) });
    (db.selectFrom as Mock).mockReturnValue(chain);
    (TableRepository.findByIdAndGm as Mock).mockResolvedValue(null);

    const res = await request(makeApp()).get('/api/v1/gm/tables/table-orphan');

    expect(res.status).toBe(404);
    expect(TableRepository.findByIdAndGm).toHaveBeenCalledWith('table-orphan', 'gm-profile-1');
    expect(TableRepository.findById).not.toHaveBeenCalled();
  });
});

describe('PUT /api/v1/gm/tables/:id — mesa órfã (gm_id: null)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRole = 'admin';
    mockUserId = 'admin-1';
  });

  it('admin edita mesa órfã — updateTableWithRelations chamado com gmProfileId null', async () => {
    (db.selectFrom as Mock).mockReturnValue(mockChain({ executeTakeFirst: vi.fn().mockResolvedValue(ORPHAN_TABLE) }));
    (TableRepository.updateTableWithRelations as Mock).mockResolvedValue({ id: 'table-orphan', slug: 'mesa-orfa', title: 'Mesa Órfã Editada', status: 'draft', updated_at: new Date() });

    const res = await request(makeApp())
      .put('/api/v1/gm/tables/table-orphan')
      .send({ title: 'Mesa Órfã Editada' });

    expect(res.status).toBe(200);
    expect(TableRepository.updateTableWithRelations).toHaveBeenCalledWith(
      'table-orphan',
      null,
      expect.objectContaining({ title: 'Mesa Órfã Editada' }),
      undefined,
      undefined,
    );
  });

  it('GM comum sem perfil recebe 403 (não bate a checagem de gm_profiles)', async () => {
    mockRole = 'gm';
    (db.selectFrom as Mock).mockReturnValue(mockChain({ executeTakeFirst: vi.fn().mockResolvedValue(null) }));

    const res = await request(makeApp())
      .put('/api/v1/gm/tables/table-orphan')
      .send({ title: 'Tentativa Indevida' });

    expect(res.status).toBe(403);
    expect(TableRepository.updateTableWithRelations).not.toHaveBeenCalled();
  });
});
