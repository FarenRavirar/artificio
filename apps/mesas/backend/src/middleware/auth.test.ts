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
    insertInto: () => ({
      values: () => ({
        onConflict: () => ({
          returning: () => ({
            execute: async () => [{ id: 'local-user-1', email: 'paulo@example.com', role: 'player' }],
          }),
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
      userId: 'local-user-1',
      role: 'player',
      email: 'paulo@example.com',
      name: 'Paulo Teste',
    });
  });

  it('provisions local user on first SSO login instead of falling back to the accounts UUID (regressão 2026-07-12)', async () => {
    const app = express();
    app.use(cookieParser());
    app.get('/private', authMiddleware, (req, res) => res.json({ user: req.user }));
    const token = jwt.sign(
      {
        sub: 'accounts-user-new',
        email: 'novo@example.com',
        name: 'Novo Usuário',
        role: 'user',
      },
      'test-secret-only-for-sso',
      { algorithm: 'HS256', expiresIn: '15m' },
    );

    const response = await request(app)
      .get('/private')
      .set('Cookie', [`artificio_session=${token}`])
      .expect(200);

    // userId precisa ser o id LOCAL provisionado (local-user-1, do mock de
    // insertInto), nunca o sub/UUID do accounts — esse era exatamente o bug:
    // fallback pro UUID do accounts quebrava FK em qualquer rota que gravasse
    // user_id (ex.: POST /gm/profile).
    expect(response.body.user.userId).toBe('local-user-1');
    expect(response.body.user.userId).not.toBe('accounts-user-new');
  });
});
