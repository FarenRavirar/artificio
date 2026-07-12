import { z } from 'zod';

export const materialSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  summary: z.string().nullable(),
  description: z.string().nullable(),
  material_type: z.string(),
  access_kind: z.enum(['external_link', 'managed_upload']),
  external_url: z.string().nullable(),
  creator_id: z.string(),
  creator_slug: z.string().nullable().optional(),
  destination_id: z.string().optional(),
  system_id: z.string().nullable().optional(),
  edition_id: z.string().nullable().optional(),
  system_name: z.string().nullable().optional(),
  edition_name: z.string().nullable().optional(),
  editorial_state: z.enum(['draft', 'in_review', 'published', 'rejected', 'withdrawn']),
  created_at: z.string(),
  updated_at: z.string(),
});

export type Material = z.infer<typeof materialSchema>;

export const materialListResponseSchema = z.object({
  items: z.array(materialSchema),
  page: z.number(),
  page_size: z.number(),
  total: z.number(),
  total_pages: z.number(),
});

export type MaterialListResponse = z.infer<typeof materialListResponseSchema>;

export const SORT_OPTIONS = ['relevance', 'recent', 'popular', 'name'] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];

export interface MaterialListFilters {
  q?: string;
  system_id?: string;
  edition_id?: string;
  material_type?: string;
  access_kind?: 'external_link' | 'managed_upload';
  sort?: SortOption;
  page?: number;
}
