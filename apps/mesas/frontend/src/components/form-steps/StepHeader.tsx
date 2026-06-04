const STEP_LABELS = ['Básico', 'Sistema', 'Sessões', 'Configuração', 'Finalizar', 'Revisão'];

interface StepHeaderProps {
  step: number;
  maxStepUnlocked: number;
  onNavigate: (target: number) => void;
}

export function StepHeader({ step, maxStepUnlocked, onNavigate }: StepHeaderProps) {
  return (
    <div className="space-y-3">
      {/* Trilha de círculos */}
      <div className="flex items-center gap-0">
        {STEP_LABELS.map((label, i) => {
          const s = i + 1;
          const isActive = s === step;
          const isDone = s < step;
          const isUnlocked = s <= maxStepUnlocked;
          const isClickable = isUnlocked && !isActive;

          return (
            <div key={s} className="flex items-center flex-1 last:flex-none">
              {/* Nó */}
              <button
                type="button"
                disabled={!isClickable}
                onClick={() => isClickable && onNavigate(s)}
                title={isClickable ? `Ir para ${label}` : undefined}
                className={[
                  'flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold border-2 transition-all shrink-0',
                  isActive
                    ? 'bg-[var(--color-artificio-orange)] border-[var(--color-artificio-orange)] text-white scale-110 shadow-lg shadow-orange-900/40'
                    : isDone && isUnlocked
                    ? 'bg-[var(--color-artificio-orange)]/20 border-[var(--color-artificio-orange)] text-[var(--color-artificio-orange)] hover:bg-[var(--color-artificio-orange)]/40 cursor-pointer'
                    : 'bg-white/5 border-white/20 text-white/30 cursor-default',
                ].join(' ')}
              >
                {isDone ? '✓' : s}
              </button>

              {/* Conector (não no último) */}
              {s < STEP_LABELS.length && (
                <div
                  className={`h-0.5 flex-1 mx-1 rounded-full transition-colors ${
                    s < step ? 'bg-[var(--color-artificio-orange)]/60' : 'bg-white/10'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Labels */}
      <div className="flex justify-between">
        {STEP_LABELS.map((label, i) => {
          const s = i + 1;
          const isActive = s === step;
          const isDone = s < step;
          return (
            <span
              key={s}
              className={[
                'text-[10px] leading-tight text-center transition-colors',
                isActive ? 'text-white font-semibold' : isDone ? 'text-[var(--color-artificio-orange)]/70' : 'text-white/30',
              ].join(' ')}
              style={{ width: `${100 / STEP_LABELS.length}%` }}
            >
              {label}
            </span>
          );
        })}
      </div>
    </div>
  );
}
