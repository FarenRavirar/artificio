// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { SCRIM_PADRAO, useBannerScrim } from './useBannerScrim';

/**
 * O véu do hero se dimensiona pela imagem que o mestre subiu. Estes testes
 * travam a REGRA de contraste — a leitura de canvas em si depende do browser e
 * é exercitada em beta.
 *
 * Origem (achado do mantenedor, 2026-09-04): o scrim era fixo em 0,88 para
 * qualquer banner, calibrado para o pior caso. Medido nesta página, a foto tem
 * luminância p90 ≈ 0,2 e precisaria de 0,09 para passar AA — levava 0,88, e o
 * contraste dava 12,72:1 onde 4,5 bastava. Resultado: a foto escolhida pelo
 * mestre praticamente desaparecia sob o véu.
 */

const luminancia = (r: number, g: number, b: number) => {
  const [rs, gs, bs] = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
};

const NAVY = luminancia(15, 24, 48);
const compor = (L: number, a: number) => L * (1 - a) + NAVY * a;
const contraste = (L: number) => 1.05 / (L + 0.05);

/** Espelha `opacidadeNecessaria` + os pisos aplicados no hook. */
const PISO = 0.28;
function scrimPara(L: number) {
  const necessaria = (alvo: number) => {
    const lMax = 1.05 / alvo - 0.05;
    if (L <= lMax) return 0;
    return Math.min(0.94, Math.max(0, (L - lMax) / (L - NAVY)));
  };
  return {
    bottom: Math.max(PISO, necessaria(6)),
    top: Math.max(PISO * 0.8, necessaria(4.5)),
  };
}

describe('scrim adaptativo do banner', () => {
  const CENARIOS = [
    { nome: 'quase preto', L: 0.05 },
    { nome: 'escuro (o banner real desta página)', L: 0.118 },
    { nome: 'escuro-médio', L: 0.2 },
    { nome: 'médio', L: 0.4 },
    { nome: 'claro (céu/areia)', L: 0.62 },
    { nome: 'muito claro', L: 0.85 },
    { nome: 'branco', L: 1.0 },
  ];

  it.each(CENARIOS)('$nome: texto claro mantém AA sobre o véu', ({ L }) => {
    const { bottom, top } = scrimPara(L);
    // 4.5:1 no corpo do hero, 3:1 no topo (título é texto grande).
    expect(contraste(compor(L, bottom))).toBeGreaterThanOrEqual(4.5);
    expect(contraste(compor(L, top))).toBeGreaterThanOrEqual(3);
  });

  it('foto escura recebe MUITO menos véu que o fixo antigo — era o defeito', () => {
    const { bottom } = scrimPara(0.118);
    expect(bottom).toBe(PISO);
    expect(SCRIM_PADRAO.bottom - bottom).toBeGreaterThan(0.5);
  });

  it('banner branco continua recebendo o véu forte — nada foi afrouxado', () => {
    const { bottom } = scrimPara(1.0);
    expect(bottom).toBeGreaterThanOrEqual(SCRIM_PADRAO.bottom - 0.01);
  });

  it('o véu cresce junto com a luminância, sem degraus invertidos', () => {
    const valores = CENARIOS.map((c) => scrimPara(c.L).bottom);
    const ordenado = [...valores].sort((a, b) => a - b);
    expect(valores).toEqual(ordenado);
  });

  it('nunca zera: o piso separa a foto do texto mesmo na imagem mais escura', () => {
    expect(scrimPara(0).bottom).toBe(PISO);
  });

  it('o padrão de fallback é o comportamento de hoje — falha de CORS não regride', () => {
    expect(SCRIM_PADRAO).toEqual({ top: 0.72, bottom: 0.88, left: 0.64, right: 0.36 });
  });
});

/**
 * A medição pertence a UM `src`. Trocar de banner precisa cair no padrão
 * conservador até a nova foto carregar — reusar o véu da anterior deixaria uma
 * foto clara com o véu leve calculado para uma escura, e o texto ilegível na
 * janela entre as duas (achado de review, PR #307).
 */
describe('useBannerScrim — a medida não sobrevive à troca de banner', () => {
  const originalImage = globalThis.Image;
  const originalGetContext = HTMLCanvasElement.prototype.getContext;

  afterEach(() => {
    globalThis.Image = originalImage;
    HTMLCanvasElement.prototype.getContext = originalGetContext;
    vi.restoreAllMocks();
  });

  /** `Image` de mentira: o teste decide QUANDO cada carga termina. */
  function instrumentarImage() {
    const pendentes: Array<{ src: string; disparar: () => void }> = [];
    class FakeImage {
      crossOrigin = '';
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      #src = '';
      set src(valor: string) {
        this.#src = valor;
        pendentes.push({ src: valor, disparar: () => this.onload?.() });
      }
      get src() {
        return this.#src;
      }
    }
    globalThis.Image = FakeImage as unknown as typeof Image;
    return pendentes;
  }

  /** Canvas de mentira devolvendo pixels de luminância uniforme. */
  function instrumentarCanvas(valorRgb: number) {
    const total = 48 * 27 * 4;
    const dados = new Uint8ClampedArray(total);
    for (let i = 0; i < total; i += 4) {
      dados[i] = valorRgb;
      dados[i + 1] = valorRgb;
      dados[i + 2] = valorRgb;
      dados[i + 3] = 255;
    }
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      drawImage: vi.fn(),
      getImageData: () => ({ data: dados }),
    })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  }

  it('devolve SCRIM_PADRAO até o onload, e a medida só vale para o src atual', async () => {
    const pendentes = instrumentarImage();
    instrumentarCanvas(0); // preto: véu deve cair ao piso

    const { result, rerender } = renderHook(({ src }) => useBannerScrim(src), {
      initialProps: { src: 'https://exemplo.test/escuro.jpg' },
    });

    // Antes da carga: padrão conservador.
    expect(result.current).toEqual(SCRIM_PADRAO);

    act(() => pendentes[0].disparar());
    await waitFor(() => expect(result.current.bottom).toBeLessThan(SCRIM_PADRAO.bottom));
    const medidaDoEscuro = result.current;

    // Troca de banner: a medida anterior NÃO pode continuar valendo.
    rerender({ src: 'https://exemplo.test/claro.jpg' });
    expect(result.current).toEqual(SCRIM_PADRAO);
    expect(result.current).not.toEqual(medidaDoEscuro);

    // Só depois do segundo onload a nova medida entra.
    instrumentarCanvas(255); // branco: véu forte
    act(() => pendentes[1].disparar());
    await waitFor(() =>
      expect(result.current.bottom).toBeGreaterThanOrEqual(SCRIM_PADRAO.bottom - 0.01),
    );
  });

  it('sem src devolve o padrão, sem tentar medir', () => {
    const pendentes = instrumentarImage();
    const { result } = renderHook(() => useBannerScrim(null));

    expect(result.current).toEqual(SCRIM_PADRAO);
    expect(pendentes).toHaveLength(0);
  });
});
