import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { apiGet } from '../services/apiClient';

const creatorRoleSchema = z.object({ role: z.enum(['user', 'publisher', 'moderator', 'admin']) });

// T1.x (spec 075) — role real do dominio downloads (SSO so tem user|admin).
// So decide UI (mostrar/esconder link de /gestao); backend valida de verdade.
export function useCreatorRole() {
  return useQuery({
    queryKey: ['downloads', 'creators', 'me'],
    queryFn: async () => {
      const response = await apiGet('/api/v1/creators/me');
      if (!response.ok) {
        throw new Error(`Falha ao buscar role: HTTP ${response.status}`);
      }
      return creatorRoleSchema.parse(await response.json());
    },
  });
}
