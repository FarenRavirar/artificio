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

  // Mesa que nunca esteve no ar continua 404: 410 ("encerrada") afirmaria que
  // ela existiu publicamente e revelaria a existência de um rascunho a quem
  // chutou a URL.
  it.each([
    ['rascunho', { ...visibleTable, status: 'draft' }],
    ['em revisão', { ...visibleTable, status: 'pending_review' }],
  ])('devolve 404 para mesa %s (nunca foi pública)', async (_label, table) => {
    dbMocks.executeTakeFirst.mockResolvedValue(table);

    const response = await request(makeApp()).get(`/api/v1/tables/${table.slug}`);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'Mesa não encontrada.' });
  });

  it('devolve 404 para slug inexistente', async () => {
    dbMocks.executeTakeFirst.mockResolvedValue(undefined);

    const response = await request(makeApp()).get('/api/v1/tables/nao-existe');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'Mesa não encontrada.' });
  });

  // Relato de produção (2026-08-11): mesa encerrada devolvia 404 e o visitante
  // via "Mesa não encontrada", sem distinguir mesa que saiu do ar de link
  // errado. Agora devolve 410 com o payload da tela "Mesa Encerrada".
  it('devolve 410 com autoria para mesa arquivada', async () => {
    dbMocks.executeTakeFirst.mockResolvedValue({
      ...visibleTable,
      archived_at: new Date('2026-07-28T01:00:00.000Z'),
      archived_by: 'user-1',
      closed_reason: 'gm',
    });

    const response = await request(makeApp()).get('/api/v1/tables/mesa-publica');

    expect(response.status).toBe(410);
    expect(response.body.error).toBe('Mesa encerrada.');
    expect(response.body.data).toMatchObject({
      slug: visibleTable.slug,
      title: visibleTable.title,
      closed_reason: 'gm',
    });
    expect(response.body.data.closed_at).toBe('2026-07-28T01:00:00.000Z');
  });

  // Importada vencida não tem `archived_at` — ninguém a encerrou, ela expirou.
  // A data exibida é o limite calculado, e o motivo é derivado, não gravado.
  it('devolve 410 com motivo derivado para importada expirada', async () => {
    dbMocks.executeTakeFirst.mockResolvedValue({
      ...visibleTable,
      origin: 'imported',
      created_at: new Date('2026-07-01T00:00:00.000Z'),
      starts_at: null,
      archived_at: null,
      archived_by: null,
      closed_reason: null,
    });

    const response = await request(makeApp()).get('/api/v1/tables/mesa-publica');

    expect(response.status).toBe(410);
    expect(response.body.data.closed_reason).toBe('auto_expired');
    expect(response.body.data.closed_by_name).toBeNull();
    // 5 dias após a criação, a mesma regra de `isImportedTableExpired`.
    expect(response.body.data.closed_at).toBe('2026-07-06T00:00:00.000Z');
  });

  // Nada que sirva para inscrição entra na resposta de mesa encerrada: mesa
  // fora do ar não segue captando candidato.
  it('não expõe contato nem dados do GM em mesa encerrada', async () => {
    dbMocks.executeTakeFirst.mockResolvedValue({
      ...visibleTable,
      archived_at: new Date('2026-07-28T01:00:00.000Z'),
      archived_by: null,
      closed_reason: 'admin',
    });

    const response = await request(makeApp()).get('/api/v1/tables/mesa-publica');

    expect(response.status).toBe(410);
    expect(Object.keys(response.body.data).sort()).toEqual([
      'closed_at',
      'closed_by_name',
      'closed_reason',
      'slug',
      'title',
    ]);
  });

  // Estado terminal explícito: 410 mesmo sem `archived_at`, com o motivo vindo
  // do próprio status e a data aproximada por `updated_at`.
  it.each(['ended', 'cancelled'])('devolve 410 para mesa %s', async (status) => {
    dbMocks.executeTakeFirst.mockResolvedValue({
      ...visibleTable,
      status,
      archived_at: null,
      archived_by: null,
      closed_reason: null,
      updated_at: new Date('2026-08-01T12:00:00.000Z'),
    });

    const response = await request(makeApp()).get('/api/v1/tables/mesa-publica');

    expect(response.status).toBe(410);
    expect(response.body.data.closed_reason).toBe(status);
    expect(response.body.data.closed_at).toBe('2026-08-01T12:00:00.000Z');
  });

  // Mesa lotada continua pública — só não aceita mais gente. Tratá-la como
  // encerrada esconderia do jogador a mesa que ele quer acompanhar.
  it('mantém mesa full acessível (200), não encerrada', async () => {
    dbMocks.executeTakeFirst.mockResolvedValue({ ...visibleTable, status: 'full' });

    const response = await request(makeApp()).get('/api/v1/tables/mesa-publica');

    expect(response.status).toBe(200);
  });

  it('mantém mesa pública acessível', async () => {
    dbMocks.executeTakeFirst.mockResolvedValue(visibleTable);

    const response = await request(makeApp()).get('/api/v1/tables/mesa-publica');

    expect(response.status).toBe(200);
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
