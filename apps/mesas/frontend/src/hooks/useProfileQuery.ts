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
 * Snapshot de "o perfil de mestre ja existia?", tirado na PRIMEIRA escrita
 * otimista do ciclo de autosave e consumido pelo `mutationFn` do `useUpdateGm`.
 *
 * Por que no modulo e nao num `useRef` do hook: quem grava primeiro no cache
 * NAO e o `onMutate` da mutation — e o `updateGm` do `ProfileContext`, que faz
 * optimistic update no enqueue (para os TagInput lerem a prop atualizada
 * durante os 500ms de debounce). Quando o `onMutate` roda, o cache ja tem `gm`
 * preenchido, e ler `previousProfile.gm` ali daria `true` mesmo para mestre
 * novo — reintroduzindo o 404 do PUT que o ramo POST existe para evitar
 * (regressao introduzida ao corrigir o achado das tags; PR #297).
 *
 * `marcarGmExistente` e idempotente por ciclo: so a primeira chamada decide.
 * `limparSnapshotGm` fecha o ciclo quando a mutation assenta.
 */
let gmExistiaAntes: boolean | null = null;

export function marcarGmExistente(existe: boolean): void {
  if (gmExistiaAntes === null) gmExistiaAntes = existe;
}

/** Leitura do snapshot — usada pelo `mutationFn` e pelos testes de contrato. */
export function lerSnapshotGm(): boolean | null {
  return gmExistiaAntes;
}

export function limparSnapshotGm(): void {
  gmExistiaAntes = null;
}

export function useUpdateGm() {
  return useMutation({
    mutationFn: async (data: Partial<GmProfile>) => {
      const sanitized = sanitizeObject(data as Record<string, unknown>);
      const validated = validateOrThrow(gmProfileSchema, sanitized);

      // Spec 099 B0: o PATCH /api/v1/profile/gm fazia upsert — criava o perfil
      // (slug derivado + role elevada a 'gm') quando o usuário ainda não tinha
      // um. O PUT /api/v1/gm/profile responde 404 sem perfil, então a migração
      // preserva o upsert na camada do cliente: perfil existe → PUT; não existe
      // → POST com slug e nickname derivados.
      //
      // A decisão usa `gmExistiaAntes` (snapshot de modulo), NAO o cache: quando
      // o `mutationFn` roda, o cache JA foi escrito otimisticamente — primeiro
      // pelo `updateGm` do contexto (no enqueue, 500ms antes) e depois pelo
      // `onMutate`. Ler `gm` do cache aqui daria truthy mesmo para mestre novo,
      // mandando todo mundo ao PUT (404) e deixando o POST inalcancavel
      // (achado de review, PR #297).
      const criar = gmExistiaAntes === false;

      if (!criar) {
        // PUT preserva o que não veio; a engine só faz retry/refresh para
        // métodos não-idempotentes (REV-055).
        const result = await api.put<{ data: FullProfile['gm'] }>('/api/v1/gm/profile', validated);
        return result.data;
      }

      // Spec 106 R2: slug e nickname NÃO são mais derivados aqui. O backend os
      // deriva (nome do perfil → username → user-<8 hex>, nunca o e-mail); o
      // cliente só manda o que o usuário digitou.
      const result = await api.post<{ data: FullProfile['gm'] }>('/api/v1/gm/profile', validated);
      return result.data;
    },
    onMutate: async (newData) => {
      await queryClient.cancelQueries({ queryKey: ['profile', 'me'] });
      const previousProfile = queryClient.getQueryData<FullProfile>(['profile', 'me']);
      // Rede de seguranca: se nada marcou o snapshot antes (chamada direta da
      // mutation, fora do autosave do contexto), o `onMutate` ainda e o ponto
      // mais cedo disponivel. Idempotente — nao sobrescreve o do contexto.
      marcarGmExistente(Boolean(previousProfile?.gm));

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
      // Fecha o ciclo do snapshot: a proxima edicao volta a medir o estado real
      // (apos o refetch, o perfil recem-criado ja existe e o caminho e o PUT).
      limparSnapshotGm();
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
