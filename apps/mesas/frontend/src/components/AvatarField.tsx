import { useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { ImageEditor } from '@artificio/image-editor';
import '@artificio/image-editor/image-editor.css';
import type { CropRect } from '@artificio/media/image-kinds';
import { useImageUpload } from '../hooks/useImageUpload';
import { useImageUrlImport } from '../hooks/useImageUrlImport';
import { CroppedImage } from './CroppedImage';

export interface AvatarValue {
  url: string;
  crop: CropRect | null;
  width: number | null;
  height: number | null;
}

export interface AvatarFieldProps {
  label: string;
  description?: ReactNode;
  value: AvatarValue;
  onChange: (value: AvatarValue) => void;
  /** Foto exibida quando não há avatar próprio (ex.: a do perfil geral). */
  inheritedUrl?: string | null;
  placeholderInitial?: string;
  /** Traz a foto do login Google. Ausente quando o campo não oferece essa opção. */
  onUseGooglePhoto?: () => Promise<string>;
  onNotice?: (message: string) => void;
  onError?: (message: string) => void;
  idPrefix: string;
  removeLabel?: string;
}

/**
 * Campo de avatar: envio, link manual, foto do Google e enquadramento 1:1.
 *
 * Existe para acabar com duas cópias quase idênticas de ~120 linhas em
 * `ProfileEditPage` (foto do perfil geral e foto de mestre) que já divergiam
 * entre si — e para dar ao avatar o enquadramento que ele nunca teve.
 *
 * Os dois caminhos de origem convivem de propósito: a foto do login Google e a
 * imagem que o mestre envia ou cola por link. As duas passam pelo MESMO
 * enquadramento, porque a foto do Google também é recortada na exibição
 * circular e também precisa ser ajustável.
 *
 * O recorte é sempre 1:1 (decisão do mantenedor) e não altera o arquivo.
 */
export function AvatarField({
  label,
  description,
  value,
  onChange,
  inheritedUrl,
  placeholderInitial = '?',
  onUseGooglePhoto,
  onNotice,
  onError,
  idPrefix,
  removeLabel = 'Remover foto',
}: Readonly<AvatarFieldProps>) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [editorSrc, setEditorSrc] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const { isUploading, uploadFile, validateFile } = useImageUpload('profile_avatar');

  const reportError = (message: string) => {
    setFieldError(message);
    onError?.(message);
  };

  /** Imagem nova zera o enquadramento: o retângulo antigo é de outra imagem. */
  const applyNewImage = (url: string, width: number | null = null, height: number | null = null) => {
    onChange({ url, crop: null, width, height });
    setFieldError(null);
  };

  const urlImport = useImageUrlImport({
    purpose: 'profile_avatar',
    getUrl: () => value.url,
    onImported: (url) => applyNewImage(url),
    onError: reportError,
    onSuccess: (message) => onNotice?.(message),
  });

  const handleFileSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const validationError = validateFile(file);
    if (validationError) {
      reportError(validationError);
      return;
    }

    setFieldError(null);
    try {
      const uploaded = await uploadFile(file);
      applyNewImage(uploaded.url, uploaded.width, uploaded.height);
      // Abre o enquadramento logo após o envio: é o momento em que a pessoa
      // ainda tem a imagem em mente e espera decidir como ela aparece.
      setEditorSrc(uploaded.url);
    } catch (error) {
      reportError(error instanceof Error ? error.message : 'Erro ao enviar imagem.');
    }
  };

  const handleGooglePhoto = async () => {
    if (!onUseGooglePhoto) return;
    try {
      const url = await onUseGooglePhoto();
      applyNewImage(url);
      onNotice?.('Foto do Google aplicada.');
    } catch (error) {
      reportError(error instanceof Error ? error.message : 'Erro ao buscar foto do Google.');
    }
  };

  const displayedUrl = value.url || inheritedUrl || '';
  const isInherited = !value.url && Boolean(inheritedUrl);

  return (
    <div className="form-group">
      <label htmlFor={`${idPrefix}-file-input`}>{label}</label>
      {description && <p className="field-description">{description}</p>}

      <div className="avatar-premium-container">
        <div className="avatar-premium-preview">
          <CroppedImage
            src={displayedUrl}
            alt={isInherited ? `${label} (foto padrão)` : label}
            kind="profile_avatar"
            // O recorte salvo pertence à imagem própria. Quando a exibida é a
            // herdada do perfil geral, aplicar esse retângulo enquadraria a
            // imagem errada — daí o `null`.
            crop={isInherited ? null : value.crop}
            imageWidth={isInherited ? null : value.width}
            imageHeight={isInherited ? null : value.height}
            placeholder={<div className="avatar-preview-placeholder">{placeholderInitial}</div>}
          />
        </div>

        <div className="avatar-premium-actions">
          <div className="avatar-upload-section">
            <input
              type="file"
              ref={fileInputRef}
              id={`${idPrefix}-file-input`}
              accept="image/png,image/jpeg,image/webp"
              style={{ display: 'none' }}
              onChange={handleFileSelect}
            />
            <div className="avatar-button-row">
              <button
                type="button"
                className="btn-avatar-action btn-upload"
                disabled={isUploading || urlImport.isImportingUrl}
                onClick={() => fileInputRef.current?.click()}
              >
                {isUploading ? 'Enviando...' : '📤 Enviar nova imagem'}
              </button>

              {onUseGooglePhoto && (
                <button
                  type="button"
                  className="btn-avatar-action btn-google"
                  disabled={isUploading || urlImport.isImportingUrl}
                  onClick={handleGooglePhoto}
                >
                  🔄 Usar imagem do Google
                </button>
              )}
            </div>
          </div>

          <div className="avatar-button-group">
            {/* Reenquadrar sem reenviar: o recorte é dado de exibição, então a
                imagem já hospedada pode ser reajustada quantas vezes quiser. */}
            {value.url && (
              <button
                type="button"
                className="btn-avatar-action btn-manual"
                onClick={() => setEditorSrc(value.url)}
              >
                🖼️ Ajustar enquadramento
              </button>
            )}

            {value.url && (
              <button
                type="button"
                className="btn-avatar-action btn-remove"
                onClick={() => onChange({ url: '', crop: null, width: null, height: null })}
              >
                {removeLabel}
              </button>
            )}

            <details className="avatar-manual-details">
              <summary className="btn-avatar-action btn-manual">🔗 Usar URL manual</summary>
              <div className="avatar-manual-input">
                <input
                  type="url"
                  id={`${idPrefix}-url`}
                  value={value.url}
                  onChange={(event) => applyNewImage(event.target.value)}
                  onBlur={urlImport.importUrlIfNeeded}
                  placeholder="https://exemplo.com/avatar.jpg"
                />
                <label className="avatar-direct-link-option" title={urlImport.directLinkTooltip}>
                  <input
                    type="checkbox"
                    checked={urlImport.keepDirectLink}
                    onChange={(event) => urlImport.setKeepDirectLink(event.target.checked)}
                  />
                  <span>Manter link direto</span>
                </label>
                <small>
                  {urlImport.isImportingUrl
                    ? 'Importando imagem para a hospedagem do Artifício...'
                    : 'Desativado por padrão: links externos são importados ao sair do campo.'}
                </small>
              </div>
            </details>
          </div>
        </div>
      </div>

      {/* Erro visível no campo, no lugar do `alert()` bloqueante que estava
          aqui antes: `alert` interrompe a página inteira e some sem deixar
          rastro do que falhou. */}
      {fieldError && (
        <small className="error-text" role="alert">
          {fieldError}
        </small>
      )}

      {editorSrc && (
        <ImageEditor
          imageSrc={editorSrc}
          kind="profile_avatar"
          initialCrop={value.crop}
          onConfirm={(crop, naturalWidth, naturalHeight) => {
            onChange({ url: value.url || editorSrc, crop, width: naturalWidth, height: naturalHeight });
            setEditorSrc(null);
          }}
          onCancel={() => setEditorSrc(null)}
          title={`Enquadrar ${label.toLowerCase()}`}
        />
      )}
    </div>
  );
}
