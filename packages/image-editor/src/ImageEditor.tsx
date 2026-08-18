import { useCallback, useEffect, useRef, useState } from 'react';
import ReactCrop, {
  centerCrop,
  convertToPixelCrop,
  makeAspectCrop,
  type Crop,
  type PixelCrop,
} from 'react-image-crop';
import { cropToObjectPosition, imageKindSpec, type CropRect, type ImageKind } from '@artificio/media/image-kinds';

export interface ImageEditorProps {
  /** URL da imagem sendo enquadrada (blob local ou remota já hospedada). */
  imageSrc: string;
  /**
   * Tipo da imagem. Define a proporção travada do recorte — avatar é sempre
   * 1:1, banner segue 1200x650. Vem de `@artificio/media/image-kinds`, a mesma
   * definição que o backend usa para transformar o upload.
   */
  kind: ImageKind;
  /** Recorte já salvo, para reabrir o editor no enquadramento atual. */
  initialCrop?: CropRect | null;
  /** Recebe o retângulo em pixels da imagem original mais as dimensões dela. */
  onConfirm: (crop: CropRect, naturalWidth: number, naturalHeight: number) => void;
  onCancel: () => void;
  confirmLabel?: string;
  title?: string;
}

const ZOOM_MIN = 1;
const ZOOM_MAX = 4;
const ZOOM_STEP = 0.25;

function centerAspectCrop(mediaWidth: number, mediaHeight: number, aspect: number): Crop {
  return centerCrop(
    makeAspectCrop({ unit: '%', width: 100 }, aspect, mediaWidth, mediaHeight),
    mediaWidth,
    mediaHeight,
  );
}

/**
 * Editor de enquadramento com zoom, arraste e prévia real.
 *
 * Três decisões que o editor anterior (local do app `mesas`) não tinha e que
 * causaram o defeito medido em produção:
 *
 * 1. **A proporção vem do tipo da imagem**, não de um número solto no
 *    consumidor. Avatar trava em 1:1 e não há como um app pedir outra coisa.
 * 2. **O recorte é convertido para pixels da imagem ORIGINAL** (`scaleX/scaleY`
 *    abaixo). O editor antigo devolvia coordenadas do elemento renderizado na
 *    tela, que muda de tamanho conforme a janela — o retângulo salvo não
 *    correspondia à imagem, então o enquadramento saía errado.
 * 3. **O zoom afeta a imagem, não o modal.** Antes, `transform: scale()` era
 *    aplicado ao contêiner inteiro: aumentava o modal junto e empurrava os
 *    botões para fora da tela, sem aproximar de fato.
 *
 * O recorte NÃO altera o arquivo. Ele é salvo como dado e vira
 * `object-position` na exibição, então continua reajustável para sempre.
 */
export function ImageEditor({
  imageSrc,
  kind,
  initialCrop = null,
  onConfirm,
  onCancel,
  confirmLabel = 'Aplicar',
  title = 'Ajustar imagem',
}: ImageEditorProps) {
  const spec = imageKindSpec(kind);
  const aspect = spec.aspect;
  const imgRef = useRef<HTMLImageElement>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);
  const [zoom, setZoom] = useState(ZOOM_MIN);

  const onImageLoad = useCallback(
    (event: React.SyntheticEvent<HTMLImageElement>) => {
      const { width, height, naturalWidth, naturalHeight } = event.currentTarget;

      // Reabrir no enquadramento salvo: o retângulo está em pixels da imagem
      // original e precisa voltar à escala do elemento exibido.
      if (initialCrop && naturalWidth > 0 && naturalHeight > 0) {
        const scaleX = width / naturalWidth;
        const scaleY = height / naturalHeight;
        const restored: PixelCrop = {
          unit: 'px',
          x: initialCrop.x * scaleX,
          y: initialCrop.y * scaleY,
          width: initialCrop.width * scaleX,
          height: initialCrop.height * scaleY,
        };
        setCrop(restored);
        setCompletedCrop(restored);
        return;
      }

      const centered = centerAspectCrop(width, height, aspect);
      setCrop(centered);
      setCompletedCrop(convertToPixelCrop(centered, width, height));
    },
    [aspect, initialCrop],
  );

  // Teclado: Esc fecha. Sem isto o modal só sai pelo botão, o que quebra a
  // expectativa de qualquer diálogo e prende quem navega por teclado.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  const handleConfirm = () => {
    const image = imgRef.current;
    if (!image || !completedCrop || completedCrop.width === 0 || completedCrop.height === 0) return;

    // Converte do elemento renderizado para a imagem original. É o passo que
    // faltava antes: sem ele o retângulo salvo não corresponde ao arquivo.
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    onConfirm(
      {
        x: Math.max(0, Math.round(completedCrop.x * scaleX)),
        y: Math.max(0, Math.round(completedCrop.y * scaleY)),
        width: Math.round(completedCrop.width * scaleX),
        height: Math.round(completedCrop.height * scaleY),
      },
      image.naturalWidth,
      image.naturalHeight,
    );
  };

  // Prévia: mesma conta que a exibição pública fará, para o usuário ver o
  // resultado real antes de aplicar — e não uma aproximação que diverge depois.
  const previewPosition = (() => {
    const image = imgRef.current;
    if (!image || !completedCrop) return '50% 50%';
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    return cropToObjectPosition(
      {
        x: completedCrop.x * scaleX,
        y: completedCrop.y * scaleY,
        width: completedCrop.width * scaleX,
        height: completedCrop.height * scaleY,
      },
      image.naturalWidth,
      image.naturalHeight,
    );
  })();

  const isAvatar = kind === 'profile_avatar';
  const canConfirm = Boolean(completedCrop && completedCrop.width > 0 && completedCrop.height > 0);

  return (
    <div
      className="artificio-image-editor__backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="artificio-image-editor__panel">
        <div className="artificio-image-editor__header">
          <h3 className="artificio-image-editor__title">{title}</h3>
        </div>

        <div className="artificio-image-editor__stage">
          <ReactCrop
            crop={crop}
            onChange={(_pixelCrop, percentCrop) => setCrop(percentCrop)}
            onComplete={(pixelCrop) => setCompletedCrop(pixelCrop)}
            aspect={aspect}
            circularCrop={isAvatar}
            keepSelection
            minWidth={32}
          >
            <img
              ref={imgRef}
              src={imageSrc}
              onLoad={onImageLoad}
              alt="Imagem sendo enquadrada"
              className="artificio-image-editor__image"
              // O zoom escala a IMAGEM dentro da área rolável, não o modal.
              style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}
            />
          </ReactCrop>
        </div>

        <div className="artificio-image-editor__controls">
          <label className="artificio-image-editor__zoom" htmlFor="artificio-image-editor-zoom">
            <span>Aproximar</span>
            <input
              id="artificio-image-editor-zoom"
              type="range"
              min={ZOOM_MIN}
              max={ZOOM_MAX}
              step={ZOOM_STEP}
              value={zoom}
              onChange={(event) => setZoom(Number(event.target.value))}
              aria-label="Nível de aproximação"
            />
            <output>{Math.round(zoom * 100)}%</output>
          </label>

          {zoom !== ZOOM_MIN && (
            <button
              type="button"
              className="artificio-image-editor__reset"
              onClick={() => setZoom(ZOOM_MIN)}
            >
              Ver imagem inteira
            </button>
          )}
        </div>

        <div className="artificio-image-editor__preview-row">
          <span className="artificio-image-editor__preview-label">Como vai aparecer:</span>
          <div
            className={
              isAvatar
                ? 'artificio-image-editor__preview artificio-image-editor__preview--round'
                : 'artificio-image-editor__preview'
            }
            style={{ aspectRatio: spec.aspectRatioCss }}
          >
            <img
              src={imageSrc}
              alt="Prévia do enquadramento"
              style={{ objectPosition: previewPosition }}
            />
          </div>
        </div>

        <p className="artificio-image-editor__hint">
          Arraste para escolher a área • use a barra para aproximar • a imagem original é preservada
        </p>

        <div className="artificio-image-editor__actions">
          <button type="button" className="artificio-image-editor__button" onClick={onCancel}>
            Cancelar
          </button>
          <button
            type="button"
            className="artificio-image-editor__button artificio-image-editor__button--primary"
            onClick={handleConfirm}
            disabled={!canConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
