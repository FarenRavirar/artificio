import { describe, expect, it } from 'vitest';
import {
  AUDIENCE_VALUES,
  EXPERIENCE_LEVEL_VALUES,
  isAudienceOption,
  isCatalogSeal,
  isExperienceLevelOption,
  isModalityOption,
  isPriceTypeOption,
  isSortOption,
  isTableTypeOption,
  MODALITY_VALUES,
  normalizeStyles,
  PRICE_TYPE_VALUES,
  SEAL_VALUES,
  SORT_OPTIONS,
  SORT_VALUES,
  TABLE_TYPE_VALUES,
} from './catalogFilterOptions';
import { parseCatalogFilters } from './catalogFilters';

describe('fonte única — igualdade entre UI e parser (R6, critério de aceite 6)', () => {
  it('SORT_OPTIONS e SORT_VALUES derivam da mesma lista', () => {
    expect(SORT_OPTIONS.map((option) => option.value)).toEqual([...SORT_VALUES]);
  });

  it('todo sort renderizado é aceito pelo parser e sobrevive ao round-trip', () => {
    for (const option of SORT_OPTIONS) {
      const parsed = parseCatalogFilters(new URLSearchParams(`sort=${option.value}`));
      expect(parsed.sort).toBe(option.value);
    }
  });

  it('nenhum valor fora de SORT_OPTIONS é aceito pelo parser', () => {
    for (const invalid of ['ending_soon', 'abc', 'PRICE_DESC', '']) {
      expect(parseCatalogFilters(new URLSearchParams(`sort=${invalid}`)).sort).toBe('popular');
    }
  });

  it('cada sort tem label não vazio e único', () => {
    const labels = SORT_OPTIONS.map((option) => option.label);
    expect(labels.every((label) => label.length > 0)).toBe(true);
    expect(new Set(labels).size).toBe(labels.length);
  });
});

describe('fonte única — enums de modalidade, preço, experiência, selo, tipo e público', () => {
  it('listas de valores coincidem com as opções renderizadas', () => {
    const pairs: Array<[readonly { value: string }[], readonly string[]]> = [
      [SORT_OPTIONS, [...SORT_VALUES]],
    ];
    for (const [options, values] of pairs) {
      expect(options.map((option) => option.value)).toEqual(values);
    }
  });

  it('modalidade, preço e experiência preservam os enums existentes', () => {
    expect([...MODALITY_VALUES]).toEqual(['online', 'presencial', 'hibrida']);
    expect([...PRICE_TYPE_VALUES]).toEqual(['gratuita', 'paga']);
    expect([...EXPERIENCE_LEVEL_VALUES]).toEqual(['iniciante', 'intermediario', 'veterano']);
  });

  it('selos continuam exclusivos: ddal e covil-do-lich, sem opção vazia', () => {
    expect([...SEAL_VALUES]).toEqual(['ddal', 'covil-do-lich']);
  });

  it('tipo conhece exatamente os quatro valores do contrato (critério de aceite 7)', () => {
    expect([...TABLE_TYPE_VALUES]).toEqual(['campanha', 'one-shot', 'oneshot-serie', 'aberta']);
  });

  it('público conhece livre e adultos mesmo sem faceta ativa (critério de aceite 7)', () => {
    expect([...AUDIENCE_VALUES]).toEqual(['livre', 'adultos']);
  });

  it('cada tipo de option tem valor e label únicos', () => {
    const optionLists = [
      SORT_OPTIONS,
    ];
    for (const options of optionLists) {
      expect(new Set(options.map((option) => option.value)).size).toBe(options.length);
    }
  });
});

describe('fonte única — type guards derivados das listas', () => {
  it('isSortOption aceita exatamente SORT_VALUES', () => {
    for (const value of SORT_VALUES) expect(isSortOption(value)).toBe(true);
    expect(isSortOption('ending_soon')).toBe(false);
    expect(isSortOption('')).toBe(false);
  });

  it('isModalityOption / isPriceTypeOption / isExperienceLevelOption seguem as listas', () => {
    for (const value of MODALITY_VALUES) expect(isModalityOption(value)).toBe(true);
    expect(isModalityOption('hibrido')).toBe(false);

    for (const value of PRICE_TYPE_VALUES) expect(isPriceTypeOption(value)).toBe(true);
    expect(isPriceTypeOption('freemium')).toBe(false);

    for (const value of EXPERIENCE_LEVEL_VALUES) expect(isExperienceLevelOption(value)).toBe(true);
    expect(isExperienceLevelOption('mestre')).toBe(false);
  });

  it('isCatalogSeal rejeita vazio e valores fora do contrato', () => {
    expect(isCatalogSeal('ddal')).toBe(true);
    expect(isCatalogSeal('covil-do-lich')).toBe(true);
    expect(isCatalogSeal('')).toBe(false);
    expect(isCatalogSeal('selo-aleatorio')).toBe(false);
  });

  it('isTableTypeOption aceita exatamente TABLE_TYPE_VALUES', () => {
    for (const value of TABLE_TYPE_VALUES) expect(isTableTypeOption(value)).toBe(true);
    expect(isTableTypeOption('mesa')).toBe(false);
    expect(isTableTypeOption('')).toBe(false);
  });

  it('isAudienceOption aceita livre e adultos', () => {
    expect(isAudienceOption('livre')).toBe(true);
    expect(isAudienceOption('adultos')).toBe(true);
    expect(isAudienceOption('todos')).toBe(false);
  });
});

describe('normalizeStyles', () => {
  it('trim, dedupe e sort determinístico', () => {
    expect(normalizeStyles([' b ', 'a', 'b', 'a', ''])).toEqual(['a', 'b']);
  });

  it('descarta estilos gigantes (lixo óbvio)', () => {
    expect(normalizeStyles(['x'.repeat(51), 'ok'])).toEqual(['ok']);
  });

  it('preserva a ordem para o mesmo conjunto independente da ordem de entrada', () => {
    expect(normalizeStyles(['z', 'a', 'm'])).toEqual(normalizeStyles(['m', 'z', 'a']));
  });
});
