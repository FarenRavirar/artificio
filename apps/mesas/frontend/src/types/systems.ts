export type SystemNodeType = 'system' | 'edition' | 'variant' | 'subsystem';

export interface SystemTreeNode {
  id: string;
  name: string;
  name_pt: string | null;
  slug: string;
  parent_id: string | null;
  node_type: SystemNodeType;
  depth?: number;
  path_slug: string | null;
  aliases?: string[];
  has_children?: boolean;
  children?: SystemTreeNode[];
}
