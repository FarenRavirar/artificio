import { useMemo, useState } from 'react';
import { Check, Edit2, Plus, Search, Send, X } from 'lucide-react';
import type { SystemTreeNode } from '../types/systems';
import { normalizeText } from '../utils/systemTree';

export type SystemPickerMode = 'single' | 'multi';
export type SystemPickerRole = 'user' | 'admin';

export type SystemPickerProps = Readonly<{
  tree: SystemTreeNode[];
  selectedIds: string[];
  onSelectionChange: (selectedIds: string[]) => void;
  idPrefix: string;
  mode?: SystemPickerMode;
  role?: SystemPickerRole;
  searchPlaceholder?: string;
  onSuggest?: (query: string) => void;
  onCreateNow?: (query: string) => void;
  onEdit?: (node: SystemTreeNode) => void;
  showEmptySearchResults?: boolean;
}>;

const nodeMatchesQuery = (node: SystemTreeNode, normalizedQuery: string): boolean => {
  return normalizeText(node.name).includes(normalizedQuery)
    || normalizeText(node.name_pt ?? '').includes(normalizedQuery)
    || normalizeText(node.slug).includes(normalizedQuery)
    || normalizeText(node.path_slug ?? '').includes(normalizedQuery)
    || (node.aliases ?? []).some((alias) => normalizeText(alias).includes(normalizedQuery));
};

const filterRoots = (nodes: SystemTreeNode[], query: string): SystemTreeNode[] => {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return nodes;
  return nodes.filter((node) => nodeMatchesQuery(node, normalizedQuery));
};

const findPath = (nodes: SystemTreeNode[], id: string): SystemTreeNode[] | null => {
  for (const node of nodes) {
    if (node.id === id) return [node];
    const childPath = findPath(node.children ?? [], id);
    if (childPath) return [node, ...childPath];
  }
  return null;
};

const collectSelectedPaths = (tree: SystemTreeNode[], selectedIds: string[]): SystemTreeNode[][] => {
  return selectedIds
    .map((id) => findPath(tree, id))
    .filter((path): path is SystemTreeNode[] => Boolean(path));
};

const getAliasBadge = (aliases?: string[]): string | null => {
  const list = aliases ?? [];
  if (list.length === 0) return null;
  if (list.length === 1) return list[0];
  return `${list[0]} +${list.length - 1}`;
};

const LEVEL_LABEL: Record<number, string> = {
  0: 'sistema',
  1: 'edição',
  2: 'variante',
};

const ADD_LABEL: Record<number, string> = {
  0: 'Adicionar sistema',
  1: 'Adicionar edição',
  2: 'Adicionar variante',
};

type SystemPickerLevelProps = Readonly<{
  idPrefix: string;
  depth: number;
  nodes: SystemTreeNode[];
  selectedId: string | null;
  onSelect: (node: SystemTreeNode) => void;
  onToggleMulti?: (node: SystemTreeNode) => void;
  multiSelectedIds?: Set<string>;
  role: SystemPickerRole;
  onEdit?: (node: SystemTreeNode) => void;
  onAdd?: () => void;
}>;

const SystemPickerLevel = ({
  idPrefix,
  depth,
  nodes,
  selectedId,
  onSelect,
  onToggleMulti,
  multiSelectedIds,
  role,
  onEdit,
  onAdd,
}: SystemPickerLevelProps) => {
  const isMulti = Boolean(onToggleMulti && multiSelectedIds);

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)]">
      {nodes.map((node) => {
        const selected = isMulti ? multiSelectedIds!.has(node.id) : selectedId === node.id;
        const aliasBadge = getAliasBadge(node.aliases);

        return (
          <div
            key={node.id}
            className={`group flex min-h-14 items-center gap-2 border-t border-[var(--line)] px-3 py-2 text-[var(--fg)] first:border-t-0 hover:bg-[var(--surface-subtle)] ${
              selected ? 'border-l-[3px] border-l-[var(--artificio-brand)] bg-[rgba(255,87,34,.1)]' : ''
            }`}
          >
            <button
              type="button"
              id={`${idPrefix}-node-${node.id}`}
              className="min-w-0 flex-1 text-left"
              onClick={() => (isMulti ? onToggleMulti!(node) : onSelect(node))}
              aria-pressed={selected}
            >
              <span className="block truncate text-[13px] font-bold">{node.name}</span>
              <span className="block truncate text-[11px] text-[var(--fg-muted)]">
                nome PT: {node.name_pt || '—'}
              </span>
            </button>

            {aliasBadge && (
              <span className="max-w-24 shrink-0 truncate rounded-full bg-[var(--fill)] px-2 py-0.5 text-[10px] text-[var(--fg-muted)]">
                {aliasBadge}
              </span>
            )}

            {role === 'admin' && onEdit && (
              <button
                type="button"
                className="hidden h-7 w-7 shrink-0 items-center justify-center rounded text-[var(--fg-muted)] hover:bg-[var(--fill)] hover:text-[var(--fg)] group-hover:flex"
                onClick={() => onEdit(node)}
                aria-label={`Editar ${node.name}`}
                title="Editar"
              >
                <Edit2 className="h-3.5 w-3.5" />
              </button>
            )}

            {selected && <Check className="h-4 w-4 shrink-0 text-[var(--artificio-brand)]" />}
          </div>
        );
      })}

      {onAdd && (
        <button
          type="button"
          className="flex w-full items-center gap-2 border-t border-[var(--line)] px-3 py-2.5 text-left text-[13px] font-semibold text-[var(--fg-muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--fg)]"
          onClick={onAdd}
        >
          <Plus className="h-4 w-4" />
          {ADD_LABEL[depth]}
        </button>
      )}
    </div>
  );
};

export function SystemPicker({
  tree,
  selectedIds,
  onSelectionChange,
  idPrefix,
  mode = 'single',
  role = 'user',
  searchPlaceholder = 'Buscar sistema...',
  onSuggest,
  onCreateNow,
  onEdit,
  showEmptySearchResults = true,
}: SystemPickerProps) {
  const [search, setSearch] = useState('');
  const [pendingAddDepth, setPendingAddDepth] = useState<number | null>(null);

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedPaths = useMemo(() => collectSelectedPaths(tree, selectedIds), [tree, selectedIds]);

  // Caminho de navegação: em modo single, é o caminho do nó selecionado.
  // Em modo multi, navegação é independente da seleção (só serve pra descer níveis e ver edições/variantes).
  const [navPath, setNavPath] = useState<SystemTreeNode[]>([]);
  const effectiveNavPath = mode === 'single' && selectedPaths.length > 0 ? selectedPaths[0] : navPath;

  const normalizedSearch = normalizeText(search);
  const shouldShowResults = showEmptySearchResults || normalizedSearch.length > 0;
  const visibleRoots = useMemo(() => filterRoots(tree, search), [tree, search]);

  const handleSelectAtLevel = (depth: number, node: SystemTreeNode) => {
    setPendingAddDepth(null);
    const basePath = effectiveNavPath.slice(0, depth);
    setNavPath([...basePath, node]);

    if (mode === 'single') {
      onSelectionChange(selectedIdSet.has(node.id) ? [] : [node.id]);
    }
  };

  const toggleMultiAtRoot = (node: SystemTreeNode) => {
    const next = selectedIdSet.has(node.id)
      ? selectedIds.filter((id) => id !== node.id)
      : [...selectedIds, node.id];
    onSelectionChange(next);
  };

  const clearSelection = () => {
    onSelectionChange([]);
    setNavPath([]);
  };

  const removeSelected = (id: string) => {
    onSelectionChange(selectedIds.filter((selectedId) => selectedId !== id));
    if (mode === 'single') setNavPath([]);
  };

  const canSuggest = normalizedSearch.length > 0 && onSuggest;
  const canCreateNow = role === 'admin' && normalizedSearch.length > 0 && onCreateNow;
  const noRootResults = shouldShowResults && visibleRoots.length === 0;

  // Colunas visíveis: raiz (sistemas) + uma por nível já navegado, cada uma mostrando os filhos do nó anterior.
  const levels: { depth: number; nodes: SystemTreeNode[] }[] = [{ depth: 0, nodes: visibleRoots }];
  effectiveNavPath.forEach((node, index) => {
    const children = node.children ?? [];
    if (children.length > 0 || role === 'admin') {
      levels.push({ depth: index + 1, nodes: children });
    }
  });

  return (
    <div className="space-y-3 text-[var(--fg)]">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--fg-muted)]" />
        <input
          id={`${idPrefix}-search`}
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] py-2.5 pl-9 pr-3 text-sm text-[var(--fg)] outline-none placeholder:text-[var(--fg-muted)] focus:border-[var(--artificio-brand)]"
        />
      </div>

      {shouldShowResults && (
        <div className="space-y-3">
          {levels.map(({ depth, nodes }) => (
            <div key={`level-${depth}`} className="space-y-1">
              {depth > 0 && (
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
                  {LEVEL_LABEL[Math.min(depth, 2)]}{depth > 1 ? 's' : depth === 0 ? '' : 's'} de {effectiveNavPath[depth - 1]?.name}
                </p>
              )}
              {nodes.length > 0 || role === 'admin' ? (
                <SystemPickerLevel
                  idPrefix={idPrefix}
                  depth={depth}
                  nodes={nodes}
                  selectedId={mode === 'single' ? (effectiveNavPath[depth]?.id ?? null) : null}
                  onSelect={(node) => handleSelectAtLevel(depth, node)}
                  onToggleMulti={depth === 0 && mode === 'multi' ? toggleMultiAtRoot : undefined}
                  multiSelectedIds={depth === 0 && mode === 'multi' ? selectedIdSet : undefined}
                  role={role}
                  onEdit={onEdit}
                  onAdd={role === 'admin' ? () => setPendingAddDepth(depth) : undefined}
                />
              ) : (
                <p className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--fg-muted)]">
                  Nenhum{depth === 2 ? 'a' : ''} {LEVEL_LABEL[Math.min(depth, 2)]} cadastrad{depth === 2 ? 'a' : 'o'} ainda.
                </p>
              )}
            </div>
          ))}

          {noRootResults && (
            <div className="space-y-3 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4">
              <p className="text-sm text-[var(--fg-muted)]">Nenhum sistema encontrado.</p>
              {(canSuggest || canCreateNow) && (
                <div className="flex flex-wrap gap-2">
                  {canSuggest && (
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface-subtle)] px-3 py-2 text-sm font-semibold text-[var(--fg)] hover:border-[var(--artificio-brand)]"
                      onClick={() => onSuggest(search.trim())}
                    >
                      <Send className="h-4 w-4" />
                      Sugerir cadeia
                    </button>
                  )}
                  {canCreateNow && (
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 rounded-lg border border-[var(--artificio-brand)] bg-[rgba(255,87,34,.1)] px-3 py-2 text-sm font-semibold text-[var(--artificio-brand)]"
                      onClick={() => onCreateNow(search.trim())}
                    >
                      <Plus className="h-4 w-4" />
                      Criar agora
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {pendingAddDepth !== null && role === 'admin' && onCreateNow && (
            <div className="flex items-center gap-2 rounded-lg border border-[var(--artificio-brand)] bg-[rgba(255,87,34,.08)] px-3 py-2.5">
              <p className="flex-1 text-[13px] text-[var(--fg)]">
                Use o botão "Criar agora" na busca acima informando o nome, ou "Sugerir" para enviar para moderação.
              </p>
              <button
                type="button"
                className="h-7 w-7 shrink-0 rounded text-[var(--fg-muted)] hover:bg-[var(--fill)] hover:text-[var(--fg)]"
                onClick={() => setPendingAddDepth(null)}
                aria-label="Fechar"
              >
                <X className="mx-auto h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {selectedPaths.length > 0 && (
        <div className="space-y-2">
          {selectedPaths.map((path) => (
            <div
              key={path[path.length - 1]?.id}
              className="flex items-start gap-2 rounded-lg border border-[var(--artificio-brand)] bg-[rgba(255,87,34,.08)] px-3 py-2.5"
            >
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--artificio-brand)]" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-[var(--artificio-brand)]">Selecionado</p>
                <p className="truncate text-[13px] text-[var(--fg)]">
                  {path.map((node) => node.name).join(' › ')}
                </p>
              </div>
              {mode === 'multi' && (
                <button
                  type="button"
                  className="h-7 w-7 shrink-0 rounded text-[var(--fg-muted)] hover:bg-[var(--fill)] hover:text-[var(--fg)]"
                  onClick={() => removeSelected(path[path.length - 1]?.id ?? '')}
                  aria-label={`Remover ${path[path.length - 1]?.name}`}
                >
                  <X className="mx-auto h-4 w-4" />
                </button>
              )}
            </div>
          ))}
          {mode === 'single' && (
            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--fg-muted)] hover:text-[var(--fg)]"
              onClick={clearSelection}
            >
              <X className="h-3.5 w-3.5" />
              Limpar seleção
            </button>
          )}
        </div>
      )}

      <p className="text-[11px] text-[var(--fg-muted)]">
        Cada nível é um nó com nome, nome PT e aliases próprios; o caminho selecionado é só a leitura da árvore de cima a baixo, não um campo salvo.
      </p>
    </div>
  );
}
