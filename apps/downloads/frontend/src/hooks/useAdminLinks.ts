import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { apiGet, apiPost } from '../services/apiClient';

const linkCheckSchema = z.object({
  id: z.string(),
  material_id: z.string(),
  material_slug: z.string(),
  material_title: z.string(),
  checked_url: z.string(),
  http_status: z.number().nullable(),
  is_healthy: z.boolean(),
  error_detail: z.string().nullable(),
  checked_at: z.string(),
});

const linksSchema = z.array(linkCheckSchema);

// T5.3 (spec 075) — status mais recente de link por material.
export function useAdminLinks() {
  return useQuery({
    queryKey: ['downloads', 'admin', 'links'],
    queryFn: async () => {
      const response = await apiGet('/api/v1/admin/links');
      if (!response.ok) {
        throw new Error(`Falha ao buscar links: HTTP ${response.status}`);
      }
      return linksSchema.parse(await response.json());
    },
  });
}

// T5.1 (spec 075) — dispara checagem sob demanda de um material.
export function useCheckLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (materialId: string) => {
      const response = await apiPost(`/api/v1/admin/materials/${materialId}/check-link`);
      if (!response.ok) {
        throw new Error(`Falha ao checar link: HTTP ${response.status}`);
      }
      return response.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['downloads', 'admin', 'links'] });
      void queryClient.invalidateQueries({ queryKey: ['downloads', 'admin', 'summary'] });
    },
  });
}
