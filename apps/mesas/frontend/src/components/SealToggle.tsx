import type { ReactNode } from 'react';

export type SealToggleVariant = 'pill' | 'toolbar' | 'drawer';

interface SealToggleProps {
  readonly active: boolean;
  readonly onClick: () => void;
  readonly variant: SealToggleVariant;
  readonly icon?: ReactNode;
  readonly children: ReactNode;
  readonly activeClassName?: string;
}

// Débito BL-MESAS-CATALOGO-SELOS-DUP (spec 081): unifica os 3 blocos de toggle
// de selo (hero pill, desktop toolbar, mobile drawer) que existiam com JSX
// próprio por superfície, mesma lógica (`aria-pressed`), sem componente
// compartilhado. `activeClassName` cobre a cor de destaque por selo
// (âmbar/DDAL, roxo/Covil), já que cada um usa uma cor diferente quando ativo.
export function SealToggle({ active, onClick, variant, icon, children, activeClassName }: SealToggleProps) {
  const base = {
    pill: 'rounded-full px-3 py-1 text-xs transition-colors',
    toolbar: 'flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all whitespace-nowrap',
    drawer: 'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition-all',
  }[variant];

  const inactive = {
    pill: 'bg-white/10 text-white/70 hover:bg-white/20',
    toolbar: 'border-white/10 bg-[#0B1220] text-white/70 hover:border-white/20 hover:bg-white/5',
    drawer: 'border-white/10 bg-[#13213f] text-white/70',
  }[variant];

  const activeDefault = {
    pill: 'bg-[var(--color-artificio-orange)] font-semibold text-white',
    toolbar: 'border-white/10 bg-white/10 text-white',
    drawer: 'border-white/10 bg-white/10 text-white',
  }[variant];

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`${base} ${active ? (activeClassName ?? activeDefault) : inactive} ${icon ? 'flex items-center gap-1' : ''}`.trim()}
    >
      {icon}
      {children}
    </button>
  );
}
