import { useMemo } from 'react';
import { CatalogTree, type CatalogUiNode } from '@artificio/catalog-ui';
import type { SystemTreeNode } from '../types/systems';

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
  /** Repassado direto pra CatalogTree — ver doc da prop lá (criação em cascata
   * sistema->edição->variante a partir do botão "+ Adicionar" de cada nível). */
  onAddChildAtLevel?: (depth: number, parent: SystemTreeNode | null) => void;
}>;

/** SystemTreeNode (mesas, slug) -> CatalogUiNode (pacote compartilhado, canonical_slug). */
function toUiNode(node: SystemTreeNode): CatalogUiNode {
  return {
    id: node.id,
    parent_id: node.parent_id,
    node_type: node.node_type,
    name: node.name,
    name_pt: node.name_pt,
    canonical_slug: node.slug,
    path_slug: node.path_slug,
    aliases: node.aliases,
    children: (node.children ?? []).map(toUiNode),
  };
}

/** Wrapper fino sobre @artificio/catalog-ui#CatalogTree — mantém a interface
 * SystemPickerProps já consumida pelos 6 usos existentes em mesas-frontend
 * (I8.6, spec 062: unificação de árvore/formulário entre mesas e site-admin). */
export function SystemPicker({
  tree,
  onEdit,
  onAddChildAtLevel,
  ...rest
}: SystemPickerProps) {
  const uiTree = useMemo(() => tree.map(toUiNode), [tree]);
  const byId = useMemo(() => {
    const map = new Map<string, SystemTreeNode>();
    const visit = (nodes: SystemTreeNode[]) => {
      nodes.forEach((node) => {
        map.set(node.id, node);
        visit(node.children ?? []);
      });
    };
    visit(tree);
    return map;
  }, [tree]);

  return (
    <CatalogTree
      {...rest}
      tree={uiTree}
      onEdit={onEdit ? (uiNode) => {
        const original = byId.get(uiNode.id);
        if (original) onEdit(original);
      } : undefined}
      onAddChildAtLevel={onAddChildAtLevel ? (depth, uiParent) => {
        const original = uiParent ? (byId.get(uiParent.id) ?? null) : null;
        onAddChildAtLevel(depth, original);
      } : undefined}
    />
  );
}
