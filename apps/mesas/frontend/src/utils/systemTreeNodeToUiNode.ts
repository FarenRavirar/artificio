import type { CatalogUiNode } from '@artificio/catalog-ui';
import type { SystemTreeNode } from '../types/systems';

/**
 * SystemTreeNode (mesas, slug) -> CatalogUiNode (pacote compartilhado, canonical_slug).
 *
 * Módulo comum para a conversão de árvore entre o contrato de dados do mesas e
 * o contrato do `@artificio/catalog-ui` — consumido por `SystemPicker` e
 * `CatalogSystemPopover`. Extraído de `SystemPicker.tsx` durante a spec 094
 * (Fase 2) para eliminar a duplicação que o popover novo teria introduzido
 * (R6: compartilhado por padrão; regra pétrea "achou, conserta" — débito de
 * duplicação reportado na fase, corrigido na mesma spec antes do PR).
 */
export function systemTreeNodeToUiNode(node: SystemTreeNode): CatalogUiNode {
  return {
    id: node.id,
    parent_id: node.parent_id,
    node_type: node.node_type,
    name: node.name,
    name_pt: node.name_pt,
    canonical_slug: node.slug,
    path_slug: node.path_slug,
    aliases: node.aliases,
    children: (node.children ?? []).map(systemTreeNodeToUiNode),
  };
}
