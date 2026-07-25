import type { ComponentType, ReactNode } from "react";
import { cn } from "./cn.js";

export interface AdminLinkProps {
  to: string;
  className?: string;
  children: ReactNode;
  onClick?: () => void;
  "aria-current"?: "page";
}

export type AdminLinkComponent = ComponentType<AdminLinkProps>;

export interface MetricCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  to?: string;
  LinkComponent?: AdminLinkComponent;
  tone?: "neutral" | "brand" | "warn" | "danger";
  loading?: boolean;
}

const VALUE_TONE: Record<NonNullable<MetricCardProps["tone"]>, string> = {
  neutral: "text-[var(--admin-fg)]",
  brand: "text-[var(--artificio-brand)]",
  warn: "text-[var(--admin-warn)]",
  danger: "text-[var(--admin-danger-soft)]",
};

export function MetricCard({
  label,
  value,
  hint,
  icon,
  to,
  LinkComponent,
  tone = "neutral",
  loading,
}: Readonly<MetricCardProps>) {
  const content = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-[var(--admin-fg-faint)]">{label}</span>
        {icon && <span className="text-[var(--admin-fg-ghost)]">{icon}</span>}
      </div>
      <div className={cn("mt-2 text-2xl font-semibold tabular-nums", VALUE_TONE[tone])}>
        {loading ? <span className="text-[var(--admin-fg-ghost)]">—</span> : value}
      </div>
      {hint && <div className="mt-1 text-xs text-[var(--admin-fg-low)]">{hint}</div>}
    </>
  );
  const base = "block rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-3 shadow-[var(--admin-shadow-card)] transition-colors";

  if (to && LinkComponent) {
    return <LinkComponent to={to} className={cn(base, "hover:border-[var(--admin-border-strong)]")}>{content}</LinkComponent>;
  }
  return <div className={base}>{content}</div>;
}
