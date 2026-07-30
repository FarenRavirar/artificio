// T5.4 (spec 072 débito DEB-072-04) — deteccao de abuso de denuncia. Regra
// decidida nominalmente pelo mantenedor (2026-07-12): N denuncias seguidas
// do mesmo reporter terminadas "dismissed" (improcedente) marca o usuario
// como abusivo. E so um SINAL para o moderador revisar manualmente — nunca
// bane/bloqueia sozinho.

export const ABUSE_DISMISSED_STREAK_THRESHOLD = 3;

// Limiar decide quando sinalizar; janela mede o volume recente mostrado ao
// moderador. Não unificar: limitar a consulta ao limiar satura o snapshot em 3.
export const ABUSE_LOOKBACK_WINDOW = 20;

export function reporterDismissedStreak(recentCaseStatesDescending: string[]): number {
  return recentCaseStatesDescending.findIndex((state) => state !== 'dismissed') === -1
    ? recentCaseStatesDescending.length
    : recentCaseStatesDescending.findIndex((state) => state !== 'dismissed');
}

/**
 * Recebe os N reports mais recentes do usuario (mais recente primeiro,
 * apenas com case_state resolved/dismissed) e diz se a sequencia mais
 * recente e toda "dismissed" (== abusiva). Uma unica "resolved" no meio
 * (denuncia procedente) quebra a sequencia e reseta a contagem.
 */
export function isReporterAbusive(recentCaseStatesDescending: string[]): boolean {
  return reporterDismissedStreak(recentCaseStatesDescending) >= ABUSE_DISMISSED_STREAK_THRESHOLD;
}
