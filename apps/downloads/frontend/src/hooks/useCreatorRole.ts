import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { apiGet, apiPatch } from '../services/apiClient';

const ownCreatorProfileSchema = z.object({
  slug: z.string(),
  display_name: z.string(),
  bio: z.string().nullable(),
});

const creatorMeSchema = z.object({
  role: z.enum(['user', 'publisher', 'moderator', 'admin']),
  profile: ownCreatorProfileSchema.nullable(),
});

export type CreatorMe = z.infer<typeof creatorMeSchema>;
export type OwnCreatorProfileInput = { display_name: string; bio: string | null };

const CREATOR_ME_QUERY_KEY = ['downloads', 'creators', 'me'] as const;

export function useCreatorMe() {
  return useQuery({
    queryKey: CREATOR_ME_QUERY_KEY,
    queryFn: async () => {
      const response = await apiGet('/api/v1/creators/me');
      if (!response.ok) {
        throw new Error(`Falha ao buscar perfil: HTTP ${response.status}`);
      }
      return creatorMeSchema.parse(await response.json());
    },
  });
}

// T1.x (spec 075) — role real do dominio downloads (SSO so tem user|admin).
// So decide UI (mostrar/esconder link de /gestao); backend valida de verdade.
export function useCreatorRole() {
  return useCreatorMe();
}

export function useUpdateOwnCreatorProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: OwnCreatorProfileInput): Promise<CreatorMe> => {
      const response = await apiPatch('/api/v1/creators/me', input);
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        const message = body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
          ? body.error
          : `Falha ao salvar perfil: HTTP ${response.status}`;
        throw new Error(message);
      }
      return creatorMeSchema.parse(body);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(CREATOR_ME_QUERY_KEY, data);
      if (data.profile) {
        void queryClient.invalidateQueries({ queryKey: ['downloads', 'creator', data.profile.slug] });
      }
    },
  });
}
