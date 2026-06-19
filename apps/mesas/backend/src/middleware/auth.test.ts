import jwt from 'jsonwebtoken';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { authMiddleware } from './auth';

vi.mock('../db', () => ({
  db: {
    selectFrom: () => ({
      select: () => ({
        where: () => ({
          executeTakeFirst: async () => undefined,
        }),
      }),
    }),
  },
}));

const originalSecret = process.env.JWT_SECRET;

describe('SSO auth middleware', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret-only-for-sso';
  });

  afterEach(() => {
    process.env.JWT_SECRET = originalSecret;
  });

  it('returns 401 without artificio_session cookie', async () => {
    const app = express();
    app.use(cookieParser());
    app.get('/private', authMiddleware, (_req, res) => res.json({ ok: true }));

    await request(app).get('/private').expect(401);
  });

  it('accepts valid accounts JWT from artificio_session cookie', async () => {
    const app = express();
    app.use(cookieParser());
    app.get('/private', authMiddleware, (req, res) => res.json({ user: req.user }));
    const token = jwt.sign(
      {
        sub: 'accounts-user-1',
        email: 'paulo@example.com',
        name: 'Paulo Teste',
        role: 'user',
      },
      'test-secret-only-for-sso',
      { algorithm: 'HS256', expiresIn: '15m' },
    );

    const response = await request(app)
      .get('/private')
      .set('Cookie', [`artificio_session=${token}`])
      .expect(200);

    expect(response.body.user).toMatchObject({
      userId: 'accounts-user-1',
      role: 'player',
      email: 'paulo@example.com',
      name: 'Paulo Teste',
    });
  });
});
