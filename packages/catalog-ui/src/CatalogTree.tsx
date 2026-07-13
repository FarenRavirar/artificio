import { useMemo, useState, type ReactNode } from 'react';
import { Check, Edit2, Plus, Search, Send, X } from 'lucide-react';
import type { CatalogUiNode } from './types.js';
import { normalizeText } from './normalize.js';

export type CatalogTreeMode = 'single' | 'multi';
export type CatalogTreeRole = 'user' | 'admin';

export type CatalogTreeProps = Readonly<{
  tree: CatalogUiNode[];
  selectedIds: string[];
  onSelectionChange: (selectedIds: string[]) => void;
  idPrefix: string;
  mode?: CatalogTreeMode;
  role?: CatalogTreeRole;
  searchPlaceholder?: string;
  onSuggest?: (query: string) => void;
  onCreateNow?: (query: string) => void;
  onEdit?: (node: CatalogUiNode) => void;
  showEmptySearchResults?: boolean;
  /** Quando fornecida, o botão "+ Adicionar" de cada nível chama isso direto com o nó
   * pai daquele nível (ou null na raiz) — usado por consumidores com formulário de
   * criação embutido (ex.: CatalogExplorer), em vez do fluxo de busca+onCreateNow.
   * Achado Codex (PR #148): sem isto, o botão só marcava um estado sem nenhuma ação. */
  onAddChildAtLevel?: (depth: number, parent: CatalogUiNode | null) => void;
}>;

const nodeMatchesQuery = (node: CatalogUiNode, normalizedQuery: string): boolean => {
  return normalizeText(node.name).includes(normalizedQuery)
    || normalizeText(node.name_pt ?? '').includes(normalizedQuery)
    || normalizeText(node.canonical_slug).includes(normalizedQuery)
    || normalizeText(node.path_slug ?? '').includes(normalizedQuery)
    || (node.aliases ?? []).some((alias) => normalizeText(alias).includes(normalizedQuery));
};

/** Acha match em qualquer nível (nome/slug/alias de sistema, edição ou variante) —
 * comportamento do antigo filterTree do site-admin (achado Codex PR #148): buscar
 * "5e" precisa achar a edição, não só sistemas de nível raiz cujo próprio nome bate. */
const subtreeMatchesQuery = (node: CatalogUiNode, normalizedQuery: string): boolean => {
  if (nodeMatchesQuery(node, normalizedQuery)) return true;
  return (node.children ?? []).some((child) => subtreeMatchesQuery(child, normalizedQuery));
};

const filterRoots = (nodes: CatalogUiNode[], query: string): CatalogUiNode[] => {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return nodes;
  return nodes.filter((node) => subtreeMatchesQuery(node, normalizedQuery));
};

const findPath = (nodes: CatalogUiNode[], id: string): CatalogUiNode[] | null => {
  for (const node of nodes) {
    if (node.id === id) return [node];
    const childPath = findPath(node.children ?? [], id);
    if (childPath) return [node, ...childPath];
  }
  return null;
};

const collectSelectedPaths = (tree: CatalogUiNode[], selectedIds: string[]): CatalogUiNode[][] => {
  return selectedIds
    .map((id) => findPath(tree, id))
    .filter((path): path is CatalogUiNode[] => Boolean(path));
};

type TreeLevel = { depth: number; nodes: CatalogUiNode[] };

/** Colunas visíveis: raiz (sistemas) + uma por nível já navegado, cada uma mostrando
 * os filhos do nó anterior. Admin sempre vê a coluna seguinte (mesmo vazia) para
 * poder usar o botão "+ Adicionar"; usuário comum só vê colunas com filho real. */
const buildVisibleLevels = (
  visibleRoots: CatalogUiNode[],
  navPath: CatalogUiNode[],
  role: CatalogTreeRole,
): TreeLevel[] => {
  const levels: TreeLevel[] = [{ depth: 0, nodes: visibleRoots }];
  navPath.forEach((node, index) => {
    const children = node.children ?? [];
    if (children.length > 0 || role === 'admin') {
      levels.push({ depth: index + 1, nodes: children });
    }
  });
  return levels;
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

const LEVEL_LABEL_PLURAL: Record<number, string> = {
  0: 'sistemas',
  1: 'edições',
  2: 'variantes',
};

const LEVEL_LABEL_FEMININE: Record<number, boolean> = {
  0: false,
  1: true,
  2: true,
};

const ADD_LABEL: Record<number, string> = {
  0: 'Adicionar sistema',
  1: 'Adicionar edição',
  2: 'Adicionar variante',
};

type CatalogTreeLevelProps = Readonly<{
  idPrefix: string;
  depth: number;
  nodes: CatalogUiNode[];
  selectedId: string | null;
  onSelect: (node: CatalogUiNode) => void;
  onToggleMulti?: (node: CatalogUiNode) => void;
  multiSelectedIds?: Set<string>;
  role: CatalogTreeRole;
  onEdit?: (node: CatalogUiNode) => void;
  onAdd?: () => void;
}>;

const CatalogTreeLevel = ({
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
}: CatalogTreeLevelProps) => {
  const isMulti = Boolean(onToggleMulti && multiSelectedIds);

  const isEmpty = nodes.length === 0;

  // Achado real (2026-07-13): coluna vazia (ex.: "Adicionar edição" logo após
  // criar o sistema, sem nenhuma edição ainda) usava o mesmo card cheio com
  // borda sólida das colunas com conteúdo — 2-3 colunas vazias lado a lado
  // (sistema/edição/variante) ficavam repetitivas e visualmente pesadas
  // ("muito feios e lotados", relatado pelo mantenedor). Coluna vazia agora
  // usa borda tracejada + botão centralizado, visualmente mais leve que uma
  // lista de itens.
  if (isEmpty && onAdd) {
    return (
      <button
        type="button"
        className="flex w-full flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--line)] bg-[var(--surface)] px-3 py-5 text-[13px] font-semibold text-[var(--fg-muted)] hover:border-[var(--artificio-brand)] hover:text-[var(--fg)]"
        onClick={onAdd}
      >
        <Plus className="h-4 w-4" />
        {ADD_LABEL[depth]}
      </button>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)]">
      {nodes.map((node) => {
        const selected = isMulti ? multiSelectedIds!.has(node.id) : selectedId === node.id;
        const aliasBadge = getAliasBadge(node.aliases);

        return (
          <div
            key={node.id}
            className={`group flex min-h-14 items-center gap-2 border-t border-[var(--line)] px-3 py-2.5 text-[var(--fg)] first:border-t-0 hover:bg-[var(--surface-subtle)] ${
              selected ? 'border-l-[3px] border-l-[var(--artificio-brand)] bg-[rgba(255,87,34,.1)]' : ''
            }`}
          >
            <button
              type="button"
              id={`${idPrefix}-node-${node.id}`}
              className="min-w-0 flex-1 text-left"
              onClick={() => {
                onSelect(node);
                if (isMulti) onToggleMulti!(node);
              }}
              aria-pressed={selected}
            >
              <span className="block text-[13px] font-bold">{node.name}</span>
              <span className="block text-[11px] text-[var(--fg-muted)]">
                nome PT: {node.name_pt || '—'}
              </span>
            </button>

            {aliasBadge && (
              <span className="max-w-40 shrink-0 truncate rounded-full bg-[var(--fill)] px-2 py-0.5 text-[10px] text-[var(--fg-muted)] sm:max-w-64">
                {aliasBadge}
              </span>
            )}

            {role === 'admin' && onEdit && (
              <button
                type="button"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-[var(--fg-muted)] opacity-0 hover:bg-[var(--fill)] hover:text-[var(--fg)] focus-visible:opacity-100 group-hover:opacity-100"
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

type RenderLevelContentArgs = Readonly<{
  depth: number;
  nodes: CatalogUiNode[];
  mode: CatalogTreeMode;
  role: CatalogTreeRole;
  idPrefix: string;
  effectiveNavPath: CatalogUiNode[];
  noRootResults: boolean;
  selectedIdSet: Set<string>;
  onSelectAtLevel: (depth: number, node: CatalogUiNode) => void;
  onToggleMultiAtRoot: (node: CatalogUiNode) => void;
  onEdit?: (node: CatalogUiNode) => void;
  onAddAtLevel: (depth: number, parent: CatalogUiNode | null) => void;
}>;

/** 3 ramos explícitos: nada a mostrar (raiz vazia já coberta por noRootResults),
 * lista de nós (ou botão de adicionar pra admin), ou aviso de nível vazio. */
const renderLevelContent = ({
  depth,
  nodes,
  mode,
  role,
  idPrefix,
  effectiveNavPath,
  noRootResults,
  selectedIdSet,
  onSelectAtLevel,
  onToggleMultiAtRoot,
  onEdit,
  onAddAtLevel,
}: RenderLevelContentArgs): ReactNode => {
  const isEmptyRoot = depth === 0 && nodes.length === 0 && noRootResults;
  if (isEmptyRoot) return null;

  const hasNodesToShow = nodes.length > 0 || role === 'admin';
  if (!hasNodesToShow) {
    const feminine = LEVEL_LABEL_FEMININE[Math.min(depth, 2)];
    return (
      <p className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--fg-muted)]">
        Nenhum{feminine ? 'a' : ''} {LEVEL_LABEL[Math.min(depth, 2)]} cadastrad{feminine ? 'a' : 'o'} ainda.
      </p>
    );
  }

  return (
    <CatalogTreeLevel
      idPrefix={idPrefix}
      depth={depth}
      nodes={nodes}
      selectedId={mode === 'single' ? (effectiveNavPath[depth]?.id ?? null) : null}
      onSelect={(node) => onSelectAtLevel(depth, node)}
      onToggleMulti={depth === 0 && mode === 'multi' ? onToggleMultiAtRoot : undefined}
      multiSelectedIds={depth === 0 && mode === 'multi' ? selectedIdSet : undefined}
      role={role}
      onEdit={onEdit}
      onAdd={role === 'admin' ? () => onAddAtLevel(depth, effectiveNavPath[depth - 1] ?? null) : undefined}
    />
  );
};

export function CatalogTree({
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
  showEmptySearchResults = false,
  onAddChildAtLevel,
}: CatalogTreeProps) {
  const [search, setSearch] = useState('');
  const [pendingAddDepth, setPendingAddDepth] = useState<number | null>(null);

  const handleAddAtLevel = (depth: number, parent: CatalogUiNode | null) => {
    setPendingAddDepth(depth);
    onAddChildAtLevel?.(depth, parent);
  };

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedPaths = useMemo(() => collectSelectedPaths(tree, selectedIds), [tree, selectedIds]);

  // Caminho de navegação: em modo single, é o caminho do nó selecionado.
  // Em modo multi, navegação é independente da seleção (só serve pra descer níveis e ver edições/variantes).
  const [navPath, setNavPath] = useState<CatalogUiNode[]>([]);
  const effectiveNavPath = mode === 'single' && selectedPaths.length > 0 ? selectedPaths[0] : navPath;

  const normalizedSearch = normalizeText(search);
  // Nível raiz (sistemas) só aparece com busca vazia se showEmptySearchResults=true
  // (com dado real, 1000+ sistemas listados sem busca é inutilizável). Níveis já
  // navegados (edição/variante) sempre aparecem, independente da busca — busca filtra
  // só sistemas, não desfaz uma navegação em curso.
  const shouldShowRootLevel = showEmptySearchResults || normalizedSearch.length > 0;
  const visibleRoots = useMemo(
    () => (shouldShowRootLevel ? filterRoots(tree, search) : []),
    [tree, search, shouldShowRootLevel],
  );

  const handleSelectAtLevel = (depth: number, node: CatalogUiNode) => {
    setPendingAddDepth(null);

    if (mode === 'single' && selectedIdSet.has(node.id)) {
      onSelectionChange([]);
      setNavPath([]);
      return;
    }

    if (mode === 'single') {
      onSelectionChange([node.id]);
      // navPath não precisa ser setado aqui: em modo single, effectiveNavPath deriva
      // de selectedPaths[0] (achado CodeRabbit PR #148 — setNavPath era sem efeito).
      return;
    }

    const basePath = effectiveNavPath.slice(0, depth);
    setNavPath([...basePath, node]);
  };

  const toggleMultiAtRoot = (node: CatalogUiNode) => {
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
  const noRootResults = shouldShowRootLevel && visibleRoots.length === 0;
  const shouldShowResults = shouldShowRootLevel || effectiveNavPath.length > 0;

  const levels = useMemo(
    () => buildVisibleLevels(visibleRoots, effectiveNavPath, role),
    [visibleRoots, effectiveNavPath, role],
  );

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
          <div
            className={`grid grid-cols-1 gap-3 ${
              Math.min(levels.length, 3) === 2 ? 'md:grid-cols-2' : ''
            } ${Math.min(levels.length, 3) === 3 ? 'md:grid-cols-3' : ''}`}
          >
          {levels.map(({ depth, nodes }) => (
            <div key={`level-${depth}`} className="min-w-0 space-y-1">
              {depth > 0 && (
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
                  {LEVEL_LABEL_PLURAL[Math.min(depth, 2)]} de {effectiveNavPath[depth - 1]?.name}
                </p>
              )}
              {renderLevelContent({
                depth,
                nodes,
                mode,
                role,
                idPrefix,
                effectiveNavPath,
                noRootResults,
                selectedIdSet,
                onSelectAtLevel: handleSelectAtLevel,
                onToggleMultiAtRoot: toggleMultiAtRoot,
                onEdit,
                onAddAtLevel: handleAddAtLevel,
              })}
            </div>
          ))}
          </div>

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

          {/* Achado real (2026-07-13): esta instrução só faz sentido no fluxo de
              fallback por busca (sem onAddChildAtLevel) — quando o consumidor
              fornece onAddChildAtLevel, o clique em "+ Adicionar" já dispara a
              ação real (ex.: abre modal pré-preenchido), e mostrar esta mensagem
              por cima virava instrução órfã sem nenhum botão correspondente
              visível (bug relatado: "Adicionar edição" não fazia nada). */}
          {pendingAddDepth !== null && role === 'admin' && onCreateNow && !onAddChildAtLevel && (
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
