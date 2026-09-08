import { useRef, useState, type ChangeEvent } from 'react';
import { ImageEditor } from '@artificio/image-editor';
import '@artificio/image-editor/image-editor.css';
import { Checkbox, TextInput } from '@artificio/ui';
import {
  imageKindHint,
  imageKindSpec,
  isArtificioHostedImage,
  type CropRect,
  type ImageKind,
} from '@artificio/media/image-kinds';
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
  /**
   * Obrigatório: dele saem SETE ids (`-label`, `-file`, `-url`, `-hint`,
   * `-error`, `-select-file`, `-adjust-frame`, `-remove-image`), e dois deles
   * são alvo de `aria-labelledby`/`aria-describedby`. Com o default anterior
   * (`'image-uploader'`), duas instâncias na mesma tela produziam ids
   * duplicados e os atributos ARIA passavam a apontar para o elemento errado —
   * falha muda, que nada quebra visualmente e só aparece no leitor de tela.
   *
   * Os componentes irmãos com o mesmo padrão já exigiam (`AvatarField:29`,
   * `CatalogAdvancedFilters:43`); este era o único outlier. Obrigatório, quem
   * cobra é o compilador, não a memória de quem escrever a próxima chamada
   * (achado de review, PR #307).
   */
  idPrefix: string;
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
  /**
   * Largura máxima da PRÉVIA (não do campo). Existe porque a prévia é
   * `w-full` e a altura vem da proporção do `kind`: num banner 1200×650
   * dentro da coluna de trabalho do editor (900px), ela desenhava 456px de
   * altura — medido no beta — e sozinha respondia por 778px dos 3085px da
   * parte `identity`, forçando ~5 telas de rolagem em 1366×768.
   * Limitar a LARGURA reduz a altura proporcionalmente, sem distorcer e sem
   * recortar: a imagem continua inteira, só menor. Default `undefined`
   * preserva o comportamento antigo para os outros consumidores
   * (ProfileEditPage).
   */
  previewMaxWidthClass?: string;
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
  idPrefix,
  manualInputId,
  fileInputId,
  kind = 'table_banner',
  onCropChange,
  initialCropData,
  onDimensionsChange,
  imageWidth,
  imageHeight,
  placeholderSrc,
  previewMaxWidthClass,
}: Readonly<ImageUploaderProps>) {
  const inputId = fileInputId || `${idPrefix}-file`;
  const manualUrlId = manualInputId || `${idPrefix}-url`;
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // Foco a mover para o campo de URL quando ele aparece por ação do mestre
  // (F6.4c, achado de review PR #310): o botão "Trocar por um link" DESMONTA ao
  // ser clicado, e sem isso o foco cai no `<body>` — quem navega por teclado
  // perde o lugar exatamente na ação que pediu, e o próximo Tab recomeça do
  // topo da página. Só quando o mestre pede: montagem por dado que chega (o
  // valor deixar de ser hospedado aqui) não deve roubar o foco de onde ele
  // estiver.
  const focarCampoDeLinkRef = useRef(false);
  const spec = imageKindSpec(kind);
  const isAvatar = kind === 'profile_avatar';
  const fallbackImage = placeholderSrc ?? (isAvatar ? '' : bannerPlaceholder);

  const [uploadError, setUploadError] = useState<string | null>(null);
  const [editorSrc, setEditorSrc] = useState<string | null>(null);
  // F6.4c (spec 100): quem subiu arquivo não vê a URL crua, mas pode pedir o
  // campo de volta para trocar por link. Estado, não `value`, porque a
  // intenção é do mestre e não do dado.
  const [mostrarCampoDeLink, setMostrarCampoDeLink] = useState(false);
  const { isUploading, uploadFile, validateFile } = useImageUpload(kind);

  const previewSource = value.trim() || fallbackImage;

  /**
   * F6.4c (spec 100) — a metade do caso que a correção anterior não tratou.
   *
   * O placeholder intuitivo ("Cole aqui um link direto de imagem") chegou a
   * produção e resolve o campo VAZIO. Mas depois do upload o campo passa a
   * exibir o `value`, e o mestre encara a URL do Cloudinary — 100 caracteres
   * de `res.cloudinary.com/.../khmxivtocytsah6o0pap.jpg` como texto editável,
   * que foi exatamente a queixa original ("o cara acha que aquilo é código
   * vazado"). Medido em produção 2026-09-05: `banner_url` devolvido pela API é
   * o banner real que ele subiu, não placeholder algum.
   *
   * Com imagem já hospedada aqui, o campo de link some e o que fica é a prévia
   * (que já existia, abaixo) mais o convite a trocar. Link externo mantido por
   * "Manter link direto" CONTINUA visível: aquela URL o mestre digitou, ele a
   * reconhece, e escondê-la tiraria a única forma de conferi-la.
   *
   * `isArtificioHostedImage` e NÃO `isCloudinaryUrl`: os dois predicados
   * respondem perguntas diferentes. `isCloudinaryUrl` decide **importar**, e
   * trata qualquer `*.cloudinary.com` como hospedada para não reimportar; usá-lo
   * aqui escondia também o Cloudinary DE TERCEIRO que o mestre colou e manteve
   * como link direto — justamente o caso que o parágrafo acima manda preservar
   * (achado de review, PR #310). O predicado de exibição olha a pasta, que só o
   * nosso backend escreve.
   */
  const imagemHospedadaAqui = isArtificioHostedImage(value.trim());
  const campoDeLinkVisivel = !imagemHospedadaAqui || mostrarCampoDeLink;

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
        // O link colado virou imagem hospedada aqui: fecha o campo, senão o
        // mestre que pediu "trocar por um link" fica encarando a URL crua do
        // Cloudinary — o mesmo defeito que F6.4c fecha, reaberto pela porta ao
        // lado (achado de review, PR #310).
        setMostrarCampoDeLink(false);
        clearError();
      },
      onError: setError,
    });

  const releaseEditorSrc = () => {
    if (editorSrc?.startsWith('blob:')) URL.revokeObjectURL(editorSrc);
    setEditorSrc(null);
  };

  // B7 (spec 099): o campo exibe hint fixo (proporção/formatos, do
  // imageKindHint) e erro condicional; o botão de seleção — controle
  // acionável principal, já que o input de arquivo é `display:none` — recebe
  // a associação a ambos, quando presentes.
  const hintId = `${idPrefix}-hint`;
  const errorId = `${idPrefix}-error`;
  const describedBy = [hintId, uploadError || hasError ? errorId : undefined]
    .filter(Boolean)
    .join(' ') || undefined;

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
      // Mesmo motivo do `onImported`: subir arquivo com o campo de link aberto
      // repunha a URL crua na tela.
      setMostrarCampoDeLink(false);
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

  return (
    <section className="flex flex-col gap-3" aria-live="polite">
      {/* Rótulo do CAMPO, não gatilho do upload (spec 100, medido em beta
          2026-09-04): como `<label for>` de um input de arquivo, a faixa
          inteira (818px medidos) abria o seletor ao clique, inclusive no vazio
          longe do texto. Quem dispara é o botão abaixo. O vínculo acessível
          fica por `aria-labelledby` no input. Mesmo conserto de
          `AvatarField.tsx`. */}
      <span
        id={`${idPrefix}-label`}
        className="text-[length:var(--text-support)] font-[var(--weight-medium)] text-[var(--fg-muted)]"
      >
        {label}
      </span>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={fileInputRef}
            id={inputId}
            type="file"
            aria-labelledby={`${idPrefix}-label`}
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
            aria-describedby={describedBy}
            // Nome acessível cita o campo — mesma razão do `AvatarField`: o
            // input é `hidden` e não recebe foco, então quem precisa do rótulo
            // é este botão. Sem isso, dois campos de imagem na mesma tela
            // produzem dois "Selecionar imagem" indistinguíveis.
            aria-label={`${isUploading ? 'Enviando imagem' : 'Selecionar imagem'}: ${label}`}
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

          {/* Legenda única do contrato (T4.0t-bis, R19/A22): a frase vem de
              `imageKindHint(kind)` — proporção recomendada (1200 × 650 para o
              banner), formatos e limite lidos do imageKindSpec, nunca escritos
              à mão. A proporção é o que o mestre precisa para prever o corte
              ANTES de enviar: a imagem entra num 1200/650 e o enquadramento só
              aparece depois. B7: `id` para o aria-describedby do botão. */}
          <span className="text-xs text-white/60" id={hintId}>{imageKindHint(kind)}</span>
        </div>

        {!campoDeLinkVisivel && (
          <button
            type="button"
            id={`${idPrefix}-show-url`}
            onClick={() => {
              focarCampoDeLinkRef.current = true;
              setMostrarCampoDeLink(true);
            }}
            className="text-[length:var(--text-label)] text-[var(--fg-muted)] hover:text-[var(--fg)] underline underline-offset-2 text-left transition-colors"
          >
            Trocar por um link de imagem
          </button>
        )}

        {campoDeLinkVisivel && (
        <div className="flex flex-col gap-1">
          {/* "URL manual (fallback)" era jargão, e o placeholder mostrava uma
              URL crua do Cloudinary — o mestre lia aquilo como código vazado e
              não entendia o que devia digitar (achado do mantenedor,
              2026-09-04). Rótulo e exemplo passam a dizer o que se espera dele. */}
          <label htmlFor={manualUrlId} className="text-[length:var(--text-label)] font-[var(--weight-medium)] text-[var(--fg-muted)]">
            Ou cole o link de uma imagem
          </label>
          {/* Spec 099 G5/A15: `<input>` cru virou o primitivo do pacote. As
              utilitárias de padding/fonte/altura saíram junto — quem governa a
              escala do controle é `artificio-control-md` (§9.3 item 3), e
              mantê-las aqui só recriaria por classe local o mesmo desvio que a
              regra legada do CSS produzia por especificidade (§13.7). O que
              fica é a largura, que o primitivo não decide. */}
          <TextInput
            // Callback ref, não `useEffect`: dispara na montagem do input, sem
            // o render extra que a lint deste repo reprova
            // (`react-hooks/set-state-in-effect`), e sem precisar de dependência
            // que descreva "acabou de aparecer".
            ref={(node) => {
              if (node && focarCampoDeLinkRef.current) {
                focarCampoDeLinkRef.current = false;
                node.focus();
              }
            }}
            id={manualUrlId}
            type="url"
            value={value}
            onChange={(event) => {
              onChange(event.target.value);
              clearError();
            }}
            onBlur={importUrlIfNeeded}
            placeholder="Cole aqui um link direto de imagem (.jpg, .png ou .webp)"
            className="w-full"
          />
          <label
            className="mt-2 inline-flex items-center gap-2 text-xs text-white/70"
            title={directLinkTooltip}
          >
            <Checkbox
              checked={keepDirectLink}
              onChange={(event) => setKeepDirectLink(event.target.checked)}
            />
            <span>Manter link direto</span>
          </label>
          <p className="text-xs text-white/50">
            Desativado por padrão: links externos são importados para a hospedagem do Artifício ao sair do campo.
          </p>
        </div>
        )}
      </div>

      <div
        className={
          isAvatar
            ? 'flex items-center gap-4'
            : `overflow-hidden rounded-xl border border-white/10 ${previewMaxWidthClass ?? ''}`.trim()
        }
      >
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
                // Sem imagem não há o que esconder: o campo de link volta a ser
                // o caminho padrão, como em campo novo.
                setMostrarCampoDeLink(false);
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
        <p className="text-xs text-red-300" role="alert" id={errorId}>
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
