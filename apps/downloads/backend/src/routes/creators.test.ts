import request from 'supertest';
import express from 'express';

// T4.1 (spec 073) — perfil publico de criador: 404 quando nao existe, nunca
// vaza user_id, lista so materiais publicados do criador.

const dbMocks = vi.hoisted(() => ({
  selectFrom: vi.fn(),
}));

vi.mock('../db', () => ({
  db: { selectFrom: dbMocks.selectFrom },
}));

import creatorsRoutes from './creators';

function app() {
  const server = express();
  server.use('/api/v1/creators', creatorsRoutes);
  return server;
}

function makeCreatorQuery(creator: unknown) {
  return {
    select: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    executeTakeFirst: vi.fn().mockResolvedValue(creator),
  };
}

function makeMaterialsQuery(materials: unknown[]) {
  return {
    select: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue(materials),
  };
}

describe('GET /api/v1/creators/:slug', () => {
  beforeEach(() => {
    dbMocks.selectFrom.mockReset();
  });

  it('retorna 404 quando criador nao existe', async () => {
    dbMocks.selectFrom.mockReturnValueOnce(makeCreatorQuery(undefined));

    await request(app()).get('/api/v1/creators/inexistente').expect(404);
  });

  it('retorna perfil publico sem vazar user_id', async () => {
    const creator = { id: 'creator-1', user_id: 'user-secret', slug: 'criador-1', display_name: 'Criador 1', bio: null };
    dbMocks.selectFrom
      .mockReturnValueOnce(makeCreatorQuery(creator))
      .mockReturnValueOnce(makeMaterialsQuery([]));

    const response = await request(app()).get('/api/v1/creators/criador-1').expect(200);

    expect(response.body).not.toHaveProperty('user_id');
    expect(response.body.slug).toBe('criador-1');
    expect(response.body.materials).toEqual([]);
  });

  it('retorna perfil de credito sem conta associada (user_id null) sem consultar materiais', async () => {
    const creator = { id: 'creator-2', user_id: null, slug: 'creditos-only', display_name: 'Sem Conta', bio: null };
    dbMocks.selectFrom.mockReturnValueOnce(makeCreatorQuery(creator));

    const response = await request(app()).get('/api/v1/creators/creditos-only').expect(200);

    expect(response.body).not.toHaveProperty('user_id');
    expect(response.body.materials).toEqual([]);
    expect(dbMocks.selectFrom).toHaveBeenCalledTimes(1);
  });
});
