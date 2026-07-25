import type { ReactNode } from "react";
import { cn } from "./cn.js";

export type PillTone = "neutral" | "brand" | "success" | "warn" | "danger" | "info";

const TONE: Record<PillTone, string> = {
  neutral: "bg-[var(--admin-hover)] text-[var(--fg-low)] border-[var(--border)]",
  brand: "bg-[color-mix(in_srgb,var(--artificio-brand)_18%,transparent)] text-[var(--artificio-brand)] border-[var(--border-orange-soft)]",
  success: "bg-[color-mix(in_srgb,var(--success)_16%,transparent)] text-[var(--success)] border-[color-mix(in_srgb,var(--success)_30%,transparent)]",
  warn: "bg-[color-mix(in_srgb,var(--warn)_16%,transparent)] text-[var(--warn)] border-[color-mix(in_srgb,var(--warn)_30%,transparent)]",
  danger: "bg-[color-mix(in_srgb,var(--danger)_16%,transparent)] text-[var(--danger-soft)] border-[color-mix(in_srgb,var(--danger)_30%,transparent)]",
  info: "bg-[color-mix(in_srgb,var(--info)_16%,transparent)] text-[var(--info)] border-[color-mix(in_srgb,var(--info)_30%,transparent)]",
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
