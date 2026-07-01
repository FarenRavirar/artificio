import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from './cn';

interface Props {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  to?: string;
  tone?: 'neutral' | 'brand' | 'warn' | 'danger';
  loading?: boolean;
}

const VALUE_TONE: Record<NonNullable<Props['tone']>, string> = {
  neutral: 'text-[var(--fg)]',
  brand: 'text-[var(--color-artificio-orange)]',
  warn: 'text-[var(--warn)]',
  danger: 'text-[var(--danger-soft)]',
};

/** Card de métrica de estado real. Vira link se `to` for passado. */
export function MetricCard({ label, value, hint, icon, to, tone = 'neutral', loading }: Readonly<Props>) {
  const inner = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-[var(--fg-faint)]">{label}</span>
        {icon && <span className="text-[var(--fg-ghost)]">{icon}</span>}
      </div>
      <div className={cn('mt-2 text-2xl font-semibold tabular-nums', VALUE_TONE[tone])}>
        {loading ? <span className="text-[var(--fg-ghost)]">—</span> : value}
      </div>
      {hint && <div className="mt-1 text-xs text-[var(--fg-low)]">{hint}</div>}
    </>
  );

  const base =
    'block rounded-xl border border-[var(--border)] bg-[var(--admin-surface)] px-4 py-3 shadow-[var(--shadow-card)] transition-colors';

  if (to) {
    return (
      <Link to={to} className={cn(base, 'hover:border-[var(--border-strong)]')}>
        {inner}
      </Link>
    );
  }
  return <div className={base}>{inner}</div>;
}
