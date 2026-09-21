import { cloudinaryDeliveryUrl, cloudinarySrcset } from "@artificio/media/delivery-url";

/**
 * Logo de grupo, entregue no tamanho em que é exibida.
 *
 * Existe por uma medição da spec 103 (T2.4): os três `<img>` de logo pediam a
 * URL crua do Cloudinary. Medido em `links.artificiorpg.com/api/groups`, com os
 * 13 grupos publicados (12 com logo na nossa conta, 1 sem, nenhum de terceiro):
 * **955.063 bytes** de logo para preencher caixas de 52px. As mesmas 12 imagens
 * com `q_auto/f_auto/w_208` e `Accept: image/avif,image/webp` pesam **94.626
 * bytes** — 840 KiB a menos, 90%. A maior logo sozinha passava de 143 KiB.
 *
 * Nada aqui monta URL: a forma vive em `@artificio/media/delivery-url`, um
 * lugar só para todo o monorepo. Este arquivo só declara as larguras que o
 * layout do `links` pede.
 */

/**
 * Logo do card, na prateleira e em `CommunityGroups`.
 *
 * A exibição é **52px**, de `global.css:230-232` (`.card .logo`) — não os 104 do
 * atributo `width`. O atributo continua onde está: ele reserva o espaço na
 * proporção certa (1:1) antes da imagem chegar, e mudá-lo é decisão de layout,
 * não desta otimização.
 *
 * As três larguras cobrem 1x, 2x e 3x sobre os 52px reais. Acima de 208 não há
 * consumo: nenhum ponto do `links` exibe logo de card maior que isso.
 */
const LARGURAS_CARD = [52, 104, 208] as const;

/**
 * Logo da página do grupo (`grupo/[slug].astro`), exibida a **128px** — o
 * atributo `width`, já que `.logo-lg` (`global.css:657`) não declara tamanho.
 */
const LARGURAS_DETALHE = [128, 256, 384] as const;

export interface LogoAttrs {
  readonly src: string;
  readonly srcset?: string;
  readonly sizes?: string;
}

/**
 * Atributos da logo para o tamanho de exibição pedido.
 *
 * `srcset` e `sizes` saem juntos ou não saem: com descritor `w`, `srcset` sem
 * `sizes` faz o navegador assumir `100vw` e escolher o maior arquivo, que é o
 * oposto do que esta função existe para fazer. Logo de terceiro ou ausente volta
 * como `src` puro — `cloudinarySrcset` devolve string vazia, e reescrever
 * caminho alheio daria 404.
 *
 * O tamanho é FIXO em CSS nos dois casos, então `sizes` é um valor em px e não
 * uma consulta de viewport.
 */
export function groupLogoAttrs(
  rawSrc: string | null | undefined,
  tamanho: "card" | "detalhe",
): LogoAttrs {
  const src = rawSrc || "/placeholder.svg";
  const larguras = tamanho === "card" ? LARGURAS_CARD : LARGURAS_DETALHE;
  const exibida = larguras[0];

  const srcset = cloudinarySrcset(src, larguras);
  if (!srcset) return { src };

  return {
    // O `src` também pede tamanho: ele é o que navegador antigo (sem `srcset`)
    // e leitor de feed baixam.
    src: cloudinaryDeliveryUrl(src, exibida * 2),
    srcset,
    sizes: `${exibida}px`,
  };
}
