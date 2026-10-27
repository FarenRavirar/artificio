import request from 'supertest';
import express, { type Request, type Response, type NextFunction } from 'express';

// Spec 106 R6: PATCH /profile/me/profile valida display_name como o PUT /me/preferences.
vi.mock('../db/index.js', () => ({ db: {} }));
vi.mock('../middleware/auth.js', () => ({
  authMiddleware: (req: Request, _res: Response, next: NextFunction) => {
    req.user = { userId: 'u1', role: 'player' };
    next();
  },
}));
vi.mock('../services/profileService.js', () => ({
  updateProfile: vi.fn().mockResolvedValue({ display_name: 'VOID' }),
}));

import profileRoutes from './profile.js';
import * as profileService from '../services/profileService.js';

const app = express().use(express.json()).use('/api/v1/profile', profileRoutes);

describe('PATCH /api/v1/profile/me/profile — display_name', () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(['', ' ', 'V', 7])('recusa %j com 400, sem gravar', async (display_name) => {
    const res = await request(app).patch('/api/v1/profile/me/profile').send({ display_name });
    expect(res.status).toBe(400);
    expect(profileService.updateProfile).not.toHaveBeenCalled();
  });

  it('aceita 2+ caracteres, e patch sem display_name segue passando', async () => {
    expect((await request(app).patch('/api/v1/profile/me/profile').send({ display_name: 'VOID' })).status).toBe(200);
    expect((await request(app).patch('/api/v1/profile/me/profile').send({ bio: 'oi' })).status).toBe(200);
  });
});
