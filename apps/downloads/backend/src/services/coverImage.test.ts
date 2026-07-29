import { MAX_COVER_BYTES, validateCoverImage } from './coverImage';

function png(width = 1200, height = 630): Buffer {
  const buffer = Buffer.alloc(24);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buffer);
  buffer.write('IHDR', 12, 'ascii');
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  return buffer;
}

function jpeg(width = 1200, height = 630): Buffer {
  return Buffer.from([
    0xff, 0xd8,
    0xff, 0xc0, 0x00, 0x07, 0x08,
    (height >> 8) & 0xff, height & 0xff,
    (width >> 8) & 0xff, width & 0xff,
  ]);
}

function webp(width = 1200, height = 630): Buffer {
  const buffer = Buffer.alloc(30);
  buffer.write('RIFF', 0, 'ascii');
  buffer.write('WEBP', 8, 'ascii');
  buffer.write('VP8X', 12, 'ascii');
  buffer.writeUIntLE(width - 1, 24, 3);
  buffer.writeUIntLE(height - 1, 27, 3);
  return buffer;
}

describe('validateCoverImage', () => {
  it.each([
    [png(), 'capa.png', 'image/png', 'png'],
    [jpeg(), 'capa.jpeg', 'image/jpeg', 'jpg'],
    [webp(), 'capa.webp', 'image/webp', 'webp'],
  ])('valida assinatura e dimensões de %s', (buffer, filename, mimeType, extension) => {
    expect(validateCoverImage(buffer, filename, mimeType)).toMatchObject({
      extension,
      width: 1200,
      height: 630,
    });
  });

  it('rejeita arquivo hostil com extensão e MIME de imagem', () => {
    expect(() => validateCoverImage(Buffer.from('<script>alert(1)</script>'), 'capa.png', 'image/png'))
      .toThrow(/não é uma imagem/i);
  });

  it('rejeita divergência entre extensão, MIME e assinatura', () => {
    expect(() => validateCoverImage(png(), 'capa.jpg', 'image/jpeg'))
      .toThrow(/não correspondem/i);
  });

  it.each([
    [['capa.png'], 'image/png'],
    ['capa.png', ['image/png']],
  ])('rejeita nome ou MIME com tipo adulterado', (filename, mimeType) => {
    expect(() => validateCoverImage(png(), filename, mimeType))
      .toThrow(/Nome ou MIME/);
  });

  it('rejeita limite de tamanho e dimensão', () => {
    expect(() => validateCoverImage(Buffer.alloc(MAX_COVER_BYTES + 1), 'capa.png', 'image/png'))
      .toThrow(/5 MB/i);
    expect(() => validateCoverImage(png(8001, 630), 'capa.png', 'image/png'))
      .toThrow(/8000 px/i);
  });
});
