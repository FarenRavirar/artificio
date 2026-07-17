import express from 'express';
import request from 'supertest';
import type { Mock } from 'vitest';
import adminDiscordSyncRoutes from '../adminDiscordSync.js';
import { db } from '../../db/index.js';
import { destroyAssetResult } from '@artificio/media';

vi.mock('../../db', () => ({
  db: {
    selectFrom: vi.fn(),
    deleteFrom: vi.fn(),
  },
}));

vi.mock('@artificio/media', () => ({
  destroyAssetResult: vi.fn(),
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
  selectFrom: Mock;
  deleteFrom: Mock;
};
const mockDestroy = destroyAssetResult as unknown as Mock;

type Target = { id: string; cover_public_id: string | null };

function mockSelectTargets(targets: Target[]) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue(targets),
  };
  mockDb.selectFrom.mockReturnValue(chain);
  return chain;
}

function mockDelete(numDeletedRows: bigint) {
  const chain = {
    where: vi.fn().mockReturnThis(),
    executeTakeFirst: vi.fn().mockResolvedValue({ numDeletedRows }),
  };
  mockDb.deleteFrom.mockReturnValue(chain);
  return chain;
}

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/admin/discord', adminDiscordSyncRoutes);
  return app;
}

describe('DELETE /admin/discord/drafts/rejected', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('apaga descartados sem capa sem chamar o Cloudinary', async () => {
    mockSelectTargets([
      { id: 'd1', cover_public_id: null },
      { id: 'd2', cover_public_id: null },
    ]);
    mockDelete(2n);

    const response = await request(makeApp()).delete('/admin/discord/drafts/rejected');

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ deleted: 2, cover_destroy_failed: 0 });
    expect(mockDestroy).not.toHaveBeenCalled();
    expect(mockDb.deleteFrom).toHaveBeenCalled();
  });

  it('destrói a capa no Cloudinary antes de apagar a linha', async () => {
    mockSelectTargets([{ id: 'd1', cover_public_id: 'pub_1' }]);
    mockDestroy.mockResolvedValue(true);
    const deleteChain = mockDelete(1n);

    const response = await request(makeApp()).delete('/admin/discord/drafts/rejected');

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ deleted: 1, cover_destroy_failed: 0 });
    expect(mockDestroy).toHaveBeenCalledWith('pub_1');
    expect(deleteChain.where).toHaveBeenCalledWith('id', 'in', ['d1']);
  });

  it('mantém a linha quando o destroy da capa falha (não vaza mídia)', async () => {
    mockSelectTargets([
      { id: 'd1', cover_public_id: 'pub_1' },
      { id: 'd2', cover_public_id: null },
    ]);
    mockDestroy.mockResolvedValue(false);
    const deleteChain = mockDelete(1n);

    const response = await request(makeApp()).delete('/admin/discord/drafts/rejected');

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ deleted: 1, cover_destroy_failed: 1 });
    // Só a linha sem capa entra no delete; a da capa falha fica p/ retry.
    expect(deleteChain.where).toHaveBeenCalledWith('id', 'in', ['d2']);
  });

  it('não chama deleteFrom quando não há descartados', async () => {
    mockSelectTargets([]);

    const response = await request(makeApp()).delete('/admin/discord/drafts/rejected');

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ deleted: 0, cover_destroy_failed: 0 });
    expect(mockDb.deleteFrom).not.toHaveBeenCalled();
  });

  it('rejeita origin inválido com 400 sem tocar o banco', async () => {
    const response = await request(makeApp()).delete('/admin/discord/drafts/rejected?origin=banana');

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('inválidos');
    expect(mockDb.selectFrom).not.toHaveBeenCalled();
    expect(mockDb.deleteFrom).not.toHaveBeenCalled();
  });
});
