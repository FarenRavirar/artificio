import { useState } from 'react';

export type ImageImportPurpose = 'table_banner' | 'profile_avatar' | 'profile_banner';

export const DIRECT_LINK_TOOLTIP =
  'Ao ativar esta opção, a imagem será exibida a partir do endereço informado, sem cópia para nossa hospedagem. Se esse link sair do ar ou expirar, a imagem poderá deixar de aparecer.';

function isCloudinaryUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname === 'res.cloudinary.com' || parsed.hostname.endsWith('.cloudinary.com');
  } catch {
    return false;
  }
}

function getApiBase(): string {
  return (import.meta.env.VITE_API_URL || '').replace(/\/api\/v1\/?$/, '');
}

async function importImageUrl(url: string, purpose: ImageImportPurpose): Promise<string> {
  const response = await fetch(`${getApiBase()}/api/v1/upload/url`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, purpose }),
  });

  const payload = await response.json();

  if (!response.ok || !payload?.secure_url) {
    throw new Error(payload?.error || 'Não foi possível importar a imagem desse link.');
  }

  return payload.secure_url as string;
}

interface UseImageUrlImportOptions {
  purpose: ImageImportPurpose;
  getUrl: () => string;
  onImported: (url: string) => void;
  onError: (message: string) => void;
  onSuccess?: (message: string) => void;
}

export function useImageUrlImport({
  purpose,
  getUrl,
  onImported,
  onError,
  onSuccess,
}: UseImageUrlImportOptions) {
  const [keepDirectLink, setKeepDirectLink] = useState(false);
  const [isImportingUrl, setIsImportingUrl] = useState(false);

  const importUrlIfNeeded = async () => {
    const manualUrl = getUrl().trim();
    if (!manualUrl || keepDirectLink || isCloudinaryUrl(manualUrl)) return;

    let parsed: URL;
    try {
      parsed = new URL(manualUrl);
    } catch {
      onError('Informe uma URL válida para importar a imagem.');
      return;
    }

    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      onError('Use uma URL HTTP ou HTTPS válida.');
      return;
    }

    setIsImportingUrl(true);

    try {
      const secureUrl = await importImageUrl(manualUrl, purpose);
      onImported(secureUrl);
      onSuccess?.('Imagem importada para a hospedagem do Artifício.');
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Não foi possível importar a imagem desse link.');
    } finally {
      setIsImportingUrl(false);
    }
  };

  return {
    keepDirectLink,
    setKeepDirectLink,
    isImportingUrl,
    importUrlIfNeeded,
    directLinkTooltip: DIRECT_LINK_TOOLTIP,
  };
}
