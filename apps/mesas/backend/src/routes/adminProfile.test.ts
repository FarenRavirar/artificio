import type { Mock } from 'vitest';
import request from 'supertest';
import express from 'express';

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

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/admin', adminProfileRoutes);
  return app;
}

describe('GET /api/v1/admin/users', () => {
  it('returns empty user list with meta', async () => {
    const res = await request(makeApp()).get('/api/v1/admin/users');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.meta.total).toBe(0);
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
  });

  it('rejects when verified is not boolean', async () => {
    const res = await request(makeApp())
      .patch('/api/v1/admin/users/u1/covil')
      .send({ verified: 'yes' });
    expect(res.status).toBe(400);
  });
});
