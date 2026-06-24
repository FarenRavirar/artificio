import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/useAuth';
import { authGet, authPost, authPatch, authDelete } from '../utils/authenticatedFetch';

export interface UserLink {
  id: string;
  user_id: string;
  url: string;
  type: 'youtube' | 'spotify' | 'twitch' | 'twitter' | 'article' | 'website';
  title: string | null;
  description: string | null;
  thumbnail_url: string | null;
  sort_order: number;
  embed_url?: string;
  created_at: string;
  updated_at: string;
}

interface UseLinksReturn {
  links: UserLink[];
  loading: boolean;
  error: string | null;
  addLink: (url: string) => Promise<UserLink | null>;
  removeLink: (linkId: string) => Promise<boolean>;
  reorderLinks: (linkIds: string[]) => Promise<boolean>;
  refresh: () => Promise<void>;
}

async function readApiError(response: Response, fallback: string): Promise<string> {
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    try {
      const data = await response.json();
      return data?.error || data?.message || fallback;
    } catch {
      return fallback;
    }
  }

  try {
    const text = await response.text();
    if (text.trim().startsWith('<!doctype') || text.trim().startsWith('<html')) {
      return fallback;
    }
    return text.slice(0, 200) || fallback;
  } catch {
    return fallback;
  }
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function isUserLink(value: unknown): value is UserLink {
  if (typeof value !== 'object' || value === null) return false;
  const link = value as Partial<UserLink>;
  return (
    typeof link.id === 'string' &&
    typeof link.user_id === 'string' &&
    typeof link.url === 'string' &&
    typeof link.type === 'string' &&
    typeof link.created_at === 'string' &&
    typeof link.updated_at === 'string'
  );
}

function normalizeLinksPayload(payload: unknown): UserLink[] {
  if (typeof payload !== 'object' || payload === null || !('data' in payload)) return [];
  const data = (payload as { data: unknown }).data;
  return Array.isArray(data) ? data.filter(isUserLink) : [];
}

function normalizeLinkPayload(payload: unknown): UserLink | null {
  if (typeof payload !== 'object' || payload === null || !('data' in payload)) return null;
  const data = (payload as { data: unknown }).data;
  return isUserLink(data) ? data : null;
}

export function useLinks(): UseLinksReturn {
  const { isAuthenticated } = useAuth();
  const [links, setLinks] = useState<UserLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLinks = useCallback(async () => {
    if (!isAuthenticated) {
      setLinks([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const res = await authGet('/api/v1/profile/links');

      if (!res.ok) {
        const message = await readApiError(res, 'Erro ao carregar links');
        throw new Error(message);
      }

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error('Resposta inválida do servidor ao carregar links');
      }

      const data: unknown = await res.json();
      setLinks(normalizeLinksPayload(data));
    } catch (err: unknown) {
      console.error('Error fetching links:', err);
      setError(getErrorMessage(err, 'Erro ao carregar links'));
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    void (async () => { await fetchLinks(); })();
  }, [fetchLinks]);

  const addLink = useCallback(
    async (url: string): Promise<UserLink | null> => {
      if (!isAuthenticated) return null;

      try {
        setError(null);

        const res = await authPost('/api/v1/profile/links', { url });

        if (!res.ok) {
          const message = await readApiError(res, 'Erro ao adicionar link');
          throw new Error(message);
        }

        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          throw new Error('Resposta inválida do servidor ao adicionar link');
        }

        const data: unknown = await res.json();
        const newLink = normalizeLinkPayload(data);
        if (!newLink) {
          throw new Error('Resposta inválida do servidor ao adicionar link');
        }

        setLinks((prev) => [...prev, newLink]);
        return newLink;
      } catch (err: unknown) {
        console.error('Error adding link:', err);
        setError(getErrorMessage(err, 'Erro ao adicionar link'));
        return null;
      }
    },
    [isAuthenticated]
  );

  const removeLink = useCallback(
    async (linkId: string): Promise<boolean> => {
      if (!isAuthenticated) return false;

      try {
        setError(null);

        const res = await authDelete(`/api/v1/profile/links/${linkId}`);

        if (!res.ok) {
          const message = await readApiError(res, 'Erro ao remover link');
          throw new Error(message);
        }

        setLinks((prev) => prev.filter((link) => link.id !== linkId));
        return true;
      } catch (err: unknown) {
        console.error('Error removing link:', err);
        setError(getErrorMessage(err, 'Erro ao remover link'));
        return false;
      }
    },
    [isAuthenticated]
  );

  const reorderLinks = useCallback(
    async (linkIds: string[]): Promise<boolean> => {
      if (!isAuthenticated) return false;

      try {
        setError(null);

        const res = await authPatch('/api/v1/profile/links/reorder', { linkIds });

        if (!res.ok) {
          const message = await readApiError(res, 'Erro ao reordenar links');
          throw new Error(message);
        }

        // Atualizar ordem local
        const reordered = linkIds
          .map((id) => links.find((link) => link.id === id))
          .filter((link): link is UserLink => link !== undefined);

        setLinks(reordered);
        return true;
      } catch (err: unknown) {
        console.error('Error reordering links:', err);
        setError(getErrorMessage(err, 'Erro ao reordenar links'));
        return false;
      }
    },
    [isAuthenticated, links]
  );

  const refresh = useCallback(async () => {
    await fetchLinks();
  }, [fetchLinks]);

  return {
    links,
    loading,
    error,
    addLink,
    removeLink,
    reorderLinks,
    refresh,
  };
}
