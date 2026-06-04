import React from 'react';
import type { ReactNode } from 'react';
import { ProfileContext, type ProfileContextValue } from './profileContextCore';
import {
  useProfileQuery,
  useUpdateUser,
  useUpdateProfile,
  useUpdatePlayer,
  useUpdateGm,
  useAddSystem,
  useRemoveSystem,
} from '../hooks/useProfileQuery';

/**
 * Context para centralizar estado do perfil usando React Query
 * Elimina requisições duplicadas e fornece cache automático + optimistic updates
 */

interface ProfileProviderProps {
  children: ReactNode;
}

export function ProfileProvider({ children }: ProfileProviderProps) {
  // Query principal
  const { data: profile, isLoading, error, refetch } = useProfileQuery();

  // Mutations
  const updateUserMutation = useUpdateUser();
  const updateProfileMutation = useUpdateProfile();
  const updatePlayerMutation = useUpdatePlayer();
  const updateGmMutation = useUpdateGm();
  const addSystemMutation = useAddSystem();
  const removeSystemMutation = useRemoveSystem();

  // Estado de saving (qualquer mutation em andamento)
  const saving =
    updateUserMutation.isPending ||
    updateProfileMutation.isPending ||
    updatePlayerMutation.isPending ||
    updateGmMutation.isPending ||
    addSystemMutation.isPending ||
    removeSystemMutation.isPending;

  // Memoizar o valor do contexto
  const value = React.useMemo<ProfileContextValue>(
    () => ({
      profile,
      loading: isLoading,
      error: error ? String(error) : null,
      saving,
      refetch,
      updateUser: async (data) => {
        if (updateUserMutation.isPending) return;
        await updateUserMutation.mutateAsync(data);
      },
      updateProfile: async (data) => {
        if (updateProfileMutation.isPending) return;
        await updateProfileMutation.mutateAsync(data);
      },
      updatePlayer: async (data) => {
        if (updatePlayerMutation.isPending) return;
        await updatePlayerMutation.mutateAsync(data);
      },
      updateGm: async (data) => {
        if (updateGmMutation.isPending) return;
        await updateGmMutation.mutateAsync(data);
      },
      addSystem: async (systemId, type = 'favorite') => {
        if (addSystemMutation.isPending) return;
        await addSystemMutation.mutateAsync({ systemId, type });
      },
      removeSystem: async (systemId) => {
        if (removeSystemMutation.isPending) return;
        await removeSystemMutation.mutateAsync(systemId);
      },
    }),
    [
      profile,
      isLoading,
      error,
      saving,
      refetch,
      updateUserMutation,
      updateProfileMutation,
      updatePlayerMutation,
      updateGmMutation,
      addSystemMutation,
      removeSystemMutation,
    ]
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

