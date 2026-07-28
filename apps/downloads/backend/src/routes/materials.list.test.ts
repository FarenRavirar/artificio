import request from 'supertest';
import express from 'express';

// T4.3 (spec 073) — teste de integracao da listagem publica: filtro,
// paginacao e que so material publicado aparece.

const dbMocks = vi.hoisted(() => ({
  selectFrom: vi.fn(),
  insertInto: vi.fn(),
}));

const catalogMocks = vi.hoisted(() => ({
  loadCatalogSystemsFlat: vi.fn(),
  loadCatalogMaterialTypes: vi.fn(),
  getCatalogMaterialTypeById: vi.fn(),
  getCatalogNodeById: vi.fn(),
  // Spec 087 (achado de review PR #214) — busca textual passa a casar tambem
  // nome de sistema, resolvido no snapshot do Catalogo Central.
  matchTaxonomyIdsByName: vi.fn(),
}));

vi.mock('../db', () => ({
  db: {
    selectFrom: dbMocks.selectFrom,
    insertInto: dbMocks.insertInto,
  },
}));

vi.mock('../middleware/auth', () => ({
  authMiddleware: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    (req as express.Request & { user: { userId: string; role: string } }).user = { userId: 'user-1', role: 'user' };
    next();
  },
}));

vi.mock('../services/catalogClient', () => catalogMocks);

// Spec 087 (T1B.6) — metricas de curadoria vivem em services/materialMetrics
// (Bayesian average + corte de elegibilidade). Aqui elas sao mockadas pra
// testar o CONTRATO da rota; o comportamento da formula em si tem suite
// propria em services/materialMetrics.test.ts.
const metricsMocks = vi.hoisted(() => ({
  loadRatingAggregates: vi.fn(),
  loadPopularityScores: vi.fn(),
  loadTrendingOrder: vi.fn(),
  loadRatingOrder: vi.fn(),
  registerMaterialView: vi.fn(),
  invalidateCatalogAnchorCache: vi.fn(),
}));

vi.mock('../services/materialMetrics', () => metricsMocks);

import materialsRoutes from './materials';

function app() {
  const server = express();
  server.use(express.json());
  server.use('/api/v1/materials', materialsRoutes);
  return server;
}

function makeQueryBuilder(items: unknown[], count: number) {
  const builder: Record<string, unknown> = {};
  builder.where = vi.fn().mockReturnValue(builder);
  builder.select = vi.fn((selector) => {
    if (typeof selector === 'function') {
      // count select vem via ({ fn }) => [fn.countAll().as('count')]
      builder.executeTakeFirstOrThrow = vi.fn().mockResolvedValue({ count });
    }
    return builder;
  });
  builder.leftJoin = vi.fn().mockReturnValue(builder);
  builder.innerJoin = vi.fn().mockReturnValue(builder);
  builder.groupBy = vi.fn().mockReturnValue(builder);
  builder.orderBy = vi.fn().mockReturnValue(builder);
  // `sort=popular` monta uma subquery agregada e a nomeia com `.as(...)`
  // (materials.ts, join de download_metric_daily). Sem isto o stub estoura
  // com "`.as` is not a function" — gap descoberto ao cobrir os sorts antigos
  // pela primeira vez (spec 087 T1B.6; a suíte original nunca exercitou
  // `sort=popular`).
  builder.as = vi.fn().mockReturnValue(builder);
  builder.having = vi.fn().mockReturnValue(builder);
  builder.limit = vi.fn().mockReturnValue(builder);
  builder.offset = vi.fn().mockReturnValue(builder);
  builder.execute = vi.fn().mockResolvedValue(items);
  builder.executeTakeFirstOrThrow = vi.fn().mockResolvedValue({ count });
  return builder;
}

describe('GET /api/v1/materials — listagem publica', () => {
  beforeEach(() => {
    dbMocks.selectFrom.mockReset();
    dbMocks.insertInto.mockReset();
    catalogMocks.loadCatalogSystemsFlat.mockReset();
    catalogMocks.loadCatalogSystemsFlat.mockResolvedValue([]);
    catalogMocks.loadCatalogMaterialTypes.mockReset();
    catalogMocks.loadCatalogMaterialTypes.mockResolvedValue([]);
    catalogMocks.getCatalogMaterialTypeById.mockReset();
    catalogMocks.getCatalogNodeById.mockReset();
    catalogMocks.matchTaxonomyIdsByName.mockReset();
    catalogMocks.matchTaxonomyIdsByName.mockResolvedValue([]);
    metricsMocks.loadRatingAggregates.mockReset();
    metricsMocks.loadRatingAggregates.mockResolvedValue(new Map());
    metricsMocks.loadPopularityScores.mockReset();
    metricsMocks.loadPopularityScores.mockResolvedValue(new Map());
    metricsMocks.loadTrendingOrder.mockReset();
    metricsMocks.loadTrendingOrder.mockResolvedValue([]);
    metricsMocks.loadRatingOrder.mockReset();
    metricsMocks.loadRatingOrder.mockResolvedValue([]);
    metricsMocks.registerMaterialView.mockReset();
    metricsMocks.registerMaterialView.mockResolvedValue(true);
  });

  it('retorna metadata opcional sem perder material sem metadata', async () => {
    const items = [{
      id: 'm1', slug: 'material-1', title: 'Material 1', editorial_state: 'published',
      system_id: null, edition_id: null, cover_image_url: null, credits: null, scenario: null,
    }];
    const builder = makeQueryBuilder(items, 1);
    dbMocks.selectFrom.mockReturnValue(builder);

    const response = await request(app())
      .get('/api/v1/materials')
      .query({ page: 1, page_size: 20 })
      .expect(200);

    // Spec 087 (Requisito 14) — a listagem passa a expor avg_rating/
    // rating_count/popularity_score. Sem dado de metrica, os 3 saem no estado
    // "sem informacao" (null/0), nunca ausentes: o schema Zod do frontend
    // valida o shape completo.
    expect(response.body.items).toEqual([{
      ...items[0],
      taxonomy_chain: [],
      avg_rating: null,
      rating_count: 0,
      popularity_score: null,
    }]);
    expect(response.body.total).toBe(1);
    expect(response.body.page).toBe(1);
    expect(builder.leftJoin).toHaveBeenCalledWith(
      'download_material_metadata',
      'download_material_metadata.material_id',
      'download_material.id',
    );
    expect(response.body.items[0]).toMatchObject({ cover_image_url: null, credits: null, scenario: null });
  });

  it('rejeita page_size acima do maximo', async () => {
    dbMocks.selectFrom.mockReturnValue(makeQueryBuilder([], 0));

    const response = await request(app())
      .get('/api/v1/materials')
      .query({ page_size: 999 })
      .expect(400);

    expect(response.body.error).toMatch(/inválidos/i);
  });

  it('aceita filtro de busca textual e material_type canônico', async () => {
    const builder = makeQueryBuilder([], 0);
    dbMocks.selectFrom.mockReturnValue(builder);

    await request(app())
      .get('/api/v1/materials')
      .query({ q: 'aventura', material_type: 'b071ab5e-2d16-4c58-8f0e-086000000001' })
      .expect(200);

    expect(builder.where).toHaveBeenCalled();
  });

  it('filtra editora e autoria por chave antes de contar e paginar', async () => {
    const builder = makeQueryBuilder([], 0);
    dbMocks.selectFrom.mockReturnValue(builder);

    await request(app()).get('/api/v1/materials').query({
      publisher: 'Grimórios & Dados Editora',
      author: 'Ágata',
      page: 2,
    }).expect(200);

    expect(builder.leftJoin).toHaveBeenCalledBefore(builder.select as ReturnType<typeof vi.fn>);
    expect(builder.where).toHaveBeenCalledWith('download_material_metadata.publisher_key', '=', 'grimorios e dados');
    expect(builder.where).toHaveBeenCalledWith('download_material_metadata.author_keys', '@>', ['agata']);
    expect(builder.where).toHaveBeenCalledTimes(3);
    expect(builder.offset).toHaveBeenCalledWith(20);
  });

  it('rejeita faceta que normaliza para chave vazia em vez de ignorar o filtro', async () => {
    dbMocks.selectFrom.mockReturnValue(makeQueryBuilder([], 0));
    const response = await request(app()).get('/api/v1/materials').query({ publisher: 'Editora' }).expect(400);

    expect(response.body.error).toMatch(/inválidos/i);
  });

  // Achado de review PR #214 (Codex, P2): o placeholder prometia busca por
  // "título, autor ou sistema" mas a query so cobria title/summary.
  it('busca textual consulta a taxonomia pelo termo, para casar nome de sistema', async () => {
    const builder = makeQueryBuilder([], 0);
    dbMocks.selectFrom.mockReturnValue(builder);
    catalogMocks.matchTaxonomyIdsByName.mockResolvedValue(['sys-dnd']);

    await request(app())
      .get('/api/v1/materials')
      .query({ q: 'D&D' })
      .expect(200);

    expect(catalogMocks.matchTaxonomyIdsByName).toHaveBeenCalledWith('D&D');
  });

  // Sem termo de busca nao ha o que casar na taxonomia — evita ida inutil ao
  // snapshot em toda listagem sem `q` (a vitrine inteira cai nesse caso).
  it('não consulta a taxonomia quando não há termo de busca', async () => {
    const builder = makeQueryBuilder([], 0);
    dbMocks.selectFrom.mockReturnValue(builder);

    await request(app())
      .get('/api/v1/materials')
      .expect(200);

    expect(catalogMocks.matchTaxonomyIdsByName).not.toHaveBeenCalled();
  });

  // Catalogo Central fora do ar nao pode derrubar a busca: matchTaxonomyIdsByName
  // devolve [] e a listagem segue casando titulo/resumo/autor.
  it('responde 200 quando a taxonomia não devolve nenhum id para o termo', async () => {
    const builder = makeQueryBuilder([], 0);
    dbMocks.selectFrom.mockReturnValue(builder);
    catalogMocks.matchTaxonomyIdsByName.mockResolvedValue([]);

    await request(app())
      .get('/api/v1/materials')
      .query({ q: 'termo-sem-sistema' })
      .expect(200);

    expect(builder.where).toHaveBeenCalled();
  });

  it('resolve toda taxonomia da página com uma única leitura Central', async () => {
    const items = [
      { id: 'm1', system_id: 'sys', edition_id: 'ed' },
      { id: 'm2', system_id: 'sys', edition_id: 'var' },
    ];
    dbMocks.selectFrom.mockReturnValue(makeQueryBuilder(items, 2));
    catalogMocks.loadCatalogSystemsFlat.mockResolvedValue([
      { id: 'sys', parent_id: null, node_type: 'system', slug: 's', path_slug: 's', name: 'Sistema', name_pt: null, aliases: [] },
      { id: 'ed', parent_id: 'sys', node_type: 'edition', slug: 'e', path_slug: 's/e', name: 'Edição', name_pt: null, aliases: [] },
      { id: 'var', parent_id: 'ed', node_type: 'variant', slug: 'v', path_slug: 's/e/v', name: 'Variante', name_pt: null, aliases: [] },
    ]);

    const response = await request(app()).get('/api/v1/materials').expect(200);

    expect(catalogMocks.loadCatalogSystemsFlat).toHaveBeenCalledTimes(1);
    expect(response.body.items[1]).toMatchObject({
      system_name: 'Sistema', edition_name: 'Edição', variant_name: 'Variante', system_path_slug: 's/e/v',
    });
    expect(response.body.items[1].taxonomy_chain).toHaveLength(3);
  });

  it('mantém shape taxonômico completo quando o Central falha', async () => {
    const item = { id: 'm1', system_id: 'sys', edition_id: null };
    dbMocks.selectFrom.mockReturnValue(makeQueryBuilder([item], 1));
    catalogMocks.loadCatalogSystemsFlat.mockRejectedValue(new Error('catalog_503'));

    const response = await request(app()).get('/api/v1/materials').expect(200);

    expect(response.body.items).toEqual([{
      ...item,
      taxonomy_chain: [],
      system_name: null,
      edition_name: null,
      variant_name: null,
      system_path_slug: null,
      avg_rating: null,
      rating_count: 0,
      popularity_score: null,
    }]);
  });

  it('facets agrega somente linhas fornecidas como publicadas e resolve tipos no Central', async () => {
    const typeId = 'b071ab5e-2d16-4c58-8f0e-086000000001';
    dbMocks.selectFrom
      .mockReturnValueOnce(makeQueryBuilder([{ material_type_id: typeId, count: '2' }], 0))
      .mockReturnValueOnce(makeQueryBuilder([{ system_id: 'sys', count: '2' }], 0))
      .mockReturnValueOnce(makeQueryBuilder([{ edition_id: 'ed', count: '1' }], 0))
      .mockReturnValueOnce(makeQueryBuilder([{ value: 'grimorios e dados', label: 'Grimórios & Dados Editora', count: '2' }], 0))
      .mockReturnValueOnce(makeQueryBuilder([
        { value: 'agata', label: 'Ágata', count: '2' },
        { value: 'bruno', label: 'Bruno', count: '1' },
      ], 0));
    catalogMocks.loadCatalogMaterialTypes.mockResolvedValue([
      { id: typeId, slug: 'aventura', name: 'Aventura', aliases: ['adventure'], status: 'active' },
    ]);

    const response = await request(app()).get('/api/v1/materials/facets').expect(200);

    expect(response.body).toEqual({
      material_types: [{ id: typeId, slug: 'aventura', name: 'Aventura', count: 2 }],
      systems: [{ id: 'sys', count: 2 }],
      editions: [{ id: 'ed', count: 1 }],
      publishers: [{ value: 'grimorios e dados', label: 'Grimórios & Dados Editora', count: 2 }],
      authors: [
        { value: 'agata', label: 'Ágata', count: 2 },
        { value: 'bruno', label: 'Bruno', count: 1 },
      ],
    });
    for (const builder of dbMocks.selectFrom.mock.results.slice(0, 4).map((result) => result.value)) {
      expect(builder.where).toHaveBeenCalledWith('editorial_state', '=', 'published');
    }
    const authorFacetSource = dbMocks.selectFrom.mock.calls[4][0] as (eb: {
      selectFrom: ReturnType<typeof vi.fn>;
    }) => unknown;
    const authorFacetInnerBuilder = makeQueryBuilder([], 0);
    authorFacetSource({ selectFrom: vi.fn().mockReturnValue(authorFacetInnerBuilder) });
    expect(authorFacetInnerBuilder.where).toHaveBeenCalledWith('editorial_state', '=', 'published');
  });

  it('expõe sistemas/edições do Central achatados para a sidebar de filtro (T8.1)', async () => {
    catalogMocks.loadCatalogSystemsFlat.mockResolvedValue([
      { id: 'sys-1', name: 'Warhammer', name_pt: null, slug: 'warhammer', path_slug: 'warhammer', node_type: 'system', parent_id: null, aliases: [] },
      { id: 'ed-1', name: 'Fourth Edition', name_pt: 'Quarta Edição', slug: 'fourth-edition', path_slug: 'warhammer/fourth-edition', node_type: 'edition', parent_id: 'sys-1', aliases: [] },
    ]);

    const response = await request(app()).get('/api/v1/materials/catalog-systems').expect(200);

    expect(response.body).toEqual({
      items: [
        { id: 'sys-1', name: 'Warhammer', slug: 'warhammer', node_type: 'system', parent_id: null },
        { id: 'ed-1', name: 'Quarta Edição', slug: 'fourth-edition', node_type: 'edition', parent_id: 'sys-1' },
      ],
    });
  });

  it('catalog-systems devolve 503 quando o Central falha', async () => {
    catalogMocks.loadCatalogSystemsFlat.mockRejectedValue(new Error('catalog_503'));

    await request(app()).get('/api/v1/materials/catalog-systems').expect(503);
  });

  it('expõe vocabulário Central para o formulário sem lista hardcoded', async () => {
    const active = {
      id: 'b071ab5e-2d16-4c58-8f0e-086000000001',
      slug: 'aventura', name: 'Aventura', aliases: ['adventure'], status: 'active',
    };
    catalogMocks.loadCatalogMaterialTypes.mockResolvedValue([
      active,
      { ...active, id: 'b071ab5e-2d16-4c58-8f0e-086000000002', status: 'rejected' },
    ]);

    const response = await request(app()).get('/api/v1/materials/types').expect(200);

    expect(response.body).toEqual({ items: [active] });
    expect(catalogMocks.loadCatalogMaterialTypes).toHaveBeenCalledTimes(1);
  });

  it('cria rascunho usando ID e nome validados pelo Central', async () => {
    const typeId = 'b071ab5e-2d16-4c58-8f0e-086000000001';
    catalogMocks.getCatalogMaterialTypeById.mockResolvedValue({
      id: typeId, slug: 'aventura', name: 'Aventura', aliases: ['adventure'], status: 'active',
    });
    const insert = {
      values: vi.fn().mockReturnThis(),
      returningAll: vi.fn().mockReturnThis(),
      executeTakeFirstOrThrow: vi.fn().mockResolvedValue({ id: 'material-1' }),
    };
    dbMocks.insertInto.mockReturnValue(insert);

    await request(app()).post('/api/v1/materials').send({
      slug: 'meu-material', title: 'Meu material', material_type_id: typeId,
    }).expect(201);

    expect(insert.values).toHaveBeenCalledWith(expect.objectContaining({
      material_type_id: typeId,
      material_type: 'Aventura',
    }));
  });

  it('rejeita material_type livre e ID Central inexistente', async () => {
    await request(app()).post('/api/v1/materials').send({
      slug: 'livre', title: 'Livre', material_type: 'aventura inventada',
    }).expect(400);

    catalogMocks.getCatalogMaterialTypeById.mockResolvedValue(null);
    await request(app()).post('/api/v1/materials').send({
      slug: 'inexistente', title: 'Inexistente', material_type_id: 'b071ab5e-2d16-4c58-8f0e-086000000099',
    }).expect(400);
    expect(dbMocks.insertInto).not.toHaveBeenCalled();
  });

  it('rejeita tipo inativo e distingue indisponibilidade Central', async () => {
    const typeId = 'b071ab5e-2d16-4c58-8f0e-086000000001';
    catalogMocks.getCatalogMaterialTypeById.mockResolvedValue({
      id: typeId, slug: 'aventura', name: 'Aventura', aliases: [], status: 'rejected',
    });
    await request(app()).post('/api/v1/materials').send({
      slug: 'inativo', title: 'Inativo', material_type_id: typeId,
    }).expect(400);

    catalogMocks.getCatalogMaterialTypeById.mockRejectedValue(new Error('catalog_503'));
    const response = await request(app()).post('/api/v1/materials').send({
      slug: 'indisponivel', title: 'Indisponível', material_type_id: typeId,
    }).expect(503);
    expect(response.body).toEqual({ error: 'Catálogo de tipos de material indisponível.' });
    expect(dbMocks.insertInto).not.toHaveBeenCalled();
  });

  // ===== Spec 087, Fase 1B — metricas de curadoria =====

  it('expõe avg_rating ajustado com rating_count cru (Requisito 14)', async () => {
    dbMocks.selectFrom.mockReturnValue(makeQueryBuilder([{ id: 'm1', system_id: null, edition_id: null }], 1));
    metricsMocks.loadRatingAggregates.mockResolvedValue(new Map([['m1', { avgRating: 4.12, ratingCount: 12 }]]));

    const response = await request(app()).get('/api/v1/materials').expect(200);

    // Rating sai AJUSTADO (Bayesian), contagem sai CRUA: o card mostra
    // "4.1 (12 avaliações)" — exibir contagem ajustada seria mentir sobre
    // quantas pessoas de fato opinaram.
    expect(response.body.items[0]).toMatchObject({ avg_rating: 4.12, rating_count: 12 });
  });

  it('devolve popularity_score real para material elegível', async () => {
    dbMocks.selectFrom.mockReturnValue(makeQueryBuilder([{ id: 'm1', system_id: null, edition_id: null }], 1));
    metricsMocks.loadPopularityScores.mockResolvedValue(new Map([['m1', 0.42]]));

    const response = await request(app()).get('/api/v1/materials').expect(200);

    expect(response.body.items[0].popularity_score).toBe(0.42);
  });

  it('sort=trending EXCLUI material não elegível em vez de mandá-lo pro fim', async () => {
    // Universo elegível vem do serviço já com o corte download_count >= 1
    // aplicado: 'm-so-visto' (muitas views, zero download) não está na lista.
    metricsMocks.loadTrendingOrder.mockResolvedValue(['m-convertido']);
    const builder = makeQueryBuilder([{ id: 'm-convertido', system_id: null, edition_id: null }], 1);
    dbMocks.selectFrom.mockReturnValue(builder);

    const response = await request(app()).get('/api/v1/materials').query({ sort: 'trending' }).expect(200);

    // A rota restringe a consulta aos IDs elegíveis — é isso que faz o
    // material só-visualizado DESAPARECER da ordenação (Requisito 15), em vez
    // de aparecer no fim da lista.
    expect(builder.where).toHaveBeenCalledWith('download_material.id', 'in', ['m-convertido']);
    expect(response.body.items.map((item: { id: string }) => item.id)).toEqual(['m-convertido']);
  });

  it('sort=trending devolve lista vazia coerente quando ninguém é elegível', async () => {
    metricsMocks.loadTrendingOrder.mockResolvedValue([]);
    dbMocks.selectFrom.mockReturnValue(makeQueryBuilder([], 0));

    const response = await request(app()).get('/api/v1/materials').query({ sort: 'trending' }).expect(200);

    // Catálogo inteiro sem download na janela: prateleira vazia, não erro.
    expect(response.body).toMatchObject({ items: [], total: 0, total_pages: 1 });
  });

  it('sort=rating restringe aos materiais com nota, na ordem Bayesian', async () => {
    metricsMocks.loadRatingOrder.mockResolvedValue(['m-otimo', 'm-mediano']);
    const builder = makeQueryBuilder([
      { id: 'm-otimo', system_id: null, edition_id: null },
      { id: 'm-mediano', system_id: null, edition_id: null },
    ], 2);
    dbMocks.selectFrom.mockReturnValue(builder);

    await request(app()).get('/api/v1/materials').query({ sort: 'rating' }).expect(200);

    // Material sem avaliação nenhuma fica fora da ordenação: nunca aparece
    // como "0 estrelas" atrás de material com nota real baixa.
    expect(builder.where).toHaveBeenCalledWith('download_material.id', 'in', ['m-otimo', 'm-mediano']);
  });

  it('não calcula métrica de ordenação nos sorts que não usam (sem custo extra)', async () => {
    for (const sort of ['relevance', 'recent', 'popular', 'name']) {
      dbMocks.selectFrom.mockReturnValue(makeQueryBuilder([], 0));
      await request(app()).get('/api/v1/materials').query({ sort }).expect(200);
    }

    expect(metricsMocks.loadTrendingOrder).not.toHaveBeenCalled();
    expect(metricsMocks.loadRatingOrder).not.toHaveBeenCalled();
  });

  it('aceita os sorts novos e segue rejeitando sort desconhecido', async () => {
    dbMocks.selectFrom.mockReturnValue(makeQueryBuilder([], 0));
    await request(app()).get('/api/v1/materials').query({ sort: 'trending' }).expect(200);
    dbMocks.selectFrom.mockReturnValue(makeQueryBuilder([], 0));
    await request(app()).get('/api/v1/materials').query({ sort: 'rating' }).expect(200);

    await request(app()).get('/api/v1/materials').query({ sort: 'inventado' }).expect(400);
  });

  it('agrega métricas uma vez por página, não uma vez por card', async () => {
    dbMocks.selectFrom.mockReturnValue(makeQueryBuilder([
      { id: 'm1', system_id: null, edition_id: null },
      { id: 'm2', system_id: null, edition_id: null },
      { id: 'm3', system_id: null, edition_id: null },
    ], 3));

    await request(app()).get('/api/v1/materials').expect(200);

    // N+1 aqui degradaria toda listagem (a rota roda a cada busca/filtro/
    // paginação). Uma consulta agregada por página, mesmo espírito do
    // enriquecimento de taxonomia.
    expect(metricsMocks.loadRatingAggregates).toHaveBeenCalledTimes(1);
    expect(metricsMocks.loadRatingAggregates).toHaveBeenCalledWith(['m1', 'm2', 'm3']);
    expect(metricsMocks.loadPopularityScores).toHaveBeenCalledTimes(1);
  });

  it('paginação segue correta com os campos novos no payload', async () => {
    const builder = makeQueryBuilder([{ id: 'm1', system_id: null, edition_id: null }], 45);
    dbMocks.selectFrom.mockReturnValue(builder);

    const response = await request(app())
      .get('/api/v1/materials')
      .query({ page: 3, page_size: 20 })
      .expect(200);

    expect(builder.limit).toHaveBeenCalledWith(20);
    expect(builder.offset).toHaveBeenCalledWith(40);
    expect(response.body).toMatchObject({ page: 3, page_size: 20, total: 45, total_pages: 3 });
  });
});
