// T5.4 (spec 072 débito DEB-072-04) — deteccao de abuso de denuncia. Regra
// decidida nominalmente pelo mantenedor (2026-07-12): N denuncias seguidas
// do mesmo reporter terminadas "dismissed" (improcedente) marca o usuario
// como abusivo. E so um SINAL para o moderador revisar manualmente — nunca
// bane/bloqueia sozinho.

export const ABUSE_DISMISSED_STREAK_THRESHOLD = 3;

/**
 * Recebe os N reports mais recentes do usuario (mais recente primeiro,
 * apenas com case_state resolved/dismissed) e diz se a sequencia mais
 * recente e toda "dismissed" (== abusiva). Uma unica "resolved" no meio
 * (denuncia procedente) quebra a sequencia e reseta a contagem.
 */
export function isReporterAbusive(recentCaseStatesDescending: string[]): boolean {
  if (recentCaseStatesDescending.length < ABUSE_DISMISSED_STREAK_THRESHOLD) {
    return false;
  }
  return recentCaseStatesDescending
    .slice(0, ABUSE_DISMISSED_STREAK_THRESHOLD)
    .every((state) => state === 'dismissed');
}
