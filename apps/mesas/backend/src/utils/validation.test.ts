import { describe, expect, it } from 'vitest';
import { readBodyField, isValidSlugParam } from './validation.js';

describe('readBodyField', () => {
  it('lê o campo de um objeto', () => {
    expect(readBodyField({ variant: 'cta_entrar' }, 'variant')).toBe('cta_entrar');
  });

  it('payload ausente, array, número ou string devolve undefined', () => {
    for (const body of [undefined, null, ['variant'], 42, 'variant']) {
      expect(readBodyField(body, 'variant')).toBeUndefined();
    }
  });
});

describe('isValidSlugParam', () => {
  it('aceita slug de mesa real e recusa vazio, longo ou com caractere fora da regra', () => {
    expect(isValidSlugParam('as-cronicas-de-romdeau-mu2ujgv7')).toBe(true);
    expect(isValidSlugParam('')).toBe(false);
    expect(isValidSlugParam('a'.repeat(201))).toBe(false);
    expect(isValidSlugParam('mesa/../x')).toBe(false);
    expect(isValidSlugParam(undefined)).toBe(false);
  });
});
