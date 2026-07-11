import { useMemo } from 'react';
import { CatalogTree, type CatalogTreeMode, type CatalogTreeRole } from './CatalogTree.js';
import { CatalogNodeForm } from './CatalogNodeForm.js';
import type { CatalogUiNode, CatalogUiNodeInput } from './types.js';

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
  showEmptySearchResults?: boolean;
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
  showEmptySearchResults,
  onSaveNode,
  saving,
}: CatalogExplorerProps) {
  const flatNodes = useMemo(() => flattenNodes(tree), [tree]);
  const selectedNode = useMemo(
    () => (selectedIds.length === 1 ? findNode(tree, selectedIds[0]) : null),
    [tree, selectedIds],
  );

  const canEdit = role === 'admin' && Boolean(onSaveNode);

  return (
    <div className={canEdit ? 'catalog-explorer-layout' : undefined}>
      <CatalogTree
        tree={tree}
        selectedIds={selectedIds}
        onSelectionChange={onSelectionChange}
        idPrefix={idPrefix}
        mode={mode}
        role={role}
        searchPlaceholder={searchPlaceholder}
        onSuggest={onSuggest}
        onCreateNow={onCreateNow}
        showEmptySearchResults={showEmptySearchResults}
      />

      {canEdit && (
        <CatalogNodeForm
          idPrefix={`${idPrefix}-form`}
          selected={selectedNode}
          parentOptions={flatNodes}
          saving={saving}
          onSave={(form) => onSaveNode!(form, selectedNode)}
        />
      )}
    </div>
  );
}
