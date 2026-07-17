import { createHash } from 'node:crypto';
import { uploadBuffer as sharedUploadBuffer } from '@artificio/media';
import type { DiscordImageUploadStatus } from './types.js';

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
  /** Bot token p/ refresh de URLs expiradas (WS1). Se ausente, degrada silenciosamente. */
  botToken?: string | null;
}

/** Tempo máximo que uma URL refreshada do Discord pode levar para expirar (~15 min). */
const REFRESH_URL_TIMEOUT_MS = 15000;

function categorizeFetchError(error: unknown): DiscordImageUploadFailureStatus {
  if (error instanceof Error && /timeout|aborted|network|fetch failed/i.test(error.message)) {
    return 'network';
  }
  return 'expired_url';
}

function uploadBufferToCloudinary(buffer: Buffer, _contentType: string, publicId: string): Promise<{ url: string; public_id: string }> {
  return sharedUploadBuffer(buffer, { folder: 'discord-imports', publicId });
}

/**
 * Tenta refreshar URLs expiradas via API do Discord. Retorna as URLs frescas
 * (array com mesmo comprimento e ordem da entrada) ou null se falhar.
 * Nunca loga o token.
 */
async function refreshDiscordAttachmentUrls(
  attachmentUrls: string[],
  botToken: string,
  fetchImpl: typeof fetch,
): Promise<string[] | null> {
  try {
    const response = await fetchImpl('https://discord.com/api/v10/attachments/refresh-urls', {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ attachment_urls: attachmentUrls }),
      signal: AbortSignal.timeout(REFRESH_URL_TIMEOUT_MS),
    });

    if (!response.ok) {
      console.warn('[discord-image] refresh-urls failed', { status: response.status });
      return null;
    }

    // O endpoint do Discord responde { refreshed_urls: [{ original, refreshed }] }
    // — o campo de topo é `refreshed_urls`, não `refreshed` (REV-045).
    const body = await response.json() as { refreshed_urls?: Array<{ original?: string; refreshed?: string }> };
    const refreshed = body?.refreshed_urls;
    if (!Array.isArray(refreshed)) return null;

    // Mapeia URL original → refreshed (ambas podem ser null/inválidas)
    const map = new Map<string, string>();
    for (const entry of refreshed) {
      // Payload externo do Discord: só aceita par de strings (REV-020).
      if (entry && typeof entry.original === 'string' && typeof entry.refreshed === 'string') {
        map.set(entry.original, entry.refreshed);
      }
    }

    return attachmentUrls.map((url) => map.get(url) ?? url);
  } catch (error: unknown) {
    console.warn('[discord-image] refresh-urls exception', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/** Baixa a imagem de sourceUrl e faz upload p/ Cloudinary. Retorna sucesso ou falha. */
async function downloadAndUpload(
  sourceUrl: string,
  fetchImpl: typeof fetch,
  uploadBuffer: (buffer: Buffer, contentType: string, publicId: string) => Promise<{ url: string; public_id: string }>,
): Promise<DiscordImageUploadResult> {
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

export async function uploadDiscordImageToCloudinary(
  sourceUrl: string,
  deps: UploadDiscordImageDeps = {},
): Promise<DiscordImageUploadResult> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const uploadBuffer = deps.uploadBuffer ?? uploadBufferToCloudinary;

  // 1ª tentativa: download direto da URL
  const firstResult = await downloadAndUpload(sourceUrl, fetchImpl, uploadBuffer);

  // Se não expirou, retorna o resultado (sucesso ou falha não-expiração)
  if (firstResult.status !== 'expired_url') return firstResult;

  // WS1: tenta refresh via bot token (se disponível)
  if (!deps.botToken) return firstResult;

  const refreshedUrls = await refreshDiscordAttachmentUrls([sourceUrl], deps.botToken, fetchImpl);
  const freshUrl = refreshedUrls?.[0];
  if (!freshUrl || freshUrl === sourceUrl) {
    // Refresh falhou ou a URL não mudou — retorna o erro original
    return firstResult;
  }

  // 2ª tentativa: download da URL fresca
  const secondResult = await downloadAndUpload(freshUrl, fetchImpl, uploadBuffer);
  if (secondResult.status === 'success') {
    console.log('[discord-image] refresh succeeded on retry', { original: sourceUrl.substring(0, 80) });
    return secondResult;
  }

  // 2ª tentativa também falhou. A URL foi refreshada com sucesso, então o motivo
  // real é o da 2ª tentativa (network/cloudinary), não expired_url — retornar o 2º
  // evita persistir motivo errado e atrapalhar retry/diagnóstico (REV-027).
  return secondResult;
}
