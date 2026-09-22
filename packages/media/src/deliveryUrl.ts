/**
 * URL de ENTREGA do Cloudinary: a mesma imagem armazenada, servida no tamanho
 * e formato que o navegador do visitante pede.
 *
 * Distinto de `storageTransformation` (`imageKinds.ts`), que decide o que é
 * GRAVADO — ali a regra é `crop: 'limit'`, nunca descartar pixel. Aqui nada é
 * gravado: a transformação vive na URL, o Cloudinary a aplica na borda e
 * cacheia o resultado. Trocar a largura não custa upload nem perde original.
 *
 * Por que existe (spec 103, T2.1): medido em produção que o `mesas` servia o
 * arquivo ORIGINAL em todo card do catálogo — 10.644 KiB de economia de imagem
 * apontados pelo Lighthouse móvel, LCP de 5,9 s. O `<img>` pedia a URL crua,
 * sem `w_`, então o navegador baixava 1600px para exibir em 400.
 *
 * Isomórfico de propósito, igual `imageKinds.ts`: sem `node:*` e sem DOM, para
 * o frontend montar `srcset` e o backend montar `og:image` com a mesma função.
 * Um lugar só decide a forma da URL.
 */

import {
  imageKindSpec,
  isArtificioHostedImage,
  isCloudinaryTransformationSegment,
} from "./imageKinds.js";

/**
 * Parâmetros de entrega, na ordem e na forma da doc oficial do Cloudinary.
 *
 * `q_auto` deixa o Cloudinary escolher a compressão por análise do conteúdo;
 * `f_auto` negocia o formato pelo `Accept` do navegador (WebP/AVIF onde há
 * suporte, original onde não há). Nenhum dos dois recorta: o enquadramento
 * continua sendo `object-position` a partir do crop salvo pelo dono da imagem
 * (`plan.md` §3.3 — `c_fill`/`g_auto` jogaria fora essa escolha).
 *
 * A separação é por BARRA, não por vírgula. A doc de transformação descreve a
 * barra como encadeamento de componentes e a vírgula como composição dentro de
 * um componente; para estes três parâmetros as duas formas entregam o mesmo
 * arquivo (medido: 2.008 bytes nas duas), e seguir a doc é o que mantém a URL
 * legível quando alguém acrescentar um passo que dependa da ordem.
 */
const PREFIXO_ENTREGA = "q_auto/f_auto";

/** O segmento é a versão que o Cloudinary grava na URL (`v1788537783`)? */
function ehSegmentoDeVersao(segmento: string | undefined): boolean {
  return /^v\d+$/.test(segmento ?? "");
}

export interface DeliveryOpts {
  /**
   * Recortar no SERVIDOR, na proporção informada (`"1200/650"`, `"16/10"`).
   *
   * Omitir é o padrão, e é o que os apps com enquadramento do usuário usam: o
   * recorte vive em `object-position` a partir do crop salvo, e `c_fill` o
   * jogaria fora (spec 103, `plan.md` §3.3).
   *
   * Existe porque o `site` tem o caso oposto e legítimo: capa de post não tem
   * crop de dono nenhum, e ali recortar na entrega é a intenção. Antes desta
   * opção, o `site` mantinha a própria cópia da função
   * (`apps/site/src/lib/images.ts`) só por causa disso — divergência que a
   * regra §Compartilhado por padrão nomeia como o defeito.
   */
  readonly recortarNaProporcao?: string;
}

/**
 * Devolve a URL da imagem pedindo `largura` pixels de largura.
 *
 * Devolve a URL **intacta**, sem lançar, em todo caso que não seja um upload
 * nosso sem transformação. Pedir tamanho é otimização, nunca requisito: uma URL
 * que este módulo não entende tem que continuar carregando a imagem.
 *
 * Intacta quando:
 * - não é imagem hospedada na nossa conta (`isArtificioHostedImage`) — o mestre
 *   pode colar link de terceiro, e reescrever o caminho dele daria 404;
 * - a URL já traz transformação — quem a montou decidiu o tamanho, e empilhar
 *   um segundo `w_` mudaria o resultado de forma que ninguém pediu;
 * - `largura` não é inteiro positivo.
 */
export function cloudinaryDeliveryUrl(
  url: string,
  largura: number,
  opts: DeliveryOpts = {},
): string {
  if (!Number.isSafeInteger(largura) || largura <= 0) return url;
  if (!isArtificioHostedImage(url)) return url;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }

  const segmentos = parsed.pathname.split("/").filter(Boolean);
  const posUpload = segmentos.indexOf("upload");
  // `isArtificioHostedImage` já exigiu `upload` e a pasta na posição certa;
  // a checagem fica porque o índice é usado para fatiar o caminho.
  if (posUpload === -1) return url;

  const posSeguinte = posUpload + 1;
  const seguinte = segmentos[posSeguinte];
  // Agora que `isArtificioHostedImage` reconhece a URL transformada como nossa,
  // esta guarda é o que impede empilhar um segundo `w_` sobre o primeiro.
  if (!ehSegmentoDeVersao(seguinte) && isCloudinaryTransformationSegment(seguinte)) return url;

  // `ar_` + `c_fill` num componente SÓ, separado por vírgula: são parâmetros da
  // mesma ação (recortar nesta proporção), e a doc reserva a barra para ações
  // encadeadas. Proporção inválida é ignorada em vez de virar `ar_undefined`.
  // `c_limit` no ramo sem recorte: sem modo de corte o Cloudinary usa `c_scale`,
  // que AMPLIA quando a largura pedida passa do original. Medido em 2026-09-22
  // num avatar de 241×250: `w_746` devolveu 746×774 e **127 KiB**, contra 24 KiB
  // do arquivo gravado — 5× o peso sem um pixel de detalhe a mais, e um `srcset`
  // declarando largura que o bitmap não tem. `c_limit` reduz quando cabe e
  // devolve o original quando não cabe, então o teto passa a ser o arquivo e não
  // a URL (doc: cloudinary.com/documentation/resizing_and_cropping).
  //
  // O ramo com `c_fill` fica intacto: ali recortar é a intenção declarada por
  // `recortarNaProporcao`, e `c_fill` já preenche a caixa sem ampliar além do
  // necessário.
  const recorte = normalizarProporcao(opts.recortarNaProporcao);
  const passos = recorte
    ? `${PREFIXO_ENTREGA}/ar_${recorte},c_fill/w_${largura}`
    : `${PREFIXO_ENTREGA}/w_${largura},c_limit`;

  segmentos.splice(posSeguinte, 0, passos);
  parsed.pathname = `/${segmentos.join("/")}`;
  return parsed.toString();
}

/** `"1200 / 650"` → `"1200:650"`, a forma que o `ar_` aceita. */
function normalizarProporcao(raw: string | undefined): string | null {
  if (!raw) return null;
  const limpo = raw.replace(/\s+/g, "");
  const par = /^(\d+)[/:](\d+)$/.exec(limpo);
  if (!par || par[2] === "0") return null;
  return `${par[1]}:${par[2]}`;
}

/**
 * `srcset` com uma entrada por largura, para o navegador escolher pelo
 * viewport e pelo DPR dele.
 *
 * Larguras duplicadas são colapsadas e a lista sai ordenada: `srcset` fora de
 * ordem é válido, mas ilegível no DevTools, e é lá que se confere qual arquivo
 * o navegador pediu.
 *
 * Devolve string vazia quando a URL não é nossa: `srcset` com uma entrada só,
 * apontando para a mesma URL do `src`, não daria escolha nenhuma ao navegador e
 * só pesaria o HTML. O consumidor omite o atributo nesse caso.
 */
export function cloudinarySrcset(
  url: string,
  larguras: readonly number[],
  opts: DeliveryOpts = {},
): string {
  if (!isArtificioHostedImage(url)) return "";

  const validas = Array.from(new Set(larguras))
    .filter((largura) => Number.isSafeInteger(largura) && largura > 0)
    .sort((a, b) => a - b);

  const entradas = validas
    .map((largura) => {
      const transformada = cloudinaryDeliveryUrl(url, largura, opts);
      // URL que voltou intacta significa que já tinha transformação: incluí-la
      // ofereceria o MESMO arquivo em várias larguras declaradas, e o navegador
      // acreditaria na declaração.
      return transformada === url ? null : `${transformada} ${largura}w`;
    })
    .filter((entrada): entrada is string => entrada !== null);

  return entradas.join(", ");
}

/**
 * Larguras de entrega de um tipo de imagem, derivadas de `IMAGE_KINDS`.
 *
 * Não são números escolhidos à mão (spec 103, T2.2). Os dois extremos já estão
 * no contrato de cada tipo e significam coisas diferentes:
 *
 * - `minWidth` é o piso abaixo do qual o resultado degrada de forma visível —
 *   servir menos que isso é o defeito que a largura fixa causaria;
 * - `maxDimension` é o teto do que existe gravado — pedir mais só faria o
 *   Cloudinary reentregar o mesmo arquivo com um `w_` maior na URL, e o
 *   `srcset` declararia uma largura que o arquivo não tem.
 *
 * Entre os dois, dobrar: é o passo que o `srcset` quer, porque o navegador
 * escolhe por largura de layout × DPR, e DPR vem em 1x/2x/3x. Passo menor
 * multiplicaria variantes em cache sem mudar o arquivo que o navegador pede.
 *
 * `recommendedWidth` entra porque é a largura do maior consumo real (o
 * `og:image`), e ela não cai necessariamente na progressão.
 */
export function imageKindWidths(kind: unknown): readonly number[] {
  const spec = imageKindSpec(kind);
  const larguras = new Set<number>([spec.recommendedWidth, spec.maxDimension]);

  for (let largura = spec.minWidth; largura < spec.maxDimension; largura *= 2) {
    larguras.add(largura);
  }

  return Array.from(larguras).sort((a, b) => a - b);
}
