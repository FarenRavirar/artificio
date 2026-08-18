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

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** Validação local, antes de gastar rede. O servidor revalida de qualquer forma. */
export function validateImageFile(file: File, kind: ImageKind): string | null {
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return 'Formato inválido. Envie apenas JPG, PNG ou WEBP.';
  }
  const spec = imageKindSpec(kind);
  if (file.size > spec.maxFileBytes) {
    const limitMb = Math.round(spec.maxFileBytes / (1024 * 1024));
    return `Arquivo muito grande (${formatFileSize(file.size)}). Limite de ${limitMb} MB.`;
  }
  return null;
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
      const payload: unknown = await response.json();
      const data = (payload ?? {}) as Record<string, unknown>;

      if (!response.ok || typeof data.secure_url !== 'string') {
        const message = typeof data.error === 'string' ? data.error : 'Falha ao enviar imagem.';
        throw new Error(message);
      }

      return {
        url: data.secure_url,
        width: typeof data.width === 'number' ? data.width : null,
        height: typeof data.height === 'number' ? data.height : null,
      };
    } finally {
      setIsUploading(false);
    }
  };

  return { isUploading, uploadFile, validateFile: (file: File) => validateImageFile(file, kind) };
}
