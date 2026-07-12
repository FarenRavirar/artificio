import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { apiGet, apiPost } from '../services/apiClient';
import { organizationSchema } from '../types/panel';

const organizationsListSchema = z.array(organizationSchema);

export function useOrganizations() {
  return useQuery({
    queryKey: ['downloads', 'organizations'],
    queryFn: async () => {
      const response = await apiGet('/api/v1/organizations');
      if (!response.ok) throw new Error(`Falha ao buscar organizações: HTTP ${response.status}`);
      return organizationsListSchema.parse(await response.json());
    },
  });
}

export function useCreateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { slug: string; name: string }) => {
      const response = await apiPost('/api/v1/organizations', input);
      if (!response.ok) throw new Error(`Falha ao criar organização: HTTP ${response.status}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['downloads', 'organizations'] }),
  });
}
