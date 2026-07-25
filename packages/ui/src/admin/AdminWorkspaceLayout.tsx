import type { ReactNode } from "react";

export interface AdminWorkspaceLayoutProps {
  workspace: ReactNode;
  inspector: ReactNode | null;
  onCloseInspector?: () => void;
  closeIcon?: ReactNode;
}

export function AdminWorkspaceLayout({
  workspace,
  inspector,
  onCloseInspector,
  closeIcon = <span aria-hidden>×</span>,
}: Readonly<AdminWorkspaceLayoutProps>) {
  return (
    <div className="flex overflow-hidden" style={{ height: "calc(100vh - var(--header-height, 0px))" }}>
      <section className="min-w-0 flex-1 overflow-y-auto border-r border-[var(--admin-border)]">{workspace}</section>
      {inspector !== null && (
        <aside className="relative w-[400px] shrink-0 overflow-y-auto bg-[var(--admin-canvas)]">
          {onCloseInspector && (
            <button
              type="button"
              onClick={onCloseInspector}
              className="absolute right-4 top-4 z-10 min-h-11 min-w-11 text-[var(--admin-fg-low)] hover:text-[var(--admin-fg)]"
              aria-label="Fechar inspector"
            >
              {closeIcon}
            </button>
          )}
          {inspector}
        </aside>
      )}
    </div>
  );
}
