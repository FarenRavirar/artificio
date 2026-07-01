import type { Mock } from 'vitest';
import request from 'supertest';
import express from 'express';

const dbMocks = vi.hoisted(() => ({
  execute: vi.fn(),
  executeTakeFirst: vi.fn(),
  selectFrom: vi.fn(),
}));

vi.mock('../db', () => ({
  db: {
    selectFrom: dbMocks.selectFrom,
  },
}));

vi.mock('../services/profileService', () => ({
  getFullProfile: vi.fn(),
  toggleCovilVerified: vi.fn(),
}));

vi.mock('../middleware/auth', () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    req.user = { userId: 'admin-user', role: 'admin', name: 'Admin' };
    next();
  },
  requireRole: () => (_req: any, _res: any, next: any) => next(),
}));

import adminProfileRoutes from './adminProfile';
import * as profileService from '../services/profileService';

function makeQueryBuilder() {
  return {
    leftJoin: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    execute: dbMocks.execute,
    executeTakeFirst: dbMocks.executeTakeFirst,
  };
}

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/admin', adminProfileRoutes);
  return app;
}

describe('GET /api/v1/admin/users', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.execute.mockResolvedValue([]);
    dbMocks.executeTakeFirst.mockResolvedValue({ count: 0 });
    dbMocks.selectFrom.mockReturnValue(makeQueryBuilder());
  });

  it('returns users with meta', async () => {
    dbMocks.executeTakeFirst.mockResolvedValue({ count: 1 });
    dbMocks.execute.mockResolvedValue([{
      id: 'u1',
      email: 'gm@test.com',
      username: 'gmtest',
      role: 'gm',
      location: null,
      created_at: new Date('2026-06-30T10:00:00.000Z'),
      updated_at: new Date('2026-06-30T11:00:00.000Z'),
      display_name: 'GM Teste',
      avatar_url: null,
      gm_slug: 'gm-teste',
      gm_nickname: 'GM Teste',
      covil_verified: true,
      covil_verified_at: new Date('2026-06-30T12:00:00.000Z'),
    }]);

    const res = await request(makeApp()).get('/api/v1/admin/users');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe('u1');
    expect(res.body.data[0].covil_verified).toBe(true);
    expect(res.body.meta.total).toBe(1);
    expect(dbMocks.selectFrom).toHaveBeenCalledWith('users as u');
  });

  it('applies supported filters', async () => {
    const queryBuilder = makeQueryBuilder();
    dbMocks.selectFrom.mockReturnValue(queryBuilder);

    const res = await request(makeApp())
      .get('/api/v1/admin/users')
      .query({ role: 'gm', covil_verified: 'true', search: 'mestre' });

    expect(res.status).toBe(200);
    // Filtros aplicados na query de dados E na de contagem (mesmo builder mockado) → 3×2.
    expect(queryBuilder.where).toHaveBeenCalledTimes(6);
    // Valida o argumento real do filtro de role (não só a contagem de chamadas).
    expect(queryBuilder.where).toHaveBeenCalledWith('u.role', '=', 'gm');
    // covil_verified e search usam callback de expression builder.
    expect(queryBuilder.where).toHaveBeenCalledWith(expect.any(Function));
  });

  it('returns 500 when query fails', async () => {
    dbMocks.execute.mockRejectedValue(new Error('DB error'));

    const res = await request(makeApp()).get('/api/v1/admin/users');
    expect(res.status).toBe(500);
  });
});

describe('GET /api/v1/admin/users/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns profile for valid user id', async () => {
    const mockProfile = {
      user: { id: 'u1', email: 'test@test.com', username: 'test', location: null, role: 'player', created_at: new Date() },
      profile: { display_name: 'Teste', bio: null, avatar_url: null, languages: [] },
      player: null,
      gm: null,
      systems: { favorite: [], gm: [] },
    };
    (profileService.getFullProfile as Mock).mockResolvedValue(mockProfile);

    const res = await request(makeApp()).get('/api/v1/admin/users/u1');
    expect(res.status).toBe(200);
    expect(res.body.data.user.id).toBe('u1');
    expect(profileService.getFullProfile).toHaveBeenCalledWith('u1');
  });

  it('returns 500 when service throws', async () => {
    (profileService.getFullProfile as Mock).mockRejectedValue(new Error('DB error'));

    const res = await request(makeApp()).get('/api/v1/admin/users/u1');
    expect(res.status).toBe(500);
  });
});

describe('PATCH /api/v1/admin/users/:id/covil', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('toggles covil verified to true', async () => {
    (profileService.toggleCovilVerified as Mock).mockResolvedValue(undefined);

    const res = await request(makeApp())
      .patch('/api/v1/admin/users/u1/covil')
      .send({ verified: true });
    expect(res.status).toBe(200);
    expect(res.body.data.covil_verified).toBe(true);
    expect(res.body.data.user_id).toBe('u1');
    expect(profileService.toggleCovilVerified).toHaveBeenCalledWith('u1', true, 'admin-user');
  });

  it('toggles covil verified to false', async () => {
    (profileService.toggleCovilVerified as Mock).mockResolvedValue(undefined);

    const res = await request(makeApp())
      .patch('/api/v1/admin/users/u1/covil')
      .send({ verified: false });
    expect(res.status).toBe(200);
    expect(res.body.data.covil_verified).toBe(false);
    expect(res.body.data.verified_at).toBeNull();
    expect(res.body.data.verified_by).toBe('admin-user');
  });

  it('rejects when verified is not boolean', async () => {
    const res = await request(makeApp())
      .patch('/api/v1/admin/users/u1/covil')
      .send({ verified: 'yes' });
    expect(res.status).toBe(400);
  });
});
