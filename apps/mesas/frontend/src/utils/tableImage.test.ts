import { describe, expect, it } from 'vitest';
import { imageKindWidths } from '@artificio/media/delivery-url';
import {
  applyTableImageFallback,
  uploadImageAttrs,
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
      expect(entrada).toMatch(/\/upload\/q_auto\/f_auto\/w_\d+,c_limit\/.+ \d+w$/);
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

describe('uploadImageAttrs', () => {
  it('monta `srcset` com as larguras do registro, sem número escrito à mão', () => {
    const attrs = uploadImageAttrs(AVATAR_NOSSO, '64px');
    const entradas = (attrs.srcSet ?? '').split(', ').filter(Boolean);

    // A lista É `imageKindWidths('profile_avatar')`. Fixar os números aqui
    // recriaria a segunda fonte de verdade que esta refatoração removeu.
    const larguras = entradas.map((e) => Number(/w_(\d+),/.exec(e)?.[1]));
    expect(larguras).toEqual([...imageKindWidths('profile_avatar')]);
  });

  it('acompanha `sizes` sempre que há `srcset`', () => {
    const attrs = uploadImageAttrs(AVATAR_NOSSO, '(max-width: 768px) 320px, 373px');
    expect(attrs.srcSet).toBeTruthy();
    expect(attrs.sizes).toBe('(max-width: 768px) 320px, 373px');
  });

  it('entrega com `q_auto`/`f_auto` e `c_limit` em cada candidata', () => {
    const entradas = (uploadImageAttrs(AVATAR_NOSSO, '64px').srcSet ?? '').split(', ');
    for (const entrada of entradas) {
      expect(entrada).toMatch(/\/upload\/q_auto\/f_auto\/w_\d+,c_limit\/.+ \d+w$/);
      expect(entrada).not.toContain('c_scale');
    }
  });

  it('sem src devolve `src: undefined`, para o React omitir o atributo', () => {
    for (const vazio of [null, undefined, '']) {
      const attrs = uploadImageAttrs(vazio, '64px');
      expect(attrs.src).toBeUndefined();
      expect(attrs.srcSet).toBeUndefined();
    }
  });

  /**
   * URL que não é nossa sai SEM `srcSet` e sem `sizes`: uma entrada só, igual ao
   * `src`, não dá escolha nenhuma ao navegador e só pesa o HTML. O `src` tem que
   * sobreviver intacto — reescrever caminho de terceiro daria 404.
   */
  it.each([
    ['de terceiro', 'https://exemplo.com/image/upload/v1/artificio_avatars/foto.jpg'],
    [
      'já transformada',
      'https://res.cloudinary.com/dnln0btbo/image/upload/w_300/v1788501588/artificio_avatars/a.png',
    ],
  ])('URL %s: mantém o `src` e omite `srcSet`', (_caso, url) => {
    const attrs = uploadImageAttrs(url, '64px');
    expect(attrs.src).toBe(url);
    expect(attrs.srcSet).toBeUndefined();
    expect(attrs.sizes).toBeUndefined();
  });

  /**
   * O avatar do herói do perfil é candidato a LCP; os demais são decoração abaixo
   * da dobra. Marcar tudo como prioritário é o mesmo que não marcar nada.
   */
  it('só o avatar prioritário é `eager`', () => {
    expect(uploadImageAttrs(AVATAR_NOSSO, '96px', { priority: true }).loading).toBe('eager');
    expect(uploadImageAttrs(AVATAR_NOSSO, '64px').loading).toBe('lazy');
  });

  /**
   * O `kind` é parâmetro, e não constante, porque a primeira versão desta função
   * era `avatarAttrs` com `'profile_avatar'` fixo — e na rodada seguinte o banner
   * de `MasterHero` precisou de `'profile_banner'`, que a forma fixa não servia.
   * As larguras têm que seguir o registro de CADA tipo, não um só.
   */
  it.each(['profile_avatar', 'profile_banner', 'table_banner'] as const)(
    'larguras de `%s` vêm do registro daquele tipo',
    (kind) => {
      const attrs = uploadImageAttrs(AVATAR_NOSSO, '100vw', { kind });
      const larguras = (attrs.srcSet ?? '')
        .split(', ')
        .filter(Boolean)
        .map((entrada) => Number(/w_(\d+),/.exec(entrada)?.[1]));

      expect(larguras).toEqual([...imageKindWidths(kind)]);
    },
  );
});
