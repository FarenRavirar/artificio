import request from 'supertest';
import express from 'express';

// T6.2 (spec 074) — dedup de contador de download por (conta, material):
// so a PRIMEIRA insercao em download_user_material_download incrementa
// download_metric_daily.

const dbMocks = vi.hoisted(() => ({
  selectFrom: vi.fn(),
  insertInto: vi.fn(),
}));

vi.mock('../db', () => ({
  db: { selectFrom: dbMocks.selectFrom, insertInto: dbMocks.insertInto },
}));

vi.mock('../middleware/auth', () => ({
  authMiddleware: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.user = { userId: 'user-1', role: 'user' };
    next();
  },
}));

vi.mock('../middleware/rateLimit', () => ({
  writeRateLimiter: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

import downloadsRoutes from './downloads';

function app() {
  const server = express();
  server.use(express.json());
  server.use('/api/v1/downloads', downloadsRoutes);
  return server;
}

function makeMaterialQuery(material: unknown) {
  return {
    select: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    executeTakeFirst: vi.fn().mockResolvedValue(material),
  };
}

function makeInsertDownloadQuery(inserted: unknown) {
  return {
    values: vi.fn().mockReturnThis(),
    onConflict: vi.fn().mockReturnThis(),
    returning: vi.fn().mockReturnThis(),
    executeTakeFirst: vi.fn().mockResolvedValue(inserted),
  };
}

function makeMetricUpsertQuery() {
  return {
    values: vi.fn().mockReturnThis(),
    onConflict: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue(undefined),
  };
}

describe('POST /api/v1/downloads', () => {
  beforeEach(() => {
    dbMocks.selectFrom.mockReset();
    dbMocks.insertInto.mockReset();
  });

  it('primeira vez: insere download e incrementa metrica diaria', async () => {
    dbMocks.selectFrom.mockReturnValueOnce(makeMaterialQuery({ id: 'material-1' }));
    dbMocks.insertInto
      .mockReturnValueOnce(makeInsertDownloadQuery({ user_id: 'user-1' }))
      .mockReturnValueOnce(makeMetricUpsertQuery());

    const response = await request(app()).post('/api/v1/downloads').send({ material_id: 'material-1' }).expect(200);

    expect(response.body).toEqual({ already_counted: false });
    expect(dbMocks.insertInto).toHaveBeenCalledTimes(2);
  });

  it('segunda vez da mesma conta: nao incrementa metrica de novo', async () => {
    dbMocks.selectFrom.mockReturnValueOnce(makeMaterialQuery({ id: 'material-1' }));
    dbMocks.insertInto.mockReturnValueOnce(makeInsertDownloadQuery(undefined));

    const response = await request(app()).post('/api/v1/downloads').send({ material_id: 'material-1' }).expect(200);

    expect(response.body).toEqual({ already_counted: true });
    expect(dbMocks.insertInto).toHaveBeenCalledTimes(1);
  });

  it('retorna 404 quando material nao existe ou nao esta publicado', async () => {
    dbMocks.selectFrom.mockReturnValueOnce(makeMaterialQuery(undefined));

    const response = await request(app()).post('/api/v1/downloads').send({ material_id: 'material-x' }).expect(404);

    expect(response.status).toBe(404);
  });
});
