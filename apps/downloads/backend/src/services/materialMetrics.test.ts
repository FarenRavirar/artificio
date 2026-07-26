import { describe, expect, it } from 'vitest';
import {
  POPULARITY_CONFIDENCE_M,
  RATING_CONFIDENCE_M,
  bayesianAverage,
} from './materialMetrics';

// Spec 087 (T1B.6) — os criterios de aceite de T1B.2/T1B.3 sao afirmacoes
// sobre COMPORTAMENTO da formula ("1 nota isolada de 5 estrelas nao lidera",
// "material so-visualizado nunca aparece"), entao os testes verificam esse
// comportamento, nao o valor numerico exato — a constante de confianca e
// recalibravel com dado real de beta sem que a regra de produto mude.

describe('bayesianAverage', () => {
  it('ancora item novo perto da media do catalogo em vez de deixa-lo liderar', () => {
    const catalogMean = 3.5;

    // Uma unica nota 5 — o caso que o mantenedor rejeitou explicitamente.
    const isolatedFiveStar = bayesianAverage(5, 1, catalogMean, RATING_CONFIDENCE_M);
    // Muitas notas altas, desempenho real comprovado.
    const provenFavourite = bayesianAverage(4.6, 120, catalogMean, RATING_CONFIDENCE_M);

    expect(isolatedFiveStar).not.toBeNull();
    expect(provenFavourite).not.toBeNull();
    // A avaliacao isolada nao vence a que tem volume, mesmo tendo media bruta
    // maior (5.0 > 4.6). E o ponto inteiro do metodo.
    expect(isolatedFiveStar!).toBeLessThan(provenFavourite!);
    // E fica perto da ancora, nao do proprio extremo.
    expect(isolatedFiveStar!).toBeLessThan(4);
    expect(isolatedFiveStar!).toBeGreaterThan(catalogMean);
  });

  it('faz o item convergir para a propria media conforme o volume cresce', () => {
    const catalogMean = 3;
    const few = bayesianAverage(5, 2, catalogMean, RATING_CONFIDENCE_M)!;
    const some = bayesianAverage(5, 20, catalogMean, RATING_CONFIDENCE_M)!;
    const many = bayesianAverage(5, 500, catalogMean, RATING_CONFIDENCE_M)!;

    expect(few).toBeLessThan(some);
    expect(some).toBeLessThan(many);
    expect(many).toBeCloseTo(5, 1);
  });

  it('nao inventa nota quando nao ha volume nenhum', () => {
    // Ausencia de dado vira `null`, nunca 0 — material sem avaliacao nao pode
    // aparecer como "0 estrelas" (Requisito 15).
    expect(bayesianAverage(0, 0, 3.5, RATING_CONFIDENCE_M)).toBeNull();
    expect(bayesianAverage(5, 0, 3.5, RATING_CONFIDENCE_M)).toBeNull();
    expect(bayesianAverage(0.5, -1, 0.3, POPULARITY_CONFIDENCE_M)).toBeNull();
  });

  it('puxa item pior que o catalogo para cima, nao so o melhor para baixo', () => {
    const catalogMean = 4;
    const harshSingleVote = bayesianAverage(1, 1, catalogMean, RATING_CONFIDENCE_M)!;
    // Uma unica nota 1 tambem nao afunda o material: a ancora funciona nos
    // dois sentidos (juizo suspenso ate haver prova).
    expect(harshSingleVote).toBeGreaterThan(1);
    expect(harshSingleVote).toBeLessThan(catalogMean);
  });

  it('trata popularidade como taxa de conversao ancorada na media elegivel', () => {
    const catalogConversion = 0.2;

    // Item com trafego alto e conversao alta.
    const strong = bayesianAverage(0.6, 400, catalogConversion, POPULARITY_CONFIDENCE_M)!;
    // Item com 1 download e 1 view: conversao bruta de 50%, volume irrisorio.
    const thin = bayesianAverage(0.5, 2, catalogConversion, POPULARITY_CONFIDENCE_M)!;

    expect(thin).toBeLessThan(strong);
    // Volume baixo mantem o item colado na media do catalogo.
    expect(thin).toBeLessThan(0.3);
  });
});

describe('constantes de confianca', () => {
  it('exige mais volume de trafego que de avaliacao para confiar no item', () => {
    // Evento de trafego e mais barato/ruidoso que uma avaliacao deliberada,
    // entao a barra de confianca da popularidade e mais alta. Se alguem
    // inverter isso numa recalibragem futura, o teste avisa.
    expect(POPULARITY_CONFIDENCE_M).toBeGreaterThan(RATING_CONFIDENCE_M);
  });
});
