export interface ActiveFilter {
  key: string;
  label: string;
  value: string;
}

interface ActiveFilterChipsProps {
  filters: ActiveFilter[];
  onRemove: (key: string) => void;
}

// T8.3 (spec 086) — chips de filtro ativo, formato do print subnav
// importante.png (pilula + botao ⊗ de remover) mais linha de resumo textual
// abaixo, no mesmo vocabulario visual do kit administrativo (requisito 22).
export function ActiveFilterChips({ filters, onRemove }: Readonly<ActiveFilterChipsProps>) {
  if (filters.length === 0) return null;

  return (
    <div className="mb-4">
      <div className="flex flex-wrap gap-2">
        {filters.map((filter) => (
          <button
            key={filter.key}
            type="button"
            onClick={() => onRemove(filter.key)}
            className="flex min-h-[36px] items-center gap-2 rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-1 text-sm font-medium text-[var(--fg)] hover:border-artificio-orange"
          >
            {filter.value}
            <span aria-hidden="true" className="text-[var(--color-artificio-orange)]">⊗</span>
            <span className="sr-only">Remover filtro {filter.label}</span>
          </button>
        ))}
      </div>
      <p className="mt-2 text-sm text-[var(--fg-muted)]">
        {filters.map((filter) => `${filter.label}: ${filter.value}`).join(', ')}
      </p>
    </div>
  );
}
