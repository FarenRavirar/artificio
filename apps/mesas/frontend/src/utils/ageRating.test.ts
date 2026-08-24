import { describe, expect, it } from 'vitest';
import {
  ageRatingLabel,
  isRestrictedAgeRating,
  normalizeAgeRating,
  RESTRICTED_AGE_RATINGS,
} from './ageRating';

// R24/A27 (spec 096): a faixa etária aparece para o jogador — inclusive 'livre',
// que exibe o marcador "Livre" discreto (decisão do mantenedor 2026-08-24:
// "ao escolher Livre, tem que aparecer no card"). O 🔞 fica reservado às faixas
// restritivas; null e valor fora do enum ficam em silêncio.
describe('ageRating — regra de exibição da faixa etária', () => {
  it('reconhece as 5 faixas restritivas do contrato', () => {
    expect(RESTRICTED_AGE_RATINGS).toEqual(['+10', '+12', '+14', '+16', '+18']);
    for (const rating of RESTRICTED_AGE_RATINGS) {
      expect(isRestrictedAgeRating(rating)).toBe(true);
    }
  });

  it("não trata 'livre' como faixa restritiva", () => {
    expect(isRestrictedAgeRating('livre')).toBe(false);
  });

  it('não trata ausência nem valor fora do enum como faixa restritiva', () => {
    expect(isRestrictedAgeRating(null)).toBe(false);
    expect(isRestrictedAgeRating(undefined)).toBe(false);
    // Lista positiva: valor inesperado (ex.: 'Livre' capitalizado) nunca vira 🔞.
    expect(isRestrictedAgeRating('Livre')).toBe(false);
    expect(isRestrictedAgeRating('adultos')).toBe(false);
    expect(isRestrictedAgeRating('')).toBe(false);
    expect(isRestrictedAgeRating(18)).toBe(false);
  });

  it('ageRatingLabel devolve o texto exibível', () => {
    expect(ageRatingLabel('+16')).toBe('+16');
    expect(ageRatingLabel('livre')).toBe('Livre');
  });

  it('ageRatingLabel devolve null quando não há o que exibir', () => {
    expect(ageRatingLabel(null)).toBeNull();
    expect(ageRatingLabel(undefined)).toBeNull();
    expect(ageRatingLabel('Livre')).toBeNull();
    expect(ageRatingLabel('adultos')).toBeNull();
    expect(ageRatingLabel('')).toBeNull();
  });
});

describe('normalizeAgeRating (achado Codex, PR #285)', () => {
  it('preserva os valores do enum', () => {
    expect(normalizeAgeRating('livre')).toBe('livre');
    expect(normalizeAgeRating('+16')).toBe('+16');
  });

  it('descarta valor fora do enum antes de entrar no ViewModel', () => {
    // O caso real: backend antigo mandando 'Livre' capitalizado. O tipo
    // TableDetail promete o enum, mas e payload de rede — sem normalizar,
    // entrava no VM tipado e so sumia la na frente, no ageRatingLabel.
    expect(normalizeAgeRating('Livre')).toBeUndefined();
    expect(normalizeAgeRating('16+')).toBeUndefined();
  });

  it('trata ausencia e tipo errado como sem faixa', () => {
    expect(normalizeAgeRating(null)).toBeUndefined();
    expect(normalizeAgeRating(undefined)).toBeUndefined();
    expect(normalizeAgeRating(16)).toBeUndefined();
    expect(normalizeAgeRating({})).toBeUndefined();
  });
});
