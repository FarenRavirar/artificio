import request from 'supertest';
import express from 'express';

// T2.3/T6.3 (spec 074) — historico por campo: sem entrada espuria quando o
// valor nao muda; leitura de historico so para dono/moderador/admin.

const dbMocks = vi.hoisted(() => ({
  selectFrom: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock('../db', () => ({
  db: {
    selectFrom: dbMocks.selectFrom,
    transaction: dbMocks.transaction,
  },
}));

let mockUser: { userId: string; role: 'user' | 'publisher' | 'moderator' | 'admin' } = {
  userId: 'owner-user',
  role: 'user',
};

vi.mock('../middleware/auth', () => ({
  authMiddleware: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.user = mockUser;
    next();
  },
}));

import materialsRoutes from './materials';

function app() {
  const server = express();
  server.use(express.json());
  server.use('/api/v1/materials', materialsRoutes);
  return server;
}

function makeSelectAllQuery(material: unknown) {
  return {
    selectAll: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    executeTakeFirst: vi.fn().mockResolvedValue(material),
  };
}

function makeSelectQuery(row: unknown) {
  return {
    select: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    executeTakeFirst: vi.fn().mockResolvedValue(row),
  };
}

function makeHistoryQuery(rows: unknown[]) {
  return {
    selectAll: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue(rows),
  };
}

describe('PATCH /api/v1/materials/:id — historico sem entrada espuria', () => {
  beforeEach(() => {
    dbMocks.selectFrom.mockReset();
    dbMocks.transaction.mockReset();
    mockUser = { userId: 'owner-user', role: 'user' };
  });

  it('nao grava versao para campo cujo valor enviado e igual ao atual', async () => {
    const material = { id: 'material-1', creator_id: 'owner-user', title: 'Mesmo título', summary: null };
    dbMocks.selectFrom.mockReturnValue(makeSelectAllQuery(material));

    const insertVersionMock = vi.fn().mockReturnValue({
      values: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue(undefined),
    });

    const trx = {
      insertInto: insertVersionMock,
      updateTable: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returningAll: vi.fn().mockReturnThis(),
        executeTakeFirstOrThrow: vi.fn().mockResolvedValue(material),
      }),
    };

    dbMocks.transaction.mockReturnValue({
      execute: (fn: (trx: unknown) => unknown) => fn(trx),
    });

    await request(app())
      .patch('/api/v1/materials/material-1')
      .send({ title: 'Mesmo título' })
      .expect(200);

    expect(insertVersionMock).not.toHaveBeenCalled();
  });
});

describe('GET /api/v1/materials/:id/history', () => {
  beforeEach(() => {
    dbMocks.selectFrom.mockReset();
    mockUser = { userId: 'owner-user', role: 'user' };
  });

  it('dono ve o proprio historico', async () => {
    dbMocks.selectFrom
      .mockReturnValueOnce(makeSelectQuery({ id: 'material-1', creator_id: 'owner-user' }))
      .mockReturnValueOnce(makeHistoryQuery([{ id: 'v1', field_name: 'title' }]));

    const response = await request(app()).get('/api/v1/materials/material-1/history').expect(200);

    expect(response.body).toHaveLength(1);
  });

  it('usuario que nao e dono nem moderador/admin recebe 403', async () => {
    mockUser = { userId: 'other-user', role: 'user' };
    dbMocks.selectFrom.mockReturnValueOnce(makeSelectQuery({ id: 'material-1', creator_id: 'owner-user' }));

    await request(app()).get('/api/v1/materials/material-1/history').expect(403);
  });
});
