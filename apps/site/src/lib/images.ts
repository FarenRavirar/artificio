import { cloudinaryDeliveryUrl, cloudinarySrcset } from "@artificio/media/delivery-url";

/**
 * Capa de post do blog, entregue no tamanho que o layout pede.
 *
 * Camada fina sobre `@artificio/media/delivery-url` desde a spec 103 (T2.4).
 * Antes deste arquivo consumir o pacote, ele mantinha a própria cópia da
 * montagem de URL, e a divergência foi medida em cinco pontos:
 *
 * - `isCloudinaryImage` aceitava QUALQUER `res.cloudinary.com`, inclusive conta
 *   de terceiro, e reescrevia o caminho alheio — 404;
 * - separava os parâmetros por vírgula, e a doc oficial pede barra ("they
 *   should be specified as separate components... separating them with a slash
 *   (`/`), not a comma");
 * - larguras `[360, 540, 720, 960]` escritas à mão;
 * - nenhuma guarda de idempotência: duas chamadas empilhavam `w_` sobre `w_`;
 * - nada disso era testado.
 *
 * O `c_fill` **continua**, e é a razão pela qual a opção existe no pacote: capa
 * de post não tem enquadramento de dono para respeitar, ao contrário do banner
 * de mesa, então recortar na entrega é a intenção aqui.
 */

/**
 * Proporção do card, medida em `Card.astro:10-11`: `720×405` no card grande e
 * `360×203` no normal — 16/9 nos dois. Não é a do `og:image` (1200×630), que é
 * outra imagem e outro consumo.
 *
 * O número precisa casar com o `width`/`height` que o `<img>` declara: `ar_`
 * diferente do atributo produz a mesma imagem com outro recorte, e o navegador
 * reserva espaço pela declaração.
 */
const PROPORCAO_CAPA = "16/9";

/**
 * Larguras da capa do blog. Começam nas duas que `Card.astro` declara (360 e
 * 720) e dobram a partir delas, porque o navegador escolhe por largura de
 * layout × DPR, e DPR vem em 1x/2x/3x.
 */
const LARGURAS_CAPA = [360, 540, 720, 1080, 1440] as const;

export function optimizedImageUrl(url: string, width: number): string {
  if (!url) return url;
  return cloudinaryDeliveryUrl(url, width, { recortarNaProporcao: PROPORCAO_CAPA });
}

export function responsiveSrcSet(
  url: string,
  widths: readonly number[] = LARGURAS_CAPA,
): string {
  if (!url) return "";
  return cloudinarySrcset(url, widths, { recortarNaProporcao: PROPORCAO_CAPA });
}
