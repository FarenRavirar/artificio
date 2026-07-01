/**
 * Classe de botão de aba do admin (ativo vs inativo), compartilhada pelas Sections.
 * `extra` adiciona classes de layout (ex.: 'inline-flex items-center gap-2' para sub-abas com ícone).
 */
export function tabButtonClass(active: boolean, extra = ''): string {
  const base = `${extra} rounded-md px-3 py-2 text-sm font-medium transition-colors`.trim();
  return `${base} ${
    active
      ? 'bg-[var(--admin-hover)] text-[var(--fg)]'
      : 'text-[var(--fg-low)] hover:bg-[var(--admin-hover)] hover:text-[var(--fg)]'
  }`;
}
