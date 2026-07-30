import request from 'supertest';
import express from 'express';

// T4.1 (spec 073) — perfil publico de criador: 404 quando nao existe, nunca
// vaza user_id, lista so materiais publicados do criador.

const dbMocks = vi.hoisted(() => ({
  selectFrom: vi.fn(),
  updateTable: vi.fn(),
  insertInto: vi.fn(),
}));

vi.mock('../db', () => ({
  db: {
    selectFrom: dbMocks.selectFrom,
    updateTable: dbMocks.updateTable,
    insertInto: dbMocks.insertInto,
  },
}));

vi.mock('../middleware/auth', () => ({
  authMiddleware: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.user = {
      userId: 'user-1',
      role: 'user',
      name: 'Nome da Conta',
      email: 'conta@example.com',
    };
    next();
  },
}));

import creatorsRoutes from './creators';

function app() {
  const server = express();
  server.use(express.json());
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

function makeUpdateQuery(updated: unknown) {
  return {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    returning: vi.fn().mockReturnThis(),
    executeTakeFirstOrThrow: vi.fn().mockResolvedValue(updated),
  };
}

function makeInsertQuery(created: unknown, error?: unknown) {
  return {
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockReturnThis(),
    executeTakeFirstOrThrow: error
      ? vi.fn().mockRejectedValue(error)
      : vi.fn().mockResolvedValue(created),
  };
}

describe('perfil autenticado do criador', () => {
  beforeEach(() => {
    dbMocks.selectFrom.mockReset();
    dbMocks.updateTable.mockReset();
    dbMocks.insertInto.mockReset();
  });

  it('GET /me devolve role e perfil nulo antes do primeiro salvamento', async () => {
    dbMocks.selectFrom.mockReturnValueOnce(makeCreatorQuery(undefined));

    const response = await request(app()).get('/api/v1/creators/me').expect(200);

    expect(response.body).toEqual({ role: 'user', profile: null });
  });

  it('GET /me devolve o perfil público próprio sem user_id', async () => {
    dbMocks.selectFrom.mockReturnValueOnce(makeCreatorQuery({
      id: 'creator-1',
      user_id: 'user-1',
      slug: 'nome-publico',
      display_name: 'Nome Público',
      bio: 'Bio pública',
    }));

    const response = await request(app()).get('/api/v1/creators/me').expect(200);

    expect(response.body).toEqual({
      role: 'user',
      profile: { slug: 'nome-publico', display_name: 'Nome Público', bio: 'Bio pública' },
    });
  });

  it('PATCH /me rejeita nome público vazio', async () => {
    await request(app())
      .patch('/api/v1/creators/me')
      .send({ display_name: ' ', bio: null })
      .expect(400);

    expect(dbMocks.selectFrom).not.toHaveBeenCalled();
  });

  it('PATCH /me atualiza nome e bio sem mudar slug existente', async () => {
    const existing = {
      id: 'creator-1',
      user_id: 'user-1',
      slug: 'endereco-imutavel',
      display_name: 'Nome Antigo',
      bio: null,
    };
    const updated = { ...existing, display_name: 'Nome Novo', bio: '**Bio**' };
    const updateQuery = makeUpdateQuery(updated);
    dbMocks.selectFrom.mockReturnValueOnce(makeCreatorQuery(existing));
    dbMocks.updateTable.mockReturnValueOnce(updateQuery);

    const response = await request(app())
      .patch('/api/v1/creators/me')
      .send({ display_name: 'Nome Novo', bio: '**Bio**' })
      .expect(200);

    expect(updateQuery.set).toHaveBeenCalledWith({ display_name: 'Nome Novo', bio: '**Bio**' });
    expect(response.body.profile.slug).toBe('endereco-imutavel');
  });

  it('PATCH /me cria perfil no primeiro salvamento e sanitiza bio', async () => {
    const created = {
      id: 'creator-1',
      user_id: 'user-1',
      slug: 'nome-publico',
      display_name: 'Nome Público',
      bio: '**Olá** ',
    };
    const insertQuery = makeInsertQuery(created);
    dbMocks.selectFrom.mockReturnValueOnce(makeCreatorQuery(undefined));
    dbMocks.insertInto.mockReturnValueOnce(insertQuery);

    const response = await request(app())
      .patch('/api/v1/creators/me')
      .send({ display_name: 'Nome Público', bio: '**Olá** <script>alert(1)</script>' })
      .expect(200);

    expect(insertQuery.values).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 'user-1',
      slug: 'nome-publico',
      display_name: 'Nome Público',
    }));
    const savedBio = insertQuery.values.mock.calls[0]?.[0]?.bio;
    expect(savedBio).not.toMatch(/script|alert/i);
    expect(response.body.profile.slug).toBe('nome-publico');
  });

  it('PATCH /me adiciona sufixo quando endereço automático já existe', async () => {
    const collision = { code: '23505', constraint: 'idx_download_creator_slug' };
    const created = {
      id: 'creator-1',
      user_id: 'user-1',
      slug: 'nome-publico-2',
      display_name: 'Nome Público',
      bio: null,
    };
    const firstInsert = makeInsertQuery(undefined, collision);
    const secondInsert = makeInsertQuery(created);
    dbMocks.selectFrom.mockReturnValueOnce(makeCreatorQuery(undefined));
    dbMocks.insertInto.mockReturnValueOnce(firstInsert).mockReturnValueOnce(secondInsert);

    await request(app())
      .patch('/api/v1/creators/me')
      .send({ display_name: 'Nome Público', bio: null })
      .expect(200);

    expect(firstInsert.values).toHaveBeenCalledWith(expect.objectContaining({ slug: 'nome-publico' }));
    expect(secondInsert.values).toHaveBeenCalledWith(expect.objectContaining({ slug: 'nome-publico-2' }));
  });
});

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
