export type CatalogNodeType = 'system' | 'edition' | 'variant';
export type CatalogNodeStatus = 'draft' | 'pending' | 'active' | 'rejected' | 'merged';

/** Superset de SystemTreeNode (mesas) e CatalogNode (site-admin): árvore + campos de formulário completo. */
export interface CatalogUiNode {
  id: string;
  parent_id: string | null;
  node_type: CatalogNodeType;
  name: string;
  name_pt: string | null;
  canonical_slug: string;
  path_slug: string | null;
  description?: string | null;
  official_website_url?: string | null;
  logo_media_id?: string | null;
  status?: CatalogNodeStatus;
  aliases?: string[];
  children: CatalogUiNode[];
}

export interface CatalogUiNodeInput {
  parent_id?: string | null;
  node_type: CatalogNodeType;
  canonical_slug?: string;
  name: string;
  name_pt?: string | null;
  description?: string | null;
  official_website_url?: string | null;
  logo_media_id?: string | null;
  status?: CatalogNodeStatus;
  aliases?: string[];
}
