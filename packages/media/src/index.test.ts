import { EventEmitter } from 'node:events';
import { PassThrough, Writable } from 'node:stream';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const cloudinaryMocks = vi.hoisted(() => ({
  config: vi.fn(),
  uploadStream: vi.fn(),
}));

const networkMocks = vi.hoisted(() => ({
  dnsLookup: vi.fn(),
  httpGet: vi.fn(),
  httpsGet: vi.fn(),
}));

vi.mock('cloudinary', () => ({
  v2: {
    config: cloudinaryMocks.config,
    uploader: {
      upload_stream: cloudinaryMocks.uploadStream,
    },
  },
}));

vi.mock('node:dns/promises', () => ({ lookup: networkMocks.dnsLookup }));
vi.mock('node:http', () => ({ default: { get: networkMocks.httpGet } }));
vi.mock('node:https', () => ({ default: { get: networkMocks.httpsGet } }));

import { downloadPublicImage, uploadBuffer, uploadFromUrl } from './index.js';

type MockResponse = PassThrough & {
  statusCode: number;
  headers: Record<string, string>;
};

function mockedRequest(response: MockResponse, callback: (response: MockResponse) => void) {
  const request = new EventEmitter() as EventEmitter & { destroy: (error?: Error) => void };
  request.destroy = (error?: Error) => {
    if (error) request.emit('error', error);
    response.destroy(error);
  };
  queueMicrotask(() => callback(response));
  return request;
}

function makeResponse(statusCode: number, headers: Record<string, string>, chunks?: Buffer[]): MockResponse {
  const stream = new PassThrough() as MockResponse;
  stream.statusCode = statusCode;
  stream.headers = headers;
  if (chunks) {
    queueMicrotask(() => {
      if (chunks.length === 0) {
        stream.end();
        return;
      }
      chunks.forEach((chunk, index) => {
        if (index === chunks.length - 1) stream.end(chunk);
        else stream.write(chunk);
      });
    });
  }
  return stream;
}

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
  beforeEach(() => {
    networkMocks.dnsLookup.mockReset().mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
    networkMocks.httpGet.mockReset();
    networkMocks.httpsGet.mockReset();
    cloudinaryMocks.uploadStream.mockClear();
  });

  it.each([
    'http://localhost/capa.png',
    'http://127.0.0.1/capa.png',
    'http://127.1/capa.png',
    'http://10.0.0.1/capa.png',
    'http://169.254.169.254/latest/meta-data/',
    'http://[::1]/capa.png',
    'http://[0:0:0:0:0:0:0:1]/capa.png',
    'http://[::ffff:127.0.0.1]/capa.png',
    'http://[::ffff:7f00:1]/capa.png',
    'http://[fc00::1]/capa.png',
    'http://[fd12:3456:789a::1]/capa.png',
    'http://[fe80::1]/capa.png',
    'file:///etc/passwd',
  ])('bloqueia destino local antes da rede: %s', async (url) => {
    await expect(downloadPublicImage(url)).rejects.toThrow(/privada|local|HTTP|HTTPS/);
    expect(networkMocks.httpGet).not.toHaveBeenCalled();
    expect(networkMocks.httpsGet).not.toHaveBeenCalled();
  });

  it('bloqueia redirect para destino privado antes da segunda requisição', async () => {
    networkMocks.httpGet.mockImplementation((_options, callback) => {
      const redirect = makeResponse(302, { location: 'http://169.254.169.254/latest/meta-data/' }, []);
      return mockedRequest(redirect, callback);
    });

    await expect(downloadPublicImage('http://public.example/capa.png')).rejects.toThrow(/privada/);
    expect(networkMocks.httpGet).toHaveBeenCalledTimes(1);
  });

  it('aplica maxBytes durante streaming, sem confiar em content-length', async () => {
    networkMocks.httpGet.mockImplementation((_options, callback) => {
      const image = makeResponse(200, { 'content-type': 'image/png' }, [Buffer.alloc(4), Buffer.alloc(4)]);
      return mockedRequest(image, callback);
    });

    await expect(downloadPublicImage('http://public.example/capa.png', { maxBytes: 6 }))
      .rejects.toThrow(/excede limite de 6 bytes/);
  });

  it('rejeita resposta vazia', async () => {
    networkMocks.httpGet.mockImplementation((_options, callback) => {
      const image = makeResponse(200, { 'content-type': 'image/png' }, []);
      return mockedRequest(image, callback);
    });

    await expect(downloadPublicImage('http://public.example/capa.png')).rejects.toThrow(/vazia/);
  });

  it('impõe deadline absoluto enquanto o corpo permanece aberto', async () => {
    networkMocks.httpGet.mockImplementation((_options, callback) => {
      const image = makeResponse(200, { 'content-type': 'image/png' });
      queueMicrotask(() => image.write(Buffer.from('x')));
      return mockedRequest(image, callback);
    });

    await expect(downloadPublicImage('http://public.example/capa.png', { timeout: 20 }))
      .rejects.toThrow(/Tempo esgotado/);
  });

  it('uploadFromUrl herda bloqueio SSRF do downloader compartilhado', async () => {
    await expect(uploadFromUrl('http://127.0.0.1/capa.png', { folder: 'test' }))
      .rejects.toThrow(/privada/);
    expect(cloudinaryMocks.uploadStream).not.toHaveBeenCalled();
  });
});
