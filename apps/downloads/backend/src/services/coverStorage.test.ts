const mediaMocks = vi.hoisted(() => ({
  destroyAssetResult: vi.fn(),
  downloadPublicImage: vi.fn(),
  uploadBuffer: vi.fn(),
  uploadFromUrl: vi.fn(),
}));

vi.mock('@artificio/media', () => mediaMocks);
vi.mock('../db', () => ({ db: {} }));

import { CoverImageValidationError } from './coverImage';
import { isCloudinaryCoverEnabled, prepareScrapedCover } from './coverStorage';

function pngBuffer(width = 1200, height = 630): Buffer {
  const buffer = Buffer.alloc(24);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buffer);
  buffer.write('IHDR', 12, 'ascii');
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  return buffer;
}

describe('coverStorage feature switch e scraper', () => {
  afterEach(() => {
    delete process.env.DOWNLOADS_CLOUDINARY_COVERS_ENABLED;
    delete process.env.CLOUDINARY_COVER_UPLOAD_PRESET;
    vi.resetAllMocks();
  });

  it('é fail-closed e preserva origem externa sem chamar Cloudinary', async () => {
    expect(isCloudinaryCoverEnabled()).toBe(false);
    const result = await prepareScrapedCover('https://source.test/capa.png');
    expect(result).toMatchObject({
      cover_image_url: 'https://source.test/capa.png',
      cover_storage_provider: 'external',
      cover_public_id: null,
      uploadedPublicId: null,
    });
    expect(mediaMocks.downloadPublicImage).not.toHaveBeenCalled();
    expect(mediaMocks.uploadBuffer).not.toHaveBeenCalled();
  });

  it('copia capa do scraper quando ligado', async () => {
    process.env.DOWNLOADS_CLOUDINARY_COVERS_ENABLED = 'true';
    process.env.CLOUDINARY_COVER_UPLOAD_PRESET = 'downloads-signed';
    mediaMocks.downloadPublicImage.mockResolvedValue({
      buffer: pngBuffer(1200, 630),
      contentType: 'image/png',
      sourceUrl: 'https://source.test/capa.png',
    });
    mediaMocks.uploadBuffer.mockResolvedValue({
      url: 'https://cdn.test/capa.png',
      public_id: 'downloads-covers/hash',
      width: 1200,
      height: 630,
    });
    const result = await prepareScrapedCover('https://source.test/capa.png');
    expect(result).toMatchObject({
      cover_image_url: 'https://cdn.test/capa.png',
      cover_storage_provider: 'cloudinary',
      cover_public_id: 'downloads-covers/hash',
      cover_mime_type: 'image/png',
      uploadedPublicId: 'downloads-covers/hash',
    });
  });

  // Achado de review PR #228 (Codex P1, SSRF): a cópia de capa do scraper
  // passa pelo downloader que bloqueia destino privado; alvo interno tem que
  // cair no fallback externo, nunca virar asset publicado no Cloudinary.
  it('não copia capa quando o downloader recusa destino privado', async () => {
    process.env.DOWNLOADS_CLOUDINARY_COVERS_ENABLED = 'true';
    process.env.CLOUDINARY_COVER_UPLOAD_PRESET = 'downloads-signed';
    mediaMocks.downloadPublicImage.mockRejectedValue(new Error('Endereço de rede privada não é permitido.'));
    const result = await prepareScrapedCover('http://169.254.169.254/latest/meta-data/');
    expect(result).toMatchObject({ cover_storage_provider: 'external', uploadedPublicId: null });
    expect(mediaMocks.uploadBuffer).not.toHaveBeenCalled();
  });

  it('não copia capa quando o conteúdo baixado não é imagem válida', async () => {
    process.env.DOWNLOADS_CLOUDINARY_COVERS_ENABLED = 'true';
    process.env.CLOUDINARY_COVER_UPLOAD_PRESET = 'downloads-signed';
    mediaMocks.downloadPublicImage.mockResolvedValue({
      buffer: Buffer.from('{"secret":"interno"}', 'utf8'),
      contentType: 'image/png',
      sourceUrl: 'https://source.test/capa.png',
    });
    await expect(prepareScrapedCover('https://source.test/capa.png')).rejects.toThrow(CoverImageValidationError);
    expect(mediaMocks.uploadBuffer).not.toHaveBeenCalled();
  });

  it('repassa a mesma falha de validação vinda do downloader', async () => {
    process.env.DOWNLOADS_CLOUDINARY_COVERS_ENABLED = 'true';
    process.env.CLOUDINARY_COVER_UPLOAD_PRESET = 'downloads-signed';
    const validationError = new CoverImageValidationError('capa inválida');
    mediaMocks.downloadPublicImage.mockRejectedValue(validationError);

    await expect(prepareScrapedCover('https://source.test/capa.png')).rejects.toBe(validationError);
    expect(mediaMocks.uploadBuffer).not.toHaveBeenCalled();
  });

  it('falha de cópia não derruba ingestão e mantém URL externa', async () => {
    process.env.DOWNLOADS_CLOUDINARY_COVERS_ENABLED = 'true';
    process.env.CLOUDINARY_COVER_UPLOAD_PRESET = 'downloads-signed';
    mediaMocks.downloadPublicImage.mockRejectedValue(new Error('timeout'));
    const result = await prepareScrapedCover('https://source.test/capa.png');
    expect(result).toMatchObject({ cover_storage_provider: 'external', uploadedPublicId: null });
  });
});
