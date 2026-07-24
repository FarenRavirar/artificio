import request from 'supertest';
import express from 'express';

// T5.1-T5.3 (spec 084) — rotas admin do scraper: disparo manual
// (fire-and-forget), consulta de run, listagem, ingest de Modo 3.

const dbMocks = vi.hoisted(() => ({
  selectFrom: vi.fn(),
  insertInto: vi.fn(),
  updateTable: vi.fn(),
}));

vi.mock('../db', () => ({
  db: { selectFrom: dbMocks.selectFrom, insertInto: dbMocks.insertInto, updateTable: dbMocks.updateTable },
}));

vi.mock('../middleware/auth', () => ({
  authMiddleware: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.user = { userId: 'admin-1', role: 'admin' };
    next();
  },
  requireRole: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

vi.mock('../middleware/rateLimit', () => ({
  writeRateLimiter: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

const runScraperIngestMock = vi.hoisted(() => vi.fn().mockResolvedValue({ itemsFound: 0, itemsCreated: 0, itemsSkippedDuplicate: 0, itemsSkippedNotPortuguese: 0, itemsSkippedError: 0 }));
vi.mock('../services/scraperIngest', () => ({
  runScraperIngest: runScraperIngestMock,
}));

const discoverItemsMock = vi.hoisted(() => vi.fn());
vi.mock('../services/scrapers/itchIoScraper', () => ({
  ItchIoScraper: vi.fn().mockImplementation(() => ({ discoverItems: discoverItemsMock })),
}));
vi.mock('../services/scrapers/grimoriosEDadosScraper', () => ({
  GrimoriosEDadosScraper: vi.fn().mockImplementation(() => ({ discoverItems: discoverItemsMock })),
}));
vi.mock('../services/scrapers/operaRpgScraper', () => ({
  OperaRpgScraper: vi.fn().mockImplementation(() => ({ discoverItems: discoverItemsMock })),
}));
vi.mock('../services/scrapers/driveThruRpgScraper', () => ({
  DriveThruRpgScraper: vi.fn().mockImplementation(() => ({ discoverItems: discoverItemsMock })),
}));
vi.mock('../services/scrapers/dmsGuildScraper', () => ({
  DmsGuildScraper: vi.fn().mockImplementation(() => ({ discoverItems: discoverItemsMock })),
}));

import scraperRoutes from './scraper';

function app() {
  const server = express();
  server.use(express.json());
  server.use('/api/v1/admin/scraper', scraperRoutes);
  return server;
}

function insertChain(result: unknown) {
  return {
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockReturnThis(),
    executeTakeFirstOrThrow: vi.fn().mockResolvedValue(result),
  };
}

function updateChain() {
  return { set: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), execute: vi.fn().mockResolvedValue(undefined) };
}

beforeEach(() => {
  dbMocks.selectFrom.mockReset();
  dbMocks.insertInto.mockReset();
  dbMocks.updateTable.mockReset();
  runScraperIngestMock.mockClear();
  discoverItemsMock.mockReset();
  dbMocks.updateTable.mockReturnValue(updateChain());
});

describe('POST /api/v1/admin/scraper/run', () => {
  it('400 quando source_platform ausente/inválido', async () => {
    const res = await request(app()).post('/api/v1/admin/scraper/run').send({ source_platform: 'nao_existe' }).expect(400);
    expect(res.body.error).toMatch(/source_platform inválido/);
  });

  it('202 com run_id — fire-and-forget, não aguarda execução completa', async () => {
    dbMocks.insertInto.mockReturnValueOnce(insertChain({ id: 'run-1' }));

    const res = await request(app()).post('/api/v1/admin/scraper/run').send({ source_platform: 'itch_io' }).expect(202);

    expect(res.body.run_id).toBe('run-1');
  });
});

describe('GET /api/v1/admin/scraper/run/:id', () => {
  it('404 quando run não existe', async () => {
    dbMocks.selectFrom.mockReturnValueOnce({
      selectAll: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn().mockResolvedValue(undefined),
    });

    await request(app()).get('/api/v1/admin/scraper/run/inexistente').expect(404);
  });

  it('200 com run + item_logs', async () => {
    dbMocks.selectFrom
      .mockReturnValueOnce({
        selectAll: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        executeTakeFirst: vi.fn().mockResolvedValue({ id: 'run-1', status: 'completed' }),
      })
      .mockReturnValueOnce({
        selectAll: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue([{ id: 'log-1', outcome: 'created' }]),
      });

    const res = await request(app()).get('/api/v1/admin/scraper/run/run-1').expect(200);

    expect(res.body.id).toBe('run-1');
    expect(res.body.item_logs).toHaveLength(1);
  });
});

describe('GET /api/v1/admin/scraper/runs', () => {
  it('200 com lista de runs recentes', async () => {
    dbMocks.selectFrom.mockReturnValueOnce({
      selectAll: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue([{ id: 'run-1' }, { id: 'run-2' }]),
    });

    const res = await request(app()).get('/api/v1/admin/scraper/runs').expect(200);

    expect(res.body.items).toHaveLength(2);
  });
});

describe('POST /api/v1/admin/scraper/ingest', () => {
  const validItem = {
    sourceUrl: 'https://example.itch.io/game',
    title: 'Aventura',
    description: null,
    isFreeOrPwyw: true,
    coverImageUrl: null,
    publisherName: null,
    sourceLanguageHint: 'pt',
  };

  it('400 quando payload inválido (source_platform ausente)', async () => {
    const res = await request(app()).post('/api/v1/admin/scraper/ingest').send({ items: [validItem] }).expect(400);
    expect(res.body.error).toMatch(/Payload de ingest inválido/);
  });

  it('400 quando items vazio', async () => {
    const res = await request(app())
      .post('/api/v1/admin/scraper/ingest')
      .send({ source_platform: 'itch_io', items: [] })
      .expect(400);
    expect(res.body.error).toMatch(/Payload de ingest inválido/);
  });

  it('200 com run completa quando ingest roda o pipeline com sucesso', async () => {
    dbMocks.insertInto.mockReturnValueOnce(insertChain({ id: 'run-2' }));
    dbMocks.selectFrom.mockReturnValueOnce({
      selectAll: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      executeTakeFirstOrThrow: vi.fn().mockResolvedValue({ id: 'run-2', status: 'completed' }),
    });

    const res = await request(app())
      .post('/api/v1/admin/scraper/ingest')
      .send({ source_platform: 'itch_io', items: [validItem] })
      .expect(200);

    expect(res.body.id).toBe('run-2');
    expect(runScraperIngestMock).toHaveBeenCalledTimes(1);
  });

  it('502 quando runScraperIngest lança — grava status=failed', async () => {
    dbMocks.insertInto.mockReturnValueOnce(insertChain({ id: 'run-3' }));
    runScraperIngestMock.mockRejectedValueOnce(new Error('falha no pipeline'));

    const res = await request(app())
      .post('/api/v1/admin/scraper/ingest')
      .send({ source_platform: 'itch_io', items: [validItem] })
      .expect(502);

    expect(res.body.error).toMatch(/falha no pipeline/);
  });
});
