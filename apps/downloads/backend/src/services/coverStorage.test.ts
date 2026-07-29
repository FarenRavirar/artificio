const mediaMocks = vi.hoisted(() => ({
  destroyAssetResult: vi.fn(),
  downloadPublicImage: vi.fn(),
  uploadBuffer: vi.fn(),
  uploadFromUrl: vi.fn(),
}));

vi.mock('@artificio/media', () => mediaMocks);
vi.mock('../db', () => ({ db: {} }));

import { isCloudinaryCoverEnabled, prepareScrapedCover } from './coverStorage';

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
    expect(mediaMocks.uploadFromUrl).not.toHaveBeenCalled();
  });

  it('copia capa do scraper quando ligado', async () => {
    process.env.DOWNLOADS_CLOUDINARY_COVERS_ENABLED = 'true';
    process.env.CLOUDINARY_COVER_UPLOAD_PRESET = 'downloads-signed';
    mediaMocks.uploadFromUrl.mockResolvedValue({
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
      uploadedPublicId: 'downloads-covers/hash',
    });
  });

  it('falha de cópia não derruba ingestão e mantém URL externa', async () => {
    process.env.DOWNLOADS_CLOUDINARY_COVERS_ENABLED = 'true';
    process.env.CLOUDINARY_COVER_UPLOAD_PRESET = 'downloads-signed';
    mediaMocks.uploadFromUrl.mockRejectedValue(new Error('timeout'));
    const result = await prepareScrapedCover('https://source.test/capa.png');
    expect(result).toMatchObject({ cover_storage_provider: 'external', uploadedPublicId: null });
  });
});
