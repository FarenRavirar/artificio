import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuth } from '../contexts/useAuth';
import { api } from '../services/apiClient';
import { queryClient } from '../lib/queryClient';
import {
  userSchema,
  profileSchema,
  playerProfileSchema,
  gmProfileSchema,
  validateOrThrow,
} from '../schemas/profileSchemas';
import { track } from '../services/analytics';
import { sanitizeObject } from '../utils/sanitize';
import { notifyProfileUpdate } from '../services/broadcastChannel';
import type { FullProfile, GmProfile, PlayerProfile } from '../types/profileTypes';
export type { FullProfile, GmProfile, PlayerProfile } from '../types/profileTypes';

type UserSystem = FullProfile['systems']['favorite'][number];

/**
 * Hook React Query para gerenciar perfil com cache e optimistic updates
 */
export function useProfileQuery() {
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: ['profile', 'me'],
    queryFn: async () => {
      const result = await api.get<{ data: FullProfile }>('/api/v1/profile/me');
      return result.data;
    },
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000, // 5 minutos
  });
}

/**
 * Mutation para atualizar usuário com optimistic update
 */
export function useUpdateUser() {
  return useMutation({
    mutationFn: async (data: { username?: string; location?: string }) => {
      const sanitized = sanitizeObject(data);
      const validated = validateOrThrow(userSchema, sanitized);
      const result = await api.patch<{ data: FullProfile['user'] }>('/api/v1/profile/me', validated);
      return result.data;
    },
    onMutate: async (newData) => {
      // Cancelar queries em andamento
      await queryClient.cancelQueries({ queryKey: ['profile', 'me'] });

      // Snapshot do estado anterior
      const previousProfile = queryClient.getQueryData<FullProfile>(['profile', 'me']);

      // Optimistic update
      if (previousProfile) {
        queryClient.setQueryData<FullProfile>(['profile', 'me'], {
          ...previousProfile,
          user: { ...previousProfile.user, ...newData },
        });
      }

      return { previousProfile };
    },
    onError: (_err, _newData, context) => {
      // Rollback em caso de erro
      if (context?.previousProfile) {
        queryClient.setQueryData(['profile', 'me'], context.previousProfile);
      }
    },
    onSettled: () => {
      // Revalidar após sucesso ou erro
      queryClient.invalidateQueries({ queryKey: ['profile', 'me'] });
    },
  });
}

/**
 * Mutation para atualizar perfil com optimistic update
 */
export function useUpdateProfile() {
  return useMutation({
    mutationFn: async (data: {
      display_name?: string;
      bio?: string;
      avatar_url?: string;
      languages?: string[];
    }) => {
      const sanitized = sanitizeObject(data);
      const validated = validateOrThrow(profileSchema, sanitized);
      const result = await api.patch<{ data: FullProfile['profile'] }>('/api/v1/profile/me/profile', validated);
      return result.data;
    },
    onMutate: async (newData) => {
      await queryClient.cancelQueries({ queryKey: ['profile', 'me'] });
      const previousProfile = queryClient.getQueryData<FullProfile>(['profile', 'me']);

      if (previousProfile) {
        queryClient.setQueryData<FullProfile>(['profile', 'me'], {
          ...previousProfile,
          profile: previousProfile.profile ? { ...previousProfile.profile, ...newData } : null,
        });
      }

      return { previousProfile };
    },
    onError: (_err, _newData, context) => {
      if (context?.previousProfile) {
        queryClient.setQueryData(['profile', 'me'], context.previousProfile);
      }
    },
    onSuccess: () => {
      track('profile_updated', { section: 'general' });
      notifyProfileUpdate();
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', 'me'] });
    },
  });
}

/**
 * Mutation para atualizar perfil de jogador com optimistic update
 */
export function useUpdatePlayer() {
  return useMutation({
    mutationFn: async (data: Partial<PlayerProfile>) => {
      const sanitized = sanitizeObject(data as Record<string, unknown>);
      const validated = validateOrThrow(playerProfileSchema, sanitized);
      const result = await api.patch<{ data: FullProfile['player'] }>('/api/v1/profile/player', validated);
      return result.data;
    },
    onMutate: async (newData) => {
      await queryClient.cancelQueries({ queryKey: ['profile', 'me'] });
      const previousProfile = queryClient.getQueryData<FullProfile>(['profile', 'me']);

      if (previousProfile) {
        queryClient.setQueryData<FullProfile>(['profile', 'me'], {
          ...previousProfile,
          player: previousProfile.player
            ? { ...previousProfile.player, ...newData }
            : (newData as PlayerProfile),
        });
      }

      return { previousProfile };
    },
    onError: (_err, _newData, context) => {
      if (context?.previousProfile) {
        queryClient.setQueryData(['profile', 'me'], context.previousProfile);
      }
    },
    onSuccess: () => {
      track('profile_updated', { section: 'player' });
      notifyProfileUpdate();
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', 'me'] });
    },
  });
}

/**
 * Mutation para atualizar perfil de mestre com optimistic update
 */
export function useUpdateGm() {
  return useMutation({
    mutationFn: async (data: Partial<GmProfile>) => {
      const sanitized = sanitizeObject(data as Record<string, unknown>);
      const validated = validateOrThrow(gmProfileSchema, sanitized);
      const result = await api.patch<{ data: FullProfile['gm'] }>('/api/v1/profile/gm', validated);
      return result.data;
    },
    onMutate: async (newData) => {
      await queryClient.cancelQueries({ queryKey: ['profile', 'me'] });
      const previousProfile = queryClient.getQueryData<FullProfile>(['profile', 'me']);

      if (previousProfile) {
        queryClient.setQueryData<FullProfile>(['profile', 'me'], {
          ...previousProfile,
          gm: previousProfile.gm
            ? { ...previousProfile.gm, ...newData }
            : (newData as GmProfile),
        });
      }

      return { previousProfile };
    },
    onError: (_err, _newData, context) => {
      if (context?.previousProfile) {
        queryClient.setQueryData(['profile', 'me'], context.previousProfile);
      }
    },
    onSuccess: () => {
      track('profile_updated', { section: 'gm' });
      notifyProfileUpdate();
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', 'me'] });
    },
  });
}

/**
 * Mutation para adicionar sistema
 */
export function useAddSystem() {
  return useMutation({
    mutationFn: async ({ systemId, type }: { systemId: string; type: 'favorite' | 'gm' }) => {
      const result = await api.post<{ data: UserSystem }>('/api/v1/profile/systems', {
        system_id: systemId,
        type: type,
      });
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', 'me'] });
      track('system_added');
    },
  });
}

/**
 * Mutation para remover sistema
 */
export function useRemoveSystem() {
  return useMutation({
    mutationFn: async (systemId: string) => {
      await api.delete(`/api/v1/profile/systems/${systemId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', 'me'] });
      track('system_removed');
    },
  });
}
