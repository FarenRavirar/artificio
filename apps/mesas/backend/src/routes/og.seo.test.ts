import express from 'express';
import request from 'supertest';

/**
 * T1.2/T1.3 (spec 102) — status HTTP do SSR que o crawler lê.
 *
 * ## Por que este arquivo existe
 *
 * `routes/og.ts` é a rota que serve HTML para Googlebot, WhatsApp e Discord, e
 * **não tinha teste nenhum** até esta spec. Ela respondia `200` para todo slug
 * que não resolvesse — inexistente, rascunho ou mesa expirada —, servindo um
 * corpo "Mesa não encontrada" com `<link rel=canonical>` auto-referente.
 *
 * Isso é soft-404, e o efeito não é só "não indexa": o Google mantém a URL na
 * fila de rastreamento, gastando crawl budget do domínio em páginas que nunca
 * vão entrar no índice. Medido em produção (2026-09-11): 51 das 92 URLs de mesa
 * do sitemap nesse estado, que é a origem das 736 páginas em "Rastreada, mas
 * não indexada" que abriu esta spec.
 *
 * Os testes abaixo travam as três coisas que a correção garante: o status certo
 * por estado da mesa, a ausência de canonical na resposta de erro, e o corpo
 * continuar sendo o app (status de erro e página útil não são excludentes).
 */
const dbMocks = vi.hoisted(() => ({
  executeTakeFirst: vi.fn(),
  selectFrom: vi.fn(),
}));

vi.mock('../db/index.js', () => ({
  db: { selectFrom: dbMocks.selectFrom },
}));

vi.mock('../services/systemCatalogProvider.js', () => ({
  hydrateTableSystemFields: vi.fn(async (tables: unknown[]) => tables),
}));

// O HTML real vem de `INDEX_HTML_PATH`, que só existe na imagem de produção.
// O stub carrega os marcadores que o teste inspeciona: `<title>` (que
// `injectMetaTags` substitui pelo bloco de meta) e uma âncora de corpo, para
// provar que o app continua sendo servido junto com o status de erro.
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(async () =>
    '<!doctype html><html><head><title>Artifício Mesas</title></head><body><div id="root"></div><script src="/app.js"></script></body></html>',
  ),
}));

import ogRoutes from './og.js';

function makeQueryBuilder() {
  return {
    innerJoin: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    executeTakeFirst: dbMocks.executeTakeFirst,
  };
}

function makeApp() {
  const app = express();
  app.use('/og', ogRoutes);
  return app;
}

const DIA_MS = 24 * 60 * 60 * 1000;

const mesaVisivel = {
  slug: 'mesa-publica',
  title: 'Mesa pública',
  description: 'Uma campanha longa.',
  banner_url: null,
  cover_url: null,
  status: 'active',
  archived_at: null,
  origin: 'manual',
  created_at: new Date(Date.now() - DIA_MS),
  starts_at: null,
  listing_excerpt: null,
  synopsis: null,
  synopsis_narrative: null,
  system_id: null,
  gm_display_name: 'Mestre',
};

// Importada criada há 6 dias: passou do limite de 5 dias, logo expirada.
const mesaExpirada = {
  ...mesaVisivel,
  slug: 'mesa-expirada',
  title: 'Mesa expirada',
  origin: 'imported',
  created_at: new Date(Date.now() - 6 * DIA_MS),
};

describe('GET /og/mesas/:slug — status HTTP para o crawler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.selectFrom.mockImplementation(() => makeQueryBuilder());
  });

  it('devolve 200 para mesa pública', async () => {
    dbMocks.executeTakeFirst.mockResolvedValue(mesaVisivel);

    const response = await request(makeApp()).get('/og/mesas/mesa-publica');

    expect(response.status).toBe(200);
    // Página que existe MANTÉM canonical — a remoção é exceção do caminho de
    // erro, não o novo padrão.
    expect(response.text).toContain('<link rel="canonical"');
  });

  // Falha de banco caía no fallback devolvendo 200 com canonical auto-referente — o mesmo
  // soft-404 que esta spec corrige, só que disparado por indisponibilidade (achado de
  // review, PR #315). 503 diz "tente de novo" sem convidar o Google a indexar o erro.
  it('devolve 503 sem canonical quando a consulta falha', async () => {
    dbMocks.executeTakeFirst.mockRejectedValue(new Error('DB fora do ar'));

    const response = await request(makeApp()).get('/og/mesas/mesa-publica');

    expect(response.status).toBe(503);
    expect(response.text).not.toContain('<link rel="canonical"');
  });

  it('devolve 404 para slug que nunca existiu', async () => {
    dbMocks.executeTakeFirst.mockResolvedValue(undefined);

    const response = await request(makeApp()).get('/og/mesas/isto-nao-existe-zzz999');

    expect(response.status).toBe(404);
  });

  // O ramo que motivou a spec: estas devolviam 200 e eram 51 das 92 URLs
  // anunciadas no sitemap.
  it.each([
    ['importada expirada', mesaExpirada],
    ['arquivada', { ...mesaVisivel, archived_at: new Date() }],
    ['encerrada (ended)', { ...mesaVisivel, status: 'ended' }],
    ['cancelada', { ...mesaVisivel, status: 'cancelled' }],
  ])('devolve 410 para mesa %s', async (_label, table) => {
    dbMocks.executeTakeFirst.mockResolvedValue(table);

    const response = await request(makeApp()).get(`/og/mesas/${table.slug}`);

    expect(response.status).toBe(410);
  });

  // Rascunho é 404 e não 410: `410` afirmaria que a mesa existiu publicamente,
  // confirmando a existência do rascunho a quem chutou a URL.
  it.each([
    ['rascunho', 'draft'],
    ['em revisão', 'pending_review'],
  ])('devolve 404 para mesa %s (nunca foi pública)', async (_label, status) => {
    dbMocks.executeTakeFirst.mockResolvedValue({ ...mesaVisivel, status });

    const response = await request(makeApp()).get('/og/mesas/mesa-publica');

    expect(response.status).toBe(404);
  });

  // Mesa lotada segue pública e indexável — só não aceita mais gente.
  it('devolve 200 para mesa lotada (full)', async () => {
    dbMocks.executeTakeFirst.mockResolvedValue({ ...mesaVisivel, status: 'full' });

    const response = await request(makeApp()).get('/og/mesas/mesa-publica');

    expect(response.status).toBe(200);
  });

  it.each([
    ['410 de mesa encerrada', mesaExpirada, 410],
    ['404 de slug inexistente', undefined, 404],
  ])('não emite canonical auto-referente no %s', async (_label, table, esperado) => {
    dbMocks.executeTakeFirst.mockResolvedValue(table);

    const response = await request(makeApp()).get('/og/mesas/qualquer-slug');

    expect(response.status).toBe(esperado);
    // Canonical numa página removida reafirma ao índice a URL que o status
    // manda esquecer — é o pior dos dois mundos.
    expect(response.text).not.toContain('rel="canonical"');
  });

  it('410 identifica a mesa pelo título e serve o app, não uma página seca', async () => {
    dbMocks.executeTakeFirst.mockResolvedValue(mesaExpirada);

    const response = await request(makeApp()).get('/og/mesas/mesa-expirada');

    expect(response.status).toBe(410);
    // A pessoa que clicou num link antigo no WhatsApp precisa reconhecer O QUE
    // procurava — "página não encontrada" genérico não diz nada.
    expect(response.text).toContain('Mesa expirada');
    // E o corpo continua sendo o app: é ele que monta a tela "Mesa Encerrada"
    // com data e conversa preservada, a partir do 410 da API.
    expect(response.text).toContain('<div id="root">');
  });
});

describe('GET /og/mestre/:slug — status HTTP para o crawler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.selectFrom.mockImplementation(() => makeQueryBuilder());
  });

  it('devolve 200 para mestre existente', async () => {
    dbMocks.executeTakeFirst.mockResolvedValue({
      display_name: 'Mestre Fulano',
      bio_long: null,
      tagline: null,
      avatar_url: null,
      banner_url: null,
      slug: 'mestre-fulano',
    });

    const response = await request(makeApp()).get('/og/mestre/mestre-fulano');

    expect(response.status).toBe(200);
  });

  // Perfil não tem estado "encerrado" — ou o slug existe, ou nunca existiu —,
  // então aqui só há 404, sem 410.
  it('devolve 404 (não 200) para mestre inexistente, sem canonical', async () => {
    dbMocks.executeTakeFirst.mockResolvedValue(undefined);

    const response = await request(makeApp()).get('/og/mestre/nao-existe-zzz');

    expect(response.status).toBe(404);
    expect(response.text).not.toContain('rel="canonical"');
  });
});
