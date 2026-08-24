import { describe, expect, it } from 'vitest';
import {
  ageRatingLabel,
  isRestrictedAgeRating,
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
