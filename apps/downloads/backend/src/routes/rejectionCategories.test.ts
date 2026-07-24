import request from 'supertest';
import express from 'express';

// T2.2/T7.3 (spec 083) — categoria de reprovacao: slug imutavel, categoria
// inativa nao lista mas resolve em referencia historica (join).

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
    req.user = { userId: 'moderator-1', role: 'moderator' };
    next();
  },
  requireRole: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

vi.mock('../middleware/rateLimit', () => ({
  writeRateLimiter: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

import rejectionCategoriesRoutes from './rejectionCategories';

function app() {
  const server = express();
  server.use(express.json());
  server.use('/api/v1/admin/rejection-categories', rejectionCategoriesRoutes);
  return server;
}

beforeEach(() => {
  dbMocks.selectFrom.mockReset();
  dbMocks.insertInto.mockReset();
  dbMocks.updateTable.mockReset();
});

describe('GET /api/v1/admin/rejection-categories', () => {
  it('filtra so ativas por padrao', async () => {
    const query = {
      selectAll: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue([{ id: 'cat-1', slug: 'copyright', active: true }]),
    };
    dbMocks.selectFrom.mockReturnValue(query);

    const res = await request(app()).get('/api/v1/admin/rejection-categories').expect(200);

    expect(query.where).toHaveBeenCalledWith('active', '=', true);
    expect(res.body.items).toHaveLength(1);
  });

  it('lista tambem inativas quando active=false', async () => {
    const query = {
      selectAll: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue([
        { id: 'cat-1', slug: 'copyright', active: true },
        { id: 'cat-2', slug: 'old', active: false },
      ]),
    };
    dbMocks.selectFrom.mockReturnValue(query);

    const res = await request(app()).get('/api/v1/admin/rejection-categories?active=false').expect(200);

    expect(query.where).not.toHaveBeenCalled();
    expect(res.body.items).toHaveLength(2);
  });
});

describe('PATCH /api/v1/admin/rejection-categories/:id', () => {
  it('rejeita tentativa de mudar slug (imutavel)', async () => {
    const res = await request(app())
      .patch('/api/v1/admin/rejection-categories/cat-1')
      .send({ slug: 'novo-slug' })
      .expect(400);

    expect(res.body.error).toMatch(/imutável/);
    expect(dbMocks.selectFrom).not.toHaveBeenCalled();
  });

  it('desativa categoria sem apagar (soft-disable)', async () => {
    const findQuery = {
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn().mockResolvedValue({ id: 'cat-1' }),
    };
    dbMocks.selectFrom.mockReturnValue(findQuery);

    const updateChain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      returningAll: vi.fn().mockReturnThis(),
      executeTakeFirstOrThrow: vi.fn().mockResolvedValue({ id: 'cat-1', active: false }),
    };
    dbMocks.updateTable.mockReturnValue(updateChain);

    await request(app())
      .patch('/api/v1/admin/rejection-categories/cat-1')
      .send({ active: false })
      .expect(200);

    expect(updateChain.set).toHaveBeenCalledWith(expect.objectContaining({ active: false }));
  });

  it('404 quando categoria nao existe', async () => {
    const findQuery = {
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn().mockResolvedValue(undefined),
    };
    dbMocks.selectFrom.mockReturnValue(findQuery);

    await request(app())
      .patch('/api/v1/admin/rejection-categories/does-not-exist')
      .send({ active: false })
      .expect(404);
  });
});

describe('POST /api/v1/admin/rejection-categories', () => {
  it('rejeita slug com caractere invalido', async () => {
    const res = await request(app())
      .post('/api/v1/admin/rejection-categories')
      .send({ slug: 'Slug Invalido!', label: 'Teste' })
      .expect(400);

    expect(res.body.error).toBe('Payload inválido.');
  });

  it('409 quando slug ja existe', async () => {
    const findQuery = {
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn().mockResolvedValue({ id: 'cat-existing' }),
    };
    dbMocks.selectFrom.mockReturnValue(findQuery);

    await request(app())
      .post('/api/v1/admin/rejection-categories')
      .send({ slug: 'copyright', label: 'Direitos autorais' })
      .expect(409);
  });
});
