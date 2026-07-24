import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { apiGet } from '../services/apiClient';

const creatorItemSchema = z.object({
  id: z.string(),
  slug: z.string(),
  display_name: z.string(),
  role: z.string(),
  created_at: z.string(),
});

const creatorsPageSchema = z.object({
  items: z.array(creatorItemSchema),
  total: z.number(),
  page: z.number(),
  page_size: z.number(),
});

// T2.7 (spec 082) — Gestao de Publicadores: listagem paginada com busca por
// nome/slug (antes so havia busca individual por slug, publica).
export function useAdminCreators(params: { q?: string; page?: number }) {
  return useQuery({
    queryKey: ['downloads', 'admin', 'creators', params],
    queryFn: async () => {
      const search = new URLSearchParams();
      if (params.q) search.set('q', params.q);
      if (params.page) search.set('page', String(params.page));

      const response = await apiGet(`/api/v1/admin/creators?${search.toString()}`);
      if (!response.ok) {
        throw new Error(`Falha ao buscar publicadores: HTTP ${response.status}`);
      }
      return creatorsPageSchema.parse(await response.json());
    },
  });
}
