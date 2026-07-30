import express from 'express';
import request from 'supertest';

const dbMocks = vi.hoisted(() => ({ selectFrom: vi.fn() }));
vi.mock('../db', () => ({ db: dbMocks }));
vi.mock('../middleware/rateLimit', () => ({
  writeRateLimiter: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

import commentsRoutes from './comments';

function app() {
  const server = express();
  server.use(express.json());
  server.use('/api/v1/comments', commentsRoutes);
  return server;
}

describe('GET /api/v1/comments/:materialId — moderação transparente', () => {
  it('preserva comentário removido sem vazar o corpo', async () => {
    const builder = {
      select: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), orderBy: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue([
        { id: 'active', material_id: 'material-1', user_id: 'user-1', body: 'Texto público', removed_at: null, created_at: new Date() },
        { id: 'removed', material_id: 'material-1', user_id: 'user-2', body: 'Corpo que não pode vazar', removed_at: new Date(), created_at: new Date() },
      ]),
    };
    dbMocks.selectFrom.mockReturnValue(builder);

    const response = await request(app()).get('/api/v1/comments/material-1').expect(200);

    expect(response.body[0]).toMatchObject({ body: 'Texto público', removed_by_moderation: false });
    expect(response.body[1]).toMatchObject({ body: null, removed_by_moderation: true });
    expect(response.text).not.toContain('Corpo que não pode vazar');
  });
});
