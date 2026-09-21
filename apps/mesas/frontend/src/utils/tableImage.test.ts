import { describe, expect, it } from 'vitest';
import {
  applyTableImageFallback,
  avatarSrc,
  bannerPlaceholder,
  resolveTableImageSource,
  tableImageAttrs,
} from './tableImage';

/**
 * Capa hospedada na nossa conta, na forma que produção serve. A pasta importa:
 * `isArtificioHostedImage` decide por ela se a URL é nossa.
 */
const CAPA_NOSSA =
  'https://res.cloudinary.com/dnln0btbo/image/upload/v1788537783/mesas_rpg/abc123.jpg';

const SIZES = '(min-width: 1280px) 420px, 100vw';

describe('tableImageAttrs', () => {
  it('monta `srcset` com ao menos 3 larguras para capa nossa', () => {
    const attrs = tableImageAttrs(CAPA_NOSSA, { sizes: SIZES });

    const entradas = (attrs.srcSet ?? '').split(', ').filter(Boolean);
    expect(entradas.length).toBeGreaterThanOrEqual(3);
    for (const entrada of entradas) {
      expect(entrada).toMatch(/\/upload\/q_auto\/f_auto\/w_\d+\/.+ \d+w$/);
    }
  });

  it('acompanha `sizes` sempre que há `srcset`', () => {
    const attrs = tableImageAttrs(CAPA_NOSSA, { sizes: SIZES });
    // `srcset` de descritor `w` sem `sizes` faz o navegador assumir `100vw` e
    // baixar a maior variante — o oposto do que a tarefa existe para resolver.
    expect(attrs.srcSet).toBeTruthy();
    expect(attrs.sizes).toBe(SIZES);
  });

  it.each([
    ['link de terceiro', 'https://exemplo.com/capa.jpg'],
    ['Cloudinary de outra conta', 'https://res.cloudinary.com/demo/image/upload/v1/x.jpg'],
  ])('não emite `srcset` nem `sizes` para %s', (_caso, url) => {
    const attrs = tableImageAttrs(url, { sizes: SIZES });
    expect(attrs.srcSet).toBeUndefined();
    // Sem `srcset`, um `sizes` sozinho não descreve nada.
    expect(attrs.sizes).toBeUndefined();
    expect(attrs.src).toBe(url);
  });

  it('cai no placeholder do bundle quando o src não é utilizável', () => {
    const attrs = tableImageAttrs(null, { sizes: SIZES });
    expect(attrs.src).toBe(bannerPlaceholder);
    expect(attrs.srcSet).toBeUndefined();
  });

  it('imagem comum é preguiçosa; a do LCP não', () => {
    const comum = tableImageAttrs(CAPA_NOSSA, { sizes: SIZES });
    expect(comum.loading).toBe('lazy');
    expect(comum.fetchPriority).toBe('auto');

    const lcp = tableImageAttrs(CAPA_NOSSA, { sizes: SIZES, priority: true });
    expect(lcp.loading).toBe('eager');
    expect(lcp.fetchPriority).toBe('high');
  });

  it('larguras vêm do tipo de imagem, não de número fixo', () => {
    const banner = tableImageAttrs(CAPA_NOSSA, { sizes: SIZES, kind: 'table_banner' });
    const avatar = tableImageAttrs(CAPA_NOSSA, { sizes: SIZES, kind: 'profile_avatar' });
    // `profile_avatar` tem `maxDimension` 1024 contra 1600 do banner, então as
    // listas não podem coincidir.
    expect(banner.srcSet).not.toBe(avatar.srcSet);
    expect(banner.srcSet).toContain('w_1600');
    expect(avatar.srcSet).not.toContain('w_1600');
  });

  it('nenhuma largura passa do que existe gravado', () => {
    const attrs = tableImageAttrs(CAPA_NOSSA, { sizes: SIZES, kind: 'table_banner' });
    const larguras = [...(attrs.srcSet ?? '').matchAll(/ (\d+)w/g)].map((m) => Number(m[1]));
    expect(larguras.length).toBeGreaterThan(0);
    expect(Math.max(...larguras)).toBeLessThanOrEqual(1600);
  });
});

describe('applyTableImageFallback', () => {
  function imgComSrcset(): HTMLImageElement {
    const img = document.createElement('img');
    img.src = CAPA_NOSSA;
    img.srcset = `${CAPA_NOSSA} 800w`;
    img.sizes = SIZES;
    return img;
  }

  it('limpa `srcset` ao aplicar o placeholder', () => {
    const img = imgComSrcset();

    applyTableImageFallback({ currentTarget: img } as never);

    // Sem isto o placeholder não aparece: com descritor de largura o navegador
    // ignora `src` e continua escolhendo do `srcset` — a capa quebrada ficaria
    // quebrada, em silêncio (spec 103, T2.2).
    expect(img.srcset).toBe('');
    expect(img.getAttribute('sizes')).toBe('');
    expect(img.src).toContain(bannerPlaceholder);
  });

  it('não reaplica quando o próprio placeholder falha', () => {
    const img = imgComSrcset();

    applyTableImageFallback({ currentTarget: img } as never);
    const depoisDaPrimeira = img.src;
    img.src = 'https://exemplo.com/outra.jpg';
    applyTableImageFallback({ currentTarget: img } as never);

    // Segunda passagem é no-op: sem a trava, um placeholder que falha entraria
    // em laço de `onError`.
    expect(img.src).toBe('https://exemplo.com/outra.jpg');
    expect(depoisDaPrimeira).toContain(bannerPlaceholder);
  });
});

describe('resolveTableImageSource', () => {
  it('preserva a URL utilizável', () => {
    expect(resolveTableImageSource(CAPA_NOSSA)).toBe(CAPA_NOSSA);
  });

  it.each([null, undefined, '', '   ', 'data:image/png;base64,quebrado aqui'])(
    'cai no placeholder para src inutilizável: %s',
    (src) => {
      expect(resolveTableImageSource(src)).toBe(bannerPlaceholder);
    },
  );
});

/**
 * Avatar hospedado na nossa conta, na forma que produção servia: SEM
 * transformação nenhuma. Foi essa forma que somou 507 KiB em 6 URLs na medição de
 * 2026-09-21, uma delas com 217 KiB para 24 px de exibição.
 */
const AVATAR_NOSSO =
  'https://res.cloudinary.com/dnln0btbo/image/upload/v1788501588/artificio_avatars/abc123.png';

describe('avatarSrc', () => {
  it('pede o dobro da largura de layout, para cobrir tela 2x', () => {
    expect(avatarSrc(AVATAR_NOSSO, 24)).toContain('/w_48/');
    expect(avatarSrc(AVATAR_NOSSO, 120)).toContain('/w_240/');
  });

  it('entrega com `q_auto`/`f_auto`, não o arquivo original', () => {
    const url = avatarSrc(AVATAR_NOSSO, 24) ?? '';
    expect(url).toContain('q_auto');
    expect(url).toContain('f_auto');
    expect(url).not.toBe(AVATAR_NOSSO);
  });

  it('devolve `undefined` sem src, para o React omitir o atributo', () => {
    expect(avatarSrc(null, 24)).toBeUndefined();
    expect(avatarSrc(undefined, 24)).toBeUndefined();
    expect(avatarSrc('', 24)).toBeUndefined();
  });

  it('não reescreve URL de terceiro: reescrever daria 404', () => {
    const alheia = 'https://exemplo.com/image/upload/v1/artificio_avatars/foto.jpg';
    expect(avatarSrc(alheia, 24)).toBe(alheia);
  });

  it('não empilha transformação sobre URL que já tem uma', () => {
    const jaTransformada =
      'https://res.cloudinary.com/dnln0btbo/image/upload/w_300/v1788501588/artificio_avatars/abc123.png';
    expect(avatarSrc(jaTransformada, 24)).toBe(jaTransformada);
  });
});
