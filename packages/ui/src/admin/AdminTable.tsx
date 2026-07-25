import { useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "./cn.js";

export interface AdminColumn<T> {
  key: string;
  header: ReactNode;
  render?: (row: T) => ReactNode;
  className?: string;
}

export interface AdminFacet<T> {
  key: string;
  label: string;
  options: Array<{ value: string; label: string }>;
  getValue: (row: T) => string | null | undefined;
}

export interface AdminBulkAction {
  key: string;
  label: string;
  icon?: ReactNode;
  tone?: "neutral" | "danger";
  confirm?: string;
  onRun: (ids: string[]) => void | Promise<void>;
}

export interface AdminRowAction<T> {
  key: string;
  label: string;
  icon?: ReactNode;
  tone?: "neutral" | "danger";
  hidden?: (row: T) => boolean;
  onRun: (row: T) => void | Promise<void>;
}

export interface AdminTableIcons {
  search?: ReactNode;
  chevronDown?: ReactNode;
  clear?: ReactNode;
  open?: ReactNode;
  edit?: ReactNode;
}

export interface AdminTableProps<T> {
  tableId: string;
  rows: T[];
  getRowId: (row: T) => string;
  columns: Array<AdminColumn<T>>;
  searchKeys?: Array<keyof T | ((row: T) => string)>;
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  facets?: Array<AdminFacet<T>>;
  facetValues?: Readonly<Record<string, string | undefined>>;
  onFacetChange?: (facetKey: string, value: string) => void;
  bulkActions?: AdminBulkAction[];
  rowActions?: Array<AdminRowAction<T>>;
  onOpen?: (row: T) => void;
  onEdit?: (row: T) => void;
  icons?: AdminTableIcons;
  loading?: boolean;
  error?: string | null;
  emptyTitle?: string;
  emptyHint?: ReactNode;
}

function valueToText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.toLowerCase();
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value).toLowerCase();
  }
  if (value instanceof Date) return value.toISOString().toLowerCase();
  return "";
}

function valueToDisplay(value: unknown): ReactNode {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  if (value instanceof Date) return value.toLocaleString("pt-BR");
  return "";
}

export function filterAdminRows<T>(
  rows: T[],
  query: string,
  searchKeys: AdminTableProps<T>["searchKeys"],
  facets: Array<AdminFacet<T>>,
  facetValues: Readonly<Record<string, string | undefined>>,
): T[] {
  const normalizedQuery = query.trim().toLowerCase();
  return rows.filter((row) => {
    if (normalizedQuery && searchKeys?.length) {
      const haystack = searchKeys
        .map((key) => typeof key === "function" ? key(row) : valueToText(row[key]))
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(normalizedQuery)) return false;
    }
    return facets.every((facet) => {
      const selectedValue = facetValues[facet.key] ?? "";
      return !selectedValue || valueToText(facet.getValue(row)) === selectedValue.toLowerCase();
    });
  });
}

export function AdminTable<T>({
  tableId,
  rows,
  getRowId,
  columns,
  searchKeys,
  searchPlaceholder = "Buscar…",
  searchValue,
  onSearchChange,
  facets = [],
  facetValues = {},
  onFacetChange,
  bulkActions = [],
  rowActions = [],
  onOpen,
  onEdit,
  icons = {},
  loading,
  error,
  emptyTitle = "Nada por aqui",
  emptyHint,
}: Readonly<AdminTableProps<T>>) {
  const [internalQuery, setInternalQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const inFlightRef = useRef(false);
  const query = searchValue ?? internalQuery;

  const setQuery = (value: string) => {
    if (searchValue === undefined) setInternalQuery(value);
    onSearchChange?.(value);
  };

  const filtered = useMemo(
    () => filterAdminRows(rows, query, searchKeys, facets, facetValues),
    [rows, query, searchKeys, facets, facetValues],
  );
  const filteredIds = useMemo(() => filtered.map(getRowId), [filtered, getRowId]);
  const visibleSelectedIds = useMemo(() => filteredIds.filter((id) => selected.has(id)), [filteredIds, selected]);
  const allSelected = filteredIds.length > 0 && visibleSelectedIds.length === filteredIds.length;
  const someSelected = visibleSelectedIds.length > 0;

  const toggleAll = () => {
    setSelected((previous) => {
      const next = new Set(previous);
      if (allSelected) filteredIds.forEach((id) => next.delete(id));
      else filteredIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const toggleOne = (id: string) => {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const runBulk = async (action: AdminBulkAction) => {
    if (inFlightRef.current) return;
    const ids = visibleSelectedIds;
    if (ids.length === 0) return;
    if (action.confirm && !globalThis.confirm(`${action.confirm}\n\n${ids.length} item(ns) selecionado(s).`)) return;
    inFlightRef.current = true;
    setBusy(true);
    setActionError(null);
    try {
      await action.onRun(ids);
      setSelected(new Set());
    } catch (error_) {
      setActionError(error_ instanceof Error ? error_.message : "Falha ao executar a ação.");
    } finally {
      inFlightRef.current = false;
      setBusy(false);
    }
  };

  const runRowAction = async (action: AdminRowAction<T>, row: T) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setBusy(true);
    setActionError(null);
    try {
      await action.onRun(row);
    } catch (error_) {
      setActionError(error_ instanceof Error ? error_.message : "Falha ao executar a ação.");
    } finally {
      inFlightRef.current = false;
      setBusy(false);
    }
  };

  const builtinRowActions: Array<AdminRowAction<T>> = [
    ...(onOpen ? [{ key: "__open", label: "Abrir", icon: icons.open, onRun: onOpen }] : []),
    ...(onEdit ? [{ key: "__edit", label: "Editar", icon: icons.edit, onRun: onEdit }] : []),
    ...rowActions,
  ];
  const hasSelection = bulkActions.length > 0;
  const columnSpan = columns.length + (hasSelection ? 1 : 0) + (builtinRowActions.length > 0 ? 1 : 0);

  return (
    <div className="flex flex-col gap-3" data-table-id={tableId}>
      <div className="flex flex-wrap items-center gap-2">
        {searchKeys && searchKeys.length > 0 && (
          <div className="relative">
            {icons.search && <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--admin-fg-ghost)]">{icons.search}</span>}
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              className={cn(
                "h-8 w-56 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-input)] pr-2 text-sm text-[var(--admin-fg)] outline-none placeholder:text-[var(--admin-fg-ghost)] focus:border-[var(--admin-border-strong)]",
                icons.search ? "pl-8" : "pl-2.5",
              )}
            />
          </div>
        )}
        {facets.map((facet) => (
          <div key={facet.key} className="relative">
            <select
              value={facetValues[facet.key] ?? ""}
              onChange={(event) => onFacetChange?.(facet.key, event.target.value)}
              aria-label={facet.label}
              className="h-8 appearance-none rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-input)] pl-2.5 pr-7 text-sm text-[var(--admin-fg)] outline-none focus:border-[var(--admin-border-strong)]"
            >
              <option value="">{facet.label}: todos</option>
              {facet.options.map((option) => <option key={option.value} value={option.value}>{facet.label}: {option.label}</option>)}
            </select>
            {icons.chevronDown && <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[var(--admin-fg-ghost)]">{icons.chevronDown}</span>}
          </div>
        ))}
        <span className="ml-auto text-xs text-[var(--admin-fg-faint)]">{filtered.length} de {rows.length}</span>
      </div>

      {hasSelection && someSelected && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--admin-border-orange-soft)] bg-[color-mix(in_srgb,var(--artificio-brand)_8%,transparent)] px-3 py-2">
          <span className="text-sm text-[var(--admin-fg-muted)]">{visibleSelectedIds.length} selecionado(s)</span>
          <div className="ml-auto flex items-center gap-2">
            {bulkActions.map((action) => (
              <button
                key={action.key}
                type="button"
                disabled={busy}
                onClick={() => void runBulk(action)}
                className={cn(
                  "inline-flex min-h-11 items-center gap-1.5 rounded-lg border px-2.5 py-1 text-sm font-medium disabled:opacity-50",
                  action.tone === "danger"
                    ? "border-[color-mix(in_srgb,var(--admin-danger)_40%,transparent)] text-[var(--admin-danger-soft)] hover:bg-[color-mix(in_srgb,var(--admin-danger)_12%,transparent)]"
                    : "border-[var(--admin-border)] text-[var(--admin-fg-muted)] hover:bg-[var(--admin-hover)]",
                )}
              >
                {action.icon}{action.label}
              </button>
            ))}
            <button type="button" onClick={() => setSelected(new Set())} className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2 py-1 text-sm text-[var(--admin-fg-faint)] hover:text-[var(--admin-fg)]">
              {icons.clear} limpar
            </button>
          </div>
        </div>
      )}

      {actionError && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_40%,transparent)] bg-[color-mix(in_srgb,var(--admin-danger)_12%,transparent)] px-3 py-2 text-sm text-[var(--admin-danger-soft)]">
          <span>{actionError}</span>
          <button type="button" aria-label="Fechar erro" onClick={() => setActionError(null)} className="min-h-11 min-w-11 text-[var(--admin-fg-faint)] hover:text-[var(--admin-fg)]">{icons.clear ?? "×"}</button>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)]">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-[var(--admin-border)] text-left text-xs uppercase tracking-wide text-[var(--admin-fg-faint)]">
              {hasSelection && <th className="w-10 px-3 py-2.5"><input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Selecionar todos" className="accent-[var(--artificio-brand)]" /></th>}
              {columns.map((column) => <th key={column.key} className={cn("px-3 py-2.5 font-medium", column.className)}>{column.header}</th>)}
              {builtinRowActions.length > 0 && <th className="px-3 py-2.5 text-right font-medium">Ações</th>}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={columnSpan} className="px-3 py-10 text-center text-[var(--admin-fg-faint)]">Carregando…</td></tr>}
            {!loading && error && <tr><td colSpan={columnSpan} className="px-3 py-10 text-center text-[var(--admin-danger-soft)]">{error}</td></tr>}
            {!loading && !error && filtered.length === 0 && (
              <tr><td colSpan={columnSpan} className="px-3 py-12 text-center"><div className="text-sm font-medium text-[var(--admin-fg-muted)]">{emptyTitle}</div>{emptyHint && <div className="mt-1 text-xs text-[var(--admin-fg-faint)]">{emptyHint}</div>}</td></tr>
            )}
            {!loading && !error && filtered.map((row) => {
              const id = getRowId(row);
              const isSelected = selected.has(id);
              return (
                <tr key={id} className={cn("border-b border-[var(--admin-border-soft)] transition-colors last:border-0 hover:bg-[var(--admin-hover)]", isSelected && "bg-[color-mix(in_srgb,var(--artificio-brand)_6%,transparent)]")}>
                  {hasSelection && <td className="px-3 py-2.5"><input type="checkbox" checked={isSelected} onChange={() => toggleOne(id)} aria-label={`Selecionar ${id}`} className="accent-[var(--artificio-brand)]" /></td>}
                  {columns.map((column) => (
                    <td key={column.key} className={cn("px-3 py-2.5 text-[var(--admin-fg-muted)]", column.className)}>
                      {column.render ? column.render(row) : valueToDisplay((row as Record<string, unknown>)[column.key])}
                    </td>
                  ))}
                  {builtinRowActions.length > 0 && (
                    <td className="px-3 py-2.5"><div className="flex items-center justify-end gap-1">
                      {builtinRowActions.filter((action) => !action.hidden?.(row)).map((action) => (
                        <button key={action.key} type="button" title={action.label} aria-label={action.label} disabled={busy} onClick={() => void runRowAction(action, row)} className={cn("inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-md border border-transparent px-1.5 py-1 text-xs disabled:opacity-50 hover:border-[var(--admin-border)] hover:bg-[var(--admin-hover)]", action.tone === "danger" ? "text-[var(--admin-danger-soft)]" : "text-[var(--admin-fg-low)]")}>
                          {action.icon ?? action.label}
                        </button>
                      ))}
                    </div></td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
