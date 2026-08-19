import { useRef, useState, type ChangeEvent } from 'react';
import { ImageEditor } from '@artificio/image-editor';
import '@artificio/image-editor/image-editor.css';
import { imageKindSpec, type CropRect, type ImageKind } from '@artificio/media/image-kinds';
import bannerPlaceholder from '../assets/banner_placeholder.webp';
import { useImageUrlImport } from '../hooks/useImageUrlImport';
import { useImageUpload } from '../hooks/useImageUpload';
import { CroppedImage } from './CroppedImage';

export interface ImageUploaderProps {
  label: string;
  value: string;
  onChange: (url: string) => void;
  onError: (hasError: boolean) => void;
  hasError?: boolean;
  idPrefix?: string;
  manualInputId?: string;
  fileInputId?: string;
  /**
   * Tipo da imagem. Decide a proporção do recorte, o limite de arquivo e a
   * pasta no servidor — tudo vem de `@artificio/media/image-kinds`, a mesma
   * definição que o backend usa. Avatar é sempre 1:1.
   */
  kind?: ImageKind;
  /** Enquadramento escolhido, em pixels da imagem armazenada. */
  onCropChange?: (cropData: CropRect | null) => void;
  initialCropData?: CropRect | null;
  /** Dimensões da imagem armazenada, necessárias para aplicar o recorte. */
  onDimensionsChange?: (dimensions: { width: number; height: number } | null) => void;
  imageWidth?: number | null;
  imageHeight?: number | null;
  placeholderSrc?: string;
}

/**
 * Envio + enquadramento de imagem, um componente para todos os casos.
 *
 * Substitui `AvatarUploader` (que era código morto: nenhum consumidor no repo)
 * e os blocos de upload inline de `ProfileEditPage`. O que variava entre eles
 * — proporção, limite de arquivo, pasta — agora vem do `kind`, então
 * acrescentar um tipo de imagem não cria mais uma cópia deste arquivo.
 *
 * O recorte NÃO altera o arquivo enviado: é salvo como dado e aplicado na
 * exibição via `object-position`. Antes o corte acontecia no servidor, era
 * destrutivo e não podia ser refeito.
 */
export function ImageUploader({
  label,
  value,
  onChange,
  onError,
  hasError = false,
  idPrefix = 'image-uploader',
  manualInputId,
  fileInputId,
  kind = 'table_banner',
  onCropChange,
  initialCropData,
  onDimensionsChange,
  imageWidth,
  imageHeight,
  placeholderSrc,
}: Readonly<ImageUploaderProps>) {
  const inputId = fileInputId || `${idPrefix}-file`;
  const manualUrlId = manualInputId || `${idPrefix}-url`;
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const spec = imageKindSpec(kind);
  const isAvatar = kind === 'profile_avatar';
  const fallbackImage = placeholderSrc ?? (isAvatar ? '' : bannerPlaceholder);

  const [uploadError, setUploadError] = useState<string | null>(null);
  const [editorSrc, setEditorSrc] = useState<string | null>(null);
  const { isUploading, uploadFile, validateFile } = useImageUpload(kind);

  const previewSource = value.trim() || fallbackImage;

  const clearError = () => {
    setUploadError(null);
    onError(false);
  };

  const setError = (message: string) => {
    setUploadError(message);
    onError(true);
  };

  const { keepDirectLink, setKeepDirectLink, isImportingUrl, importUrlIfNeeded, directLinkTooltip } =
    useImageUrlImport({
      purpose: kind,
      getUrl: () => value,
      onImported: (url) => {
        onChange(url);
        // Link novo invalida o enquadramento da imagem anterior: manter o
        // retângulo antigo aplicaria coordenadas de outra imagem.
        onCropChange?.(null);
        onDimensionsChange?.(null);
        clearError();
      },
      onError: setError,
    });

  const releaseEditorSrc = () => {
    if (editorSrc?.startsWith('blob:')) URL.revokeObjectURL(editorSrc);
    setEditorSrc(null);
  };

  /**
   * O arquivo sobe PRIMEIRO e o enquadramento vem depois, sobre a imagem já
   * hospedada. É o oposto da ordem anterior, e de propósito: o servidor pode
   * reduzir a imagem (`crop: 'limit'`), então um retângulo medido no arquivo
   * local não corresponderia ao que foi armazenado.
   */
  const handleFileSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    clearError();
    try {
      const uploaded = await uploadFile(file);
      onChange(uploaded.url);
      // Imagem nova zera crop E dimensoes juntos. Preservar as dimensoes
      // antigas quando o servidor nao as devolve deixaria numeros de OUTRA
      // imagem no estado, e o proximo recorte seria convertido pela escala
      // errada.
      onDimensionsChange?.(
        uploaded.width && uploaded.height ? { width: uploaded.width, height: uploaded.height } : null,
      );
      onCropChange?.(null);
      if (onCropChange) setEditorSrc(uploaded.url);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Falha inesperada no upload.');
    }
  };

  const handleConfirmCrop = (crop: CropRect, naturalWidth: number, naturalHeight: number) => {
    onCropChange?.(crop);
    onDimensionsChange?.({ width: naturalWidth, height: naturalHeight });
    releaseEditorSrc();
  };

  const limitMb = Math.round(spec.maxFileBytes / (1024 * 1024));

  return (
    <section className="flex flex-col gap-3" aria-live="polite">
      <label htmlFor={inputId} className="text-sm font-medium text-white/70">
        {label}
      </label>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={fileInputRef}
            id={inputId}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleFileSelect}
            className="hidden"
          />

          <button
            id={`${idPrefix}-select-file`}
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading || isImportingUrl}
            className="min-h-[44px] px-4 py-2 rounded-lg bg-[var(--color-artificio-orange)] hover:bg-[var(--color-artificio-orange-hover)] disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
          >
            {isUploading ? 'Enviando imagem...' : 'Selecionar imagem'}
          </button>

          {/* Reenquadrar sem reenviar: o recorte é dado de exibição, então a
              imagem já hospedada pode ser reajustada quantas vezes quiser. */}
          {value && onCropChange && (
            <button
              id={`${idPrefix}-adjust-frame`}
              type="button"
              onClick={() => setEditorSrc(value)}
              disabled={isUploading || isImportingUrl}
              className="min-h-[44px] px-4 py-2 rounded-lg border border-white/15 text-white/80 hover:text-white text-sm transition-colors"
            >
              Ajustar enquadramento
            </button>
          )}

          <span className="text-xs text-white/60">JPG, PNG ou WEBP até {limitMb} MB</span>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={manualUrlId} className="text-xs font-medium text-white/70">
            URL manual (fallback)
          </label>
          <input
            id={manualUrlId}
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
            Desativado por padrão: links externos são importados para a hospedagem do Artifício ao sair do campo.
          </p>
        </div>
      </div>

      <div className={isAvatar ? 'flex items-center gap-4' : 'overflow-hidden rounded-xl border border-white/10'}>
        <CroppedImage
          src={previewSource}
          alt={value ? `Prévia de ${spec.label}` : `${spec.label} padrão`}
          kind={kind}
          crop={initialCropData}
          imageWidth={imageWidth}
          imageHeight={imageHeight}
          className={isAvatar ? 'w-24 shrink-0' : 'w-full'}
          fallbackSrc={fallbackImage || undefined}
        />
        <div className={isAvatar ? 'flex flex-col gap-1' : 'bg-black/30 px-3 py-2 flex justify-between items-center'}>
          <span className="text-xs text-white/70">
            {value ? `${spec.label} personalizado em uso` : `${spec.label} padrão em uso`}
          </span>
          {isImportingUrl && <span className="text-xs text-amber-200">Importando link...</span>}
          {value ? (
            <button
              id={`${idPrefix}-remove-image`}
              type="button"
              onClick={() => {
                onChange('');
                onCropChange?.(null);
                onDimensionsChange?.(null);
                clearError();
              }}
              className="text-xs text-red-200 hover:text-red-100 transition-colors text-left"
            >
              Remover imagem
            </button>
          ) : null}
        </div>
      </div>

      {(uploadError || hasError) && (
        <p className="text-xs text-red-300" role="alert">
          {uploadError || 'Não foi possível validar a imagem enviada.'}
        </p>
      )}

      {editorSrc && (
        <ImageEditor
          imageSrc={editorSrc}
          kind={kind}
          initialCrop={initialCropData}
          onConfirm={handleConfirmCrop}
          onCancel={releaseEditorSrc}
          title={`Enquadrar ${spec.label}`}
        />
      )}
    </section>
  );
}
