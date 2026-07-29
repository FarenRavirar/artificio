import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbMocks = vi.hoisted(() => ({ selectFrom: vi.fn() }));
vi.mock('../db', () => ({ db: { selectFrom: dbMocks.selectFrom } }));

import publicSeoRoutes from './publicSeo';

function makeQuery(rows: unknown[]) {
  const query = {
    select: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    execute: vi.fn().mockResolvedValue(rows),
  };
  query.select.mockReturnValue(query);
  query.where.mockReturnValue(query);
  query.orderBy.mockReturnValue(query);
  return query;
}

function makeApp() {
  const app = express();
  app.use(publicSeoRoutes);
  return app;
}

describe('robots e sitemap por ambiente', () => {
  beforeEach(() => {
    process.env.APP_ENV = 'production';
    dbMocks.selectFrom.mockReset();
  });

  it('bloqueia todo crawl e omite sitemap em beta', async () => {
    process.env.APP_ENV = 'beta';
    const robots = await request(makeApp()).get('/robots.txt');
    const sitemap = await request(makeApp()).get('/sitemap.xml');

    expect(robots.status).toBe(200);
    expect(robots.type).toMatch(/text\/plain/);
    expect(robots.text).toBe('User-agent: *\nDisallow: /\n');
    expect(robots.text).not.toContain('Sitemap:');
    expect(sitemap.status).toBe(404);
    expect(sitemap.headers['x-robots-tag']).toBe('noindex, nofollow');
    expect(dbMocks.selectFrom).not.toHaveBeenCalled();
  });

  it('mantém bloqueio de facetas e referencia sitemap em produção', async () => {
    const response = await request(makeApp()).get('/robots.txt');
    expect(response.status).toBe(200);
    expect(response.text).toContain('Disallow: /*?*publisher=');
    expect(response.text).toContain('Disallow: /*?*page=');
    expect(response.text).toContain('Sitemap: https://downloads.artificiorpg.com/sitemap.xml');
    expect(response.text).not.toContain('Disallow: /\n');
  });

  it('lista somente o resultado da query pública no sitemap de produção', async () => {
    const query = makeQuery([
      { slug: 'aventura-a', updated_at: new Date('2026-07-29T12:00:00.000Z') },
      { slug: 'mapa-b', updated_at: new Date('2026-07-28T12:00:00.000Z') },
    ]);
    dbMocks.selectFrom.mockReturnValue(query);
    const response = await request(makeApp()).get('/sitemap.xml');

    expect(response.status).toBe(200);
    expect(response.type).toMatch(/application\/xml/);
    expect(query.where).toHaveBeenCalledWith('editorial_state', '=', 'published');
    expect(response.text).toContain('<loc>https://downloads.artificiorpg.com/materiais/aventura-a</loc>');
    expect(response.text).toContain('<loc>https://downloads.artificiorpg.com/materiais/mapa-b</loc>');
  });

  it('devolve 503 não cacheável quando sitemap não pode consultar o banco', async () => {
    const query = makeQuery([]);
    query.execute.mockRejectedValue(new Error('db unavailable'));
    dbMocks.selectFrom.mockReturnValue(query);
    const response = await request(makeApp()).get('/sitemap.xml');

    expect(response.status).toBe(503);
    expect(response.headers['retry-after']).toBe('60');
    expect(response.headers['cache-control']).toBe('no-store');
  });
});
