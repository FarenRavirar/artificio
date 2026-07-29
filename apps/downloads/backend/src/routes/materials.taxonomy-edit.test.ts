import express from 'express';
import request from 'supertest';
import type { FlatCatalogSystem } from '../services/catalogClient';

const dbMocks = vi.hoisted(() => ({
  selectFrom: vi.fn(),
  transaction: vi.fn(),
}));

const catalogMocks = vi.hoisted(() => ({
  loadCatalogSystemsFlat: vi.fn(),
}));

vi.mock('../db', () => ({
  db: {
    selectFrom: dbMocks.selectFrom,
    transaction: dbMocks.transaction,
  },
}));

vi.mock('../services/catalogClient', async (importOriginal) => ({
  ...await importOriginal<typeof import('../services/catalogClient')>(),
  loadCatalogSystemsFlat: catalogMocks.loadCatalogSystemsFlat,
}));

vi.mock('../middleware/auth', () => ({
  authMiddleware: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.user = { userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', role: 'user' };
    next();
  },
}));

import materialsRoutes from './materials';

const SYSTEM_A = '11111111-1111-4111-8111-111111111111';
const EDITION_A = '22222222-2222-4222-8222-222222222222';
const SYSTEM_B = '33333333-3333-4333-8333-333333333333';
const EDITION_B = '44444444-4444-4444-8444-444444444444';

const nodes: FlatCatalogSystem[] = [
  { id: SYSTEM_A, name: 'Sistema A', name_pt: null, slug: 'a', path_slug: 'a', node_type: 'system', parent_id: null, aliases: [] },
  { id: EDITION_A, name: 'Edição A', name_pt: null, slug: 'ed-a', path_slug: 'a/ed-a', node_type: 'edition', parent_id: SYSTEM_A, aliases: [] },
  { id: SYSTEM_B, name: 'Sistema B', name_pt: null, slug: 'b', path_slug: 'b', node_type: 'system', parent_id: null, aliases: [] },
  { id: EDITION_B, name: 'Edição B', name_pt: null, slug: 'ed-b', path_slug: 'b/ed-b', node_type: 'edition', parent_id: SYSTEM_B, aliases: [] },
];

function app() {
  const server = express();
  server.use(express.json());
  server.use('/api/v1/materials', materialsRoutes);
  return server;
}

function materialQuery() {
  return {
    selectAll: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    executeTakeFirst: vi.fn().mockResolvedValue({
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      creator_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      title: 'Material',
      external_url: null,
      system_id: SYSTEM_A,
      edition_id: EDITION_A,
    }),
  };
}

describe('PATCH /api/v1/materials/:id — taxonomia', () => {
  const historyValues = vi.fn();
  const updateSet = vi.fn();

  beforeEach(() => {
    dbMocks.selectFrom.mockReset().mockReturnValue(materialQuery());
    catalogMocks.loadCatalogSystemsFlat.mockReset().mockResolvedValue(nodes);
    historyValues.mockReset();
    updateSet.mockReset().mockReturnThis();

    const update = {
      set: updateSet,
      where: vi.fn().mockReturnThis(),
      returningAll: vi.fn().mockReturnThis(),
      executeTakeFirstOrThrow: vi.fn().mockResolvedValue({ system_id: SYSTEM_B, edition_id: null }),
    };
    const trx = {
      insertInto: vi.fn().mockReturnValue({
        values: historyValues.mockReturnThis(),
        execute: vi.fn().mockResolvedValue(undefined),
      }),
      updateTable: vi.fn().mockReturnValue(update),
    };
    dbMocks.transaction.mockReset().mockReturnValue({
      execute: (callback: (transaction: typeof trx) => unknown) => callback(trx),
    });
  });

  it('troca sistema, limpa edição incompatível e registra os dois campos', async () => {
    await request(app())
      .patch('/api/v1/materials/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')
      .send({ system_id: SYSTEM_B })
      .expect(200);

    expect(updateSet).toHaveBeenNthCalledWith(1, {
      system_id: SYSTEM_B,
      edition_id: null,
    });
    expect(historyValues).toHaveBeenCalledTimes(2);
    expect(historyValues).toHaveBeenCalledWith(expect.objectContaining({
      field_name: 'edition_id',
      old_value: EDITION_A,
      new_value: null,
    }));
  });

  it('rejeita edição de outro sistema sem abrir transação', async () => {
    const response = await request(app())
      .patch('/api/v1/materials/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')
      .send({ system_id: SYSTEM_A, edition_id: EDITION_B })
      .expect(400);

    expect(response.body.error).toMatch(/não pertence/i);
    expect(dbMocks.transaction).not.toHaveBeenCalled();
  });

  it('devolve 503 quando o catálogo central está indisponível', async () => {
    catalogMocks.loadCatalogSystemsFlat.mockRejectedValue(new Error('catalog_503'));

    await request(app())
      .patch('/api/v1/materials/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')
      .send({ system_id: SYSTEM_B })
      .expect(503);

    expect(dbMocks.transaction).not.toHaveBeenCalled();
  });
});
