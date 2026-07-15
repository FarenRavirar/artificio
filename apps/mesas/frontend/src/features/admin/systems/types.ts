export interface System {
  id: string;
  name: string;
  name_pt?: string | null;
  slug: string;
  node_type: 'system' | 'edition' | 'variant';
  parent_id: string | null;
  depth?: number;
  path_slug: string | null;
  logo_filename?: string | null;
  website_url?: string | null;
  aliases?: string[];
  has_children?: boolean;
  children_count?: number;
  tables_count?: number;
  aliases_count?: number;
  children?: System[];
}

export interface PaginationInfo {
  next_cursor: string | null;
  has_more: boolean;
}

export interface SystemsResponse {
  data: System[];
  pagination: PaginationInfo;
}
