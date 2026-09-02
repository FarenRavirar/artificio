import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Check, Edit2, Plus, Search, Send, X } from 'lucide-react';
import type { CatalogUiNode } from './types.js';
import { normalizeText } from './normalize.js';
import {
  SYSTEM_SEARCH_DEBOUNCE_MS,
  normalizeNodes,
  type CatalogSystemSearchFetch,
  type CatalogSystemChildrenFetch,
} from './catalogFetch.js';

export type CatalogTreeMode = 'single' | 'multi';
export type CatalogTreeRole = 'user' | 'admin';

export type CatalogTreeProps = Readonly<{
  /**
   * Fonte local: árvore pronta, busca filtrada no cliente.
   *
   * Continua sendo o caminho padrão e o default (`[]`) preserva os
   * consumidores existentes. Quando `fetchSystemOptions` é fornecida, a busca
   * passa a ser server-side e esta árvore deixa de ser necessária para
   * encontrar sistemas — mas ainda é ela que nomeia a seleção já existente,
   * a menos que `selectedNodes` seja fornecida (ver abaixo).
   */
  tree?: CatalogUiNode[];
  /**
   * Fonte server-side do nível raiz (spec 099, fase G — G7).
   *
   * Mesmo contrato que `CatalogSystemSelector` já define e que o pacote já
   * implementa: o consumidor monta a chamada real (ex.:
   * `GET /systems?search=<query>`) e devolve os nós; o pacote não inventa HTTP.
   * Quando fornecida, tem precedência sobre a busca local em `tree`.
   *
   * Por que existe: o `CatalogTree` fazia multi-select mas só aceitava árvore
   * local, e o `CatalogSystemSelector` fazia busca sob demanda mas é
   * single-select. Quem precisava das duas — o editor de perfil, que escolhe de
   * 1 a 5 sistemas — pagava o catálogo inteiro no primeiro render: **487.965
   * bytes** (1.289 nós) contra **2.040** de uma busca, medido na API de beta em
   * 2026-09-01. A prop fecha essa lacuna sem forçar ninguém a migrar.
   *
   * Estabilizar com `useCallback` no consumidor — o componente guarda a
   * referência e não refaz busca por causa de re-render.
   */
  fetchSystemOptions?: CatalogSystemSearchFetch;
  /**
   * Fonte server-side dos filhos de um nó (spec 099 G7), mesmo contrato do
   * `CatalogSystemSelector`. Quando fornecida, descer um nível carrega sob
   * demanda em vez de ler `node.children`; lista vazia = nível sem filhos.
   */
  fetchChildOptions?: CatalogSystemChildrenFetch;
  /**
   * Os nós já selecionados, resolvidos pelo consumidor (spec 099 G7).
   *
   * **Necessária quando não há `tree`.** O bloco de seleção mostra o caminho
   * pelo NOME (`path.map(n => n.name)`), e sem árvore local não há de onde
   * derivar isso: o componente teria o id salvo e nada para exibir — o usuário
   * veria a contagem certa e os nomes sumidos, que é pior do que carregar o
   * catálogo. Com ela, o consumidor entrega o que já sabe (ele precisa desses
   * nomes de qualquer forma para a própria lista) e nada se perde.
   *
   * Quando ausente, o caminho é derivado de `tree`, como sempre foi.
   */
  selectedNodes?: CatalogUiNode[];
  selectedIds: string[];
  onSelectionChange: (selectedIds: string[]) => void;
  idPrefix: string;
  mode?: CatalogTreeMode;
  role?: CatalogTreeRole;
  searchPlaceholder?: string;
  onSuggest?: (query: string) => void;
  onCreateNow?: (query: string) => void;
  onEdit?: (node: CatalogUiNode) => void;
  /** Quando fornecida, o botão "+ Adicionar" de cada nível chama isso direto com o nó
   * pai daquele nível (ou null na raiz) — usado por consumidores com formulário de
   * criação embutido (ex.: CatalogExplorer), em vez do fluxo de busca+onCreateNow.
   * Achado Codex (PR #148): sem isto, o botão só marcava um estado sem nenhuma ação. */
  onAddChildAtLevel?: (depth: number, parent: CatalogUiNode | null) => void;
  /** D0.5 (spec 094), REVISADA por R18 (spec 096): política aditiva de
   * apresentação, default `full` para não alterar consumidores existentes
   * (site-admin via CatalogExplorer).
   * - `full`: comportamento atual — linha "nome PT", badge de aliases
   *   (formato compacto "primeiro +N") e parágrafo técnico final visíveis;
   * - `selection`: superfície pública compacta — NÃO RENDERIZA o parágrafo
   *   técnico nem a linha "nome PT", MAS RENDERIZA os aliases nas opções
   *   (reversão da D0.5, decisão do mantenedor 2026-08-24, R18/A21: com
   *   1.269 nós e 409 aliases, distinguir nomes parecidos vale mais que a
   *   economia visual). `nodeMatchesQuery` continua buscando por nome
   *   PT/alias (não-renderização, não perda de matcher — esconder por CSS
   *   não satisfaz R18). */
  presentation?: 'full' | 'selection';
}>;

export const nodeMatchesQuery = (node: CatalogUiNode, normalizedQuery: string): boolean => {
  return normalizeText(node.name).includes(normalizedQuery)
    || normalizeText(node.name_pt ?? '').includes(normalizedQuery)
    || normalizeText(node.canonical_slug).includes(normalizedQuery)
    || normalizeText(node.path_slug ?? '').includes(normalizedQuery)
    || (node.aliases ?? []).some((alias) => normalizeText(alias).includes(normalizedQuery));
};

/** Acha match em qualquer nível (nome/slug/alias de sistema, edição ou variante) —
 * comportamento do antigo filterTree do site-admin (achado Codex PR #148): buscar
 * "5e" precisa achar a edição, não só sistemas de nível raiz cujo próprio nome bate. */
export const subtreeMatchesQuery = (node: CatalogUiNode, normalizedQuery: string): boolean => {
  if (nodeMatchesQuery(node, normalizedQuery)) return true;
  return (node.children ?? []).some((child) => subtreeMatchesQuery(child, normalizedQuery));
};

export const filterRoots = (nodes: CatalogUiNode[], query: string): CatalogUiNode[] => {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return nodes;
  return nodes.filter((node) => subtreeMatchesQuery(node, normalizedQuery));
};

export const findPath = (nodes: CatalogUiNode[], id: string): CatalogUiNode[] | null => {
  for (const node of nodes) {
    if (node.id === id) return [node];
    const childPath = findPath(node.children ?? [], id);
    if (childPath) return [node, ...childPath];
  }
  return null;
};

export const collectSelectedPaths = (tree: CatalogUiNode[], selectedIds: string[]): CatalogUiNode[][] => {
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
  // G7: filhos carregados sob demanda, por id de pai. Vazio quando o consumidor
  // não usa fonte server-side — e aí `node.children` da árvore responde, como
  // sempre respondeu.
  remoteChildren: Record<string, CatalogUiNode[]> = {},
): TreeLevel[] => {
  const levels: TreeLevel[] = [{ depth: 0, nodes: visibleRoots }];
  navPath.forEach((node, index) => {
    // O carregado sob demanda tem precedência: com fonte server-side, o nó vem
    // da busca sem `children` preenchido, e ler a árvore aqui devolveria vazio.
    const children = remoteChildren[node.id] ?? node.children ?? [];
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

/** Aliases completos para leitura (R18/A21): "Vampiro · VtM · The Masquerade".
 * Formato usado no modo `selection` — a reversão da D0.5 quer TODOS os aliases
 * na linha da opção, não o resumo compacto "primeiro +N" do modo `full`. */
export const formatAliases = (aliases?: string[]): string => (aliases ?? []).join(' · ');

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
  presentation: 'full' | 'selection';
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
  presentation,
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
              {presentation !== 'selection' && (
                <span className="block text-[11px] text-[var(--fg-muted)]">
                  nome PT: {node.name_pt || '—'}
                </span>
              )}
            </button>

            {aliasBadge && (
              <span
                className={`shrink-0 rounded-full bg-[var(--fill)] px-2 py-0.5 text-[10px] text-[var(--fg-muted)] ${
                  presentation === 'selection' ? 'max-w-[45%]' : 'max-w-40 truncate sm:max-w-64'
                }`}
              >
                {presentation === 'selection' ? formatAliases(node.aliases) : aliasBadge}
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
  presentation: 'full' | 'selection';
  idPrefix: string;
  effectiveNavPath: CatalogUiNode[];
  noRootResults: boolean;
  shouldShowRootLevel: boolean;
  selectedIdSet: Set<string>;
  onSelectAtLevel: (depth: number, node: CatalogUiNode) => void;
  onToggleMultiAtRoot: (node: CatalogUiNode) => void;
  onEdit?: (node: CatalogUiNode) => void;
  onAddAtLevel: (depth: number, parent: CatalogUiNode | null) => void;
}>;

/** 3 ramos explícitos: nada a mostrar (raiz vazia já coberta por noRootResults
 * ou por shouldShowRootLevel=false), lista de nós (ou botão de adicionar pra
 * admin), ou aviso de nível vazio. */
const renderLevelContent = ({
  depth,
  nodes,
  mode,
  role,
  presentation,
  idPrefix,
  effectiveNavPath,
  noRootResults,
  shouldShowRootLevel,
  selectedIdSet,
  onSelectAtLevel,
  onToggleMultiAtRoot,
  onEdit,
  onAddAtLevel,
}: RenderLevelContentArgs): ReactNode => {
  // Achado do mantenedor (2026-07-14, DEB-077-01): com sistema já selecionado
  // e sem busca digitada, shouldShowResults fica true (por causa da navegação
  // já aberta pro nó selecionado), incluindo a coluna depth:0 (raiz) mesmo
  // vazia por design (raiz só aparece com busca — regra de 2026-07-13 acima).
  // noRootResults sozinho não cobre esse caso (ele só é true quando HÁ busca
  // e ela não bateu nada) — sem o check de shouldShowRootLevel, a coluna
  // raiz vazia caía no branch de "nível vazio" abaixo e mostrava a mensagem
  // errada "Nenhum sistema cadastrado ainda." mesmo com catálogo populado.
  const isEmptyRoot = depth === 0 && nodes.length === 0 && (noRootResults || !shouldShowRootLevel);
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
      presentation={presentation}
      onEdit={onEdit}
      onAdd={role === 'admin' ? () => onAddAtLevel(depth, effectiveNavPath[depth - 1] ?? null) : undefined}
    />
  );
};

export function CatalogTree({
  tree = [],
  selectedIds,
  onSelectionChange,
  idPrefix,
  mode = 'single',
  role = 'user',
  searchPlaceholder = 'Buscar sistema...',
  presentation = 'full',
  onSuggest,
  onCreateNow,
  onEdit,
  onAddChildAtLevel,
  fetchSystemOptions,
  fetchChildOptions,
  selectedNodes,
}: CatalogTreeProps) {
  const [search, setSearch] = useState('');
  const [pendingAddDepth, setPendingAddDepth] = useState<number | null>(null);

  // ── Fonte server-side (spec 099, fase G — G7) ────────────────────────────
  // Toda a mecânica abaixo espelha a que o `CatalogSystemSelector` já usa:
  // debounce compartilhado, um AbortController por busca, normalização do que
  // volta do HTTP e silêncio quando não há termo digitado.
  const [remoteRoots, setRemoteRoots] = useState<CatalogUiNode[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchFailed, setSearchFailed] = useState(false);
  const searchAbortRef = useRef<AbortController | null>(null);

  // Filhos carregados sob demanda, por id de nó pai.
  const [remoteChildren, setRemoteChildren] = useState<Record<string, CatalogUiNode[]>>({});
  const childAbortRef = useRef<AbortController | null>(null);

  // Refs para as fontes: o consumidor pode não memoizar as funções, e o efeito
  // de busca não deve refazer fetch por causa disso.
  //
  // A ESCRITA vive em efeito, não no corpo do render: render interrompido (o
  // React pode descartar um render antes de comitá-lo) deixaria a ref apontando
  // para o callback de um render que nunca existiu, e o efeito seguinte usaria
  // essa função. Declarados ANTES dos efeitos que leem as refs, para que a
  // atualização aconteça primeiro na ordem de execução.
  const fetchSystemOptionsRef = useRef(fetchSystemOptions);
  useEffect(() => {
    fetchSystemOptionsRef.current = fetchSystemOptions;
  }, [fetchSystemOptions]);
  const fetchChildOptionsRef = useRef(fetchChildOptions);
  useEffect(() => {
    fetchChildOptionsRef.current = fetchChildOptions;
  }, [fetchChildOptions]);

  const handleAddAtLevel = (depth: number, parent: CatalogUiNode | null) => {
    setPendingAddDepth(depth);
    onAddChildAtLevel?.(depth, parent);
  };

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  // O bloco de seleção mostra o caminho pelo NOME. Sem árvore local não há de
  // onde derivá-lo, então o consumidor entrega os nós já selecionados
  // (`selectedNodes`, G7) e cada um vira um caminho de um nível — é o que ele
  // sabe, e é o que basta para nomear a seleção. Com árvore, nada muda.
  const selectedPaths = useMemo(() => {
    if (selectedNodes) {
      const byId = new Map(selectedNodes.map((node) => [node.id, node]));
      return selectedIds
        .map((id) => byId.get(id))
        .filter((node): node is CatalogUiNode => node !== undefined)
        .map((node) => [node]);
    }
    return collectSelectedPaths(tree, selectedIds);
  }, [tree, selectedIds, selectedNodes]);

  // Caminho de navegação: em modo single, é o caminho do nó selecionado.
  // Em modo multi, navegação é independente da seleção (só serve pra descer níveis e ver edições/variantes).
  const [navPath, setNavPath] = useState<CatalogUiNode[]>([]);
  const effectiveNavPath = mode === 'single' && selectedPaths.length > 0 ? selectedPaths[0] : navPath;

  const normalizedSearch = normalizeText(search);
  // Nível raiz (sistemas) só aparece com busca digitada (achado do mantenedor
  // 2026-07-14: regressão visual pós-PR #156 — showEmptySearchResults=true por
  // ter seleção fazia a lista completa de 1269 sistemas vazar a caixa mesmo sem
  // busca. Regra correta: sem busca não mostra nada (ou só o já selecionado,
  // no bloco abaixo); com busca, filtra e mostra resultados — igual esteja ou
  // não selecionado. Níveis já navegados (edição/variante) sempre aparecem,
  // independente da busca — busca filtra só sistemas, não desfaz navegação em curso.
  const shouldShowRootLevel = normalizedSearch.length > 0;

  // Busca server-side quando o consumidor fornece a fonte (G7); senão, filtra a
  // árvore local exatamente como antes. A regra de "sem busca não mostra nada"
  // vale nos dois caminhos — é ela que impede os 1.289 nós de vazarem a caixa.
  useEffect(() => {
    const fetchSystem = fetchSystemOptionsRef.current;
    if (!fetchSystem) return;

    searchAbortRef.current?.abort();
    setSearchFailed(false);

    const query = search.trim();
    if (!query) {
      setSearching(false);
      setRemoteRoots([]);
      return;
    }

    setSearching(true);
    const controller = new AbortController();
    searchAbortRef.current = controller;
    const timer = setTimeout(() => {
      fetchSystem(query, controller.signal)
        .then((options) => {
          if (controller.signal.aborted) return;
          setRemoteRoots(normalizeNodes(options));
        })
        .catch((error: unknown) => {
          if ((error as Error)?.name === 'AbortError') return;
          // Falha de rede vira lista vazia MAIS aviso: sem o aviso, "não achei
          // nada" e "não consegui buscar" ficam idênticos na tela, e o usuário
          // conclui que o sistema não existe no catálogo.
          setRemoteRoots([]);
          setSearchFailed(true);
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
  }, [search]);

  // Nunca deixar request órfão ao desmontar.
  useEffect(
    () => () => {
      searchAbortRef.current?.abort();
      childAbortRef.current?.abort();
    },
    [],
  );

  const visibleRoots = useMemo(() => {
    if (!shouldShowRootLevel) return [];
    // Com fonte server-side, o servidor já filtrou: refiltrar no cliente
    // esconderia resultado legítimo que casou por um campo que o matcher local
    // não conhece.
    if (fetchSystemOptions) return remoteRoots;
    return filterRoots(tree, search);
  }, [tree, search, shouldShowRootLevel, fetchSystemOptions, remoteRoots]);

  // Filhos sob demanda (G7): ao descer um nível, busca os filhos do nó mais
  // profundo do caminho. Sem `fetchChildOptions`, `node.children` da árvore
  // continua sendo a fonte — consumidor existente não muda de comportamento.
  const deepestNavId = effectiveNavPath[effectiveNavPath.length - 1]?.id ?? null;
  useEffect(() => {
    const fetchChildren = fetchChildOptionsRef.current;
    if (!fetchChildren || !deepestNavId) return;
    // Já carregado: não refaz. O catálogo é estável dentro de uma sessão de
    // escolha, e refazer a cada re-render devolveria por outro caminho o
    // excesso de requisição que esta prop existe para evitar.
    if (remoteChildren[deepestNavId]) return;

    const parent = effectiveNavPath[effectiveNavPath.length - 1];
    if (!parent) return;

    childAbortRef.current?.abort();
    const controller = new AbortController();
    childAbortRef.current = controller;

    fetchChildren(parent, controller.signal)
      .then((children) => {
        if (controller.signal.aborted) return;
        setRemoteChildren((current) => ({
          ...current,
          [parent.id]: normalizeNodes(children),
        }));
      })
      .catch((error: unknown) => {
        if ((error as Error)?.name === 'AbortError') return;
        // Lista vazia = "sem filhos", que é o contrato. Falha aqui degrada para
        // "este nó não tem níveis abaixo" em vez de travar a navegação.
        setRemoteChildren((current) => ({ ...current, [parent.id]: [] }));
      });

    return () => controller.abort();
  }, [deepestNavId, effectiveNavPath, remoteChildren]);

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
  // `searching`/`searchFailed` só ficam true no caminho server-side (G7). Sem
  // eles, buscar remotamente mostraria "nenhum resultado" durante o request e
  // depois a lista — o usuário leria "não existe" sobre algo que existe.
  const noRootResults =
    shouldShowRootLevel && visibleRoots.length === 0 && !searching && !searchFailed;
  const shouldShowResults = shouldShowRootLevel || effectiveNavPath.length > 0;

  const levels = useMemo(
    () => buildVisibleLevels(visibleRoots, effectiveNavPath, role, remoteChildren),
    [visibleRoots, effectiveNavPath, role, remoteChildren],
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

      {/* Estados da busca server-side (G7). No caminho local nenhum dos dois
          acende, então o markup é idêntico ao de antes para quem passa `tree`. */}
      {searching && (
        <p className="text-xs text-[var(--fg-muted)]" role="status">
          Buscando sistemas...
        </p>
      )}
      {searchFailed && (
        <p className="text-xs text-[var(--state-danger-fg)]" role="alert">
          Não foi possível buscar agora. Tente de novo em instantes.
        </p>
      )}

      {shouldShowResults && (
        <div className="space-y-3">
          <div className="flex flex-col gap-3">
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
                presentation,
                idPrefix,
                effectiveNavPath,
                noRootResults,
                shouldShowRootLevel,
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

      {presentation !== 'selection' && (
        <p className="text-[11px] text-[var(--fg-muted)]">
          Cada nível é um nó com nome, nome PT e aliases próprios; o caminho selecionado é só a leitura da árvore de cima a baixo, não um campo salvo.
        </p>
      )}
    </div>
  );
}
