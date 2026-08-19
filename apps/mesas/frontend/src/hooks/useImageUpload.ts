import { useState } from 'react';
import { imageKindSpec, type ImageKind } from '@artificio/media/image-kinds';
import { authPost } from '../services/apiClient';

/**
 * Upload de arquivo de imagem, um caminho só para todo o app.
 *
 * Substitui três implementações que faziam a mesma coisa com regras
 * divergentes: `AvatarUploader` (limite 2 MB, código morto — nenhum consumidor),
 * `ImageUploader` (5 MB) e um bloco inline em `ProfileEditPage` (5 MB, `alert()`
 * bloqueante, e um `FormData` montado e descartado sem uso). Divergência de
 * limite entre telas para o MESMO endpoint é bug de contrato, não preferência.
 *
 * O `kind` viaja junto com o arquivo porque é ele que decide, no servidor, a
 * transformação e a pasta. Antes o backend recebia o tipo e o descartava,
 * cortando todo upload como banner de mesa.
 */

export interface UploadedImage {
  url: string;
  width: number | null;
  height: number | null;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

/** Validação local, antes de gastar rede. O servidor revalida de qualquer forma. */
export function validateImageFile(file: File, kind: ImageKind): string | null {
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return 'Formato inválido. Envie apenas JPG, PNG ou WEBP.';
  }
  const spec = imageKindSpec(kind);
  if (file.size > spec.maxFileBytes) {
    const limitMb = Math.round(spec.maxFileBytes / (1024 * 1024));
    return `Arquivo muito grande (${formatFileSize(file.size)}). Limite de ${limitMb} MB.`;
  }
  return null;
}

/**
 * Normaliza a resposta do upload antes de ela virar estado.
 *
 * O corpo e `unknown`: nada garante que o servidor devolveu o que promete, e a
 * asercao `as Record<string, unknown>` que existia aqui so silenciava o
 * compilador. `width`/`height` viram divisor em `cropToObjectPosition`, entao
 * valor zero, negativo, fracionario ou `NaN` produziria `object-position` sem
 * sentido — pior que ausencia, porque parece dado valido.
 */
function normalizeUploadResponse(payload: unknown, ok: boolean): UploadedImage {
  const data = (payload ?? {}) as Record<string, unknown>;

  if (!ok || typeof data.secure_url !== 'string' || data.secure_url.trim() === '') {
    const message = typeof data.error === 'string' ? data.error : 'Falha ao enviar imagem.';
    throw new Error(message);
  }

  const dimension = (raw: unknown): number | null =>
    typeof raw === 'number' && Number.isSafeInteger(raw) && raw > 0 ? raw : null;

  return {
    url: data.secure_url,
    width: dimension(data.width),
    height: dimension(data.height),
  };
}

export function useImageUpload(kind: ImageKind) {
  const [isUploading, setIsUploading] = useState(false);

  const uploadFile = async (file: File): Promise<UploadedImage> => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      // O campo precisa vir ANTES do arquivo: o multer expõe em `req.body` só
      // os campos de texto já parseados quando o arquivo chega.
      formData.append('purpose', kind);
      formData.append('file', file);

      const response = await authPost('/api/v1/upload', formData);

      // Nem toda falha devolve JSON: 502 do proxy, HTML de erro do nginx ou
      // corpo vazio fariam `response.json()` lancar erro de parser, e a
      // mensagem do parser apareceria na tela no lugar de algo acionavel.
      const payload: unknown = await response.json().catch(() => null);
      return normalizeUploadResponse(payload, response.ok);
    } finally {
      setIsUploading(false);
    }
  };

  return { isUploading, uploadFile, validateFile: (file: File) => validateImageFile(file, kind) };
}
