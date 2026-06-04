import type { TableCard } from '../types/tables';

/**
 * Garante que valor esteja dentro do range [min, max]
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export interface SlotsVisualState {
  total: number;
  filled: number;
  open: number;
  visibleTotal: number;
  visibleFilled: number;
  ratio: number;
  colorClass: string;
  isUrgent: boolean;
  isFull: boolean;
}

/**
 * Fonte única de verdade para lógica de vagas
 * - Usa slots_open como prioridade (backend)
 * - Fallback para cálculo clássico
 * - Normaliza valores inválidos
 * - Limita visual a maxDots (default: 10)
 * - Retorna cor baseada em ocupação (verde → amarelo → vermelho)
 * - Expõe estados de urgência para uso no componente
 * - Blindado contra valores negativos ou maiores que total
 */
export function getSlotsVisualState(
  table: Pick<TableCard, 'slots_total' | 'slots_filled'> & { slots_open?: number | null },
  maxDots: number = 10
): SlotsVisualState {
  const total = Math.max(0, table.slots_total ?? 0);

  let open =
    table.slots_open !== null && table.slots_open !== undefined
      ? table.slots_open
      : Math.max(0, total - (table.slots_filled ?? 0));

  // Blindagem: garantir que open esteja no range [0, total]
  open = clamp(open, 0, total);

  const filled = Math.max(0, total - open);

  // Limite visual
  const visibleTotal = Math.min(maxDots, total);

  // Proporção (resolve casos > maxDots)
  const ratio = total > 0 ? filled / total : 0;
  const visibleFilled = Math.round(ratio * visibleTotal);

  // Estados de urgência
  const isUrgent = open <= 2 && open > 0;
  const isFull = open === 0;

  // Cor baseada na ocupação (thresholds ajustados para reservar vermelho)
  let colorClass = 'bg-green-500';

  if (filled === 0) {
    colorClass = 'bg-white/40'; // Mesa vazia
  } else if (ratio > 0.85) {
    colorClass = 'bg-red-500'; // Quase lotado
  } else if (ratio > 0.5) {
    colorClass = 'bg-yellow-400'; // Meio cheio
  }

  return {
    total,
    filled,
    open,
    visibleTotal,
    visibleFilled,
    ratio,
    colorClass,
    isUrgent,
    isFull,
  };
}
