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

export type AddLinkResult =
  | { ok: true; link: UserLink }
  | { ok: false; error: string };

interface UseLinksReturn {
  links: UserLink[];
  loading: boolean;
  error: string | null;
  addLink: (url: string) => Promise<AddLinkResult>;
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

/**
 * Estado COMPARTILHADO entre todas as instâncias do hook (spec 099, fase G).
 *
 * Antes cada `useLinks()` guardava a própria lista em `useState`, e
 * `addLink`/`removeLink` atualizavam só a instância que chamou. Enquanto havia
 * um consumidor por tela isso não aparecia; a fase G criou o segundo — a
 * lateral do editor conta os links para a pendência de "Onde te achar",
 * enquanto o `LinksManager` é quem adiciona. O mestre adicionava um link, a
 * lista crescia e o contador ao lado não mexia até recarregar a página, que é
 * exatamente o "número cai ao preencher, sem recarregar" que o A12 promete.
 * Achado do Codex na PR #304.
 *
 * Store de módulo em vez de contexto novo: o contrato público do hook não
 * muda, então os consumidores existentes (`LinksManager`, `PainelMestrePage`)
 * seguem sem alteração. Os assinantes são notificados a cada escrita.
 */
let sharedLinks: UserLink[] = [];
const linkSubscribers = new Set<(links: UserLink[]) => void>();

/**
 * Geração do store: sobe a cada escrita autoritativa (mutação ou GET novo).
 *
 * Existe porque o estado agora é COMPARTILHADO e há mais de uma instância na
 * mesma tela — o `LinksManager` e a lateral que conta. Cada uma dispara o
 * próprio GET na montagem, e um GET lento que responde DEPOIS de um `addLink`
 * bem-sucedido devolveria a lista antiga por cima da nova: o link que o mestre
 * acabou de criar sumiria da tela sem erro nenhum, e ele só o veria de volta ao
 * recarregar. Com estado local por instância isso não acontecia, porque o GET
 * atrasado só sujava a própria cópia.
 *
 * Cada requisição guarda a geração em que nasceu e só publica se nada mais
 * autoritativo tiver acontecido no meio.
 */
let linksGeneration = 0;

function publishLinks(next: UserLink[]): void {
  linksGeneration += 1;
  sharedLinks = next;
  for (const notify of linkSubscribers) notify(next);
}

/** Publica só se a geração de origem ainda for a corrente (ver acima). */
function publishLinksIfCurrent(next: UserLink[], generation: number): void {
  if (generation !== linksGeneration) return;
  publishLinks(next);
}

export function useLinks(): UseLinksReturn {
  const { isAuthenticated } = useAuth();
  const [links, setLocalLinks] = useState<UserLink[]>(sharedLinks);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cada instância espelha o store; a escrita passa por `publishLinks`, que
  // avisa todas as outras.
  //
  // Sem `setLocalLinks(sharedLinks)` aqui: o `useState` acima já inicializa com
  // o valor do store, então repetir a leitura no efeito só encadearia um render
  // extra em toda montagem (`react-hooks/set-state-in-effect`). Escrita entre a
  // montagem e este efeito não se perde — ela passa por `publishLinks`, que
  // atualiza `sharedLinks` antes de notificar, e o próximo assinante já lê o
  // valor novo.
  useEffect(() => {
    linkSubscribers.add(setLocalLinks);
    return () => {
      linkSubscribers.delete(setLocalLinks);
    };
  }, []);

  const setLinks = useCallback(
    (update: UserLink[] | ((prev: UserLink[]) => UserLink[])) => {
      publishLinks(typeof update === 'function' ? update(sharedLinks) : update);
    },
    [],
  );

  const fetchLinks = useCallback(async () => {
    if (!isAuthenticated) {
      setLinks([]);
      setLoading(false);
      return;
    }

    // Geração em que ESTE GET nasceu: se uma mutação (ou um GET mais novo)
    // publicar enquanto ele está em voo, a resposta que chegar depois já não é
    // autoritativa e é descartada — senão o link recém-criado sumiria da tela.
    const generation = linksGeneration;

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
      publishLinksIfCurrent(normalizeLinksPayload(data), generation);
    } catch (err: unknown) {
      console.error('Error fetching links:', err);
      setError(getErrorMessage(err, 'Erro ao carregar links'));
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, setLinks]);

  useEffect(() => {
    void (async () => { await fetchLinks(); })();
  }, [fetchLinks]);

  const addLink = useCallback(
    async (url: string): Promise<AddLinkResult> => {
      if (!isAuthenticated) {
        return { ok: false, error: 'Sessao expirada. Entre novamente para adicionar links.' };
      }

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
        return { ok: true, link: newLink };
      } catch (err: unknown) {
        console.error('Error adding link:', err);
        // Canal unico: a falha volta SO no resultado, para o LinksManager
        // guardar em `addError` e renderizar junto do formulario. Nao setamos
        // o `error` do hook aqui — ele alimenta outro bloco de render (a
        // mensagem de carregamento da lista), e escrever nos dois fazia a
        // mesma falha aparecer duas vezes na tela (achado Codex, PR #285).
        // O retorno carrega a mensagem real porque o state e assincrono e
        // ainda nao estaria atualizado quando o chamador le o resultado — foi
        // por isso que o painel mostrava sempre "Verifique a URL" para um 500.
        return { ok: false, error: getErrorMessage(err, 'Erro ao adicionar link') };
      }
    },
    [isAuthenticated, setLinks]
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
    [isAuthenticated, setLinks]
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
    [isAuthenticated, links, setLinks]
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
