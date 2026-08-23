import { describe, it, expect } from 'vitest';
import { normalizeNumeric } from './tableViewMapper';

// normalizeNumeric é a fronteira que converte NUMERIC do pg (string sem parser
// para o OID 1700) no view model da página da mesa. Estrito por tipo: boolean,
// string vazia/só espaços e demais tipos devolvem undefined — Number() direto
// coagiria true→1 e ''→0, fabricando preço onde não existe (achado Codex
// PR #283, segunda rodada).
describe('normalizeNumeric — fronteira NUMERIC do view model', () => {
  it('aceita number finito', () => {
    expect(normalizeNumeric(50)).toBe(50);
    expect(normalizeNumeric(39.9)).toBe(39.9);
  });

  it('aceita string não-branca que parseia para number finito (formato do pg)', () => {
    expect(normalizeNumeric('50.00')).toBe(50);
    expect(normalizeNumeric('39.90')).toBe(39.9);
  });

  it('devolve undefined para null/undefined', () => {
    expect(normalizeNumeric(null)).toBeUndefined();
    expect(normalizeNumeric(undefined)).toBeUndefined();
  });

  it('devolve undefined para boolean (true coagiria para 1)', () => {
    expect(normalizeNumeric(true)).toBeUndefined();
    expect(normalizeNumeric(false)).toBeUndefined();
  });

  it('devolve undefined para string vazia ou só espaços (coagiriam para 0)', () => {
    expect(normalizeNumeric('')).toBeUndefined();
    expect(normalizeNumeric('   ')).toBeUndefined();
  });

  it('devolve undefined para valores não numéricos e não finitos', () => {
    expect(normalizeNumeric('abc')).toBeUndefined();
    expect(normalizeNumeric(NaN)).toBeUndefined();
    expect(normalizeNumeric(Infinity)).toBeUndefined();
    expect(normalizeNumeric({})).toBeUndefined();
    expect(normalizeNumeric(['50'])).toBeUndefined();
  });
});
