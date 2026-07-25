/** Classe compartilhada de aba administrativa. */
export function tabButtonClass(active: boolean, extra = ""): string {
  const base = `${extra} rounded-md px-3 py-2 text-sm font-medium transition-colors`.trim();
  return `${base} ${
    active
      ? "bg-[var(--admin-hover)] text-[var(--admin-fg)]"
      : "text-[var(--admin-fg-low)] hover:bg-[var(--admin-hover)] hover:text-[var(--admin-fg)]"
  }`;
}
