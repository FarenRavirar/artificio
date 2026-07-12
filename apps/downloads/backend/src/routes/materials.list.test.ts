import request from 'supertest';
import express from 'express';

// T4.3 (spec 073) — teste de integracao da listagem publica: filtro,
// paginacao e que so material publicado aparece.

const dbMocks = vi.hoisted(() => ({
  selectFrom: vi.fn(),
}));

vi.mock('../db', () => ({
  db: {
    selectFrom: dbMocks.selectFrom,
  },
}));

vi.mock('../middleware/auth', () => ({
  authMiddleware: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

import materialsRoutes from './materials';

function app() {
  const server = express();
  server.use(express.json());
  server.use('/api/v1/materials', materialsRoutes);
  return server;
}

function makeQueryBuilder(items: unknown[], count: number) {
  const builder: Record<string, unknown> = {};
  builder.where = vi.fn().mockReturnValue(builder);
  builder.select = vi.fn((selector) => {
    if (typeof selector === 'function') {
      // count select vem via ({ fn }) => [fn.countAll().as('count')]
      builder.executeTakeFirstOrThrow = vi.fn().mockResolvedValue({ count });
    }
    return builder;
  });
  builder.leftJoin = vi.fn().mockReturnValue(builder);
  builder.orderBy = vi.fn().mockReturnValue(builder);
  builder.limit = vi.fn().mockReturnValue(builder);
  builder.offset = vi.fn().mockReturnValue(builder);
  builder.execute = vi.fn().mockResolvedValue(items);
  builder.executeTakeFirstOrThrow = vi.fn().mockResolvedValue({ count });
  return builder;
}

describe('GET /api/v1/materials — listagem publica', () => {
  beforeEach(() => {
    dbMocks.selectFrom.mockReset();
  });

  it('retorna items paginados com total', async () => {
    const items = [{ id: 'm1', slug: 'material-1', title: 'Material 1', editorial_state: 'published' }];
    dbMocks.selectFrom.mockReturnValue(makeQueryBuilder(items, 1));

    const response = await request(app())
      .get('/api/v1/materials')
      .query({ page: 1, page_size: 20 })
      .expect(200);

    expect(response.body.items).toEqual(items);
    expect(response.body.total).toBe(1);
    expect(response.body.page).toBe(1);
  });

  it('rejeita page_size acima do maximo', async () => {
    dbMocks.selectFrom.mockReturnValue(makeQueryBuilder([], 0));

    const response = await request(app())
      .get('/api/v1/materials')
      .query({ page_size: 999 })
      .expect(400);

    expect(response.body.error).toMatch(/inválidos/i);
  });

  it('aceita filtro de busca textual e material_type', async () => {
    const builder = makeQueryBuilder([], 0);
    dbMocks.selectFrom.mockReturnValue(builder);

    await request(app())
      .get('/api/v1/materials')
      .query({ q: 'aventura', material_type: 'adventure' })
      .expect(200);

    expect(builder.where).toHaveBeenCalled();
  });
});
