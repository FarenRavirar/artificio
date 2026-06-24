import { useRef, useState, type ChangeEvent } from 'react';
import { useImageUrlImport } from '../hooks/useImageUrlImport';
import { authPost } from '../services/apiClient';

interface AvatarUploaderProps {
  label: string;
  value: string;
  onChange: (url: string) => void;
  onError: (hasError: boolean) => void;
  hasError?: boolean;
  idPrefix?: string;
}

const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AvatarUploader({
  label,
  value,
  onChange,
  onError,
  hasError = false,
  idPrefix = 'avatar-uploader',
}: AvatarUploaderProps) {
  const inputId = `${idPrefix}-file`;
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const cloudName = (import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || '').trim();
  const apiBase = (import.meta.env.VITE_API_URL || '').replace(/\/api\/v1$/, '');
  const uploadEndpoint = apiBase + '/api/v1/upload';

  const isCloudinaryConfigured = cloudName.length > 0;
  const previewSource = value.trim() || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Ccircle cx="50" cy="50" r="50" fill="%23334"/%3E%3Ccircle cx="50" cy="38" r="18" fill="%23666"/%3E%3Ccircle cx="50" cy="85" r="25" fill="%23666"/%3E%3C/svg%3E';

  const clearError = () => {
    setUploadError(null);
    onError(false);
  };

  const setError = (message: string) => {
    setUploadError(message);
    onError(true);
  };

  const {
    keepDirectLink,
    setKeepDirectLink,
    isImportingUrl,
    importUrlIfNeeded,
    directLinkTooltip,
  } = useImageUrlImport({
    purpose: 'profile_avatar',
    getUrl: () => value,
    onImported: (url) => {
      onChange(url);
      onError(false);
      setUploadError(null);
    },
    onError: setError,
  });

  const handleFileSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) return;

    if (!isCloudinaryConfigured) {
      setError('Cloudinary não configurado.');
      return;
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      setError('Formato inválido. Envie apenas JPG, PNG ou WEBP.');
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError(`Arquivo muito grande (${formatFileSize(file.size)}). Limite de 2 MB.`);
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await authPost(uploadEndpoint, formData);

      const payload = await response.json();

      if (!response.ok || !payload?.secure_url) {
        throw new Error(payload?.error || 'Falha ao enviar imagem.');
      }

      const url = typeof payload.secure_url === 'string' ? payload.secure_url : String(payload.secure_url ?? '');
      onChange(url);
      onError(false);
      setUploadError(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Falha inesperada no upload.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <section className="flex flex-col gap-3" aria-live="polite">
      <label className="text-sm font-medium text-white/70">
        {label}
      </label>

      <div className="flex items-center gap-4">
        <div className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-white/20 shrink-0">
          <img
            src={previewSource}
            alt="Preview do avatar"
            className="w-full h-full object-cover"
            onError={(event) => {
              const img = event.currentTarget;
              if (img.dataset.fallbackApplied === 'true') return;
              img.dataset.fallbackApplied = 'true';
              img.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Ccircle cx="50" cy="50" r="50" fill="%23334"/%3E%3Ccircle cx="50" cy="38" r="18" fill="%23666"/%3E%3Ccircle cx="50" cy="85" r="25" fill="%23666"/%3E%3C/svg%3E';
            }}
          />
        </div>

        <div className="flex flex-col gap-2">
          <input
            ref={fileInputRef}
            id={inputId}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleFileSelect}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading || isImportingUrl}
            className="px-3 py-1.5 rounded-lg bg-[var(--color-artificio-orange)] hover:bg-[var(--color-artificio-orange-hover)] disabled:opacity-60 disabled:cursor-not-allowed text-white text-xs font-semibold transition-colors"
          >
            {isUploading ? 'Enviando...' : isImportingUrl ? 'Importando...' : 'Enviar foto'}
          </button>

          <span className="text-xs text-white/60">
            até 2 MB
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-white/70">
          URL manual (fallback)
        </label>
        <input
          type="url"
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            clearError();
          }}
          onBlur={importUrlIfNeeded}
          placeholder="https://res.cloudinary.com/..."
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-[var(--color-artificio-orange)]/60 focus:ring-1 focus:ring-[var(--color-artificio-orange)]/30 transition-all"
        />
        <label
          className="mt-2 inline-flex items-center gap-2 text-xs text-white/70"
          title={directLinkTooltip}
        >
          <input
            type="checkbox"
            checked={keepDirectLink}
            onChange={(event) => setKeepDirectLink(event.target.checked)}
            className="h-4 w-4 rounded border-white/20 bg-white/5 accent-[var(--color-artificio-orange)]"
          />
          <span>Manter link direto</span>
        </label>
        <p className="text-xs text-white/50">
          Desativado por padrão: links externos são importados para nossa hospedagem ao sair do campo.
        </p>
      </div>

      {(uploadError || hasError) && (
        <p className="text-xs text-red-300" role="alert">
          {uploadError || 'Não foi possível validar a imagem enviada.'}
        </p>
      )}
    </section>
  );
}
