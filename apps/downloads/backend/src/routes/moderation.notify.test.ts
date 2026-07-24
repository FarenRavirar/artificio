import request from 'supertest';
import express from 'express';

// DEB-074-04 (spec 074/075) — aprovacao/reprovacao devem emitir notificacao
// pro dono do material via download_notification.

const dbMocks = vi.hoisted(() => ({
  selectFrom: vi.fn(),
  updateTable: vi.fn(),
  insertInto: vi.fn(),
}));

vi.mock('../db', () => ({
  db: { selectFrom: dbMocks.selectFrom, updateTable: dbMocks.updateTable, insertInto: dbMocks.insertInto },
}));

vi.mock('../middleware/auth', () => ({
  authMiddleware: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.user = { userId: 'moderator-1', role: 'moderator' };
    next();
  },
  requireRole: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

vi.mock('../middleware/rateLimit', () => ({
  writeRateLimiter: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

vi.mock('../services/moderationEmail', () => ({
  sendModerationEmail: vi.fn().mockResolvedValue(undefined),
}));

import moderationRoutes from './moderation';

function app() {
  const server = express();
  server.use(express.json());
  server.use('/api/v1/moderation', moderationRoutes);
  return server;
}

function makeMaterialQuery(material: unknown) {
  return {
    selectAll: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    executeTakeFirst: vi.fn().mockResolvedValue(material),
  };
}

describe('POST /api/v1/moderation/:id/approve — emite notificacao', () => {
  beforeEach(() => {
    dbMocks.selectFrom.mockReset();
    dbMocks.updateTable.mockReset();
    dbMocks.insertInto.mockReset();
  });

  it('insere download_notification apos aprovar', async () => {
    const material = { id: 'material-1', creator_id: 'owner-1', title: 'Meu material', editorial_state: 'in_review', slug: 'meu-material' };
    dbMocks.selectFrom
      .mockReturnValueOnce(makeMaterialQuery(material))
      .mockReturnValueOnce(makeMaterialQuery({ id: 'evidence-1' }));

    const updateChain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      returningAll: vi.fn().mockReturnThis(),
      executeTakeFirstOrThrow: vi.fn().mockResolvedValue({ ...material, editorial_state: 'published' }),
    };
    dbMocks.updateTable.mockReturnValue(updateChain);

    const insertChain = { values: vi.fn().mockReturnThis(), execute: vi.fn().mockResolvedValue(undefined) };
    dbMocks.insertInto.mockReturnValue(insertChain);

    await request(app()).post('/api/v1/moderation/material-1/approve').expect(200);

    expect(dbMocks.insertInto).toHaveBeenCalledWith('download_notification');
    expect(insertChain.values).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'owner-1', kind: 'material_approved', material_id: 'material-1' }),
    );
  });
});
