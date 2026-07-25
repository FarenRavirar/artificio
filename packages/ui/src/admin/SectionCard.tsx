import type { ReactNode } from "react";
import { cn } from "./cn.js";

export interface SectionCardProps {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

/**
 * Card de seção administrativo.
 * `Panel` não substitui esta peça: ele não oferece descrição nem classes separadas
 * de corpo e usa tokens públicos, enquanto esta peça preserva o contrato visual do
 * admin aprovado na spec 086.
 */
export function SectionCard({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
}: Readonly<SectionCardProps>) {
  return (
    <section className={cn("rounded-xl border border-[var(--border)] bg-[var(--admin-surface)] shadow-[var(--shadow-card)]", className)}>
      {(title || description || action) && (
        <header className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
          <div className="min-w-0">
            {title && <h3 className="text-sm font-semibold text-[var(--fg)]">{title}</h3>}
            {description && <p className="mt-1 text-xs text-[var(--fg-low)]">{description}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      <div className={cn("px-5 py-4", bodyClassName)}>{children}</div>
    </section>
  );
}
