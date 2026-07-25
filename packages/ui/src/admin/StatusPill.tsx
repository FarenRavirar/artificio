import type { ReactNode } from "react";
import { cn } from "./cn.js";

export type PillTone = "neutral" | "brand" | "success" | "warn" | "danger" | "info";

const TONE: Record<PillTone, string> = {
  neutral: "bg-[var(--admin-hover)] text-[var(--admin-fg-low)] border-[var(--admin-border)]",
  brand: "bg-[color-mix(in_srgb,var(--artificio-brand)_18%,transparent)] text-[var(--artificio-brand)] border-[var(--admin-border-orange-soft)]",
  success: "bg-[color-mix(in_srgb,var(--admin-success)_16%,transparent)] text-[var(--admin-success)] border-[color-mix(in_srgb,var(--admin-success)_30%,transparent)]",
  warn: "bg-[color-mix(in_srgb,var(--admin-warn)_16%,transparent)] text-[var(--admin-warn)] border-[color-mix(in_srgb,var(--admin-warn)_30%,transparent)]",
  danger: "bg-[color-mix(in_srgb,var(--admin-danger)_16%,transparent)] text-[var(--admin-danger-soft)] border-[color-mix(in_srgb,var(--admin-danger)_30%,transparent)]",
  info: "bg-[color-mix(in_srgb,var(--admin-info)_16%,transparent)] text-[var(--admin-info)] border-[color-mix(in_srgb,var(--admin-info)_30%,transparent)]",
};

export interface StatusPillProps {
  children: ReactNode;
  tone?: PillTone;
  className?: string;
}

/**
 * Status compacto do admin. `Badge` público tem altura/peso próprios e variantes
 * globais; não preserva os seis tons baseados nos tokens administrativos da spec 086.
 */
export function StatusPill({ children, tone = "neutral", className }: Readonly<StatusPillProps>) {
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium", TONE[tone], className)}>
      {children}
    </span>
  );
}
