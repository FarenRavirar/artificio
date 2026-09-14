// Guard de escrita do canonical (spec 102, achado P2 do Codex na PR #320).
//
// ## O defeito que este teste trava
//
// `normalizeCanonical` valida FORMA — protocolo, host permitido, credencial embutida,
// barra final. Ela nunca validou para ONDE o canonical aponta: medido em 2026-09-14,
// aceitava `https://artificiorpg.com/blog/OUTRO-POST/` e `https://artificiorpg.com/x/`.
//
// O admin barrava domínio externo e deixava passar exatamente a forma que tirou 105 dos
// 126 posts do índice do Google (spec 102 F3): uma página apontando para OUTRA página do
// próprio site, dizendo ao buscador "o original não sou eu". Nenhum erro aparecia, a
// página abria normal no navegador, e o dano acontecia inteiro dentro do índice.
//
// Por que teste e não só o guard de CI: `scripts/ci/check_post_canonical.mjs` lê o
// `posts.json` VERSIONADO (seed de 8 posts) e o CI nunca roda o export do banco — um
// canonical divergente salvo pelo admin não é alcançado por ele. O caminho de escrita é
// o único ponto onde o valor errado pode ser barrado antes de virar dado.

import express, { type NextFunction, type Request, type Response } from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';

const postsMocks = vi.hoisted(() => ({
  // O parâmetro é declarado E USADO. Declarado porque o teste do caso "canonical vazio"
  // inspeciona o que foi gravado, e sem o tipo `mock.calls[0][0]` é tupla vazia para o
  // TypeScript (`tsc --noEmit` quebra). Usado porque não há `argsIgnorePattern` na
  // config do site: um `_write` só declarado vira erro de `no-unused-vars` no lint —
  // e as duas checagens rodam no mesmo job do CI.
  createPost: vi.fn(async (write: Record<string, unknown>) => (write ? 1 : 1)),
  updatePost: vi.fn(async () => undefined),
  getPost: vi.fn(async () => ({ id: 1, slug: 'meu-post', status: 'draft', author_id: null })),
  setPostTaxonomies: vi.fn(async () => undefined),
  slugExists: vi.fn(async () => false),
}));

const pagesMocks = vi.hoisted(() => ({
  createPage: vi.fn(async () => 2),
  updatePage: vi.fn(async () => undefined),
  getPage: vi.fn(async () => ({ id: 2, slug: 'sobre', status: 'draft', author_id: null })),
  pageSlugExists: vi.fn(async () => false),
}));

// `maybeRebuild` chama `runJob`, que dispara o rebuild do SSG. Num teste de validação
// isso seria efeito externo puro — o que está sob prova é o 400, não o rebuild.
const jobsMocks = vi.hoisted(() => ({
  runJob: vi.fn(() => ({ started: false })),
  jobState: vi.fn(() => ({ running: false })),
}));

vi.mock('../db/repo/posts.js', () => postsMocks);
vi.mock('../db/repo/pages.js', () => pagesMocks);
vi.mock('./jobs.js', () => jobsMocks);

import { adminApi } from './admin-api';

const servers: Array<ReturnType<ReturnType<typeof express>['listen']>> = [];
const pass = (_req: Request, _res: Response, next: NextFunction) => next();

async function call(path: string, body: Record<string, unknown>, method = 'POST') {
  const app = express();
  app.use(express.json());
  app.use(adminApi(pass, pass));
  const server = app.listen(0);
  servers.push(server);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('test_server_address_missing');
  return fetch(`http://127.0.0.1:${address.port}${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

afterEach(async () => {
  vi.clearAllMocks();
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  })));
});

const post = (extra: Record<string, unknown>) => ({
  title: 'Meu post', slug: 'meu-post', content_html: '<p>x</p>', status: 'draft', ...extra,
});

describe('canonical no caminho de escrita do admin', () => {
  it('aceita canonical VAZIO — é o default correto, a página cai no auto-referente', async () => {
    const res = await call('/posts', post({ canonical: '' }));
    expect(res.status).toBe(201);
    expect(postsMocks.createPost).toHaveBeenCalledOnce();
    expect(postsMocks.createPost.mock.calls[0]?.[0]).toMatchObject({ canonical: null });
  });

  it('aceita canonical apontando para a PRÓPRIA página', async () => {
    const res = await call('/posts', post({ canonical: 'https://artificiorpg.com/blog/meu-post/' }));
    expect(res.status).toBe(201);
  });

  it('RECUSA canonical apontando para outro post — a forma dos 105 da T3.2', async () => {
    const res = await call('/posts', post({ canonical: 'https://artificiorpg.com/blog/outro-post/' }));
    expect(res.status).toBe(400);
    const corpo = await res.json();
    expect(corpo).toMatchObject({ error: 'bad_canonical' });
    expect(corpo.detail).toContain('/blog/meu-post/');
    expect(postsMocks.createPost).not.toHaveBeenCalled();
  });

  it('RECUSA canonical para caminho fora do blog', async () => {
    const res = await call('/posts', post({ canonical: 'https://artificiorpg.com/qualquer/coisa/' }));
    expect(res.status).toBe(400);
    expect(postsMocks.createPost).not.toHaveBeenCalled();
  });

  it('RECUSA query string — a página se declararia canônica para uma variante dela mesma', async () => {
    const res = await call('/posts', post({ canonical: 'https://artificiorpg.com/blog/meu-post/?utm_source=x' }));
    expect(res.status).toBe(400);
    const corpo = await res.json();
    expect(corpo.detail).toContain('query');
    expect(postsMocks.createPost).not.toHaveBeenCalled();
  });

  it('RECUSA host externo — comportamento que já existia, preservado', async () => {
    const res = await call('/posts', post({ canonical: 'https://outro-site.com/blog/meu-post/' }));
    expect(res.status).toBe(400);
    expect(postsMocks.createPost).not.toHaveBeenCalled();
  });

  it('valida contra o slug EFETIVO, não o digitado: colisão vira `meu-post-2`', async () => {
    // `uniqueSlug` devolve `meu-post-2` quando o slug já existe. O canonical que bate com
    // o slug DIGITADO passa a divergir da URL real — e é a URL real que o Google lê.
    postsMocks.slugExists.mockImplementationOnce(async () => true);
    const res = await call('/posts', post({ canonical: 'https://artificiorpg.com/blog/meu-post/' }));
    expect(res.status).toBe(400);
    const corpo = await res.json();
    expect(corpo.detail).toContain('/blog/meu-post-2/');
  });

  it('página institucional vive na raiz, sem o prefixo /blog/', async () => {
    const res = await call('/pages', {
      title: 'Sobre', slug: 'sobre', content_html: '<p>x</p>', status: 'draft',
      canonical: 'https://artificiorpg.com/sobre/',
    });
    expect(res.status).toBe(201);
  });

  it('RECUSA página institucional com canonical de post', async () => {
    const res = await call('/pages', {
      title: 'Sobre', slug: 'sobre', content_html: '<p>x</p>', status: 'draft',
      canonical: 'https://artificiorpg.com/blog/sobre/',
    });
    expect(res.status).toBe(400);
    expect(pagesMocks.createPage).not.toHaveBeenCalled();
  });
});
