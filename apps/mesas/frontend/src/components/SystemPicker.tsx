import { useCallback, useMemo, useRef } from 'react';
import { CatalogTree } from '@artificio/catalog-ui';
import { systemTreeNodeToUiNode } from '../utils/systemTreeNodeToUiNode';
import type { SystemTreeNode } from '../types/systems';

export type SystemPickerMode = 'single' | 'multi';
export type SystemPickerRole = 'user' | 'admin';

/** Fonte server-side de sistemas, no contrato de dados do `mesas`
 * (`SystemTreeNode`) — a conversão para o nó do pacote acontece aqui dentro,
 * como já acontece com `tree`. Spec 099, fase G (G7/G5b). */
export type SystemSearchFetch = (
  query: string,
  signal: AbortSignal,
) => Promise<SystemTreeNode[]>;

export type SystemChildrenFetch = (
  parentId: string,
  signal: AbortSignal,
) => Promise<SystemTreeNode[]>;

export type SystemPickerProps = Readonly<{
  /**
   * Árvore local. **Opcional desde a fase G**: quem passa `fetchSystemOptions`
   * busca sob demanda e não precisa carregar o catálogo inteiro. Sem nenhuma
   * das duas, a lista fica vazia — que é o comportamento correto de "não tenho
   * de onde tirar opção", não um erro.
   */
  tree?: SystemTreeNode[];
  /** Busca sob demanda (G7). Sem ela, filtra `tree` no cliente, como antes. */
  fetchSystemOptions?: SystemSearchFetch;
  /** Filhos sob demanda (G7). Sem ela, usa `children` da árvore. */
  fetchChildOptions?: SystemChildrenFetch;
  /**
   * Nós já selecionados, para nomear a seleção sem árvore local (G7). O
   * consumidor já precisa desses nomes para a própria lista, então não há
   * trabalho novo — só deixar de depender do catálogo inteiro para exibi-los.
   */
  selectedNodes?: SystemTreeNode[];
  selectedIds: string[];
  onSelectionChange: (selectedIds: string[]) => void;
  idPrefix: string;
  mode?: SystemPickerMode;
  role?: SystemPickerRole;
  searchPlaceholder?: string;
  onSuggest?: (query: string) => void;
  onCreateNow?: (query: string) => void;
  onEdit?: (node: SystemTreeNode) => void;
  /** Repassado direto pra CatalogTree — ver doc da prop lá (criação em cascata
   * sistema->edição->variante a partir do botão "+ Adicionar" de cada nível). */
  onAddChildAtLevel?: (depth: number, parent: SystemTreeNode | null) => void;
}>;

/** Wrapper fino sobre @artificio/catalog-ui#CatalogTree — mantém a interface
 * SystemPickerProps já consumida pelos usos existentes em mesas-frontend
 * (I8.6, spec 062: unificação de árvore/formulário entre mesas e site-admin).
 *
 * A contagem "6 usos" que este comentário trazia estava desatualizada: medido
 * em 2026-09-01, `<SystemPicker` aparece **4** vezes (`GmProfileFields`,
 * `UserSystemsSelector`, `DraftEditorTab`, `OnboardingPage`).
 *
 * Fase G (G7/G5b): o wrapper passou a repassar as fontes server-side. Antes ele
 * declarava `tree` obrigatória e zero `fetch*`, então furar só o `CatalogTree`
 * não teria entregado nada a quem passa por aqui. As props novas são aditivas —
 * quem não as usa continua no caminho de antes. */
export function SystemPicker({
  tree,
  onEdit,
  onAddChildAtLevel,
  fetchSystemOptions,
  fetchChildOptions,
  selectedNodes,
  ...rest
}: SystemPickerProps) {
  const uiTree = useMemo(() => (tree ?? []).map(systemTreeNodeToUiNode), [tree]);
  const byId = useMemo(() => {
    const map = new Map<string, SystemTreeNode>();
    const visit = (nodes: SystemTreeNode[]) => {
      nodes.forEach((node) => {
        map.set(node.id, node);
        visit(node.children ?? []);
      });
    };
    visit(tree ?? []);
    return map;
  }, [tree]);

  const uiSelectedNodes = useMemo(
    () => selectedNodes?.map(systemTreeNodeToUiNode),
    [selectedNodes],
  );

  // As fontes atravessam convertendo na fronteira, igual `tree` sempre fez: o
  // consumidor fala `SystemTreeNode` (contrato do mesas) e o pacote recebe
  // `CatalogUiNode`. Os wrappers são memoizados porque o `CatalogTree` guarda a
  // referência — recriar a função a cada render não refaz busca, mas manter a
  // identidade estável é o contrato documentado da prop.
  // Nós vindos do servidor, por id: as fontes remotas devolvem `SystemTreeNode`,
  // convertem para o nó da UI e o original se perderia. Ref porque isto é
  // preenchido DENTRO do fetch — setState aqui reentraria no ciclo de render.
  const remotosPorId = useRef(new Map<string, SystemTreeNode>());
  const registrarRemotos = useCallback((nodes: SystemTreeNode[]): SystemTreeNode[] => {
    for (const node of nodes) remotosPorId.current.set(node.id, node);
    return nodes;
  }, []);

  const uiFetchSystemOptions = useMemo(
    () =>
      fetchSystemOptions
        ? async (query: string, signal: AbortSignal) =>
            registrarRemotos(await fetchSystemOptions(query, signal)).map(systemTreeNodeToUiNode)
        : undefined,
    [fetchSystemOptions, registrarRemotos],
  );

  const uiFetchChildOptions = useMemo(
    () =>
      fetchChildOptions
        ? async (parent: { id: string }, signal: AbortSignal) =>
            registrarRemotos(await fetchChildOptions(parent.id, signal)).map(systemTreeNodeToUiNode)
        : undefined,
    [fetchChildOptions, registrarRemotos],
  );

  return (
    <CatalogTree
      {...rest}
      tree={uiTree}
      fetchSystemOptions={uiFetchSystemOptions}
      fetchChildOptions={uiFetchChildOptions}
      selectedNodes={uiSelectedNodes}
      /* `byId` indexa só a ÁRVORE LOCAL, e com fonte remota (fase G) nenhum nó
         buscado está lá: `onEdit` nunca disparava e `onAddChildAtLevel` recebia
         `null`, abrindo o modal de "novo filho" sem saber de quem. Os nós vistos
         via `fetchSystemOptions`/`fetchChildOptions` passam a ser registrados em
         `remotosPorId` (ref, não estado: alimentar isto por setState reentraria
         no render). Achado do CodeRabbit na PR #304. */
      onEdit={onEdit ? (uiNode) => {
        const original = byId.get(uiNode.id) ?? remotosPorId.current.get(uiNode.id);
        if (original) onEdit(original);
      } : undefined}
      onAddChildAtLevel={onAddChildAtLevel ? (depth, uiParent) => {
        const original = uiParent
          ? (byId.get(uiParent.id) ?? remotosPorId.current.get(uiParent.id) ?? null)
          : null;
        onAddChildAtLevel(depth, original);
      } : undefined}
    />
  );
}
