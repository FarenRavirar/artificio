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
  builder.groupBy = vi.fn().mockReturnValue(builder);
  builder.orderBy = vi.fn().mockReturnValue(builder);
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

    expect(response.body.items).toEqual([{ ...items[0], taxonomy_chain: [] }]);
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
    }]);
  });

  it('facets agrega somente linhas fornecidas como publicadas e resolve tipos no Central', async () => {
    const typeId = 'b071ab5e-2d16-4c58-8f0e-086000000001';
    dbMocks.selectFrom
      .mockReturnValueOnce(makeQueryBuilder([{ material_type_id: typeId, count: '2' }], 0))
      .mockReturnValueOnce(makeQueryBuilder([{ system_id: 'sys', count: '2' }], 0))
      .mockReturnValueOnce(makeQueryBuilder([{ edition_id: 'ed', count: '1' }], 0));
    catalogMocks.loadCatalogMaterialTypes.mockResolvedValue([
      { id: typeId, slug: 'aventura', name: 'Aventura', aliases: ['adventure'], status: 'active' },
    ]);

    const response = await request(app()).get('/api/v1/materials/facets').expect(200);

    expect(response.body).toEqual({
      material_types: [{ id: typeId, slug: 'aventura', name: 'Aventura', count: 2 }],
      systems: [{ id: 'sys', count: 2 }],
      editions: [{ id: 'ed', count: 1 }],
    });
    for (const builder of dbMocks.selectFrom.mock.results.map((result) => result.value)) {
      expect(builder.where).toHaveBeenCalledWith('editorial_state', '=', 'published');
    }
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
});
