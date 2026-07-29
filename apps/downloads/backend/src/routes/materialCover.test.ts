import express from 'express';
import request from 'supertest';

const dbMocks = vi.hoisted(() => ({
  selectFrom: vi.fn(),
  insertInto: vi.fn(),
  updateTable: vi.fn(),
}));

const mediaMocks = vi.hoisted(() => ({
  uploadBuffer: vi.fn(),
  uploadFromUrl: vi.fn(),
  downloadPublicImage: vi.fn(),
  destroyAssetResult: vi.fn(),
}));

vi.mock('../db', () => ({ db: dbMocks }));
vi.mock('@artificio/media', () => mediaMocks);
vi.mock('../middleware/rateLimit', () => ({
  writeRateLimiter: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

let userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
vi.mock('../middleware/auth', () => ({
  authMiddleware: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.user = { userId, role: 'user' };
    next();
  },
}));

import materialCoverRoutes from './materialCover';

function png(): Buffer {
  const buffer = Buffer.alloc(24);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buffer);
  buffer.write('IHDR', 12, 'ascii');
  buffer.writeUInt32BE(1200, 16);
  buffer.writeUInt32BE(630, 20);
  return buffer;
}

function query(result: unknown) {
  return {
    select: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    executeTakeFirst: vi.fn().mockResolvedValue(result),
  };
}

function app() {
  const server = express();
  server.use(express.json());
  server.use('/api/v1/materials', materialCoverRoutes);
  return server;
}

describe('POST /api/v1/materials/:id/cover', () => {
  const insertValues = vi.fn();
  const insertExecute = vi.fn();
  const updateExecute = vi.fn();

  beforeEach(() => {
    process.env.DOWNLOADS_CLOUDINARY_COVERS_ENABLED = 'true';
    process.env.CLOUDINARY_COVER_UPLOAD_PRESET = 'downloads-signed';
    userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    dbMocks.selectFrom.mockReset()
      .mockReturnValueOnce(query({ id: 'material-1', creator_id: userId }))
      .mockReturnValueOnce(query(undefined));
    insertValues.mockReset().mockReturnThis();
    insertExecute.mockReset().mockResolvedValue(undefined);
    const insertBuilder = {
      values: insertValues,
      onConflict: vi.fn(),
      executeTakeFirstOrThrow: insertExecute,
    };
    insertBuilder.onConflict.mockImplementation((callback) => {
        callback({
          column: vi.fn().mockReturnValue({ doUpdateSet: vi.fn() }),
        });
        return insertBuilder;
    });
    dbMocks.insertInto.mockReset().mockReturnValue(insertBuilder);
    updateExecute.mockReset().mockResolvedValue(undefined);
    dbMocks.updateTable.mockReset().mockReturnValue({
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      executeTakeFirst: updateExecute,
    });
    mediaMocks.uploadBuffer.mockReset().mockResolvedValue({
      url: 'https://cdn.example.test/downloads-covers/material-1.png',
      public_id: 'downloads-covers/material-1-new',
      width: 1200,
      height: 630,
    });
    mediaMocks.destroyAssetResult.mockReset().mockResolvedValue(true);
    mediaMocks.downloadPublicImage.mockReset().mockResolvedValue({
      buffer: png(), contentType: 'image/png', sourceUrl: 'https://example.test/capa.png',
    });
  });

  afterEach(() => {
    delete process.env.DOWNLOADS_CLOUDINARY_COVERS_ENABLED;
    delete process.env.CLOUDINARY_COVER_UPLOAD_PRESET;
  });

  it('valida e persiste capa gerenciada com preset assinado', async () => {
    const response = await request(app())
      .post('/api/v1/materials/material-1/cover?filename=capa.png')
      .set('Content-Type', 'image/png')
      .send(png())
      .expect(201);

    expect(mediaMocks.uploadBuffer).toHaveBeenCalledWith(expect.any(Buffer), expect.objectContaining({
      folder: 'downloads-covers',
      uploadPreset: 'downloads-signed',
      resourceType: 'image',
      overwrite: false,
    }));
    expect(insertValues).toHaveBeenCalledWith(expect.objectContaining({
      cover_storage_provider: 'cloudinary',
      cover_public_id: 'downloads-covers/material-1-new',
      cover_width: 1200,
      cover_height: 630,
      cover_mime_type: 'image/png',
    }));
    expect(response.body).toMatchObject({ width: 1200, height: 630, mime_type: 'image/png' });
  });

  it('mantém Cloudinary desligado por padrão', async () => {
    delete process.env.DOWNLOADS_CLOUDINARY_COVERS_ENABLED;
    await request(app())
      .post('/api/v1/materials/material-1/cover?filename=capa.png')
      .set('Content-Type', 'image/png')
      .send(png())
      .expect(503);
    expect(mediaMocks.uploadBuffer).not.toHaveBeenCalled();
  });

  it('com chave desligada grava URL externa e limpa identidade anterior', async () => {
    delete process.env.DOWNLOADS_CLOUDINARY_COVERS_ENABLED;
    dbMocks.selectFrom.mockReset()
      .mockReturnValueOnce(query({ id: 'material-1', creator_id: userId }))
      .mockReturnValueOnce(query({
        cover_storage_provider: 'cloudinary',
        cover_public_id: 'downloads-covers/material-1-old',
        cover_pending_delete_public_id: null,
      }));

    const response = await request(app())
      .post('/api/v1/materials/material-1/cover-url')
      .send({ url: 'https://example.test/capa.png' })
      .expect(201);

    expect(insertValues).toHaveBeenCalledWith(expect.objectContaining({
      cover_image_url: 'https://example.test/capa.png',
      cover_storage_provider: 'external',
      cover_public_id: null,
      cover_pending_delete_public_id: 'downloads-covers/material-1-old',
    }));
    expect(mediaMocks.downloadPublicImage).not.toHaveBeenCalled();
    expect(response.body).toMatchObject({ external: true });
  });

  it('com chave desligada preserva exclusão pendente sem efeito Cloudinary', async () => {
    delete process.env.DOWNLOADS_CLOUDINARY_COVERS_ENABLED;
    dbMocks.selectFrom.mockReset()
      .mockReturnValueOnce(query({ id: 'material-1', creator_id: userId }))
      .mockReturnValueOnce(query({
        cover_storage_provider: 'external',
        cover_public_id: null,
        cover_pending_delete_public_id: 'downloads-covers/pending-old',
      }));

    await request(app())
      .post('/api/v1/materials/material-1/cover-url')
      .send({ url: 'https://example.test/nova-capa.png' })
      .expect(422);

    expect(mediaMocks.destroyAssetResult).not.toHaveBeenCalled();
    expect(insertExecute).not.toHaveBeenCalled();
  });

  it('com chave ligada baixa, valida e copia URL para ativo próprio', async () => {
    await request(app())
      .post('/api/v1/materials/material-1/cover-url')
      .send({ url: 'https://example.test/capa.png' })
      .expect(201);

    expect(mediaMocks.downloadPublicImage).toHaveBeenCalledWith('https://example.test/capa.png', expect.any(Object));
    expect(mediaMocks.uploadBuffer).toHaveBeenCalled();
    expect(insertValues).toHaveBeenCalledWith(expect.objectContaining({
      cover_storage_provider: 'cloudinary',
      cover_public_id: 'downloads-covers/material-1-new',
    }));
  });

  it('rejeita conteúdo hostil antes do upload', async () => {
    await request(app())
      .post('/api/v1/materials/material-1/cover?filename=capa.png')
      .set('Content-Type', 'image/png')
      .send(Buffer.from('<script>alert(1)</script>'))
      .expect(400);

    expect(mediaMocks.uploadBuffer).not.toHaveBeenCalled();
  });

  it('apaga o upload novo quando a escrita no banco falha', async () => {
    insertExecute.mockRejectedValue(new Error('db unavailable'));

    await request(app())
      .post('/api/v1/materials/material-1/cover?filename=capa.png')
      .set('Content-Type', 'image/png')
      .send(png())
      .expect(500);

    expect(mediaMocks.destroyAssetResult).toHaveBeenCalledWith('downloads-covers/material-1-new');
  });

  it('remove somente a capa anterior pertencente ao projeto', async () => {
    dbMocks.selectFrom.mockReset()
      .mockReturnValueOnce(query({ id: 'material-1', creator_id: userId }))
      .mockReturnValueOnce(query({
        cover_storage_provider: 'cloudinary',
        cover_public_id: 'downloads-covers/material-1-old',
        cover_pending_delete_public_id: null,
      }));

    await request(app())
      .post('/api/v1/materials/material-1/cover?filename=capa.png')
      .set('Content-Type', 'image/png')
      .send(png())
      .expect(201);

    expect(mediaMocks.destroyAssetResult).toHaveBeenCalledWith('downloads-covers/material-1-old');
    expect(updateExecute).toHaveBeenCalled();
  });

  it('bloqueia usuário que não é dono', async () => {
    userId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

    await request(app())
      .post('/api/v1/materials/material-1/cover?filename=capa.png')
      .set('Content-Type', 'image/png')
      .send(png())
      .expect(403);

    expect(mediaMocks.uploadBuffer).not.toHaveBeenCalled();
  });
});
