import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import type { DiscordImageUploadStatus } from './types';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

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

function uploadBufferToCloudinary(buffer: Buffer, contentType: string, publicId: string): Promise<{ url: string; public_id: string }> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'discord-imports',
        public_id: publicId,
        resource_type: 'image',
        overwrite: false,
      },
      (error, result?: UploadApiResponse) => {
        if (error) {
          reject(error);
          return;
        }
        if (!result?.secure_url || !result.public_id) {
          reject(new Error('Cloudinary não retornou URL da imagem.'));
          return;
        }
        resolve({ url: result.secure_url, public_id: result.public_id });
      },
    );

    Readable.from(buffer).pipe(stream);
  });
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
