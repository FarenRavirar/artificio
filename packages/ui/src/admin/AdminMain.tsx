import type { ReactNode } from "react";
import { Breadcrumb } from "./Breadcrumb.js";

export interface AdminMainProps {
  groupLabel?: string;
  groupEyebrow?: string;
  breadcrumbPath?: string[];
  breadcrumbCreating?: boolean;
  actions?: ReactNode;
  subnav?: ReactNode;
  children: ReactNode;
}

export function AdminMain({
  groupLabel,
  groupEyebrow,
  breadcrumbPath,
  breadcrumbCreating = false,
  actions,
  subnav,
  children,
}: Readonly<AdminMainProps>) {
  const hasHeader = Boolean(groupEyebrow || breadcrumbPath?.length || groupLabel || actions);

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-y-auto bg-[var(--admin-canvas)]">
      {hasHeader && (
        <header className="sticky top-0 z-10 border-b border-[var(--admin-border)] bg-[var(--admin-canvas)] px-8 py-4">
          <div className="mb-1 flex items-center justify-between">
            <div className="flex min-w-0 items-center gap-3">
              {groupEyebrow && <span className="eyebrow shrink-0 text-[var(--admin-fg-low)]">{groupEyebrow}</span>}
              {breadcrumbPath && breadcrumbPath.length > 0 && (
                <Breadcrumb path={breadcrumbPath} creating={breadcrumbCreating} />
              )}
            </div>
            {actions && <div className="ml-4 flex shrink-0 items-center gap-2">{actions}</div>}
          </div>
          {groupLabel && <h1 className="mt-1 text-xl font-bold text-[var(--admin-fg)]">{groupLabel}</h1>}
        </header>
      )}

      {subnav && (
        <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface)] px-8 py-3">{subnav}</div>
      )}

      {/* Código real tinha <Outlet>, quarta dependência de react-router-dom omitida no plano.
          children mantém o kit portável e deixa roteamento sob responsabilidade do app. */}
      <div className="flex-1 px-8 py-6">{children}</div>
    </div>
  );
}
