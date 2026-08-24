import type { TableAgeRating } from '../types/tables';

// R24/A27 (spec 096): faixa etária visível ao jogador no card do catálogo e na
// página da mesa. REGRA DE EXIBIÇÃO ÚNICA (consumida por TableCard e pela ficha
// técnica):
//   - faixas restritivas (+10/+12/+14/+16/+18) → selo 🔞 no card / valor na ficha;
//   - 'livre' → marcador "Livre" visível e discreto, SEM o 🔞 — decisão do
//     mantenedor (2026-08-24): "ao escolher Livre, tem que aparecer no card".
//     A27 continua valendo: mesa 'livre' não ganha o selo RUÍDOSO de restrição,
//     mas a informação aparece;
//   - ausente (null) ou valor fora do enum → silêncio (sem dado, sem ruído).
//
// Lista positiva para decidir o 🔞: valor inesperado (ex.: 'Livre' capitalizado
// vindo de um backend antigo) nunca vira selo de restrição.
export const RESTRICTED_AGE_RATINGS: readonly TableAgeRating[] = [
  '+10',
  '+12',
  '+14',
  '+16',
  '+18',
];

export function isRestrictedAgeRating(
  value: unknown,
): value is TableAgeRating {
  return (
    typeof value === 'string' &&
    (RESTRICTED_AGE_RATINGS as readonly string[]).includes(value)
  );
}

/** Texto a exibir para a faixa etária, ou null quando não há o que exibir. */
export function ageRatingLabel(value: unknown): string | null {
  if (isRestrictedAgeRating(value)) return value;
  if (value === 'livre') return 'Livre';
  return null;
}
