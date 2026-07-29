export const MAX_COVER_BYTES = 5 * 1024 * 1024;
export const MAX_COVER_DIMENSION = 8_000;

export interface ValidatedCoverImage {
  extension: 'jpg' | 'png' | 'webp';
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  width: number;
  height: number;
}

export class CoverImageValidationError extends Error {}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_SOF_MARKERS = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

function pngDimensions(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.length < 24 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) return null;
  if (buffer.toString('ascii', 12, 16) !== 'IHDR') return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function nextJpegMarker(buffer: Buffer, startOffset: number): { marker: number | undefined; offset: number } {
  let offset = startOffset;
  while (offset < buffer.length && buffer[offset] !== 0xff) offset += 1;
  while (offset < buffer.length && buffer[offset] === 0xff) offset += 1;
  return { marker: buffer[offset], offset: offset + 1 };
}

function jpegDimensions(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 3 < buffer.length) {
    // Achado real (review PR #228, Sonar): busca do próximo marcador isolada
    // reduz complexidade sem mudar a leitura sequencial do JPEG.
    const markerData = nextJpegMarker(buffer, offset);
    const marker = markerData.marker;
    offset = markerData.offset;
    if (marker === undefined) break;
    if (marker === 0xd8 || marker === 0x01) continue;
    if (marker === 0xd9 || marker === 0xda || offset + 2 > buffer.length) break;
    const segmentLength = buffer.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > buffer.length) return null;
    if (JPEG_SOF_MARKERS.has(marker) && segmentLength >= 7) {
      return { width: buffer.readUInt16BE(offset + 5), height: buffer.readUInt16BE(offset + 3) };
    }
    offset += segmentLength;
  }
  return null;
}

function readUint24LE(buffer: Buffer, offset: number): number {
  return buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16);
}

function webpDimensions(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.length < 30 || buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WEBP') {
    return null;
  }
  const chunk = buffer.toString('ascii', 12, 16);
  if (chunk === 'VP8X') {
    return { width: readUint24LE(buffer, 24) + 1, height: readUint24LE(buffer, 27) + 1 };
  }
  if (chunk === 'VP8L' && buffer[20] === 0x2f) {
    const bits = buffer.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
  }
  if (chunk === 'VP8 ' && buffer[23] === 0x9d && buffer[24] === 0x01 && buffer[25] === 0x2a) {
    return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
  }
  return null;
}

const FORMATS = [{
  extension: 'png' as const,
  mimeType: 'image/png' as const,
  dimensions: pngDimensions,
}, {
  extension: 'jpg' as const,
  mimeType: 'image/jpeg' as const,
  dimensions: jpegDimensions,
}, {
  extension: 'webp' as const,
  mimeType: 'image/webp' as const,
  dimensions: webpDimensions,
}];

export function validateCoverImage(
  buffer: unknown,
  filename: unknown,
  declaredMimeType: unknown,
): ValidatedCoverImage {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new CoverImageValidationError('Arquivo de capa vazio ou inválido.');
  }
  // Achado CodeQL PR #228: esta função fica na fronteira de upload HTTP.
  // Tipos TypeScript não protegem runtime contra query/header adulterado.
  if (typeof filename !== 'string' || typeof declaredMimeType !== 'string') {
    throw new CoverImageValidationError('Nome ou MIME da capa é inválido.');
  }
  if (buffer.length > MAX_COVER_BYTES) {
    throw new CoverImageValidationError('A capa excede o limite de 5 MB.');
  }

  const declaredExtension = filename.split('.').at(-1)?.toLowerCase() === 'jpeg'
    ? 'jpg'
    : filename.split('.').at(-1)?.toLowerCase();
  const detected = FORMATS.map((format) => ({ ...format, size: format.dimensions(buffer) }))
    .find((format) => format.size !== null);

  if (!detected) {
    throw new CoverImageValidationError('Conteúdo não é uma imagem JPEG, PNG ou WebP válida.');
  }
  if (declaredExtension !== detected.extension || declaredMimeType.toLowerCase() !== detected.mimeType) {
    throw new CoverImageValidationError('Extensão, MIME e assinatura real da capa não correspondem.');
  }

  const { width, height } = detected.size!;
  if (width < 1 || height < 1 || width > MAX_COVER_DIMENSION || height > MAX_COVER_DIMENSION) {
    throw new CoverImageValidationError('Dimensões da capa são inválidas ou excedem 8000 px.');
  }
  return { extension: detected.extension, mimeType: detected.mimeType, width, height };
}
