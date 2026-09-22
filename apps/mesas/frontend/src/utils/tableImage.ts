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

export interface UploadImageAttrsOpts {
  /** `true` só para a imagem que é o LCP da página. */
  readonly priority?: boolean;
  /** Tipo de imagem, que define as larguras disponíveis. */
  readonly kind?: ImageKind;
}

/** Atributos responsivos de um `<img>` que NÃO tem placeholder de capa. */
export interface UploadImageAttrs {
  readonly src: string | undefined;
  readonly srcSet?: string;
  readonly sizes?: string;
  readonly loading: 'lazy' | 'eager';
  readonly decoding: 'async' | 'sync' | 'auto';
}

/**
 * Atributos responsivos de qualquer imagem nossa que não seja capa de mesa —
 * avatar, banner de perfil — na mesma forma que `tableImageAttrs` usa para a
 * capa: `srcset` com as larguras do registro, `sizes` descrevendo a caixa, e a
 * escolha do arquivo feita pelo NAVEGADOR, com a geometria real que só ele
 * conhece.
 *
 * **O `kind` é parâmetro, não constante.** A primeira versão desta função era
 * `uploadImageAttrs`, com `'profile_avatar'` fixo — e na rodada seguinte o banner de
 * `MasterHero` precisou do mesmo tratamento com `'profile_banner'`, que a forma
 * fixa não servia. Caso particular vira duplicação na primeira vez que o segundo
 * caso aparece (AGENTS.md §Compartilhado por padrão).
 *
 * Separada de `tableImageAttrs` por UMA diferença real: a capa cai no
 * `bannerPlaceholder` do bundle quando não há URL, e avatar/banner somem — quem
 * decide o que aparece no lugar é o consumidor, que tem inicial do nome ou
 * bloco vazio para mostrar.
 *
 * Existe porque o avatar era o único consumo de imagem do `mesas` que não passava
 * por `@artificio/media`: medido em produção em 2026-09-21, 6 URLs saíam como
 * `/upload/v17…/artificio_avatars/…`, sem transformação nenhuma, somando **507 KiB**
 * — a maior com 217 KiB para renderizar em 24 px (`TableCard`).
 *
 * **A primeira versão pedia UMA largura fixa por consumidor, e isso foi o defeito.**
 * A revisão da PR #330 achou três valores errados em três rodadas — 240 (era o
 * `max-width` do mobile), 280 (era a largura, não o eixo limitante) e por fim o
 * próprio eixo: `.mestre-bio-photo img` tem `aspect-ratio: 3 / 4` e
 * `object-fit: cover` (`MestrePage.css:363-366`), então a caixa mede 280×373 e é a
 * ALTURA que manda. Cada correção acertava um número e deixava o seguinte errado,
 * porque um número copiado do CSS para o TypeScript é duas fontes para o mesmo
 * fato — e elas divergem na primeira vez que alguém mexe no CSS.
 *
 * `sizes` não tem esse problema: ele é a MESMA linguagem do CSS, avaliada contra o
 * viewport real, e a própria media query que muda o layout muda o `sizes` junto.
 * O que era número mágico vira descrição, e `object-fit: cover` deixa de importar —
 * o navegador já resolve a proporção ao escolher a candidata.
 *
 * `imageKindWidths('profile_avatar')` devolve `[140, 280, 560, 1024]`, medido: cobre
 * de 24 px em tela 1x até os 373 px da bio em DPR 2. A justificativa que a versão
 * anterior dava para não usar `srcset` — "só ofereceria candidatas grandes demais" —
 * era falsa, e o `srcset` da capa já provava o contrário no mesmo arquivo.
 *
 * URL que não é nossa (link de terceiro, já transformada) sai sem `srcSet`:
 * `cloudinarySrcset` devolve string vazia, e uma entrada só, igual ao `src`, não dá
 * escolha nenhuma ao navegador e só pesa o HTML.
 */
export function uploadImageAttrs(
  rawSrc: string | null | undefined,
  sizes: string,
  { priority = false, kind = 'profile_avatar' }: UploadImageAttrsOpts = {},
): UploadImageAttrs {
  if (!rawSrc) {
    return { src: undefined, loading: 'lazy', decoding: 'async' };
  }

  const srcSet = cloudinarySrcset(rawSrc, imageKindWidths(kind));

  return {
    src: rawSrc,
    srcSet: srcSet || undefined,
    sizes: srcSet ? sizes : undefined,
    loading: priority ? 'eager' : 'lazy',
    decoding: priority ? 'sync' : 'async',
  };
}

export { bannerPlaceholder };
