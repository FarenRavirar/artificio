import request from 'supertest';
import express from 'express';

const dbMocks = vi.hoisted(() => ({
  selectFrom: vi.fn(),
  insertInto: vi.fn(),
}));

vi.mock('../db', () => ({ db: dbMocks }));
vi.mock('../middleware/auth', () => ({
  authMiddleware: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.user = { userId: 'creator-1', role: 'user' };
    next();
  },
}));
vi.mock('../middleware/rateLimit', () => ({
  writeRateLimiter: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

import materialMetadataRoutes from './materialMetadata';

function app() {
  const server = express();
  server.use(express.json());
  server.use('/api/v1/material-metadata', materialMetadataRoutes);
  return server;
}

function materialQuery(material: unknown) {
  return {
    select: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    executeTakeFirst: vi.fn().mockResolvedValue(material),
  };
}

describe('PUT /api/v1/material-metadata/:materialId', () => {
  beforeEach(() => {
    dbMocks.selectFrom.mockReset();
    dbMocks.insertInto.mockReset();
  });

  it('aceita metadata rica, limpa HTML hostil colado no editor e preserva source_filters como array', async () => {
    dbMocks.selectFrom.mockReturnValueOnce(materialQuery({ id: 'material-1', creator_id: 'creator-1', system_id: null }));
    const insert = {
      values: vi.fn().mockReturnThis(),
      onConflict: vi.fn().mockImplementation((callback) => {
        callback({ column: vi.fn().mockReturnValue({ doUpdateSet: vi.fn() }) });
        return insert;
      }),
      returningAll: vi.fn().mockReturnThis(),
      executeTakeFirstOrThrow: vi.fn().mockResolvedValue({ material_id: 'material-1' }),
    };
    dbMocks.insertInto.mockReturnValueOnce(insert);

    await request(app())
      .put('/api/v1/material-metadata/material-1')
      .send({
        file_size_text: '44,49 MB',
        page_count: 15,
        creation_method: 'Human-Created Without AI',
        source_category: 'Linha de produto',
        source_filters: [{ facet: 'tipoDeProduto', path: ['Aventura', 'Campanha'] }],
        description_html: '<p onclick="alert(1)">Seguro</p><a href="javascript:alert(1)">link</a><img src="https://example.com/capa.png" onerror="alert(1)"><iframe src="https://evil.example"></iframe><script>alert(1)</script>',
      })
      .expect(200);

    expect(insert.values).toHaveBeenCalledWith(expect.objectContaining({
      material_id: 'material-1',
      file_size_text: '44,49 MB',
      page_count: 15,
      creation_method: 'Human-Created Without AI',
      source_category: 'Linha de produto',
      // Achado real (smoke visual pós-deploy, 2026-07-26): node-postgres sem
      // type hint serializa array JS como array literal do Postgres ('[]'
      // virava '{}' no banco, quebrando o parse Zod do GET seguinte). Fix é
      // JSON.stringify explícito antes do Kysely — o valor aqui é a STRING
      // serializada, não o array em si.
      source_filters: JSON.stringify([{ facet: 'tipoDeProduto', path: ['Aventura', 'Campanha'] }]),
      description_html: '<p>Seguro</p><a>link</a><img src="https://example.com/capa.png">',
    }));
  });

  it('PUT parcial não zera campo rico salvo por outra tela', async () => {
    dbMocks.selectFrom.mockReturnValueOnce(materialQuery({ id: 'material-1', creator_id: 'creator-1', system_id: null }));
    const doUpdateSet = vi.fn();
    const insert = {
      values: vi.fn().mockReturnThis(),
      onConflict: vi.fn().mockImplementation((callback) => {
        callback({ column: vi.fn().mockReturnValue({ doUpdateSet }) });
        return insert;
      }),
      returningAll: vi.fn().mockReturnThis(),
      executeTakeFirstOrThrow: vi.fn().mockResolvedValue({ material_id: 'material-1' }),
    };
    dbMocks.insertInto.mockReturnValueOnce(insert);

    await request(app())
      .put('/api/v1/material-metadata/material-1')
      .send({ file_size_text: '1 MB' })
      .expect(200);

    expect(insert.values).toHaveBeenCalledWith(expect.objectContaining({ source_filters: JSON.stringify([]) }));
    expect(doUpdateSet).toHaveBeenCalledWith(expect.not.objectContaining({
      description_html: expect.anything(),
      source_filters: expect.anything(),
    }));
  });
});
