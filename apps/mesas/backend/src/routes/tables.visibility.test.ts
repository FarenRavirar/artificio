import express from 'express';
import request from 'supertest';

const dbMocks = vi.hoisted(() => ({
  execute: vi.fn(),
  executeTakeFirst: vi.fn(),
  selectFrom: vi.fn(),
}));

vi.mock('../db/index.js', () => ({
  db: {
    selectFrom: dbMocks.selectFrom,
  },
}));

vi.mock('../middleware/auth.js', () => ({
  authMiddleware: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.user = { userId: 'user-1', role: 'player', name: 'Pessoa' };
    next();
  },
  optionalAuth: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

vi.mock('../middleware/requestLogger.js', () => ({ logDatabaseError: vi.fn() }));

vi.mock('../services/systemCatalogProvider.js', () => ({
  resolveSystemIdBySlug: vi.fn(),
  hydrateTableSystemFields: vi.fn(async (tables: unknown[]) => tables),
  loadSystemCatalogTree: vi.fn(async () => []),
}));

import tablesRoutes from './tables.js';

function makeQueryBuilder() {
  return {
    leftJoin: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    selectAll: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    execute: dbMocks.execute,
    executeTakeFirst: dbMocks.executeTakeFirst,
  };
}

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/tables', tablesRoutes);
  return app;
}

const visibleTable = {
  id: 'table-1',
  slug: 'mesa-publica',
  title: 'Mesa pública',
  status: 'active',
  archived_at: null,
  origin: 'manual',
  created_at: new Date('2026-07-28T00:00:00.000Z'),
  starts_at: null,
  gm_user_id: null,
  cover_url: null,
  gm_bio_long: null,
};

describe('GET /api/v1/tables/:slug — visibilidade pública', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.execute.mockResolvedValue([]);
    dbMocks.selectFrom.mockImplementation(() => makeQueryBuilder());
  });

  it.each([
    ['rascunho', { ...visibleTable, status: 'draft' }],
    ['arquivada', { ...visibleTable, archived_at: new Date('2026-07-28T01:00:00.000Z') }],
  ])('devolve 404 para mesa %s', async (_label, table) => {
    dbMocks.executeTakeFirst.mockResolvedValue(table);

    const response = await request(makeApp()).get(`/api/v1/tables/${table.slug}`);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'Mesa não encontrada.' });
  });

  it('mantém mesa pública acessível e aplica os mesmos filtros da listagem', async () => {
    const detailBuilder = makeQueryBuilder();
    dbMocks.selectFrom
      .mockReturnValueOnce(detailBuilder)
      .mockImplementation(() => makeQueryBuilder());
    dbMocks.executeTakeFirst.mockResolvedValue(visibleTable);

    const response = await request(makeApp()).get('/api/v1/tables/mesa-publica');

    expect(response.status).toBe(200);
    expect(detailBuilder.where).toHaveBeenCalledWith('t.status', '=', 'active');
    expect(detailBuilder.where).toHaveBeenCalledWith('t.archived_at', 'is', null);
  });
});

describe('interações de mesa pública — visibilidade', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.execute.mockResolvedValue([]);
    dbMocks.selectFrom.mockImplementation(() => makeQueryBuilder());
    dbMocks.executeTakeFirst.mockResolvedValue({
      ...visibleTable,
      archived_at: new Date('2026-07-28T01:00:00.000Z'),
    });
  });

  it.each([
    ['POST', '/api/v1/tables/mesa-publica/view'],
    ['POST', '/api/v1/tables/mesa-publica/click'],
    ['GET', '/api/v1/tables/mesa-publica/favorite'],
    ['POST', '/api/v1/tables/mesa-publica/favorite'],
  ] as const)('%s %s devolve 404 para mesa arquivada', async (method, path) => {
    const response = method === 'GET'
      ? await request(makeApp()).get(path)
      : await request(makeApp()).post(path);

    expect(response.status).toBe(404);
  });
});
