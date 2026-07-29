import { Writable } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';

const cloudinaryMocks = vi.hoisted(() => ({
  config: vi.fn(),
  uploadStream: vi.fn(),
}));

vi.mock('cloudinary', () => ({
  v2: {
    config: cloudinaryMocks.config,
    uploader: {
      upload_stream: cloudinaryMocks.uploadStream,
    },
  },
}));

import { downloadPublicImage, uploadBuffer } from './index.js';

describe('uploadBuffer', () => {
  it('encaminha o preset assinado opcional ao Cloudinary', async () => {
    cloudinaryMocks.uploadStream.mockImplementation((options, callback) => {
      callback(null, {
        secure_url: 'https://cdn.example.test/cover.png',
        public_id: 'downloads-covers/cover-1',
        width: 1200,
        height: 630,
      });
      return new Writable({ write: (_chunk, _encoding, done) => done() });
    });

    await expect(uploadBuffer(Buffer.from('image'), {
      folder: 'downloads-covers',
      uploadPreset: 'downloads-covers-signed',
    })).resolves.toEqual({
      url: 'https://cdn.example.test/cover.png',
      public_id: 'downloads-covers/cover-1',
      width: 1200,
      height: 630,
    });

    expect(cloudinaryMocks.uploadStream).toHaveBeenCalledWith(
      expect.objectContaining({ upload_preset: 'downloads-covers-signed' }),
      expect.any(Function),
    );
  });
});

describe('downloadPublicImage', () => {
  it.each([
    'http://localhost/capa.png',
    'http://127.0.0.1/capa.png',
    'http://[::1]/capa.png',
    'http://[::ffff:127.0.0.1]/capa.png',
  ])('bloqueia destino local antes da rede: %s', async (url) => {
    await expect(downloadPublicImage(url)).rejects.toThrow(/privada|local/);
  });
});
