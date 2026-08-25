import { describe, expect, it } from 'vitest';
import { asRecord, readEnvelopeData } from './apiEnvelope';

/**
 * Helpers de envelope `{ data: [...] }` (achado 1 da revisão adversarial
 * Fase 5, spec 096) — extraídos dos hooks de catálogo para um util único
 * (regra "compartilhado por padrão"). As mensagens de erro de cada hook são
 * passadas pelo chamador, então aqui vale qualquer texto.
 */

describe('asRecord', () => {
  it('devolve o próprio objeto quando o valor é objeto', () => {
    const value = { data: [{ id: 'x' }] };
    expect(asRecord(value)).toBe(value);
  });

  it('devolve objeto vazio para null', () => {
    expect(asRecord(null)).toEqual({});
  });

  it('devolve objeto vazio para primitivos', () => {
    expect(asRecord('texto')).toEqual({});
    expect(asRecord(42)).toEqual({});
    expect(asRecord(true)).toEqual({});
    expect(asRecord(undefined)).toEqual({});
  });
});

describe('readEnvelopeData', () => {
  const message = 'Resposta em formato inesperado.';

  it('extrai a lista data de um envelope válido', () => {
    const items = [{ id: 'a' }, { id: 'b' }];
    expect(readEnvelopeData({ data: items }, message)).toBe(items);
  });

  it('aceita lista vazia', () => {
    expect(readEnvelopeData({ data: [] }, message)).toEqual([]);
  });

  it('lança TypeError com a mensagem do chamador quando data não é array', () => {
    expect(() => readEnvelopeData({ data: 'não-array' }, message)).toThrowError(
      new TypeError(message),
    );
  });

  it('lança TypeError com a mensagem do chamador quando não há data', () => {
    expect(() => readEnvelopeData({ other: true }, message)).toThrowError(
      new TypeError(message),
    );
  });

  it('lança TypeError com a mensagem do chamador quando o json não é objeto', () => {
    expect(() => readEnvelopeData(null, message)).toThrowError(new TypeError(message));
    expect(() => readEnvelopeData('texto', message)).toThrowError(new TypeError(message));
  });
});
