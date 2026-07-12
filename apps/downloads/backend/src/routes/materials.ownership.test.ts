import request from 'supertest';
import express from 'express';

// T3.2 — teste de integracao: publicador nao edita material de terceiro
// (070/spec.md criterio de aceite #5). Rota real, db/auth mockados.

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

function makeSelectQuery(material: unknown) {
  return {
    selectAll: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    executeTakeFirst: vi.fn().mockResolvedValue(material),
  };
}

function app() {
  const server = express();
  server.use(express.json());
  server.use('/api/v1/materials', materialsRoutes);
  return server;
}

describe('PATCH /api/v1/materials/:id — ownership', () => {
  const foreignMaterial = {
    id: 'material-1',
    creator_id: 'other-user',
    title: 'Original',
  };

  beforeEach(() => {
    dbMocks.selectFrom.mockReset();
    dbMocks.transaction.mockReset();
  });

  it('publicador (role publisher) não pode editar material de outro criador', async () => {
    mockUser = { userId: 'owner-user', role: 'publisher' };
    dbMocks.selectFrom.mockReturnValue(makeSelectQuery(foreignMaterial));

    const response = await request(app())
      .patch('/api/v1/materials/material-1')
      .send({ title: 'Tentativa de edição alheia' })
      .expect(403);

    expect(response.body.error).toMatch(/permissão/i);
  });

  it('moderador pode editar material de outro criador', async () => {
    mockUser = { userId: 'mod-user', role: 'moderator' };
    dbMocks.selectFrom.mockReturnValue(makeSelectQuery(foreignMaterial));

    // transaction e mockada minimamente so pra provar que passou do guard 403
    const trxUpdateResult = { ...foreignMaterial, title: 'Editado pelo moderador' };
    const trx = {
      insertInto: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue(undefined),
      }),
      updateTable: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returningAll: vi.fn().mockReturnThis(),
        executeTakeFirstOrThrow: vi.fn().mockResolvedValue(trxUpdateResult),
      }),
    };

    dbMocks.transaction.mockReturnValue({
      execute: (fn: (trx: unknown) => unknown) => fn(trx),
    });

    const response = await request(app())
      .patch('/api/v1/materials/material-1')
      .send({ title: 'Editado pelo moderador' })
      .expect(200);

    expect(response.body.title).toBe('Editado pelo moderador');
  });
});
