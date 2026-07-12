import request from 'supertest';
import express from 'express';

// T7.1-T7.3 (spec 075) — rotas admin: dashboard, link checker sob demanda,
// upload com magic bytes, sanitize-preview.

const dbMocks = vi.hoisted(() => ({
  selectFrom: vi.fn(),
  insertInto: vi.fn(),
}));

vi.mock('../db', () => ({
  db: { selectFrom: dbMocks.selectFrom, insertInto: dbMocks.insertInto },
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

const checkLinkMock = vi.hoisted(() => vi.fn());
vi.mock('../services/linkChecker', () => ({ checkLink: checkLinkMock }));

import adminRoutes from './admin';

function app() {
  const server = express();
  server.use(express.json());
  server.use('/api/v1/admin', adminRoutes);
  return server;
}

function makeCountQuery(count: number) {
  return {
    select: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    executeTakeFirst: vi.fn().mockResolvedValue(undefined),
    executeTakeFirstOrThrow: vi.fn().mockResolvedValue({ count }),
  };
}

describe('GET /api/v1/admin/summary', () => {
  beforeEach(() => {
    dbMocks.selectFrom.mockReset();
  });

  it('agrega contagem de filas', async () => {
    dbMocks.selectFrom.mockReturnValue(makeCountQuery(3));

    const response = await request(app()).get('/api/v1/admin/summary').expect(200);

    expect(response.body.moderation_queue.count).toBe(3);
    expect(response.body.reports_open.count).toBe(3);
    expect(response.body.degraded_links.count).toBe(3);
  });
});

describe('POST /api/v1/admin/materials/:id/check-link', () => {
  beforeEach(() => {
    dbMocks.selectFrom.mockReset();
    dbMocks.insertInto.mockReset();
    checkLinkMock.mockReset();
  });

  it('checa link e grava resultado', async () => {
    dbMocks.selectFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn().mockResolvedValue({ id: 'material-1', external_url: 'https://example.com' }),
    });
    checkLinkMock.mockResolvedValue({ checkedUrl: 'https://example.com', httpStatus: 200, isHealthy: true, errorDetail: null });
    dbMocks.insertInto.mockReturnValue({
      values: vi.fn().mockReturnThis(),
      returningAll: vi.fn().mockReturnThis(),
      executeTakeFirstOrThrow: vi.fn().mockResolvedValue({ id: 'check-1', is_healthy: true }),
    });

    const response = await request(app()).post('/api/v1/admin/materials/material-1/check-link').expect(200);

    expect(response.body.is_healthy).toBe(true);
    expect(checkLinkMock).toHaveBeenCalledWith('https://example.com');
  });

  it('404 quando material nao existe', async () => {
    dbMocks.selectFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn().mockResolvedValue(undefined),
    });

    await request(app()).post('/api/v1/admin/materials/material-x/check-link').expect(404);
  });
});

describe('POST /api/v1/admin/materials/:id/evidence/upload', () => {
  beforeEach(() => {
    dbMocks.selectFrom.mockReset();
    dbMocks.insertInto.mockReset();
  });

  it('aceita PDF real (magic bytes) e grava evidencia', async () => {
    dbMocks.selectFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn().mockResolvedValue({ id: 'material-1' }),
    });
    dbMocks.insertInto.mockReturnValue({
      values: vi.fn().mockReturnThis(),
      returningAll: vi.fn().mockReturnThis(),
      executeTakeFirstOrThrow: vi.fn().mockResolvedValue({ id: 'evidence-1', evidence_kind: 'pdf' }),
    });

    const pdfBuffer = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.from('conteudo fake')]);

    const response = await request(app())
      .post('/api/v1/admin/materials/material-1/evidence/upload?filename=doc.pdf')
      .set('Content-Type', 'application/octet-stream')
      .send(pdfBuffer)
      .expect(201);

    expect(response.body.evidence_kind).toBe('pdf');
  });

  it('rejeita arquivo cujo magic bytes nao bate com a extensao declarada', async () => {
    dbMocks.selectFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn().mockResolvedValue({ id: 'material-1' }),
    });

    const fakePdf = Buffer.from('isto nao e um pdf de verdade');

    const response = await request(app())
      .post('/api/v1/admin/materials/material-1/evidence/upload?filename=doc.pdf')
      .set('Content-Type', 'application/octet-stream')
      .send(fakePdf)
      .expect(422);

    expect(response.status).toBe(422);
  });
});

describe('POST /api/v1/admin/sanitize-preview', () => {
  it('retorna texto sanitizado', async () => {
    const response = await request(app())
      .post('/api/v1/admin/sanitize-preview')
      .send({ text: '<img src=x onerror=alert(1)>texto' })
      .expect(200);

    expect(response.body.sanitized).toBe('texto');
  });
});
