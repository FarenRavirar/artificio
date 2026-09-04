// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { SCRIM_PADRAO } from './useBannerScrim';

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
