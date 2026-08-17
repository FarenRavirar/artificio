/**
 * Mesa encerrada (410 do backend). Campos mínimos para explicar o encerramento
 * — nada de contato ou link de inscrição, que o backend não envia de propósito.
 */
export type ClosedTable = {
  /**
   * T7.8 (spec 090) — `subject_id` da conversa. Nulo quando o backend ainda não
   * envia o campo (deploy escalonado): a tela de encerramento continua inteira,
   * só não monta a conversa. Degradar assim é o que impede a mesa encerrada de
   * quebrar durante a janela em que front e API estão em versões diferentes.
   */
  id: string | null;
  title: string;
  closedAt: Date | null;
  reason: 'gm' | 'admin' | 'auto_expired' | 'unknown';
  closedByName: string | null;
};

/**
 * Extraído de `MesaPage.tsx` em 2026-08-16 (T7.8). O motivo é a regra
 * `react-refresh/only-export-components`, e ela está certa: arquivo de
 * componente que também exporta função quebra o fast refresh do Vite, porque o
 * runtime não sabe se o módulo alterado é um componente a remontar ou uma
 * dependência a reavaliar.
 *
 * A alternativa seria manter tudo lá e silenciar o lint, o que AGENTS.md
 * proíbe — e a separação é melhor de qualquer forma: normalizador de payload
 * externo é lógica pura, testável sem router, sessão nem API mockada.
 */

const CLOSED_REASONS = new Set(['gm', 'admin', 'auto_expired', 'unknown']);

/**
 * Payload de API é `unknown` até passar por normalizador tipado (AGENTS.md
 * §Regras Gerais de Código). Data inválida vira `null` em vez de `Invalid Date`
 * chegando ao render, e motivo desconhecido degrada para `unknown` — a tela
 * ainda funciona sem a data ou sem o autor, que é o caso das mesas encerradas
 * antes da `migration_156`.
 */
export function normalizeClosedTable(input: unknown): ClosedTable {
  const root = typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {};
  const data = typeof root.data === 'object' && root.data !== null ? (root.data as Record<string, unknown>) : {};

  const rawClosedAt = typeof data.closed_at === 'string' ? new Date(data.closed_at) : null;
  const rawReason = typeof data.closed_reason === 'string' ? data.closed_reason : 'unknown';

  return {
    id: typeof data.id === 'string' && data.id.trim() ? data.id : null,
    title: typeof data.title === 'string' && data.title.trim() ? data.title : 'Esta mesa',
    closedAt: rawClosedAt && !Number.isNaN(rawClosedAt.getTime()) ? rawClosedAt : null,
    reason: (CLOSED_REASONS.has(rawReason) ? rawReason : 'unknown') as ClosedTable['reason'],
    closedByName: typeof data.closed_by_name === 'string' && data.closed_by_name.trim() ? data.closed_by_name : null,
  };
}

/**
 * Frase do encerramento. `auto_expired` não nomeia autor porque não houve um —
 * a divulgação importada venceu por tempo; atribuí-la a alguém seria inventar.
 */
export function describeClosure(closed: ClosedTable): string {
  switch (closed.reason) {
    case 'auto_expired':
      return 'Esta divulgação expirou e saiu do ar automaticamente.';
    case 'gm':
      return closed.closedByName
        ? `Esta mesa foi encerrada pelo mestre ${closed.closedByName}.`
        : 'Esta mesa foi encerrada pelo próprio mestre.';
    case 'admin':
      return closed.closedByName
        ? `Esta mesa foi encerrada pela administração (${closed.closedByName}).`
        : 'Esta mesa foi encerrada pela administração.';
    default:
      return 'Esta mesa foi encerrada e não está mais recebendo inscrições.';
  }
}
