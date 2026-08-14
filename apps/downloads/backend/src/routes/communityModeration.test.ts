import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }));
vi.mock('undici', () => ({ fetch: fetchMock }));
vi.mock('../middleware/auth', () => ({
  authMiddleware: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.user = { userId: 'moderator-user', role: 'moderator' };
    next();
  },
  requireRole: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

import router from './communityModeration';

function app() {
  const server = express();
  server.use(express.json());
  server.use('/api/v1/community', router);
  return server;
}

describe('fachada browser-safe de moderação comunitária', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ACCOUNTS_URL = 'http://accounts.test';
    process.env.SERVICE_CREDENTIAL = 'downloads-prod.credential';
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ items: [], new_account_comments: [] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));
  });

  it('mantém credencial e ator somente no salto backend-to-backend', async () => {
    const response = await request(app()).get('/api/v1/community/moderation/queue?status=open');

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://accounts.test/internal/v1/comments/moderation-queue?status=open',
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Service-Token': 'downloads-prod.credential',
          'X-Acting-User-Id': 'moderator-user',
        }),
      }),
    );
    expect(response.headers).not.toHaveProperty('x-service-token');
  });

  it('preserva 409 e o payload para a UI não apagar trabalho concorrente', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 'case_already_resolved' } }), {
      status: 409,
      headers: { 'content-type': 'application/json' },
    }));

    const response = await request(app())
      .post('/api/v1/community/moderation/cases/case-1/resolution')
      .set('Idempotency-Key', 'attempt-1')
      .send({ verdicts: [], action: 'no_change', reason: 'Já tratado' });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: { code: 'case_already_resolved' } });
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({ 'Idempotency-Key': 'attempt-1' });
  });

  it('falha fechado quando a credencial não existe', async () => {
    delete process.env.SERVICE_CREDENTIAL;
    const response = await request(app()).get('/api/v1/community/moderation/queue');
    expect(response.status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
