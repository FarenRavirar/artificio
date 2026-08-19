import { useCallback, useEffect, useRef, useState } from 'react';
import ReactCrop, {
  centerCrop,
  convertToPixelCrop,
  makeAspectCrop,
  type Crop,
  type PixelCrop,
} from 'react-image-crop';
// Folha OBRIGATÓRIA da biblioteca: ela posiciona a seleção, a máscara escura e
// as alças de redimensionamento. Sem isto o editor abre com o recorte
// invisível — a pessoa vê a imagem e nada mais. Fica junto do componente que
// depende dela, e não no CSS do pacote, para não virar uma cópia de 5 KB de
// código de terceiro que envelhece sozinha a cada atualização.
import 'react-image-crop/dist/ReactCrop.css';
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
 * 3. **O zoom muda o TAMANHO da imagem, não a transforma.** Antes,
 *    `transform: scale()` era aplicado ao contêiner inteiro: aumentava o modal
 *    junto e empurrava os botões para fora da tela. Usar `transform` só na
 *    imagem também não serve — `transform` não altera o tamanho de layout, e o
 *    `ReactCrop` mede o elemento não-escalado. O retângulo desenhado deixaria
 *    de corresponder ao que a pessoa vê na tela a partir de qualquer zoom > 1.
 *    Com `width` de verdade, layout e visual coincidem, e `image.width` volta a
 *    ser a escala correta na conversão.
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
  /**
   * O recorte é guardado em PORCENTAGEM, não em pixels.
   *
   * O zoom muda a largura real do elemento (é o que mantém o retângulo alinhado
   * com o que a pessoa vê). Guardar pixels faria o valor apontar para o tamanho
   * anterior assim que o zoom mudasse, e `onComplete` só dispara quando alguém
   * arrasta — então Aplicar logo após mexer no zoom salvaria o retângulo velho.
   * Porcentagem é invariante ao tamanho do elemento: converter para pixels na
   * hora do uso mantém os dois sempre coerentes.
   */
  const [crop, setCrop] = useState<Crop>();
  const [zoom, setZoom] = useState(ZOOM_MIN);

  const onImageLoad = useCallback(
    (event: React.SyntheticEvent<HTMLImageElement>) => {
      const { width, height, naturalWidth, naturalHeight } = event.currentTarget;

      // Reabrir no enquadramento salvo: o retângulo está em pixels da imagem
      // ORIGINAL, e vira porcentagem — que não depende do tamanho exibido.
      if (initialCrop && naturalWidth > 0 && naturalHeight > 0) {
        setCrop({
          unit: '%',
          x: (initialCrop.x / naturalWidth) * 100,
          y: (initialCrop.y / naturalHeight) * 100,
          width: (initialCrop.width / naturalWidth) * 100,
          height: (initialCrop.height / naturalHeight) * 100,
        });
        return;
      }

      setCrop(centerAspectCrop(width, height, aspect));
    },
    [aspect, initialCrop],
  );

  /**
   * Converte o recorte percentual para pixels do elemento NO MOMENTO DA
   * CHAMADA — nunca em valor guardado.
   *
   * Ler o tamanho durante o render congelaria a medida do render anterior, e o
   * clique em Aplicar usaria um elemento que já mudou de tamanho. Como função,
   * cada chamada mede o elemento como ele está agora, então o zoom é
   * acompanhado sem depender de `onComplete` (que só dispara ao arrastar).
   */
  const readPixelCrop = (): PixelCrop | null => {
    const image = imgRef.current;
    if (!crop || !image || image.width === 0 || image.height === 0) return null;
    const pixels = convertToPixelCrop(crop, image.width, image.height);
    return pixels.width > 0 && pixels.height > 0 ? pixels : null;
  };

  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<() => void>(onCancel);
  closeRef.current = onCancel;

  /**
   * `<dialog>` nativo em vez de `div role="dialog"`.
   *
   * O elemento nativo traz de graça o que uma div exige reimplementar à mão:
   * retenção de foco dentro do modal, foco inicial, devolução ao elemento que
   * abriu, `Esc` fechando e a camada `::backdrop` que torna o resto da página
   * inerte. Reimplementar isso é onde a acessibilidade costuma ficar pela
   * metade — e uma div que só ANUNCIA `role="dialog"` sem o comportamento faz
   * ao leitor de tela uma promessa que não cumpre.
   *
   * `showModal()` não existe no jsdom, então o fallback abre pelo atributo
   * `open`. Sem ele o conteúdo nem renderizaria em teste, e o componente
   * ficaria sem cobertura justamente na parte de acessibilidade.
   */
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }

    // O primeiro controle recebe o foco: sem isto o leitor de tela começaria a
    // leitura do topo do documento, atrás do modal.
    dialog.querySelector<HTMLElement>('button:not([disabled])')?.focus();

    return () => {
      if (typeof dialog.close === 'function' && dialog.open) dialog.close();
      previouslyFocused?.focus?.();
    };
  }, []);

  // `Esc` no `<dialog>` dispara `cancel` antes de fechar. Interceptamos para
  // que o fechamento passe pelo `onCancel` do componente — senão o consumidor
  // não saberia que o editor fechou e o estado ficaria dessincronizado.
  const handleCancelEvent = (event: React.SyntheticEvent<HTMLDialogElement>) => {
    event.preventDefault();
    closeRef.current();
  };

  const handleConfirm = () => {
    const image = imgRef.current;
    const completedCrop = readPixelCrop();
    if (!image || !completedCrop) return;

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
    const completedCrop = readPixelCrop();
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
  // O botão espelha a existência de um recorte utilizável. `crop` é o estado
  // que muda; o tamanho em pixels é medido na hora do clique.
  const canConfirm = Boolean(crop && crop.width > 0 && crop.height > 0);

  return (
    <dialog
      ref={dialogRef}
      className="artificio-image-editor__dialog"
      aria-label={title}
      onCancel={handleCancelEvent}
    >
      <div className="artificio-image-editor__panel">
        <div className="artificio-image-editor__header">
          <h3 className="artificio-image-editor__title">{title}</h3>
        </div>

        <div className="artificio-image-editor__stage">
          <ReactCrop
            crop={crop}
            onChange={(_pixelCrop, percentCrop) => setCrop(percentCrop)}
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
              // `width` em vez de `transform: scale()`: o `ReactCrop` mede o
              // tamanho de LAYOUT do elemento, que `transform` não altera —
              // com transform, o recorte salvo divergiria do que a pessoa vê
              // assim que ela aproximasse. A área acima rola quando a imagem
              // passa do contêiner.
              style={{ width: `${zoom * 100}%`, maxWidth: 'none' }}
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
    </dialog>
  );
}
