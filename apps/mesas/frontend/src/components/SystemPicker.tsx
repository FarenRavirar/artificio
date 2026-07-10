import { useMemo, useState, type ReactNode } from 'react';
import { Check, ChevronRight, Edit2, Plus, Search, Send, X } from 'lucide-react';
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

type VisibleSystemNode = Omit<SystemTreeNode, 'children'> & {
  children: VisibleSystemNode[];
};

const INDENT_PX = 22;

const nodeMatchesQuery = (node: SystemTreeNode, normalizedQuery: string): boolean => {
  return normalizeText(node.name).includes(normalizedQuery)
    || normalizeText(node.name_pt ?? '').includes(normalizedQuery)
    || normalizeText(node.slug).includes(normalizedQuery)
    || normalizeText(node.path_slug ?? '').includes(normalizedQuery)
    || (node.aliases ?? []).some((alias) => normalizeText(alias).includes(normalizedQuery));
};

const filterTree = (nodes: SystemTreeNode[], query: string): VisibleSystemNode[] => {
  const normalizedQuery = normalizeText(query);

  const visit = (node: SystemTreeNode): VisibleSystemNode | null => {
    const filteredChildren = (node.children ?? [])
      .map(visit)
      .filter((child): child is VisibleSystemNode => Boolean(child));

    if (!normalizedQuery || nodeMatchesQuery(node, normalizedQuery) || filteredChildren.length > 0) {
      return {
        ...node,
        aliases: node.aliases ?? [],
        children: filteredChildren,
      };
    }

    return null;
  };

  return nodes
    .map(visit)
    .filter((node): node is VisibleSystemNode => Boolean(node));
};

const collectExpandableIds = (nodes: SystemTreeNode[]): string[] => {
  const ids: string[] = [];
  const visit = (node: SystemTreeNode) => {
    if ((node.children ?? []).length > 0) {
      ids.push(node.id);
      node.children?.forEach(visit);
    }
  };
  nodes.forEach(visit);
  return ids;
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

const getExpandButtonLabel = (hasChildren: boolean, expanded: boolean, name: string): string | undefined => {
  if (!hasChildren) return undefined;
  if (expanded) return `Recolher ${name}`;
  return `Expandir ${name}`;
};

export function SystemPicker({
  tree,
  selectedIds,
  onSelectionChange,
  idPrefix,
  mode = 'single',
  role = 'user',
  searchPlaceholder = 'Buscar sistema, edição ou variante...',
  onSuggest,
  onCreateNow,
  onEdit,
  showEmptySearchResults = true,
}: SystemPickerProps) {
  const [search, setSearch] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set(collectExpandableIds(tree)));

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedPaths = useMemo(() => collectSelectedPaths(tree, selectedIds), [tree, selectedIds]);
  const visibleTree = useMemo(() => filterTree(tree, search), [tree, search]);
  const allVisibleExpandableIds = useMemo(() => new Set(collectExpandableIds(visibleTree)), [visibleTree]);
  const normalizedSearch = normalizeText(search);
  const shouldShowResults = showEmptySearchResults || normalizedSearch.length > 0;

  const toggleExpanded = (node: SystemTreeNode) => {
    if ((node.children ?? []).length === 0) return;
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(node.id)) {
        next.delete(node.id);
      } else {
        next.add(node.id);
      }
      return next;
    });
  };

  const toggleSelection = (node: SystemTreeNode) => {
    if (mode === 'single') {
      onSelectionChange(selectedIdSet.has(node.id) ? [] : [node.id]);
      return;
    }

    const next = selectedIdSet.has(node.id)
      ? selectedIds.filter((id) => id !== node.id)
      : [...selectedIds, node.id];
    onSelectionChange(next);
  };

  const clearSelection = () => {
    onSelectionChange([]);
  };

  const renderNode = (node: VisibleSystemNode, depth = 0): ReactNode => {
    const hasChildren = node.children.length > 0;
    const expanded = normalizedSearch ? allVisibleExpandableIds.has(node.id) : expandedIds.has(node.id);
    const selected = selectedIdSet.has(node.id);
    const aliasBadge = getAliasBadge(node.aliases);
    const expandButtonLabel = getExpandButtonLabel(hasChildren, expanded, node.name);

    return (
      <div key={node.id}>
        <div
          className={`group flex min-h-14 items-center gap-2 border-t border-[var(--line)] px-3 py-2 text-[var(--fg)] first:border-t-0 hover:bg-[var(--surface-subtle)] ${
            selected ? 'border-l-[3px] border-l-[var(--artificio-brand)] bg-[rgba(255,87,34,.1)]' : ''
          }`}
          style={{ paddingLeft: 12 + depth * INDENT_PX }}
        >
          <button
            type="button"
            className="flex h-5 w-[14px] shrink-0 items-center justify-center text-xs text-[var(--fg-muted)]"
            onClick={() => toggleExpanded(node)}
            aria-label={expandButtonLabel}
            disabled={!hasChildren}
          >
            {hasChildren ? (
              <ChevronRight className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-90' : ''}`} />
            ) : (
              <span className="text-[10px] leading-none">•</span>
            )}
          </button>

          <button
            type="button"
            id={`${idPrefix}-node-${node.id}`}
            className="min-w-0 flex-1 text-left"
            onClick={() => toggleSelection(node)}
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

        {expanded && node.children.map((child) => renderNode(child, depth + 1))}
      </div>
    );
  };

  const canSuggest = normalizedSearch.length > 0 && onSuggest;
  const canCreateNow = role === 'admin' && normalizedSearch.length > 0 && onCreateNow;

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
        <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)]">
          {visibleTree.length > 0 ? (
            visibleTree.map((node) => renderNode(node))
          ) : (
            <div className="space-y-3 p-4">
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
                  onClick={() => onSelectionChange(selectedIds.filter((id) => id !== path[path.length - 1]?.id))}
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
