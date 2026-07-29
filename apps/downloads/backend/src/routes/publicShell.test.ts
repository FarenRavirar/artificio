import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  readFile: vi.fn(),
  stat: vi.fn(),
  findPublishedMaterialBySlug: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({ readFile: mocks.readFile, stat: mocks.stat }));
vi.mock('../services/publicMaterial', () => ({
  findPublishedMaterialBySlug: mocks.findPublishedMaterialBySlug,
}));

import publicShellRoutes from './publicShell';

const INDEX_HTML = `<!doctype html><html><head>
<title>Genérico</title>
<meta name="description" content="genérica">
<link rel="canonical" href="https://example.invalid/">
<meta property="og:type" content="website">
<meta property="og:title" content="Genérico">
<meta property="og:image" content="https://example.invalid/old.png">
<meta name="twitter:card" content="summary">
</head><body><div id="root"></div><script src="/assets/app.js"></script></body></html>`;

const MATERIAL = {
  id: 'material-1',
  slug: 'guia-hostil',
  title: 'Guia "D&D" <avançado>',
  summary: 'Resumo & conteúdo público.',
  description: 'Descrição longa.',
  cover_image_url: 'https://cdn.example/capa.png',
  updated_at: new Date('2026-07-29T12:00:00.000Z'),
};

function makeApp() {
  const app = express();
  app.use(publicShellRoutes);
  return app;
}

function count(body: string, pattern: RegExp): number {
  return body.match(pattern)?.length ?? 0;
}

describe('shell HTML público de material', () => {
  beforeEach(() => {
    process.env.APP_ENV = 'production';
    mocks.readFile.mockReset().mockResolvedValue(INDEX_HTML);
    mocks.stat.mockReset().mockResolvedValue({ mtimeMs: Date.parse('2026-07-29T10:00:00.000Z') });
    mocks.findPublishedMaterialBySlug.mockReset().mockResolvedValue(MATERIAL);
  });

  it('serve o mesmo head completo para humano e crawler, sem tags duplicadas', async () => {
    const app = makeApp();
    const human = await request(app).get('/materiais/guia-hostil');
    const crawler = await request(app).get('/materiais/guia-hostil').set('User-Agent', 'facebookexternalhit/1.1');

    expect(human.status).toBe(200);
    expect(crawler.status).toBe(200);
    expect(crawler.text).toBe(human.text);
    expect(human.headers.vary).toBeUndefined();
    expect(human.text).toContain('<div id="root"></div><script src="/assets/app.js"></script>');
    expect(human.text).toContain('Guia &quot;D&amp;D&quot; &lt;avançado&gt;');
    expect(human.text).not.toContain('<avançado>');
    expect(human.text).toContain('https://downloads.artificiorpg.com/materiais/guia-hostil');
    expect(human.text).toContain('https://cdn.example/capa.png');
    expect(human.text).not.toContain('og:image:width');
    const singularTags = [
      /<title>/g,
      /name="description"/g,
      /rel="canonical"/g,
      /property="og:type"/g,
      /property="og:title"/g,
      /property="og:description"/g,
      /property="og:url"/g,
      /property="og:image"/g,
      /property="og:image:alt"/g,
      /property="og:site_name"/g,
      /property="og:locale"/g,
      /name="twitter:card"/g,
      /name="twitter:title"/g,
      /name="twitter:description"/g,
      /name="twitter:image"/g,
    ];
    for (const tag of singularTags) expect(count(human.text, tag)).toBe(1);
    expect(human.text).toContain('<meta property="og:type" content="website">');
    expect(human.text).toContain('<meta property="og:locale" content="pt_BR">');
  });

  it('declara dimensões somente para o fallback próprio', async () => {
    mocks.findPublishedMaterialBySlug.mockResolvedValue({ ...MATERIAL, cover_image_url: null });
    const response = await request(makeApp()).get('/materiais/guia-hostil');

    expect(response.text).toContain('https://downloads.artificiorpg.com/og-default.png');
    expect(response.text).toContain('<meta property="og:image:width" content="1200">');
    expect(response.text).toContain('<meta property="og:image:height" content="630">');
    expect(response.text).toContain('<meta property="og:image:alt"');
  });

  it('emite noindex no shell de beta', async () => {
    process.env.APP_ENV = 'beta';
    const response = await request(makeApp()).get('/materiais/guia-hostil');
    expect(response.text).toContain('<meta name="robots" content="noindex,nofollow">');
  });

  it('devolve 404 real e não expõe metadata quando material não é público', async () => {
    mocks.findPublishedMaterialBySlug.mockResolvedValue(undefined);
    const response = await request(makeApp()).get('/materiais/rascunho-secreto');

    expect(response.status).toBe(404);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers['x-robots-tag']).toBe('noindex, nofollow');
    expect(response.text).toContain('Material não encontrado');
    expect(response.text).not.toContain(MATERIAL.summary);
  });

  it.each(['inexistente', 'rascunho', 'rejeitado', 'retirado'])(
    'não diferencia conteúdo indisponível no shell: %s',
    async (slug) => {
      mocks.findPublishedMaterialBySlug.mockResolvedValue(undefined);
      const response = await request(makeApp()).get(`/materiais/${slug}`);

      expect(response.status).toBe(404);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.text).not.toContain(MATERIAL.title);
    },
  );

  it('devolve 503 não cacheável quando banco falha', async () => {
    mocks.findPublishedMaterialBySlug.mockRejectedValue(new Error('db unavailable'));
    const response = await request(makeApp()).get('/materiais/guia-hostil');

    expect(response.status).toBe(503);
    expect(response.headers['retry-after']).toBe('60');
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers['x-robots-tag']).toBe('noindex, nofollow');
    expect(response.text).toContain('Serviço indisponível');
    expect(response.text).not.toContain(MATERIAL.title);
  });

  it('mantém HEAD coerente e suporta revalidação por ETag', async () => {
    const app = makeApp();
    const first = await request(app).get('/materiais/guia-hostil');
    const head = await request(app).head('/materiais/guia-hostil');
    const cached = await request(app).get('/materiais/guia-hostil').set('If-None-Match', first.headers.etag);

    expect(head.status).toBe(200);
    expect(head.text).toBeUndefined();
    expect(head.headers.etag).toBe(first.headers.etag);
    expect(head.headers['last-modified']).toBe(first.headers['last-modified']);
    expect(cached.status).toBe(304);
  });
});
