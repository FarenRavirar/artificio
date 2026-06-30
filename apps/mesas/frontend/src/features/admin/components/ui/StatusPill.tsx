import { cn } from './cn';

export type PillTone = 'neutral' | 'brand' | 'success' | 'warn' | 'danger' | 'info';

const TONE: Record<PillTone, string> = {
  neutral: 'bg-[var(--admin-hover)] text-[var(--fg-low)] border-[var(--border)]',
  brand: 'bg-[color-mix(in_srgb,var(--color-artificio-orange)_18%,transparent)] text-[var(--color-artificio-orange)] border-[var(--border-orange-soft)]',
  success: 'bg-[color-mix(in_srgb,var(--success)_16%,transparent)] text-[var(--success)] border-[color-mix(in_srgb,var(--success)_30%,transparent)]',
  warn: 'bg-[color-mix(in_srgb,var(--warn)_16%,transparent)] text-[var(--warn)] border-[color-mix(in_srgb,var(--warn)_30%,transparent)]',
  danger: 'bg-[color-mix(in_srgb,var(--danger)_16%,transparent)] text-[var(--danger-soft)] border-[color-mix(in_srgb,var(--danger)_30%,transparent)]',
  info: 'bg-[color-mix(in_srgb,var(--info)_16%,transparent)] text-[var(--info)] border-[color-mix(in_srgb,var(--info)_30%,transparent)]',
};

interface Props {
  children: React.ReactNode;
  tone?: PillTone;
  className?: string;
}

/** Etiqueta de status compacta, tom semântico via tokens. */
export function StatusPill({ children, tone = 'neutral', className }: Readonly<Props>) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
