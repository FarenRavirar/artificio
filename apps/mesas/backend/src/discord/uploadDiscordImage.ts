import { createHash } from 'node:crypto';
import { uploadBuffer as sharedUploadBuffer } from '@artificio/media';
import type { DiscordImageUploadStatus } from './types';

export type DiscordImageUploadFailureStatus = Exclude<
  DiscordImageUploadStatus,
  'pending' | 'success' | 'permanent_fail'
>;

export type DiscordImageUploadResult =
  | { status: 'success'; url: string; public_id: string }
  | { status: DiscordImageUploadFailureStatus; error: string };

interface UploadDiscordImageDeps {
  fetchImpl?: typeof fetch;
  uploadBuffer?: (buffer: Buffer, contentType: string, publicId: string) => Promise<{ url: string; public_id: string }>;
}

function categorizeFetchError(error: unknown): DiscordImageUploadFailureStatus {
  if (error instanceof Error && /timeout|aborted|network|fetch failed/i.test(error.message)) {
    return 'network';
  }
  return 'network';
}

function uploadBufferToCloudinary(buffer: Buffer, _contentType: string, publicId: string): Promise<{ url: string; public_id: string }> {
  return sharedUploadBuffer(buffer, { folder: 'discord-imports', publicId });
}

export async function uploadDiscordImageToCloudinary(
  sourceUrl: string,
  deps: UploadDiscordImageDeps = {},
): Promise<DiscordImageUploadResult> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const uploadBuffer = deps.uploadBuffer ?? uploadBufferToCloudinary;

  let response: Response;
  try {
    response = await fetchImpl(sourceUrl, { signal: AbortSignal.timeout(10000) });
  } catch (error: unknown) {
    return {
      status: categorizeFetchError(error),
      error: error instanceof Error ? error.message : 'Falha de rede ao baixar imagem Discord.',
    };
  }

  if (response.status === 404 || response.status === 410) {
    return { status: 'expired_url', error: `Discord CDN retornou HTTP ${response.status}.` };
  }

  if (!response.ok) {
    return { status: 'network', error: `Download da imagem Discord falhou com HTTP ${response.status}.` };
  }

  const contentType = response.headers.get('content-type')?.split(';')[0]?.toLowerCase() ?? '';
  if (!contentType.startsWith('image/') || contentType === 'image/svg+xml') {
    return { status: 'expired_url', error: `Conteúdo baixado não é imagem suportada: ${contentType || 'sem content-type'}.` };
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength === 0) {
    return { status: 'expired_url', error: 'Discord CDN retornou imagem vazia.' };
  }

  const publicId = createHash('sha256').update(buffer).digest('hex');
  try {
    return { status: 'success', ...(await uploadBuffer(buffer, contentType, publicId)) };
  } catch (error: unknown) {
    return {
      status: 'cloudinary',
      error: error instanceof Error ? error.message : 'Falha ao enviar imagem para Cloudinary.',
    };
  }
}
