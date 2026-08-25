import { describe, expect, it } from 'vitest';
import { emptyParserSignals, parseParserSignals } from './parserSignals';

/**
 * Fase 6 (spec 096, T6.6/Falha 6): os sinais de ambiguidade que o backend
 * JÁ calcula chegam ao payload do parse-preview e são normalizados aqui
 * (dado de API é `unknown` até passar pelo guard). O front antigo os
 * ignorava em silêncio — o mestre não sabia que o parser tinha escolhido
 * por ele (R5).
 */
describe('parseParserSignals (Fase 6, T6.2)', () => {
  it('F6: ambiguidades + missing_fields do payload cru viram sinais tipados', () => {
    const signals = parseParserSignals({
      missing_fields: ['day_of_week', 'price_type:ambiguous'],
      _price_ambiguity: true,
      _schedule_ambiguity: true,
      _slots_ambiguity: { first: 2, second: 5, source: 'x_slash_y' },
      raw_system_hint: null,
    });

    expect(signals).not.toBeNull();
    expect(signals?.priceAmbiguous).toBe(true);
    expect(signals?.scheduleAmbiguous).toBe(true);
    expect(signals?.slotsAmbiguous).toEqual({ first: 2, second: 5 });
    expect(signals?.missingFields).toEqual(['day_of_week', 'price_type:ambiguous']);
    expect(signals?.rawSystemHint).toBeNull();
  });

  it('F8: raw_system_hint não casado chega normalizado (sem inventar correspondência)', () => {
    const signals = parseParserSignals({
      raw_system_hint: 'Xyz Nada a Ver',
      missing_fields: ['system_name:unmatched_hint'],
    });

    expect(signals?.rawSystemHint).toBe('Xyz Nada a Ver');
    expect(signals?.missingFields).toContain('system_name:unmatched_hint');
  });

  it('payload sem sinais vira sinais neutros (nenhum aviso)', () => {
    const signals = parseParserSignals({
      missing_fields: [],
      _price_ambiguity: null,
      _schedule_ambiguity: null,
      _slots_ambiguity: null,
      raw_system_hint: null,
    });

    expect(signals).not.toBeNull();
    expect(signals?.priceAmbiguous).toBe(false);
    expect(signals?.scheduleAmbiguous).toBe(false);
    expect(signals?.slotsAmbiguous).toBeNull();
    expect(signals?.missingFields).toEqual([]);
  });

  it('entrada não-objeto devolve null (o chamador trata como sem sinais)', () => {
    expect(parseParserSignals(null)).toBeNull();
    expect(parseParserSignals('texto')).toBeNull();
    expect(parseParserSignals([1, 2])).toBeNull();
  });

  it('entradas de tipo errado dentro do payload não vazam (normalização obrigatória)', () => {
    const signals = parseParserSignals({
      missing_fields: ['day_of_week', 42, null, { evil: true }],
      _price_ambiguity: 'true',
      _slots_ambiguity: 'não é objeto',
      raw_system_hint: 123,
    });

    expect(signals?.missingFields).toEqual(['day_of_week']);
    expect(signals?.priceAmbiguous).toBe(false);
    expect(signals?.slotsAmbiguous).toBeNull();
    expect(signals?.rawSystemHint).toBeNull();
  });
});

describe('emptyParserSignals', () => {
  it('devolve o estado neutro completo', () => {
    const empty = emptyParserSignals();
    expect(empty.missingFields).toEqual([]);
    expect(empty.priceAmbiguous).toBe(false);
    expect(empty.scheduleAmbiguous).toBe(false);
    expect(empty.slotsAmbiguous).toBeNull();
    expect(empty.rawSystemHint).toBeNull();
  });
});
