import { useMemo, useState } from 'react';
import { CatalogTree, type CatalogTreeMode, type CatalogTreeRole } from './CatalogTree.js';
import { CatalogNodeForm } from './CatalogNodeForm.js';
import type { CatalogNodeType, CatalogUiNode, CatalogUiNodeInput } from './types.js';

function flattenNodes(nodes: CatalogUiNode[]): CatalogUiNode[] {
  return nodes.flatMap((node) => [node, ...flattenNodes(node.children ?? [])]);
}

function findNode(nodes: CatalogUiNode[], id: string): CatalogUiNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findNode(node.children ?? [], id);
    if (found) return found;
  }
  return null;
}

function nextChildType(type: CatalogNodeType): CatalogNodeType {
  if (type === 'system') return 'edition';
  if (type === 'edition' || type === 'subsystem') return 'variant';
  return 'variant';
}

export type CatalogExplorerProps = Readonly<{
  tree: CatalogUiNode[];
  selectedIds: string[];
  onSelectionChange: (selectedIds: string[]) => void;
  idPrefix: string;
  mode?: CatalogTreeMode;
  role?: CatalogTreeRole;
  searchPlaceholder?: string;
  onSuggest?: (query: string) => void;
  onCreateNow?: (query: string) => void;
  /** Painel de edição completo só existe quando role="admin" e onSaveNode é fornecido. */
  onSaveNode?: (form: CatalogUiNodeInput, selected: CatalogUiNode | null) => void;
  saving?: boolean;
}>;

/** Une CatalogTree (seleção em cascata) + CatalogNodeForm (edição completa por nó):
 * ao selecionar qualquer nó em qualquer consumidor (mesas ou site-admin), o painel
 * de edição completo aparece — requisito do mantenedor (spec 062, I8, 2026-07-11). */
export function CatalogExplorer({
  tree,
  selectedIds,
  onSelectionChange,
  idPrefix,
  mode = 'single',
  role = 'user',
  searchPlaceholder,
  onSuggest,
  onCreateNow,
  onSaveNode,
  saving,
}: CatalogExplorerProps) {
  const flatNodes = useMemo(() => flattenNodes(tree), [tree]);
  const selectedNode = useMemo(
    () => (selectedIds.length === 1 ? findNode(tree, selectedIds[0]) : null),
    [tree, selectedIds],
  );
  // Exclui o próprio nó selecionado e seus descendentes das opções de pai —
  // escolhê-los como pai criaria um ciclo na árvore (achado CodeRabbit PR #148).
  const parentOptions = useMemo(() => {
    if (!selectedNode) return flatNodes;
    const excluded = new Set(flattenNodes([selectedNode]).map((node) => node.id));
    return flatNodes.filter((node) => !excluded.has(node.id));
  }, [flatNodes, selectedNode]);

  const canEdit = role === 'admin' && Boolean(onSaveNode);

  // Pedido de "+ Adicionar" na árvore (sem onCreateNow, fluxo do formulário embutido):
  // guarda o pai/tipo pretendido até o próximo save, sem depender de seleção.
  const [newNodeDefaults, setNewNodeDefaults] = useState<Partial<CatalogUiNodeInput> | null>(null);

  const handleAddChildAtLevel = onCreateNow ? undefined : (_depth: number, parent: CatalogUiNode | null) => {
    onSelectionChange([]);
    setNewNodeDefaults({
      parent_id: parent?.id ?? null,
      node_type: parent ? nextChildType(parent.node_type) : 'system',
    });
  };

  const handleSave = (form: CatalogUiNodeInput) => {
    setNewNodeDefaults(null);
    onSaveNode!(form, selectedNode);
  };

  return (
    <div className={canEdit ? 'catalog-explorer-layout' : undefined}>
      <CatalogTree
        tree={tree}
        selectedIds={selectedIds}
        onSelectionChange={(ids) => {
          setNewNodeDefaults(null);
          onSelectionChange(ids);
        }}
        idPrefix={idPrefix}
        mode={mode}
        role={role}
        searchPlaceholder={searchPlaceholder}
        onSuggest={onSuggest}
        onCreateNow={onCreateNow}
        onAddChildAtLevel={handleAddChildAtLevel}
      />

      {canEdit && (
        <CatalogNodeForm
          idPrefix={`${idPrefix}-form`}
          selected={selectedNode}
          parentOptions={parentOptions}
          saving={saving}
          onSave={handleSave}
          newNodeDefaults={newNodeDefaults ?? undefined}
        />
      )}
    </div>
  );
}
