import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/useAuth';
import { showError } from '../utils/toast';
import { api } from '../services/apiClient';
import {
  userSchema,
  profileSchema,
  playerProfileSchema,
  gmProfileSchema,
  validateOrThrow,
} from '../schemas/profileSchemas';

/**
 * Hook para gerenciar perfil de usuário com autosave
 * Debounce de 500ms para evitar requisições excessivas
 */

export interface PlayerProfile {
  experience_level: 'iniciante' | 'intermediario' | 'veterano' | null;
  playstyle: {
    combat?: number;
    roleplay?: number;
    exploration?: number;
    strategy?: number;
  } | null;
  preferred_days: string[] | null;
  preferred_time: 'manha' | 'tarde' | 'noite' | null;
  pricing_preference: 'free' | 'paid' | 'both' | null;
}

export interface GmProfile {
  id: string;
  user_id: string;
  slug: string;
  nickname: string | null;
  bio_long: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  languages: string[];
  specialties: string[];
  discord_connected: boolean;
  discord_username: string | null;
  covil_verified: boolean;
  experience_years: number | null;
  average_price: number | null;
  gm_style: {
    narrative?: number;
    tactical?: number;
    sandbox?: number;
    railroad?: number;
  } | null;
  tools: string[] | null;
  game_format: {
    session_length?: string;
    frequency?: string;
    group_size?: string;
  } | null;
  preferred_vtt_platforms?: string[];
  contact_methods?: Array<{
    channel: 'whatsapp' | 'email' | 'discord' | 'form';
    value: string;
    label?: string;
    discord_server_url?: string;
  }>;
}

export interface UserSystem {
  id: string;
  user_id: string;
  system_id: string;
  type: 'favorite' | 'gm';
  created_at: string;
}

export interface FullProfile {
  user: {
    id: string;
    email: string;
    username: string | null;
    location: string | null;
    role: string;
    created_at: string;
  };
  profile: {
    display_name: string;
    bio: string | null;
    avatar_url: string | null;
    languages: string[];
  } | null;
  player: PlayerProfile | null;
  gm: GmProfile | null;
  systems: {
    favorite: UserSystem[];
    gm: UserSystem[];
  };
}

interface UseProfileReturn {
  profile: FullProfile | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  updateUser: (data: { username?: string; location?: string }) => Promise<void>;
  updateProfile: (data: {
    display_name?: string;
    bio?: string;
    avatar_url?: string;
    languages?: string[];
  }) => Promise<void>;
  updatePlayer: (data: Partial<PlayerProfile>) => Promise<void>;
  updateGm: (data: Partial<GmProfile>) => Promise<void>;
  addSystem: (systemId: string, type: 'favorite' | 'gm') => Promise<void>;
  removeSystem: (id: string) => Promise<void>;
  refetch: () => Promise<void>;
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function useProfile(): UseProfileReturn {
  const { isAuthenticated } = useAuth();
  const [profile, setProfile] = useState<FullProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<number | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    try {
      const result = await api.get<{ data: FullProfile }>('/api/v1/profile/me');
      setProfile(result.data);
      setError(null);
    } catch (err: unknown) {
      const message = getErrorMessage(err, 'Erro ao buscar perfil');
      setError(message);
      console.error('[useProfile] Erro ao buscar perfil:', err);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    void (async () => { await fetchProfile(); })();
  }, [fetchProfile]);

  const debouncedSave = useCallback(
    (fn: () => Promise<void>) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      setSaving(true);

      debounceRef.current = window.setTimeout(async () => {
        try {
          await fn();
          setError(null);
        } catch (err: unknown) {
          const message = getErrorMessage(err, 'Erro ao salvar alterações');
          setError(message);
          showError(message);
          console.error('[useProfile] Erro ao salvar:', err);
        } finally {
          setSaving(false);
        }
      }, 500);
    },
    []
  );

  const updateUser = useCallback(
    async (data: { username?: string; location?: string }) => {
      if (!isAuthenticated) return;

      debouncedSave(async () => {
        const validated = validateOrThrow(userSchema, data);
        const result = await api.patch<{ data: FullProfile['user'] }>('/api/v1/profile/me', validated);
        setProfile((prev) => (prev ? { ...prev, user: result.data } : null));
      });
    },
    [isAuthenticated, debouncedSave]
  );

  const updateProfile = useCallback(
    async (data: {
      display_name?: string;
      bio?: string;
      avatar_url?: string;
      languages?: string[];
    }) => {
      if (!isAuthenticated) return;

      debouncedSave(async () => {
        const validated = validateOrThrow(profileSchema, data);
        const result = await api.patch<{ data: FullProfile['profile'] }>('/api/v1/profile/me/profile', validated);
        setProfile((prev) => (prev ? { ...prev, profile: result.data } : null));
      });
    },
    [isAuthenticated, debouncedSave]
  );

  const updatePlayer = useCallback(
    async (data: Partial<PlayerProfile>) => {
      if (!isAuthenticated) return;

      debouncedSave(async () => {
        const validated = validateOrThrow(playerProfileSchema, data);
        const result = await api.patch<{ data: FullProfile['player'] }>('/api/v1/profile/me/player', validated);
        setProfile((prev) => (prev ? { ...prev, player: result.data } : null));
      });
    },
    [isAuthenticated, debouncedSave]
  );

  const updateGm = useCallback(
    async (data: Partial<GmProfile>) => {
      if (!isAuthenticated) return;

      debouncedSave(async () => {
        const validated = validateOrThrow(gmProfileSchema, data);
        const result = await api.patch<{ data: FullProfile['gm'] }>('/api/v1/profile/me/gm', validated);
        setProfile((prev) => (prev ? { ...prev, gm: result.data } : null));
      });
    },
    [isAuthenticated, debouncedSave]
  );

  const addSystem = useCallback(
    async (systemId: string, type: 'favorite' | 'gm') => {
      if (!isAuthenticated) return;

      try {
        const result = await api.post<{ data: UserSystem }>(
          '/api/v1/profile/me/systems',
          { system_id: systemId, type }
        );
        
        setProfile((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            systems: {
              ...prev.systems,
              [type]: [...prev.systems[type], result.data],
            },
          };
        });
      } catch (err: unknown) {
        const message = getErrorMessage(err, 'Erro ao adicionar sistema');
        setError(message);
        console.error('[useProfile] Erro ao adicionar sistema:', err);
      }
    },
    [isAuthenticated]
  );

  const removeSystem = useCallback(
    async (id: string) => {
      if (!isAuthenticated) return;

      try {
        await api.delete(`/api/v1/profile/me/systems/${id}`);
        
        setProfile((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            systems: {
              favorite: prev.systems.favorite.filter((s) => s.id !== id),
              gm: prev.systems.gm.filter((s) => s.id !== id),
            },
          };
        });
      } catch (err: unknown) {
        const message = getErrorMessage(err, 'Erro ao remover sistema');
        setError(message);
        console.error('[useProfile] Erro ao remover sistema:', err);
      }
    },
    [isAuthenticated]
  );

  return {
    profile,
    loading,
    saving,
    error,
    updateUser,
    updateProfile,
    updatePlayer,
    updateGm,
    addSystem,
    removeSystem,
    refetch: fetchProfile,
  };
}
