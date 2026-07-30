import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const serviceMocks = vi.hoisted(() => ({ listPublishedMaterialSlugs: vi.fn() }));
vi.mock('../services/publicMaterial', () => ({
  listPublishedMaterialSlugs: serviceMocks.listPublishedMaterialSlugs,
}));

import publicSeoRoutes from './publicSeo';

function makeApp() {
  const app = express();
  app.use(publicSeoRoutes);
  return app;
}

describe('robots e sitemap por ambiente', () => {
  beforeEach(() => {
    process.env.APP_ENV = 'production';
    serviceMocks.listPublishedMaterialSlugs.mockReset();
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
    expect(serviceMocks.listPublishedMaterialSlugs).not.toHaveBeenCalled();
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
    serviceMocks.listPublishedMaterialSlugs.mockResolvedValue([
      { slug: 'aventura-a', updated_at: new Date('2026-07-29T12:00:00.000Z') },
      { slug: 'mapa-b', updated_at: new Date('2026-07-28T12:00:00.000Z') },
    ]);
    const response = await request(makeApp()).get('/sitemap.xml');

    expect(response.status).toBe(200);
    expect(response.type).toMatch(/application\/xml/);
    expect(serviceMocks.listPublishedMaterialSlugs).toHaveBeenCalledOnce();
    expect(response.text).toContain('<loc>https://downloads.artificiorpg.com/materiais/aventura-a</loc>');
    expect(response.text).toContain('<loc>https://downloads.artificiorpg.com/materiais/mapa-b</loc>');
  });

  it('devolve 503 não cacheável quando sitemap não pode consultar o banco', async () => {
    serviceMocks.listPublishedMaterialSlugs.mockRejectedValue(new Error('db unavailable'));
    const response = await request(makeApp()).get('/sitemap.xml');

    expect(response.status).toBe(503);
    expect(response.headers['retry-after']).toBe('60');
    expect(response.headers['cache-control']).toBe('no-store');
  });
});
