import express from 'express';
import request from 'supertest';
import type { Mock } from 'vitest';
import adminDiscordSyncRoutes from '../adminDiscordSync';
import { db } from '../../db';

vi.mock('../../db', () => ({
  db: {
    updateTable: vi.fn(),
    selectFrom: vi.fn(),
    transaction: vi.fn(),
  },
}));

vi.mock('../../middleware/auth', () => ({
  authMiddleware: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.user = { userId: 'admin-test', role: 'admin' };
    next();
  },
  requireAdmin: [(req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.user = { userId: 'admin-test', role: 'admin' };
    next();
  }],
}));

const mockDb = db as unknown as {
  updateTable: Mock;
  selectFrom: Mock;
  transaction: Mock;
};

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/admin/discord', adminDiscordSyncRoutes);
  return app;
}

function mockChain(overrides: Record<string, Mock> = {}) {
  const methods = ['select', 'selectAll', 'where', 'returning', 'returningAll', 'set', 'values', 'limit', 'offset', 'innerJoin', 'deleteFrom', 'updateTable', 'insertInto'];
  const chain: Record<string, Mock> = {};
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnThis();
  }
  return Object.assign(chain, overrides);
}

describe('POST /admin/discord/drafts/:id/sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 404 when draft not found (DraftNotFoundError)', async () => {
    const chain = mockChain({
      executeTakeFirst: vi.fn().mockResolvedValue(null),
    });
    mockDb.selectFrom.mockReturnValue(chain);

    const response = await request(makeApp())
      .post('/admin/discord/drafts/nonexistent/sync');

    expect(response.status).toBe(404);
    expect(response.body.error).toContain('não encontrado');
  });

  it('returns 422 when draft is rejected (DraftStateError)', async () => {
    const chain = mockChain({
      executeTakeFirst: vi.fn().mockResolvedValue({
        id: 'draft-1',
        status: 'rejected',
        discord_message_id: 'msg-1',
      }),
    });
    mockDb.selectFrom.mockReturnValue(chain);

    const response = await request(makeApp())
      .post('/admin/discord/drafts/draft-1/sync');

    // O guard de discord_message_id null não se aplica (draft Discord tem message_id)
    // DraftStateError é lançado pelo core
    expect(response.status).toBe(422);
    expect(response.body.error).toContain('rejeitado');
  });
});
