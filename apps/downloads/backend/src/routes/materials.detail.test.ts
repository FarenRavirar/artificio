import request from 'supertest';
import express from 'express';

// Achado real (review PR #208, Codex): ficha publica (GET /:slug) nao
// devolvia cover_image_url (so a listagem fazia o join com
// download_material_metadata) e resolvia edition_name/variant_name direto
// por getCatalogNodeById, perdendo variant_name quando edition_id apontava
// pra uma variante. Cobre os dois casos.

const dbMocks = vi.hoisted(() => ({
  selectFrom: vi.fn(),
  insertInto: vi.fn(),
}));

const catalogMocks = vi.hoisted(() => ({
  loadCatalogSystemsFlat: vi.fn(),
  loadCatalogMaterialTypes: vi.fn(),
  getCatalogMaterialTypeById: vi.fn(),
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

const BASE_PUBLIC_MATERIAL = {
  id: 'm1',
  slug: 'material-1',
  title: 'Material 1',
  summary: null,
  description: null,
  material_type: 'Aventura',
  material_type_id: 'type-1',
  access_kind: 'external_link',
  external_url: null,
  system_id: null,
  edition_id: null,
  creator_id: 'creator-1',
  editorial_state: 'published',
  created_at: new Date('2026-07-28T12:00:00.000Z'),
  updated_at: new Date('2026-07-29T12:00:00.000Z'),
  cover_image_url: null,
  credits: null,
  authors: null,
  author_keys: null,
  artists: null,
  publisher_name: null,
  publisher_key: null,
  scenario: null,
  creator_slug: null,
};

function app() {
  const server = express();
  server.use(express.json());
  server.use('/api/v1/materials', materialsRoutes);
  return server;
}

function makeMaterialQueryBuilder(material: unknown) {
  const builder: Record<string, unknown> = {};
  builder.leftJoin = vi.fn().mockReturnValue(builder);
  builder.select = vi.fn().mockReturnValue(builder);
  builder.where = vi.fn().mockReturnValue(builder);
  builder.executeTakeFirst = vi.fn().mockResolvedValue(material);
  return builder;
}

function makeDestinationQueryBuilder(destination: { id: string } | undefined) {
  const builder: Record<string, unknown> = {};
  builder.select = vi.fn().mockReturnValue(builder);
  builder.where = vi.fn().mockReturnValue(builder);
  builder.executeTakeFirst = vi.fn().mockResolvedValue(destination);
  return builder;
}

describe('GET /api/v1/materials/:slug — ficha publica', () => {
  beforeEach(() => {
    dbMocks.selectFrom.mockReset();
    dbMocks.insertInto.mockReset();
    catalogMocks.loadCatalogSystemsFlat.mockReset();
    catalogMocks.loadCatalogSystemsFlat.mockResolvedValue([]);
  });

  it('devolve cover_image_url da tabela de metadata', async () => {
    const material = {
      ...BASE_PUBLIC_MATERIAL,
      cover_image_url: 'https://cdn.test/capa.jpg',
    };
    const materialBuilder = makeMaterialQueryBuilder(material);
    dbMocks.selectFrom
      .mockReturnValueOnce(materialBuilder)
      .mockReturnValueOnce(makeDestinationQueryBuilder({ id: 'dest-1' }));

    const response = await request(app()).get('/api/v1/materials/material-1').expect(200);

    expect(materialBuilder.leftJoin).toHaveBeenCalledWith(
      'download_material_metadata',
      'download_material_metadata.material_id',
      'download_material.id',
    );
    expect(response.body.cover_image_url).toBe('https://cdn.test/capa.jpg');
  });

  it('devolve variant_name quando edition_id aponta pra uma variante', async () => {
    const material = {
      ...BASE_PUBLIC_MATERIAL,
      system_id: 'sys', edition_id: 'var', creator_slug: null,
    };
    dbMocks.selectFrom
      .mockReturnValueOnce(makeMaterialQueryBuilder(material))
      .mockReturnValueOnce(makeDestinationQueryBuilder({ id: 'dest-1' }));
    catalogMocks.loadCatalogSystemsFlat.mockResolvedValue([
      { id: 'sys', parent_id: null, node_type: 'system', slug: 's', path_slug: 's', name: 'Sistema', name_pt: null, aliases: [] },
      { id: 'ed', parent_id: 'sys', node_type: 'edition', slug: 'e', path_slug: 's/e', name: 'Edição', name_pt: null, aliases: [] },
      { id: 'var', parent_id: 'ed', node_type: 'variant', slug: 'v', path_slug: 's/e/v', name: 'Variante', name_pt: null, aliases: [] },
    ]);

    const response = await request(app()).get('/api/v1/materials/material-1').expect(200);

    expect(response.body).toMatchObject({
      system_name: 'Sistema',
      edition_name: 'Edição',
      variant_name: 'Variante',
    });
  });

  it('404 quando material nao existe ou nao esta publicado', async () => {
    dbMocks.selectFrom.mockReturnValueOnce(makeMaterialQueryBuilder(undefined));

    await request(app()).get('/api/v1/materials/inexistente').expect(404);
  });
});
