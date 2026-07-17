import express from 'express';
import request from 'supertest';
import authRouter from './auth.js';

describe('SSO auth redirect', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.ACCOUNTS_URL = 'https://accounts.artificiorpg.com';
    delete process.env.PUBLIC_SITE_URL;
    delete process.env.FRONTEND_URL;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  const app = () => {
    const server = express();
    server.use('/api/v1/auth', authRouter);
    return server;
  };

  it('uses the beta public origin when no explicit return URL is provided', async () => {
    process.env.PUBLIC_SITE_URL = 'https://mesasbeta.artificiorpg.com';

    const response = await request(app()).get('/api/v1/auth/google').expect(302);

    const location = response.headers.location as string;
    expect(location).toContain('https://accounts.artificiorpg.com/login');
    expect(location).toContain('return=https%3A%2F%2Fmesasbeta.artificiorpg.com%2F');
  });

  it('keeps only the path of an external frontend_redirect on the configured origin', async () => {
    process.env.PUBLIC_SITE_URL = 'https://mesasbeta.artificiorpg.com';

    const response = await request(app())
      .get('/api/v1/auth/google')
      .query({ frontend_redirect: 'https://evil.com/painel?tab=mesas#top' })
      .expect(302);

    const location = response.headers.location as string;
    expect(location).toContain('return=https%3A%2F%2Fmesasbeta.artificiorpg.com%2Fpainel%3Ftab%3Dmesas%23top');
    expect(location).not.toContain('evil.com');
  });
});
