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
  // T6.4 (spec 093) trocou a borda inativa por superfície; sem anel de foco, quem
  // navega por teclado perdia a única pista de onde está — a borda ERA o indicador.
  // Usa o mesmo `--artificio-focus` / 3px / offset 2px de `.artificio-button` em
  // packages/ui/styles.css:1081, e não valor próprio (T6.5: não divergir do DS).
  // Achado real (review PR #280, coderabbit, funcional/acessibilidade).
  const focusRing =
    'focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[var(--artificio-focus)]';

  const base = {
    pill: `rounded-full px-3 py-1 text-xs transition-colors ${focusRing}`,
    toolbar: `flex shrink-0 items-center gap-1.5 rounded-lg border px-3 h-10 text-xs font-semibold transition-all whitespace-nowrap ${focusRing}`,
    drawer: `flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition-all ${focusRing}`,
  }[variant];

  const inactive = {
    pill: 'bg-white/10 text-white/70 hover:bg-white/20',
    toolbar: 'border-transparent bg-[var(--surface)] text-[var(--fg-muted)] hover:border-transparent hover:bg-[var(--surface-strong)]',
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
