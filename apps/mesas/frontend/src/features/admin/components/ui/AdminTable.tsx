import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronDown, Eye, Pencil, Search, X } from 'lucide-react';
import { cn } from './cn';

// ---------------------------------------------------------------------------
// Contrato (R15) — padrão único de lista do /gestao.
// Apresentacional + controlado: os dados chegam por props; o estado de filtro
// vive na URL (namespace por tableId); a seleção é interna.
// ---------------------------------------------------------------------------

export interface AdminColumn<T> {
  key: string;
  header: React.ReactNode;
  render?: (row: T) => React.ReactNode;
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
  icon?: React.ReactNode;
  tone?: 'neutral' | 'danger';
  /** Mensagem de confirmação; se ausente, executa direto. */
  confirm?: string;
  onRun: (ids: string[]) => void | Promise<void>;
}

export interface AdminRowAction<T> {
  key: string;
  label: string;
  icon?: React.ReactNode;
  tone?: 'neutral' | 'danger';
  hidden?: (row: T) => boolean;
  onRun: (row: T) => void | Promise<void>;
}

interface AdminTableProps<T> {
  /** Namespace do estado de filtro na URL (permite N tabelas por página). */
  tableId: string;
  rows: T[];
  getRowId: (row: T) => string;
  columns: Array<AdminColumn<T>>;
  /** Chaves/acessadores p/ busca textual livre. */
  searchKeys?: Array<keyof T | ((row: T) => string)>;
  searchPlaceholder?: string;
  facets?: Array<AdminFacet<T>>;
  /** Ações em lote (apagar/arquivar padrão entram aqui). */
  bulkActions?: AdminBulkAction[];
  rowActions?: Array<AdminRowAction<T>>;
  onOpen?: (row: T) => void;
  onEdit?: (row: T) => void;
  loading?: boolean;
  error?: string | null;
  emptyTitle?: string;
  emptyHint?: React.ReactNode;
}

function valueToText(v: unknown): string {
  if (v == null) return '';
  return String(v).toLowerCase();
}

export function AdminTable<T>({
  tableId,
  rows,
  getRowId,
  columns,
  searchKeys,
  searchPlaceholder = 'Buscar…',
  facets = [],
  bulkActions = [],
  rowActions = [],
  onOpen,
  onEdit,
  loading,
  error,
  emptyTitle = 'Nada por aqui',
  emptyHint,
}: AdminTableProps<T>) {
  const [params, setParams] = useSearchParams();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const qKey = `${tableId}.q`;
  const query = params.get(qKey) ?? '';

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const activeFacets = useMemo(
    () => facets.map((f) => ({ facet: f, value: params.get(`${tableId}.${f.key}`) ?? '' })),
    [facets, params, tableId],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (q && searchKeys && searchKeys.length > 0) {
        const hay = searchKeys
          .map((k) => (typeof k === 'function' ? k(row) : valueToText(row[k])))
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      for (const { facet, value } of activeFacets) {
        if (value && valueToText(facet.getValue(row)) !== value.toLowerCase()) return false;
      }
      return true;
    });
  }, [rows, query, searchKeys, activeFacets]);

  const filteredIds = useMemo(() => filtered.map(getRowId), [filtered, getRowId]);
  const allSelected = filteredIds.length > 0 && filteredIds.every((id) => selected.has(id));
  const someSelected = selected.size > 0;

  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) filteredIds.forEach((id) => next.delete(id));
      else filteredIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const runBulk = async (action: AdminBulkAction) => {
    const ids = filteredIds.filter((id) => selected.has(id));
    if (ids.length === 0) return;
    if (action.confirm && !window.confirm(`${action.confirm}\n\n${ids.length} item(ns) selecionado(s).`)) return;
    setBusy(true);
    try {
      await action.onRun(ids);
      setSelected(new Set());
    } finally {
      setBusy(false);
    }
  };

  const builtinRowActions: Array<AdminRowAction<T>> = [
    ...(onOpen ? [{ key: '__open', label: 'Abrir', icon: <Eye size={15} />, onRun: onOpen }] : []),
    ...(onEdit ? [{ key: '__edit', label: 'Editar', icon: <Pencil size={15} />, onRun: onEdit }] : []),
    ...rowActions,
  ];

  const hasSelection = bulkActions.length > 0;
  const colSpan = columns.length + (hasSelection ? 1 : 0) + (builtinRowActions.length > 0 ? 1 : 0);

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar: busca + facetas */}
      <div className="flex flex-wrap items-center gap-2">
        {searchKeys && searchKeys.length > 0 && (
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--fg-ghost)]" />
            <input
              value={query}
              onChange={(e) => setParam(qKey, e.target.value)}
              placeholder={searchPlaceholder}
              className="h-8 w-56 rounded-lg border border-[var(--border)] bg-[var(--surface-input)] pl-8 pr-2 text-sm text-[var(--fg)] outline-none placeholder:text-[var(--fg-ghost)] focus:border-[var(--border-strong)]"
            />
          </div>
        )}
        {activeFacets.map(({ facet, value }) => (
          <div key={facet.key} className="relative">
            <select
              value={value}
              onChange={(e) => setParam(`${tableId}.${facet.key}`, e.target.value)}
              className="app-select h-8 appearance-none rounded-lg border border-[var(--border)] bg-[var(--surface-input)] pl-2.5 pr-7 text-sm text-[var(--fg)] outline-none focus:border-[var(--border-strong)]"
            >
              <option value="">{facet.label}: todos</option>
              {facet.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {facet.label}: {o.label}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[var(--fg-ghost)]" />
          </div>
        ))}
        <span className="ml-auto text-xs text-[var(--fg-faint)]">
          {filtered.length} de {rows.length}
        </span>
      </div>

      {/* Barra de lote */}
      {hasSelection && someSelected && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border-orange-soft)] bg-[color-mix(in_srgb,var(--color-artificio-orange)_8%,transparent)] px-3 py-2">
          <span className="text-sm text-[var(--fg-muted)]">{selected.size} selecionado(s)</span>
          <div className="ml-auto flex items-center gap-2">
            {bulkActions.map((a) => (
              <button
                key={a.key}
                type="button"
                disabled={busy}
                onClick={() => void runBulk(a)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-sm font-medium disabled:opacity-50',
                  a.tone === 'danger'
                    ? 'border-[color-mix(in_srgb,var(--danger)_40%,transparent)] text-[var(--danger-soft)] hover:bg-[color-mix(in_srgb,var(--danger)_12%,transparent)]'
                    : 'border-[var(--border)] text-[var(--fg-muted)] hover:bg-[var(--admin-hover)]',
                )}
              >
                {a.icon}
                {a.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-[var(--fg-faint)] hover:text-[var(--fg)]"
            >
              <X size={15} /> limpar
            </button>
          </div>
        </div>
      )}

      {/* Tabela */}
      <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--admin-surface)]">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wide text-[var(--fg-faint)]">
              {hasSelection && (
                <th className="w-10 px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label="Selecionar todos"
                    className="accent-[var(--color-artificio-orange)]"
                  />
                </th>
              )}
              {columns.map((c) => (
                <th key={c.key} className={cn('px-3 py-2.5 font-medium', c.className)}>
                  {c.header}
                </th>
              ))}
              {builtinRowActions.length > 0 && <th className="px-3 py-2.5 text-right font-medium">Ações</th>}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={colSpan} className="px-3 py-10 text-center text-[var(--fg-faint)]">
                  Carregando…
                </td>
              </tr>
            )}
            {!loading && error && (
              <tr>
                <td colSpan={colSpan} className="px-3 py-10 text-center text-[var(--danger-soft)]">
                  {error}
                </td>
              </tr>
            )}
            {!loading && !error && filtered.length === 0 && (
              <tr>
                <td colSpan={colSpan} className="px-3 py-12 text-center">
                  <div className="text-sm font-medium text-[var(--fg-muted)]">{emptyTitle}</div>
                  {emptyHint && <div className="mt-1 text-xs text-[var(--fg-faint)]">{emptyHint}</div>}
                </td>
              </tr>
            )}
            {!loading &&
              !error &&
              filtered.map((row) => {
                const id = getRowId(row);
                const isSel = selected.has(id);
                return (
                  <tr
                    key={id}
                    className={cn(
                      'border-b border-[var(--border-soft)] last:border-0 transition-colors hover:bg-[var(--admin-hover)]',
                      isSel && 'bg-[color-mix(in_srgb,var(--color-artificio-orange)_6%,transparent)]',
                    )}
                  >
                    {hasSelection && (
                      <td className="px-3 py-2.5">
                        <input
                          type="checkbox"
                          checked={isSel}
                          onChange={() => toggleOne(id)}
                          aria-label="Selecionar linha"
                          className="accent-[var(--color-artificio-orange)]"
                        />
                      </td>
                    )}
                    {columns.map((c) => (
                      <td key={c.key} className={cn('px-3 py-2.5 text-[var(--fg-muted)]', c.className)}>
                        {c.render ? c.render(row) : valueToText((row as Record<string, unknown>)[c.key])}
                      </td>
                    ))}
                    {builtinRowActions.length > 0 && (
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          {builtinRowActions
                            .filter((a) => !a.hidden?.(row))
                            .map((a) => (
                              <button
                                key={a.key}
                                type="button"
                                title={a.label}
                                onClick={() => void a.onRun(row)}
                                className={cn(
                                  'inline-flex items-center gap-1 rounded-md border border-transparent px-1.5 py-1 text-xs hover:border-[var(--border)] hover:bg-[var(--admin-hover)]',
                                  a.tone === 'danger' ? 'text-[var(--danger-soft)]' : 'text-[var(--fg-low)]',
                                )}
                              >
                                {a.icon ?? a.label}
                              </button>
                            ))}
                        </div>
                      </td>
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
