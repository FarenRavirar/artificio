// T4.11 (spec 086, Fase 4) — POST /api/v1/system-suggestions (usuário comum
// sugere sistema) e GET /mine.

import request from 'supertest';
import express from 'express';

const dbMocks = vi.hoisted(() => ({
  selectFrom: vi.fn(),
  insertInto: vi.fn(),
}));

vi.mock('../db', () => ({ db: dbMocks }));
vi.mock('../middleware/auth', () => ({
  authMiddleware: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.user = { userId: 'user-1', role: 'user' };
    next();
  },
}));
vi.mock('../middleware/rateLimit', () => ({
  writeRateLimiter: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

import systemSuggestionsRoutes from './systemSuggestions';

function app() {
  const server = express();
  server.use(express.json());
  server.use('/api/v1/system-suggestions', systemSuggestionsRoutes);
  return server;
}

function selectChain(result: unknown) {
  return { select: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), executeTakeFirst: vi.fn().mockResolvedValue(result) };
}

beforeEach(() => {
  dbMocks.selectFrom.mockReset();
  dbMocks.insertInto.mockReset();
});

describe('POST /api/v1/system-suggestions', () => {
  it('cria sugestão com source=user e suggested_by_user_id do req.user', async () => {
    dbMocks.selectFrom.mockReturnValueOnce(selectChain({ id: 'material-1', system_id: null }));
    const insert = {
      values: vi.fn().mockReturnThis(),
      returningAll: vi.fn().mockReturnThis(),
      executeTakeFirstOrThrow: vi.fn().mockResolvedValue({ id: 'suggestion-1', status: 'pending' }),
    };
    dbMocks.insertInto.mockReturnValueOnce(insert);

    const res = await request(app())
      .post('/api/v1/system-suggestions')
      .send({ material_id: 'material-1', raw_value: 'D&D 5e' });

    expect(res.status).toBe(201);
    expect(insert.values).toHaveBeenCalledWith(
      expect.objectContaining({ material_id: 'material-1', raw_value: 'D&D 5e', source: 'user', suggested_by_user_id: 'user-1' }),
    );
  });

  it('404 quando material não existe', async () => {
    dbMocks.selectFrom.mockReturnValueOnce(selectChain(undefined));

    const res = await request(app())
      .post('/api/v1/system-suggestions')
      .send({ material_id: 'inexistente', raw_value: 'D&D 5e' });

    expect(res.status).toBe(404);
    expect(dbMocks.insertInto).not.toHaveBeenCalled();
  });

  it('409 quando material já tem sistema associado', async () => {
    dbMocks.selectFrom.mockReturnValueOnce(selectChain({ id: 'material-1', system_id: 'dd5e' }));

    const res = await request(app())
      .post('/api/v1/system-suggestions')
      .send({ material_id: 'material-1', raw_value: 'D&D 5e' });

    expect(res.status).toBe(409);
    expect(dbMocks.insertInto).not.toHaveBeenCalled();
  });

  it('400 em payload inválido (raw_value vazio)', async () => {
    const res = await request(app())
      .post('/api/v1/system-suggestions')
      .send({ material_id: 'material-1', raw_value: '' });

    expect(res.status).toBe(400);
    expect(dbMocks.selectFrom).not.toHaveBeenCalled();
  });
});

describe('GET /api/v1/system-suggestions/mine', () => {
  it('lista só as sugestões do usuário autenticado', async () => {
    const chain = { selectAll: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), orderBy: vi.fn().mockReturnThis(), execute: vi.fn().mockResolvedValue([{ id: 's1' }]) };
    dbMocks.selectFrom.mockReturnValueOnce(chain);

    const res = await request(app()).get('/api/v1/system-suggestions/mine');

    expect(res.status).toBe(200);
    expect(chain.where).toHaveBeenCalledWith('suggested_by_user_id', '=', 'user-1');
  });
});
