import request from 'supertest';
import express from 'express';

// Spec 088 — a rota publica de avaliacoes passou a marcar qual e do proprio
// usuario, sem expor `user_id`.
//
// Antes: a rota selecionava `id, material_id, score, comment, created_at`,
// enquanto `ratingSchema` no frontend exigia `user_id` — o `.parse()` LANCAVA
// em toda resposta com avaliacao real, e a lista so "funcionava" quando vinha
// vazia. Media e nota do usuario nunca apareciam.
//
// A correcao NAO foi devolver `user_id`: e identificador de conta em endpoint
// publico, e expo-lo permitiria correlacionar avaliacoes entre materiais e
// mapear a atividade de qualquer pessoa. O backend compara internamente e
// publica so `is_mine`.

const dbMocks = vi.hoisted(() => ({
  selectFrom: vi.fn(),
}));

const authState = vi.hoisted(() => ({
  user: null as { userId: string; role: 'user' } | null,
}));

vi.mock('../db', () => ({
  db: { selectFrom: dbMocks.selectFrom },
}));

vi.mock('../middleware/auth', () => ({
  optionalAuth: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.user = authState.user ?? undefined;
    next();
  },
  authMiddleware: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.user = authState.user ?? undefined;
    next();
  },
}));

vi.mock('../middleware/rateLimit', () => ({
  readRateLimiter: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
  writeRateLimiter: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

import ratingsRoutes from './ratings';

function app() {
  const server = express();
  server.use(express.json());
  server.use('/api/v1/ratings', ratingsRoutes);
  return server;
}

function mockRatings(rows: unknown[]) {
  dbMocks.selectFrom.mockReturnValue({
    select: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue(rows),
  });
}

const rows = [
  {
    id: 'rating-1',
    material_id: 'material-1',
    user_id: 'user-1',
    score: 4,
    comment: 'Bom',
    created_at: '2026-07-01T00:00:00.000Z',
  },
  {
    id: 'rating-2',
    material_id: 'material-1',
    user_id: 'user-2',
    score: 2,
    comment: null,
    created_at: '2026-06-01T00:00:00.000Z',
  },
];

describe('GET /ratings/:materialId', () => {
  beforeEach(() => {
    authState.user = null;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('nunca expoe user_id na resposta', async () => {
    authState.user = { userId: 'user-1', role: 'user' };
    mockRatings(rows);

    const response = await request(app()).get('/api/v1/ratings/material-1');

    expect(response.status).toBe(200);
    response.body.forEach((rating: Record<string, unknown>) => {
      expect(rating).not.toHaveProperty('user_id');
    });
    // Prova tambem contra o corpo cru: nenhum identificador de conta atravessa.
    expect(JSON.stringify(response.body)).not.toContain('user-2');
  });

  it('marca is_mine apenas na avaliacao da conta autenticada', async () => {
    authState.user = { userId: 'user-1', role: 'user' };
    mockRatings(rows);

    const response = await request(app()).get('/api/v1/ratings/material-1');

    expect(response.body).toEqual([
      expect.objectContaining({ id: 'rating-1', score: 4, is_mine: true }),
      expect.objectContaining({ id: 'rating-2', score: 2, is_mine: false }),
    ]);
  });

  it('visitante sem sessao recebe a lista com is_mine falso', async () => {
    mockRatings(rows);

    const response = await request(app()).get('/api/v1/ratings/material-1');

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(2);
    expect(response.body.every((rating: { is_mine: boolean }) => rating.is_mine === false)).toBe(true);
  });

  it('devolve os campos que o contrato do frontend espera', async () => {
    mockRatings([rows[0]]);

    const response = await request(app()).get('/api/v1/ratings/material-1');

    // Espelha `ratingSchema` (types/panel.ts): campo a menos aqui volta a
    // fazer o `.parse()` do frontend lancar em toda resposta.
    expect(Object.keys(response.body[0]).sort()).toEqual(
      ['comment', 'created_at', 'id', 'is_mine', 'material_id', 'score'],
    );
  });
});
