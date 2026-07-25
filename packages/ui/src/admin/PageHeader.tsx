import type { ReactNode } from "react";
import { cn } from "./cn.js";

export interface PageHeaderProps {
  breadcrumb?: string[];
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

/** Cabeçalho de página administrativa: trilha, título, descrição e ação primária. */
export function PageHeader({ breadcrumb, title, description, action, className }: Readonly<PageHeaderProps>) {
  return (
    <header className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        {breadcrumb && breadcrumb.length > 0 && (
          <nav aria-label="Trilha da página" className="mb-1 flex items-center gap-1.5 text-xs text-[var(--fg-faint)]">
            {breadcrumb.map((segment, index) => (
              <span key={breadcrumb.slice(0, index + 1).join("/")} className="flex items-center gap-1.5">
                {index > 0 && <span aria-hidden>›</span>}
                <span className={index === breadcrumb.length - 1 ? "text-[var(--fg-low)]" : ""}>{segment}</span>
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
