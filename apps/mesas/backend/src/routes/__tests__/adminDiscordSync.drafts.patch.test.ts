import express from 'express';
import request from 'supertest';
import type { Mock } from 'vitest';
import adminDiscordSyncRoutes from '../adminDiscordSync';
import { db } from '../../db';

vi.mock('../../db', () => ({
  db: {
    updateTable: vi.fn(),
    selectFrom: vi.fn(),
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
};

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/admin/discord-sync', adminDiscordSyncRoutes);
  return app;
}

function mockCurrentDraft(normalizedPayload: Record<string, unknown>) {
  const selectChain = {
    select: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    executeTakeFirst: vi.fn().mockResolvedValue({
      id: 'draft-1',
      normalized_payload: normalizedPayload,
    }),
  };
  mockDb.selectFrom.mockReturnValue(selectChain);
  return selectChain;
}

function mockUpdatedDraft() {
  const updateChain = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    returningAll: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue([{
      id: 'draft-1',
      status: 'ready',
      normalized_payload: {
        missing_fields: ['day_of_week'],
      },
    }]),
  };
  mockDb.updateTable.mockReturnValue(updateChain);
  return updateChain;
}

describe('PATCH /admin/discord-sync/drafts/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentDraft({ missing_fields: ['day_of_week'] });
    mockUpdatedDraft();
  });

  it('rejects marking a draft as ready when required fields are missing', async () => {
    const response = await request(makeApp())
      .patch('/admin/discord-sync/drafts/draft-1')
      .send({ status: 'ready' });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      error: "Draft ainda tem 1 campo(s) faltando (day_of_week); não pode ser marcado como 'ready'.",
      details: { missing_fields: ['day_of_week'] },
    });
    expect(mockDb.updateTable).not.toHaveBeenCalled();
  });

  it('rejects invalid enum values in normalized_payload.table', async () => {
    const response = await request(makeApp())
      .patch('/admin/discord-sync/drafts/draft-1')
      .send({ normalized_payload: { table: { type: 'banana' } } });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('inválidos');
    expect(mockDb.selectFrom).not.toHaveBeenCalled();
    expect(mockDb.updateTable).not.toHaveBeenCalled();
  });
});
