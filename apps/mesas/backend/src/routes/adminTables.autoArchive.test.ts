import request from 'supertest';
import express from 'express';

const mockAutoArchive = vi.fn();

vi.mock('../db', () => ({ db: {} }));
vi.mock('../repositories/tableRepository', () => ({ TableRepository: class {} }));
vi.mock('../middleware/auth', () => ({
  authMiddleware: (_req: any, _res: any, next: any) => next(),
}));
vi.mock('../services/activityLogger', () => ({ logActivity: vi.fn() }));
vi.mock('../services/tableArchiving', () => ({
  AUTO_ARCHIVE_AFTER_DAYS: 30,
  autoArchiveStaleTables: (...args: unknown[]) => mockAutoArchive(...args),
}));

import adminTablesRoutes from './adminTables';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/admin', adminTablesRoutes);
  return app;
}

const ORIGINAL_ENV = { ...process.env };

describe('POST /api/v1/admin/tables/auto-archive (D-MESAS1)', () => {
  beforeEach(() => {
    mockAutoArchive.mockReset();
    process.env = { ...ORIGINAL_ENV };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('bloqueia fora de produção (403)', async () => {
    process.env.NODE_ENV = 'development';
    process.env.MESAS_CRON_SECRET = 'sekret';
    const res = await request(makeApp())
      .post('/api/v1/admin/tables/auto-archive')
      .set('x-cron-secret', 'sekret');
    expect(res.status).toBe(403);
    expect(mockAutoArchive).not.toHaveBeenCalled();
  });

  it('503 quando MESAS_CRON_SECRET ausente', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.MESAS_CRON_SECRET;
    const res = await request(makeApp()).post('/api/v1/admin/tables/auto-archive');
    expect(res.status).toBe(503);
    expect(mockAutoArchive).not.toHaveBeenCalled();
  });

  it('401 com segredo de cron inválido', async () => {
    process.env.NODE_ENV = 'production';
    process.env.MESAS_CRON_SECRET = 'sekret';
    const res = await request(makeApp())
      .post('/api/v1/admin/tables/auto-archive')
      .set('x-cron-secret', 'errado');
    expect(res.status).toBe(401);
    expect(mockAutoArchive).not.toHaveBeenCalled();
  });

  it('arquiva e retorna a contagem com segredo válido em produção', async () => {
    process.env.NODE_ENV = 'production';
    process.env.MESAS_CRON_SECRET = 'sekret';
    mockAutoArchive.mockResolvedValue([
      { id: 'a', slug: 'mesa-a', title: 'Mesa A' },
      { id: 'b', slug: 'mesa-b', title: 'Mesa B' },
    ]);
    const res = await request(makeApp())
      .post('/api/v1/admin/tables/auto-archive')
      .set('x-cron-secret', 'sekret');
    expect(res.status).toBe(200);
    expect(res.body.data.count).toBe(2);
    expect(res.body.data.tables).toHaveLength(2);
    expect(mockAutoArchive).toHaveBeenCalledTimes(1);
  });
});
