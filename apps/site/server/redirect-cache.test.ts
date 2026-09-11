// Cobre os dois defeitos corrigidos na spec 102 F2/T2.1: match de barra final e query string
// descartada. Ambos faziam o 301 legado falhar justamente na forma que sobrevive em backlink.
import express from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const repoMocks = vi.hoisted(() => ({ listRedirects: vi.fn() }));
vi.mock('../db/repo/redirects.js', () => repoMocks);

import { lookupRedirect, reloadRedirects, withOriginalQuery } from './redirect-cache';

beforeEach(() => {
  repoMocks.listRedirects.mockReset();
});

describe('lookupRedirect — normalização de barra final', () => {
  it('resolve as duas formas quando a tabela grava COM barra', async () => {
    repoMocks.listRedirects.mockResolvedValue([
      { id: 1, from_path: '/noticias/x/', to_path: '/blog/x/', code: 301 },
    ]);
    await reloadRedirects();

    expect(lookupRedirect('/noticias/x/')?.to).toBe('/blog/x/');
    expect(lookupRedirect('/noticias/x')?.to).toBe('/blog/x/');
  });

  it('resolve as duas formas quando a tabela grava SEM barra', async () => {
    repoMocks.listRedirects.mockResolvedValue([
      { id: 1, from_path: '/dnd/y', to_path: '/blog/y/', code: 301 },
    ]);
    await reloadRedirects();

    expect(lookupRedirect('/dnd/y')?.to).toBe('/blog/y/');
    expect(lookupRedirect('/dnd/y/')?.to).toBe('/blog/y/');
  });

  it('não confunde a raiz com string vazia', async () => {
    repoMocks.listRedirects.mockResolvedValue([
      { id: 1, from_path: '/', to_path: '/blog/', code: 301 },
    ]);
    await reloadRedirects();

    expect(lookupRedirect('/')?.to).toBe('/blog/');
    expect(lookupRedirect('')).toBeUndefined();
  });

  it('não casa caminho não cadastrado', async () => {
    repoMocks.listRedirects.mockResolvedValue([
      { id: 1, from_path: '/noticias/x/', to_path: '/blog/x/', code: 301 },
    ]);
    await reloadRedirects();

    expect(lookupRedirect('/noticias/outro')).toBeUndefined();
  });

  it('usa 301 quando a linha não traz code', async () => {
    repoMocks.listRedirects.mockResolvedValue([
      { id: 1, from_path: '/a/', to_path: '/blog/a/', code: 0 },
    ]);
    await reloadRedirects();

    expect(lookupRedirect('/a/')?.code).toBe(301);
  });
});

describe('withOriginalQuery', () => {
  it('mantém o destino quando a origem não tem query', () => {
    expect(withOriginalQuery('/blog/x/', '/noticias/x/')).toBe('/blog/x/');
  });

  it('anexa a query da origem ao destino', () => {
    expect(withOriginalQuery('/blog/x/', '/noticias/x/?utm_source=fb&utm_medium=social'))
      .toBe('/blog/x/?utm_source=fb&utm_medium=social');
  });

  it('mescla sem duplicar chave, com o destino vencendo', () => {
    expect(withOriginalQuery('/blog/x/?ref=interno', '/noticias/x/?ref=externo&utm_source=fb'))
      .toBe('/blog/x/?ref=interno&utm_source=fb');
  });

  it('preserva o fragmento do destino depois da query', () => {
    expect(withOriginalQuery('/blog/x/#comentarios', '/noticias/x/?utm_source=fb'))
      .toBe('/blog/x/?utm_source=fb#comentarios');
  });

  it('ignora "?" sem conteúdo', () => {
    expect(withOriginalQuery('/blog/x/', '/noticias/x/?')).toBe('/blog/x/');
  });
});

describe('middleware de redirect (integração)', () => {
  async function app() {
    repoMocks.listRedirects.mockResolvedValue([
      { id: 1, from_path: '/noticias/x/', to_path: '/blog/x/', code: 301 },
    ]);
    await reloadRedirects();

    const server = express();
    server.use((req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next();
      const hit = lookupRedirect(req.path);
      if (hit && hit.to !== req.path) {
        res.redirect(hit.code, withOriginalQuery(hit.to, req.originalUrl));
        return;
      }
      next();
    });
    server.get('/blog/x/', (_req, res) => { res.status(200).send('ok'); });
    return server;
  }

  async function get(server: express.Express, url: string) {
    const http = await import('node:http');
    const listener = http.createServer(server);
    await new Promise<void>((resolve) => listener.listen(0, resolve));
    const address = listener.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    const res = await fetch(`http://127.0.0.1:${port}${url}`, { redirect: 'manual' });
    listener.close();
    return res;
  }

  it('301 com barra final', async () => {
    const res = await get(await app(), '/noticias/x/');
    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe('/blog/x/');
  });

  it('301 sem barra final', async () => {
    const res = await get(await app(), '/noticias/x');
    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe('/blog/x/');
  });

  it('301 preservando UTM', async () => {
    const res = await get(await app(), '/noticias/x/?utm_source=fb&utm_medium=social');
    expect(res.status).toBe(301);
    const location = res.headers.get('location') ?? '';
    expect(location).toContain('utm_source=fb');
    expect(location).toContain('utm_medium=social');
  });

  it('POST não redireciona', async () => {
    const server = await app();
    const http = await import('node:http');
    const listener = http.createServer(server);
    await new Promise<void>((resolve) => listener.listen(0, resolve));
    const address = listener.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    const res = await fetch(`http://127.0.0.1:${port}/noticias/x/`, { method: 'POST', redirect: 'manual' });
    listener.close();
    expect(res.status).not.toBe(301);
  });
});
