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

/**
 * Normaliza faixa etária vinda da API para o enum do produto.
 *
 * O tipo `TableDetail.age_rating` é uma promessa de compilação sobre um
 * payload de rede — não uma garantia de runtime (AGENTS.md: dado de API é
 * `unknown` até passar por normalizador tipado). Sem isto, um backend antigo
 * mandando `'Livre'` capitalizado entrava no ViewModel como se fosse do enum,
 * e só sumia da tela lá na frente, no `ageRatingLabel` (achado Codex, PR #285).
 * Normalizar na fronteira mantém o VM sempre válido.
 */
export function normalizeAgeRating(value: unknown): TableAgeRating | undefined {
  if (value === 'livre' || isRestrictedAgeRating(value)) return value;
  return undefined;
}
