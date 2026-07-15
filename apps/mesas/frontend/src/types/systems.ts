export type SystemNodeType = 'system' | 'edition' | 'variant';

export interface SystemTreeNode {
  id: string;
  name: string;
  name_pt: string | null;
  slug: string;
  parent_id: string | null;
  node_type: SystemNodeType;
  depth?: number;
  path_slug: string | null;
  logo_filename?: string | null;
  website_url?: string | null;
  aliases?: string[];
  has_children?: boolean;
  children_count?: number;
  tables_count?: number;
  aliases_count?: number;
  children?: SystemTreeNode[];
}
