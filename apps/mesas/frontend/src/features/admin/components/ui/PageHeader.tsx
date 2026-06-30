import { cn } from './cn';

interface Props {
  /** Trilha de navegação, ex.: ['Importação', 'Bot de Discord']. */
  breadcrumb?: string[];
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Ação primária à direita (botão), estilo Cloudflare. */
  action?: React.ReactNode;
  className?: string;
}

/** Cabeçalho de página do /gestao: breadcrumb + título + ação primária. */
export function PageHeader({ breadcrumb, title, description, action, className }: Readonly<Props>) {
  return (
    <header className={cn('flex flex-wrap items-end justify-between gap-4', className)}>
      <div className="min-w-0">
        {breadcrumb && breadcrumb.length > 0 && (
          <nav className="mb-1 flex items-center gap-1.5 text-xs text-[var(--fg-faint)]">
            {breadcrumb.map((seg, i) => (
              <span key={breadcrumb.slice(0, i + 1).join('/')} className="flex items-center gap-1.5">
                {i > 0 && <span aria-hidden>›</span>}
                <span className={i === breadcrumb.length - 1 ? 'text-[var(--fg-low)]' : ''}>{seg}</span>
              </span>
            ))}
          </nav>
        )}
        <h1 className="truncate text-xl font-semibold text-[var(--fg)]">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-[var(--fg-low)]">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}
