import type { SyntheticEvent } from 'react';
import {
  cloudinarySrcset,
  imageKindWidths,
} from '@artificio/media/delivery-url';
import type { ImageKind } from '@artificio/media/image-kinds';
import bannerPlaceholder from '../assets/banner_placeholder.webp';
import { safeImageSrc } from './imageSource';

export function resolveTableImageSource(src?: string | null): string {
  return safeImageSrc(src, bannerPlaceholder);
}

export function applyTableImageFallback(event: SyntheticEvent<HTMLImageElement>): void {
  const img = event.currentTarget;
  if (img.dataset.fallbackApplied === 'true') return;
  img.dataset.fallbackApplied = 'true';
  // `srcset` PRIMEIRO, e não por estilo: com descritor de largura (`800w`) o
  // navegador ignora `src` por completo — a spec do HTML diz "if srcset uses
  // width descriptors, src is not considered". Trocar só o `src` aqui deixaria
  // a capa quebrada continuar quebrada, em silêncio, porque o navegador
  // seguiria escolhendo do `srcset` (spec 103, T2.2).
  img.srcset = '';
  img.sizes = '';
  img.src = bannerPlaceholder;
}

/**
 * Atributos responsivos de um `<img>` de capa.
 *
 * Existe para que o `srcset`, o `sizes` e o par `loading`/`decoding` sejam UMA
 * decisão, não quatro cópias: medido na spec 103 que a capa é renderizada em
 * `TableCard`, `TableHero`, `TableCardDashboard` e `MestreFeaturedTable`, cada
 * um com o seu `<img>` cru, e nenhum deles pedia tamanho — o navegador baixava
 * o arquivo inteiro para exibir em 420px (Lighthouse móvel: 10.644 KiB de
 * economia apontada, LCP 5,9 s).
 *
 * `sizes` é do CHAMADOR, não deste helper: ele descreve o espaço que a imagem
 * ocupa NAQUELE layout, e cada consumidor tem o seu. Passar um `sizes` de
 * mentira é pior que não ter `srcset`, porque o navegador acredita nele e pode
 * escolher uma variante menor que a caixa.
 *
 * Devolve `srcset: undefined` quando a URL não é nossa (link de terceiro,
 * placeholder do bundle): `srcset` com uma entrada só, igual ao `src`, não dá
 * escolha nenhuma ao navegador e só pesa o HTML. React omite o atributo.
 */
export interface TableImageAttrs {
  readonly src: string;
  readonly srcSet?: string;
  readonly sizes?: string;
  readonly loading: 'lazy' | 'eager';
  readonly decoding: 'async' | 'sync' | 'auto';
  readonly fetchPriority: 'high' | 'low' | 'auto';
}

export interface TableImageAttrsOpts {
  /** Descrição do espaço ocupado no layout do consumidor (atributo `sizes`). */
  readonly sizes: string;
  /**
   * `true` só para a imagem que é o LCP da página (herói, primeiro card).
   * Marcar tudo como prioritário é o mesmo que não marcar nada: o navegador
   * perde o critério para ordenar a fila.
   */
  readonly priority?: boolean;
  /** Tipo de imagem, que define as larguras disponíveis. */
  readonly kind?: ImageKind;
}

export function tableImageAttrs(
  rawSrc: string | null | undefined,
  { sizes, priority = false, kind = 'table_banner' }: TableImageAttrsOpts,
): TableImageAttrs {
  const src = resolveTableImageSource(rawSrc);
  const srcSet = cloudinarySrcset(src, imageKindWidths(kind));

  return {
    src,
    srcSet: srcSet || undefined,
    sizes: srcSet ? sizes : undefined,
    // Imagem do LCP não pode ser `lazy`: o navegador a adiaria justamente na
    // métrica que ela domina.
    loading: priority ? 'eager' : 'lazy',
    decoding: priority ? 'sync' : 'async',
    fetchPriority: priority ? 'high' : 'auto',
  };
}

export { bannerPlaceholder };
