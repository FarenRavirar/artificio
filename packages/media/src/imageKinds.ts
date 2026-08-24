/**
 * Contrato único de "que tipo de imagem é esta" no Artifício.
 *
 * Existe porque a mesma decisão (proporção, tamanho máximo, pasta, se pode
 * cortar) estava espalhada e DIVERGENTE entre backend e frontend: o servidor
 * cortava todo upload em 1200x650 `crop: 'fill'` — inclusive avatar — enquanto
 * a rota `/upload/url` recebia um `purpose` que validava e jogava fora. O
 * resultado media-se em produção: avatar de mestre gravado 1200x650, com topo
 * e base descartados no upload e sem original para recuperar.
 *
 * Isomórfico de propósito (sem `node:*` nem DOM): backend importa para montar
 * a transformação do Cloudinary, frontend importa para escolher o `aspect` do
 * editor de recorte e validar arquivo antes de enviar. Uma definição só, dois
 * consumidores — acrescentar um tipo novo de imagem é editar este arquivo.
 */

export type ImageKind = "table_banner" | "profile_avatar" | "profile_banner";

export interface ImageKindSpec {
  /** Proporção de exibição (largura/altura). Avatar é sempre 1:1. */
  readonly aspect: number;
  /**
   * Mesma proporção na forma `"largura / altura"`, para uso direto em
   * `aspect-ratio` no CSS. Existe separada do número porque `1200/650` em
   * ponto flutuante vira `1.8461538461538463`, e navegador/jsdom truncam ou
   * rejeitam decimal longo — a fração é exata e é a sintaxe canônica.
   */
  readonly aspectRatioCss: string;
  /**
   * Maior dimensão preservada no armazenamento. Aplicado com `crop: 'limit'`,
   * que só REDUZ imagem maior que o limite e nunca descarta pixel — o
   * enquadramento é decisão de exibição (`*_crop_data`), não de upload.
   */
  readonly maxDimension: number;
  /**
   * Dimensões RECOMENDADAS, para a legenda dizer ao usuário o que se espera —
   * não são validação. Vêm do maior consumo real de cada tipo: banner de mesa e
   * de perfil viram `og:image` (declarado 1200x630 em `og.ts`), e o avatar é
   * exibido a 140px no perfil público (`MestrePage.css:70`), o que pede 280 em
   * tela 2x.
   */
  readonly recommendedWidth: number;
  readonly recommendedHeight: number;
  /**
   * Piso abaixo do qual o resultado degrada de forma visível. Para os banners é
   * o mínimo que as plataformas sociais aceitam sem rebaixar o card
   * (600x315 é o piso de Discord/WhatsApp/Twitter/Facebook); para o avatar, o
   * dobro da exibição.
   *
   * Acrescentado em 2026-08-24 (spec 096, R19) com autorização nominal do
   * mantenedor para tocar pacote compartilhado. Motivo medido: dos 9 banners de
   * mesa com dimensão registrada em produção, 7 estavam abaixo de 1200px de
   * largura — mediana 720, menor 473 —, então o preview compartilhado saía
   * rebaixado sem que nada avisasse o mestre.
   *
   * É orientação, não bloqueio: quem valida decide se avisa ou recusa. Um
   * upload abaixo do piso continua tecnicamente válido.
   */
  readonly minWidth: number;
  readonly minHeight: number;
  /** Pasta no Cloudinary. Separar por tipo evita avatar dentro de `mesas_rpg/`. */
  readonly folder: string;
  /** Limite de arquivo aceito no upload, em bytes. */
  readonly maxFileBytes: number;
  /**
   * Formatos aceitos no upload, como MIME. Fonte única: até 2026-08-24 a lista
   * vivia duplicada em três pontos (`ImageUploader` no `accept`, `useImageUpload`
   * na validação do cliente e `upload.ts` no `fileFilter` do multer), que é
   * exatamente a divergência que este pacote existe para evitar.
   *
   * O Cloudinary não restringe formato (`services/cloudinary.ts` não define
   * `allowed_formats`), e a ENTREGA usa `fetch_format:"auto"` — o arquivo
   * enviado pode ser servido como WebP/AVIF conforme o navegador. Portanto:
   * não prometer preservação de transparência ao usuário.
   */
  readonly acceptedMimeTypes: readonly string[];
  /** Rótulo em português para mensagem de erro ao usuário. */
  readonly label: string;
}

const MB = 1024 * 1024;

/** JPG, PNG e WEBP — os três já aceitos de ponta a ponta (cliente, multer e
 * Cloudinary), confirmados em produção com 45 banners jpg, 40 png e 2 webp. */
const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export const IMAGE_KINDS = {
  table_banner: {
    aspect: 1200 / 650,
    aspectRatioCss: "1200 / 650",
    maxDimension: 1600,
    // Recomendado igual ao og:image que o banner alimenta (og.ts:75-76).
    recommendedWidth: 1200,
    recommendedHeight: 650,
    // 600x325 mantém a proporção e fica no piso social (600x315).
    minWidth: 600,
    minHeight: 325,
    folder: "mesas_rpg",
    maxFileBytes: 5 * MB,
    acceptedMimeTypes: IMAGE_MIME_TYPES,
    label: "banner da mesa",
  },
  profile_avatar: {
    // Pétreo (decisão do mantenedor, 2026-08-18): avatar é SEMPRE 1:1,
    // diferente do banner de mesa. O editor trava nessa proporção e a
    // exibição é circular.
    aspect: 1,
    aspectRatioCss: "1 / 1",
    maxDimension: 1024,
    // Exibido a 140px no perfil público (MestrePage.css:70); 280 cobre tela 2x.
    recommendedWidth: 280,
    recommendedHeight: 280,
    minWidth: 140,
    minHeight: 140,
    folder: "artificio_avatars",
    maxFileBytes: 5 * MB,
    acceptedMimeTypes: IMAGE_MIME_TYPES,
    label: "foto de perfil",
  },
  profile_banner: {
    aspect: 1200 / 650,
    aspectRatioCss: "1200 / 650",
    maxDimension: 1600,
    recommendedWidth: 1200,
    recommendedHeight: 650,
    minWidth: 600,
    minHeight: 325,
    folder: "artificio_profile_banners",
    maxFileBytes: 5 * MB,
    acceptedMimeTypes: IMAGE_MIME_TYPES,
    label: "banner do perfil",
  },
} as const satisfies Record<ImageKind, ImageKindSpec>;

/** Todos os tipos conhecidos. Iterar aqui evita lista literal duplicada nos consumidores. */
export const IMAGE_KIND_LIST = Object.keys(IMAGE_KINDS) as readonly ImageKind[];

/** Narrowing para valor vindo de request/localStorage/JSON — nunca confiar no tipo. */
export function isImageKind(value: unknown): value is ImageKind {
  return typeof value === "string" && (IMAGE_KIND_LIST as readonly string[]).includes(value);
}

/** Spec do tipo informado; cai em `table_banner` quando a origem não é confiável. */
export function imageKindSpec(kind: unknown): ImageKindSpec {
  return IMAGE_KINDS[isImageKind(kind) ? kind : "table_banner"];
}

/**
 * Frase de orientação exibida ao lado do campo de upload, montada a partir do
 * spec — nunca escrita à mão no componente. Existe porque o único texto que o
 * uploader mostrava era "JPG, PNG ou WEBP até 5 MB", **sem a proporção**, que é
 * justamente o que decide o enquadramento: o usuário enviava imagem quadrada,
 * ela entrava num 1200x650 e o corte só aparecia depois do envio (spec 096,
 * §Gap 10).
 *
 * O que a frase deliberadamente NÃO diz:
 * - "máximo 1600px" — `maxDimension` usa `crop:'limit'`, que REDUZ a imagem
 *   maior em vez de recusá-la; anunciar teto seria falso.
 * - "mantém transparência" — a entrega usa `fetch_format:"auto"`.
 * - mínimo como regra — `minWidth`/`minHeight` são orientação, não bloqueio.
 */
export function imageKindHint(kind: unknown): string {
  const spec = imageKindSpec(kind);
  const formats = spec.acceptedMimeTypes
    .map((mime) => mime.replace("image/", "").toUpperCase())
    .map((name) => (name === "JPEG" ? "JPG" : name))
    .join(", ");
  const limitMb = Math.round(spec.maxFileBytes / (1024 * 1024));
  return (
    `Recomendado ${spec.recommendedWidth} × ${spec.recommendedHeight} px` +
    ` · ${formats} até ${limitMb} MB` +
    ` · abaixo de ${spec.minWidth} × ${spec.minHeight} px a imagem perde nitidez`
  );
}

/**
 * Um passo de transformação do Cloudinary.
 *
 * Tipado aqui e não no consumidor: com `Record<string, unknown>` cada app
 * precisava de um cast para o tipo do SDK, e um cast é justamente o lugar onde
 * um erro de forma deixa de ser detectado.
 */
export interface ImageTransformationStep {
  readonly width?: number;
  readonly height?: number;
  readonly crop?: "limit" | "fill" | "fit" | "thumb";
  readonly quality?: string;
  readonly fetch_format?: string;
}

/**
 * Transformação de armazenamento do Cloudinary.
 *
 * `crop: 'limit'` (e não `'fill'`) é o ponto inteiro deste módulo: o upload
 * guarda a imagem INTEIRA, só reduzida se exceder `maxDimension`. Recortar no
 * upload é destrutivo e irreversível — o enquadramento vive em `*_crop_data`,
 * que o dono da imagem pode reajustar quantas vezes quiser.
 */
export function storageTransformation(kind: unknown): ImageTransformationStep[] {
  const spec = imageKindSpec(kind);
  return [
    { width: spec.maxDimension, height: spec.maxDimension, crop: "limit" },
    { quality: "auto", fetch_format: "auto" },
  ];
}

/** Retângulo de recorte em pixels da imagem ORIGINAL. */
export interface CropRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Valida crop vindo do banco/API (JSONB é `unknown` até normalizar). */
export function isCropRect(value: unknown): value is CropRect {
  if (typeof value !== "object" || value === null) return false;
  const rect = value as Record<string, unknown>;
  // Origem tem que ser >= 0: coordenada negativa nao descreve area DENTRO da
  // imagem, e `cropToObjectPosition` a limitaria a 0 de qualquer forma —
  // persistir o valor so guardaria um retangulo que nunca sera respeitado.
  const nonNegative = (raw: unknown) => typeof raw === "number" && Number.isFinite(raw) && raw >= 0;
  const positive = (raw: unknown) => typeof raw === "number" && Number.isFinite(raw) && raw > 0;
  return nonNegative(rect.x) && nonNegative(rect.y) && positive(rect.width) && positive(rect.height);
}

/**
 * Converte o retângulo de recorte em `object-position` CSS.
 *
 * A imagem é exibida com `object-fit: cover` num contêiner de proporção fixa;
 * `object-position` desloca qual parte fica visível. Assim o recorte escolhido
 * pelo usuário é respeitado SEM cortar o arquivo, e continua reversível.
 *
 * Retorna o centro (`50% 50%`) quando não há recorte válido ou quando as
 * dimensões originais são desconhecidas — mesmo comportamento de antes.
 */
export function cropToObjectPosition(
  crop: unknown,
  originalWidth?: number | null,
  originalHeight?: number | null,
): string {
  if (!isCropRect(crop)) return "50% 50%";
  if (!originalWidth || !originalHeight || originalWidth <= 0 || originalHeight <= 0) return "50% 50%";

  // Espaço de sobra em cada eixo. Sem sobra (recorte ocupa o eixo inteiro), a
  // posição nesse eixo é irrelevante e 50% evita divisão por zero.
  const slackX = originalWidth - crop.width;
  const slackY = originalHeight - crop.height;
  const percentX = slackX > 0 ? (crop.x / slackX) * 100 : 50;
  const percentY = slackY > 0 ? (crop.y / slackY) * 100 : 50;

  const clamp = (value: number) => Math.min(100, Math.max(0, Math.round(value)));
  return `${clamp(percentX)}% ${clamp(percentY)}%`;
}

/* ------------------------------------------------------------------------ */
/* Imagens hospedadas pelo Google                                            */
/* ------------------------------------------------------------------------ */

/**
 * Reconhece URL do Google User Content (foto do login, imagem do Blogger).
 * Compara o hostname inteiro para não aceitar `googleusercontent.com.evil.tld`.
 */
export function isGoogleUserContentUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const { hostname } = new URL(url);
    return hostname === "googleusercontent.com" || hostname.endsWith(".googleusercontent.com");
  } catch {
    return false;
  }
}

/**
 * Pede ao Google a versão maior da imagem.
 *
 * O Google expressa tamanho de duas formas, e a implementação anterior
 * (`apps/mesas`) cobria só a primeira:
 *
 * - sufixo por `=`: `.../foto=s96-c` (foto de perfil do login)
 * - segmento de caminho: `.../w199-h200/arquivo.png` (Blogger, Sites)
 *
 * Medido em 2026-08-18 com a URL real de um avatar de mestre
 * (`blogger.googleusercontent.com/.../w199-h200/...`): o regex antigo
 * (`/=s\d+-c$/`) não casava, a função devolvia a URL intacta e o avatar era
 * exibido na resolução miniatura de 199px — ampliada pelo navegador, borrada.
 *
 * Devolve a URL inalterada quando não é do Google ou quando o formato não é
 * reconhecido: pedir tamanho maior é otimização, nunca requisito.
 */
export function upgradeGoogleImageQuality(url: string, size = 400): string {
  if (!isGoogleUserContentUrl(url)) return url;

  // `=s96-c`, `=s96`, `=w199-h200`, `=s96-c-k-no` etc.
  const suffixed = url.replace(/=(?:[swh]\d+|c|k|no|p|rw|rj|-)+$/i, `=s${size}-c`);
  if (suffixed !== url) return suffixed;

  // `/w199-h200/`, `/s96-c/`, `/w199-h200-p-k-no-nu/`
  const segmented = url.replace(
    /\/(?:[swh]\d+(?:-[swh]\d+)*)(?:-[a-z]{1,3})*\/(?=[^/]*$)/i,
    `/s${size}/`,
  );
  return segmented;
}

/** Enquadramento normalizado, pronto para `cropToObjectPosition`. */
export interface ImageFrame {
  readonly crop: CropRect | null;
  readonly width: number | null;
  readonly height: number | null;
}

/**
 * Normaliza o enquadramento vindo de API, JSONB ou localStorage.
 *
 * Esses valores são `unknown` até serem validados: JSONB aceita qualquer
 * forma, e o tipo declarado no TypeScript é promessa, não garantia. Sem esta
 * passagem, um retângulo malformado chegaria a `cropToObjectPosition` e
 * produziria `object-position` sem sentido — ou `NaN% NaN%`, que o navegador
 * descarta silenciosamente, devolvendo o recorte central que este módulo
 * inteiro existe para evitar.
 *
 * Aceita as chaves com prefixo (`avatar_crop_data`, `banner_width`, …) porque
 * é assim que backend e banco as nomeiam, e devolve sempre os três campos —
 * `null` quando o valor não sobrevive à validação.
 */
export function normalizeImageFrame(source: unknown, prefix: "avatar" | "banner"): ImageFrame {
  const record = (source ?? {}) as Record<string, unknown>;
  const rawCrop = record[`${prefix}_crop_data`];
  const rawWidth = record[`${prefix}_width`];
  const rawHeight = record[`${prefix}_height`];

  const dimension = (raw: unknown): number | null =>
    typeof raw === "number" && Number.isSafeInteger(raw) && raw > 0 ? raw : null;

  const width = dimension(rawWidth);
  const height = dimension(rawHeight);

  // Recorte sem as dimensões da imagem é inútil: a conversão para
  // `object-position` divide por elas. Guardar um sem o outro só produziria o
  // centro mais tarde, com aparência de dado válido.
  if (!isCropRect(rawCrop) || width === null || height === null) {
    return { crop: null, width, height };
  }

  return { crop: rawCrop, width, height };
}

/**
 * Enquadramento para ESCRITA, com três estados em vez de dois.
 *
 * `undefined` é o que distingue esta função de {@link normalizeImageFrame}:
 * na leitura, valor inválido vira `null` (exibe centralizado); na escrita,
 * ausência precisa continuar ausente, porque `undefined` é o que o Kysely lê
 * como "não mexe nesta coluna". Colapsar os dois apagaria o enquadramento
 * salvo em qualquer `PATCH` parcial que não falasse de imagem.
 */
export interface ImageFramePatch {
  readonly crop: CropRect | null | undefined;
  readonly width: number | null | undefined;
  readonly height: number | null | undefined;
}

function patchValue<T>(raw: unknown, accept: (value: unknown) => value is T): T | null | undefined {
  if (accept(raw)) return raw;
  if (raw === null) return null;
  return undefined;
}

function isPositiveSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

/** Normaliza o enquadramento vindo do corpo de uma requisição de escrita. */
export function normalizeImageFramePatch(source: unknown, prefix: "avatar" | "banner"): ImageFramePatch {
  const record = (source ?? {}) as Record<string, unknown>;
  return {
    crop: patchValue(record[`${prefix}_crop_data`], isCropRect),
    width: patchValue(record[`${prefix}_width`], isPositiveSafeInteger),
    height: patchValue(record[`${prefix}_height`], isPositiveSafeInteger),
  };
}
