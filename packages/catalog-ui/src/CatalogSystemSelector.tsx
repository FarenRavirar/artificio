import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Check, Search, Send, X } from 'lucide-react';
import { filterRoots, findPath, formatAliases } from './CatalogTree.js';
import type { CatalogUiNode } from './types.js';

/** Debounce da busca server-side de sistemas: evita uma chamada por tecla,
 * sem depender do consumidor montar o próprio debounce. */
const SYSTEM_SEARCH_DEBOUNCE_MS = 250;

/** Fonte server-side de opções do nível sistema (R18/A21): o consumidor monta
 * a chamada real (ex.: GET /systems?search=<query>&limit=N) e devolve os nós.
 * O pacote NÃO inventa chamada HTTP — só consome o fetch que recebe. */
export type CatalogSystemSearchFetch = (query: string, signal: AbortSignal) => Promise<CatalogUiNode[]>;

/** Fonte server-side de filhos de um nó (R18/A21): o consumidor monta a chamada
 * real (ex.: GET /systems?parent_id=<parent.id>) e devolve os filhos diretos.
 * Devolver lista vazia significa "sem filhos" — a coluna não aparece. */
export type CatalogSystemChildrenFetch = (parent: CatalogUiNode, signal: AbortSignal) => Promise<CatalogUiNode[]>;

export type CatalogSystemSelectorProps = Readonly<{
  idPrefix: string;
  /** Mesmo contrato de seleção do CatalogTree: single-select, id do nó escolhido
   * (ou lista vazia). Consumidores como o CatalogSystemPopover mapeiam com
   * `(ids) => onSelect(ids[0] ?? null)`. */
  selectedIds: string[];
  onSelectionChange: (selectedIds: string[]) => void;
  /** Fonte local (fallback ao comportamento atual do CatalogTree): árvore pronta,
   * busca filtrada no cliente. Fornecer também quando houver seleção externa
   * pré-existente (ex.: edição de mesa já publicada) — o caminho selecionado é
   * derivado da árvore via findPath. */
  tree?: CatalogUiNode[];
  /** Fonte server-side do nível sistema (search/limit). Quando fornecida, tem
   * precedência sobre a busca local na árvore. Estabilizar com useCallback no
   * consumidor — o componente guarda a referência e não refaz busca por re-render. */
  fetchSystemOptions?: CatalogSystemSearchFetch;
  /** Fonte server-side de filhos (parent_id). Quando fornecida, as colunas
   * Edição/Variante carregam sob demanda ao selecionar o pai; lista vazia =
   * coluna não aparece. Sem ela, usa `node.children` da árvore. */
  fetchChildOptions?: CatalogSystemChildrenFetch;
  /** Ligado no mesmo fluxo de sugestão do CatalogTree: busca sem resultado
   * oferece "Sugerir" com o termo digitado. */
  onSuggest?: (query: string) => void;
  searchPlaceholder?: string;
  editionSearchPlaceholder?: string;
  variantSearchPlaceholder?: string;
}>;

type ColumnKind = 'system' | 'edition' | 'variant';

const COLUMN_TITLE: Record<ColumnKind, string> = {
  system: 'Sistema',
  edition: 'Edição',
  variant: 'Variante',
};

const CHILD_EMPTY_LABEL: Record<'edition' | 'variant', string> = {
  edition: 'Nenhuma edição encontrada.',
  variant: 'Nenhuma variante encontrada.',
};

type SelectorColumnProps = Readonly<{
  kind: ColumnKind;
  children: ReactNode;
}>;

const SelectorColumn = ({ kind, children }: SelectorColumnProps) => (
  <section aria-label={COLUMN_TITLE[kind]} className="min-w-0 flex-1 space-y-2">
    <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
      {COLUMN_TITLE[kind]}
    </p>
    {children}
  </section>
);

/**
 * Variante de apresentação do seletor de sistema — TRÊS COLUNAS lado a lado
 * (Sistema · Edição · Variante), cada uma com caixa de busca própria (R18/A21,
 * spec 096). É ADITIVA: o CatalogTree empilhado permanece para os demais
 * consumidores (CatalogExplorer, admin, popover, DraftEditorTab).
 *
 * Progressão decidida pelo mantenedor (2026-08-24):
 * - Sistema é SÓ busca (690 nós na raiz — nunca lista sem termo);
 * - ao escolher o sistema, a coluna Edição abre com lista E busca própria — se
 *   houver filhos (510 dos 690 sistemas não têm edição: coluna não aparece);
 * - ao escolher a edição, a coluna Variante abre com lista E busca — se houver;
 * - aliases visíveis nas opções e no caminho selecionado (reversão da D0.5);
 * - busca sem resultado oferece sugerir com o termo digitado (onSuggest).
 */
export function CatalogSystemSelector({
  idPrefix,
  selectedIds,
  onSelectionChange,
  tree,
  fetchSystemOptions,
  fetchChildOptions,
  onSuggest,
  searchPlaceholder = 'Buscar sistema...',
  editionSearchPlaceholder = 'Filtrar edições...',
  variantSearchPlaceholder = 'Filtrar variantes...',
}: CatalogSystemSelectorProps) {
  const [systemQuery, setSystemQuery] = useState('');
  const [editionQuery, setEditionQuery] = useState('');
  const [variantQuery, setVariantQuery] = useState('');

  const [systemOptions, setSystemOptions] = useState<CatalogUiNode[]>([]);
  const [editionOptions, setEditionOptions] = useState<CatalogUiNode[]>([]);
  const [variantOptions, setVariantOptions] = useState<CatalogUiNode[]>([]);

  const [searching, setSearching] = useState(false);
  const [systemError, setSystemError] = useState(false);
  const [loadingEdition, setLoadingEdition] = useState(false);
  const [loadingVariant, setLoadingVariant] = useState(false);
  const [editionError, setEditionError] = useState(false);
  const [variantError, setVariantError] = useState(false);

  // Caminho de navegação interna: em single-select com fonte server-side, o nó
  // escolhido pode não existir na árvore local — o caminho derivado cobre isso
  // (findPath acha na árvore; senão usa o navPath construído pelos cliques).
  const [navPath, setNavPath] = useState<CatalogUiNode[]>([]);

  const systemAbortRef = useRef<AbortController | null>(null);
  const childAbortRef = useRef<AbortController | null>(null);

  // Refs atualizadas a cada render: o consumidor pode não memoizar as funções,
  // e o efeito de busca não deve refazer fetch por causa disso.
  const fetchSystemOptionsRef = useRef(fetchSystemOptions);
  fetchSystemOptionsRef.current = fetchSystemOptions;
  const fetchChildOptionsRef = useRef(fetchChildOptions);
  fetchChildOptionsRef.current = fetchChildOptions;

  useEffect(() => {
    const query = systemQuery.trim();
    systemAbortRef.current?.abort();
    setSystemError(false);

    if (!query) {
      // Raiz só aparece com termo digitado — mesma regra do CatalogTree
      // (1269 nós nunca são despejados sem busca).
      setSearching(false);
      setSystemOptions([]);
      return;
    }

    const fetchSystem = fetchSystemOptionsRef.current;
    if (!fetchSystem) {
      setSystemOptions(filterRoots(tree ?? [], systemQuery));
      return;
    }

    setSearching(true);
    const controller = new AbortController();
    systemAbortRef.current = controller;
    const timer = setTimeout(() => {
      fetchSystem(query, controller.signal)
        .then((options) => {
          if (controller.signal.aborted) return;
          setSystemOptions(options);
        })
        .catch((error: unknown) => {
          if ((error as Error)?.name === 'AbortError') return;
          setSystemOptions([]);
          setSystemError(true);
        })
        .finally(() => {
          if (controller.signal.aborted) return;
          setSearching(false);
        });
    }, SYSTEM_SEARCH_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [systemQuery, tree]);

  // Aborta fetches pendentes ao desmontar (nunca deixar request órfão).
  useEffect(
    () => () => {
      systemAbortRef.current?.abort();
      childAbortRef.current?.abort();
    },
    [],
  );

  const selectedId = selectedIds[0] ?? null;
  const selectedPath = useMemo(() => {
    if (!selectedId) return navPath;
    return findPath(tree ?? [], selectedId) ?? navPath;
  }, [tree, selectedId, navPath]);

  const loadChildrenFor = (parent: CatalogUiNode, column: 'edition' | 'variant') => {
    childAbortRef.current?.abort();
    if (column === 'edition') {
      setEditionError(false);
      setEditionOptions([]);
    } else {
      setVariantError(false);
      setVariantOptions([]);
    }

    const fetchChildren = fetchChildOptionsRef.current;
    if (!fetchChildren) {
      const children = parent.children ?? [];
      if (column === 'edition') setEditionOptions(children);
      else setVariantOptions(children);
      return;
    }

    const controller = new AbortController();
    childAbortRef.current = controller;
    if (column === 'edition') setLoadingEdition(true);
    else setLoadingVariant(true);

    fetchChildren(parent, controller.signal)
      .then((children) => {
        if (controller.signal.aborted) return;
        if (column === 'edition') setEditionOptions(children);
        else setVariantOptions(children);
      })
      .catch((error: unknown) => {
        if ((error as Error)?.name === 'AbortError') return;
        if (column === 'edition') setEditionError(true);
        else setVariantError(true);
      })
      .finally(() => {
        if (controller.signal.aborted) return;
        if (column === 'edition') setLoadingEdition(false);
        else setLoadingVariant(false);
      });
  };

  // Progressão sob demanda (R18): a coluna Edição carrega quando existe um
  // sistema no caminho, a coluna Variante quando existe uma edição. Derivar do
  // caminho (e não só do clique) cobre a seleção pré-existente vinda de fora —
  // ex.: edição de mesa já publicada abre com o caminho e as colunas prontas.
  const systemId = selectedPath[0]?.id ?? null;
  const editionId = selectedPath[1]?.id ?? null;

  useEffect(() => {
    const system = selectedPath[0];
    if (!system) {
      setEditionOptions([]);
      setEditionQuery('');
      setEditionError(false);
      return;
    }
    loadChildrenFor(system, 'edition');
    // Dep por systemId (não selectedPath): selectedPath deriva de systemId, e
    // depender do objeto inteiro recarregaria os filhos a cada re-render.
  }, [systemId]);

  useEffect(() => {
    const edition = selectedPath[1];
    if (!edition) {
      setVariantOptions([]);
      setVariantQuery('');
      setVariantError(false);
      return;
    }
    loadChildrenFor(edition, 'variant');
    // Dep por editionId (não selectedPath): idem acima.
  }, [editionId]);

  const clearSelection = () => {
    onSelectionChange([]);
    setNavPath([]);
    setEditionOptions([]);
    setVariantOptions([]);
    setEditionQuery('');
    setVariantQuery('');
  };

  const handleSelectSystem = (node: CatalogUiNode) => {
    if (selectedId === node.id) {
      clearSelection();
      return;
    }
    onSelectionChange([node.id]);
    setNavPath([node]);
    setEditionQuery('');
    setVariantQuery('');
  };

  const handleSelectEdition = (node: CatalogUiNode) => {
    if (selectedId === node.id) {
      clearSelection();
      return;
    }
    const system = selectedPath[0];
    onSelectionChange([node.id]);
    setNavPath(system ? [system, node] : [node]);
    setVariantQuery('');
  };

  const handleSelectVariant = (node: CatalogUiNode) => {
    if (selectedId === node.id) {
      clearSelection();
      return;
    }
    onSelectionChange([node.id]);
    setNavPath([...selectedPath.slice(0, 2), node]);
  };

  const noSystemResults =
    systemQuery.trim().length > 0 && !searching && !systemError && systemOptions.length === 0;
  const canSuggest = noSystemResults && Boolean(onSuggest);

  const visibleEditionOptions = useMemo(
    () => filterRoots(editionOptions, editionQuery),
    [editionOptions, editionQuery],
  );
  const visibleVariantOptions = useMemo(
    () => filterRoots(variantOptions, variantQuery),
    [variantOptions, variantQuery],
  );

  const showEditionColumn =
    selectedPath.length >= 1
    && (editionOptions.length > 0 || loadingEdition || editionError);
  const showVariantColumn =
    selectedPath.length >= 2
    && (variantOptions.length > 0 || loadingVariant || variantError);

  const renderOption = (
    kind: ColumnKind,
    node: CatalogUiNode,
    onSelect: (node: CatalogUiNode) => void,
  ) => {
    const selected = selectedId === node.id;
    const aliases = formatAliases(node.aliases);
    return (
      <button
        key={node.id}
        type="button"
        id={`${idPrefix}-${kind}-${node.id}`}
        className="flex w-full items-center gap-2 border-t border-[var(--line)] px-3 py-2.5 text-left first:border-t-0 hover:bg-[var(--surface-subtle)]"
        onClick={() => onSelect(node)}
        aria-pressed={selected}
      >
        <span className="block min-w-0 flex-1 text-[13px] font-bold text-[var(--fg)]">
          {node.name}
        </span>
        {aliases.length > 0 && (
          <span className="shrink-0 text-[10px] text-[var(--fg-muted)]">{aliases}</span>
        )}
        {selected && <Check className="h-4 w-4 shrink-0 text-[var(--artificio-brand)]" />}
      </button>
    );
  };

  const renderSearchInput = (
    inputId: string,
    value: string,
    placeholder: string,
    onChange: (value: string) => void,
  ) => (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--fg-muted)]" />
      <input
        id={inputId}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] py-2.5 pl-9 pr-3 text-sm text-[var(--fg)] outline-none placeholder:text-[var(--fg-muted)] focus:border-[var(--artificio-brand)]"
      />
    </div>
  );

  const lastSelectedNode = selectedPath[selectedPath.length - 1];
  const lastSelectedAliases = formatAliases(lastSelectedNode?.aliases);

  return (
    <div className="space-y-3 text-[var(--fg)]">
      {/* Três colunas lado a lado (R18): a coluna Sistema é sempre visível; as
          colunas Edição/Variante só existem quando o nível anterior tem filho
          real — sem espaço vazio nem rótulo órfão (74% dos sistemas param aqui). */}
      <div className="flex flex-row items-start gap-3">
        <SelectorColumn kind="system">
          {renderSearchInput(
            `${idPrefix}-system-search`,
            systemQuery,
            searchPlaceholder,
            setSystemQuery,
          )}
          {searching && (
            <p className="px-3 py-2.5 text-sm text-[var(--fg-muted)]">Buscando sistemas...</p>
          )}
          {systemError && (
            <p className="px-3 py-2.5 text-sm text-[var(--fg-muted)]">
              Falha ao buscar sistemas.
            </p>
          )}
          {systemOptions.length > 0 && (
            <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)]">
              {systemOptions.map((node) => renderOption('system', node, handleSelectSystem))}
            </div>
          )}
          {noSystemResults && (
            <div className="space-y-3 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4">
              <p className="text-sm text-[var(--fg-muted)]">Nenhum sistema encontrado.</p>
              {canSuggest && (
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface-subtle)] px-3 py-2 text-sm font-semibold text-[var(--fg)] hover:border-[var(--artificio-brand)]"
                  onClick={() => onSuggest?.(systemQuery.trim())}
                >
                  <Send className="h-4 w-4" />
                  Sugerir
                </button>
              )}
            </div>
          )}
        </SelectorColumn>

        {showEditionColumn && (
          <SelectorColumn kind="edition">
            {renderSearchInput(
              `${idPrefix}-edition-search`,
              editionQuery,
              editionSearchPlaceholder,
              setEditionQuery,
            )}
            {loadingEdition && (
              <p className="px-3 py-2.5 text-sm text-[var(--fg-muted)]">Carregando edições...</p>
            )}
            {editionError && (
              <p className="px-3 py-2.5 text-sm text-[var(--fg-muted)]">
                Falha ao carregar edições.
              </p>
            )}
            {!loadingEdition && !editionError && visibleEditionOptions.length === 0 && (
              <p className="px-3 py-2.5 text-sm text-[var(--fg-muted)]">
                {CHILD_EMPTY_LABEL.edition}
              </p>
            )}
            {visibleEditionOptions.length > 0 && (
              <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)]">
                {visibleEditionOptions.map((node) => renderOption('edition', node, handleSelectEdition))}
              </div>
            )}
          </SelectorColumn>
        )}

        {showVariantColumn && (
          <SelectorColumn kind="variant">
            {renderSearchInput(
              `${idPrefix}-variant-search`,
              variantQuery,
              variantSearchPlaceholder,
              setVariantQuery,
            )}
            {loadingVariant && (
              <p className="px-3 py-2.5 text-sm text-[var(--fg-muted)]">Carregando variantes...</p>
            )}
            {variantError && (
              <p className="px-3 py-2.5 text-sm text-[var(--fg-muted)]">
                Falha ao carregar variantes.
              </p>
            )}
            {!loadingVariant && !variantError && visibleVariantOptions.length === 0 && (
              <p className="px-3 py-2.5 text-sm text-[var(--fg-muted)]">
                {CHILD_EMPTY_LABEL.variant}
              </p>
            )}
            {visibleVariantOptions.length > 0 && (
              <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)]">
                {visibleVariantOptions.map((node) => renderOption('variant', node, handleSelectVariant))}
              </div>
            )}
          </SelectorColumn>
        )}
      </div>

      {/* Caminho escolhido sempre visível (R18: "Vampire › 5ª Edição"), com os
          aliases do nó selecionado — é o que confirma ao mestre que achou o
          sistema certo. */}
      {selectedPath.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-start gap-2 rounded-lg border border-[var(--artificio-brand)] bg-[rgba(255,87,34,.08)] px-3 py-2.5">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--artificio-brand)]" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-[var(--artificio-brand)]">Selecionado</p>
              <p className="truncate text-[13px] text-[var(--fg)]">
                {selectedPath.map((node) => node.name).join(' › ')}
              </p>
              {lastSelectedAliases.length > 0 && (
                <p className="text-[11px] text-[var(--fg-muted)]">{lastSelectedAliases}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--fg-muted)] hover:text-[var(--fg)]"
            onClick={clearSelection}
          >
            <X className="h-3.5 w-3.5" />
            Limpar seleção
          </button>
        </div>
      )}
    </div>
  );
}
