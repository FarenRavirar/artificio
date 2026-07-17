import request from 'supertest';
import express from 'express';
import adminEnrichmentRoutes from './adminEnrichment.js';
import type { UserRole } from '../db/types.js';

let mockAuthUser: { userId: string; role: UserRole } | null = null;
const { mockProdExecute, mockTransactionExecute } = vi.hoisted(() => ({
  mockProdExecute: vi.fn(),
  mockTransactionExecute: vi.fn(),
}));

vi.mock('../middleware/auth', () => ({
  authMiddleware: (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!mockAuthUser) {
      res.status(401).json({ error: 'Token inválido ou expirado.' });
      return;
    }

    req.user = mockAuthUser;
    next();
  },
}));

vi.mock('../db/prod', () => ({
  prodDb: {
    selectFrom: vi.fn(() => ({
      select: vi.fn(() => ({
        limit: vi.fn(() => ({
          execute: mockProdExecute,
        })),
      })),
    })),
  },
}));

vi.mock('../db', () => ({
  db: {
    transaction: vi.fn(() => ({
      execute: mockTransactionExecute,
    })),
  },
}));

vi.mock('../services/mesasHydrationSystemGuard', () => ({
  assertMesasHydrationSystemReady: vi.fn().mockResolvedValue({ catalog_version: 1, references: 0 }),
}));

const app = express();
app.use('/api/v1/admin', adminEnrichmentRoutes);

describe('Admin Enrichment Routes', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    mockAuthUser = null;
    mockProdExecute.mockReset().mockResolvedValue([{ id: 'sample' }]);
    mockTransactionExecute.mockReset().mockImplementation(async (callback) => callback({}));
    process.env.NODE_ENV = 'test';
  });

  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('should return 401 when not authenticated', async () => {
    const res = await request(app).post('/api/v1/admin/sync/enrich');
    expect(res.status).toBe(401);
  });

  it('blocks enrichment in production before touching prod db', async () => {
    mockAuthUser = { userId: 'admin-user', role: 'admin' };
    process.env.NODE_ENV = 'production';

    const res = await request(app).post('/api/v1/admin/sync/enrich');

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('produção');
    expect(mockProdExecute).not.toHaveBeenCalled();
    expect(mockTransactionExecute).not.toHaveBeenCalled();
  });

  it('allows admin dry-run outside production and rolls back transaction', async () => {
    mockAuthUser = { userId: 'admin-user', role: 'admin' };
    mockTransactionExecute.mockImplementationOnce(async () => {
      throw new Error('DRY_RUN_ROLLBACK');
    });

    const res = await request(app).post('/api/v1/admin/sync/enrich?dry_run=true');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.dry_run).toBe(true);
    expect(mockProdExecute).toHaveBeenCalledTimes(1);
    expect(mockTransactionExecute).toHaveBeenCalledTimes(1);
  });
});
