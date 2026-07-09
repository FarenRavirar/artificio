import type { SystemTreeNode } from '../types/systems';

export interface FlattenedSystemNode {
  id: string;
  slug: string;
  name: string;
  name_pt: string | null;
  aliases: string[];
  path_slug: string | null;
  depth?: number;
  pathLabel: string;
}

export const normalizeText = (value: string): string => value.trim().toLowerCase();

export const getDisplayName = (
  node: { name: string; name_pt?: string | null },
  lang: 'en' | 'pt'
): string => {
  if (lang === 'pt' && node.name_pt) {
    return node.name_pt;
  }
  return node.name;
};

export const flattenTree = (
  nodes: SystemTreeNode[],
  breadcrumb: string[] = []
): FlattenedSystemNode[] => {
  const flattened: FlattenedSystemNode[] = [];

  for (const node of nodes) {
    const path = [...breadcrumb, node.name];

    flattened.push({
      id: node.id,
      slug: node.slug,
      name: node.name,
      name_pt: node.name_pt,
      aliases: node.aliases ?? [],
      path_slug: node.path_slug,
      depth: node.depth,
      pathLabel: path.join(' > '),
    });

    if (node.children) {
      flattened.push(...flattenTree(node.children, path));
    }
  }

  return flattened;
};
