import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { apiGet } from '../services/apiClient';

const categorySchema = z.object({
  id: z.string(),
  slug: z.string(),
  label: z.string(),
  legal_basis: z.string().nullable(),
  email_template_key: z.string(),
  active: z.boolean(),
});

const categoriesSchema = z.object({ items: z.array(categorySchema) });

// T6.1 (spec 083) — lista categorias ativas para o select de reprovacao.
export function useAdminRejectionCategories() {
  return useQuery({
    queryKey: ['downloads', 'admin', 'rejection-categories'],
    queryFn: async () => {
      const response = await apiGet('/api/v1/admin/rejection-categories');
      if (!response.ok) {
        throw new Error(`Falha ao buscar categorias de reprovação: HTTP ${response.status}`);
      }
      return categoriesSchema.parse(await response.json());
    },
  });
}
