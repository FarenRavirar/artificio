import { getSlotsVisualState } from '../utils/slots';
import type { TableCard } from '../types/tables';

interface SlotsIndicatorProps {
  table: Pick<TableCard, 'slots_total' | 'slots_filled' | 'slots_open'>;
  variant?: 'default' | 'compact';
  maxDots?: number;
}

/**
 * Componente oficial para exibição de vagas
 * 
 * Responsabilidades:
 * - Renderiza bolinhas com gradiente de cores (verde → amarelo → vermelho)
 * - Exibe texto de vagas disponíveis com clareza semântica
 * - Usa fonte única de verdade (slots_open do backend)
 * - Blindado contra valores inválidos
 * 
 * Uso:
 * ```tsx
 * <SlotsIndicator table={table} />
 * <SlotsIndicator table={table} variant="compact" maxDots={5} />
 * ```
 */
export function SlotsIndicator({
  table,
  variant = 'default',
  maxDots = 10
}: SlotsIndicatorProps) {
  const {
    open: slotsLeft,
    visibleTotal,
    visibleFilled,
    total,
    colorClass,
    isUrgent,
    isFull
  } = getSlotsVisualState(table, maxDots);

  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-2">
        <div className="flex gap-1">
          {Array.from({ length: visibleTotal }).map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-colors ${i < visibleFilled ? colorClass : 'bg-white/20'
                }`}
            />
          ))}
          {total > visibleTotal && (
            <span className="text-[10px] text-white/50 ml-1">
              +{total - visibleTotal}
            </span>
          )}
        </div>

        <span className={`text-xs font-bold ${isFull
            ? 'text-red-400'
            : isUrgent
              ? 'text-orange-400'
              : 'text-white/70'
          }`}>
          {isFull ? 'Lotada' : `${slotsLeft} ${slotsLeft === 1 ? 'vaga' : 'vagas'}`}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-1">
        {Array.from({ length: visibleTotal }).map((_, i) => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full transition-colors ${i < visibleFilled ? colorClass : 'bg-white/20'
              }`}
          />
        ))}
        {total > visibleTotal && (
          <span className="text-[10px] text-white/50 ml-1">
            +{total - visibleTotal}
          </span>
        )}
      </div>

      <span className={`text-xs font-bold ${isFull
          ? 'text-red-400'
          : isUrgent
            ? 'text-orange-400'
            : 'text-white/70'
        }`}>
        {isFull ? 'Lotada' : `${slotsLeft} ${slotsLeft === 1 ? 'vaga' : 'vagas'}`}
      </span>
    </div>
  );
}
