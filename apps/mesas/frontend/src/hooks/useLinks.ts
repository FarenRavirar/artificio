import { useState, useEffect, useCallback, useSyncExternalStore } from 'react';
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
const linkSubscribers = new Set<() => void>();

/**
 * Dono do que está no store. O logout NÃO recarrega a página — `AuthContext`
 * só limpa o estado React (`clearSession`), e um store de módulo sobrevive a
 * isso. Sem dono, os links da conta anterior continuavam publicados: bastava o
 * GET da conta nova falhar (rede, 500) para o `LinksManager` seguir mostrando
 * o YouTube e o Twitch de OUTRA pessoa, com botão de remover ao lado.
 * Achado do CodeRabbit na PR #304.
 *
 * `null` = store vazio/sem dono. A troca de dono limpa antes de qualquer
 * requisição da conta nova responder.
 */
let sharedLinksOwner: string | null = null;

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

function publishLinks(next: UserLink[], owner: string | null = sharedLinksOwner): void {
  linksGeneration += 1;
  sharedLinks = next;
  sharedLinksOwner = owner;
  for (const notify of linkSubscribers) notify();
}

/** Assinatura do store para o `useSyncExternalStore` (uma por instância). */
function subscribeToLinks(onStoreChange: () => void): () => void {
  linkSubscribers.add(onStoreChange);
  return () => {
    linkSubscribers.delete(onStoreChange);
  };
}

/**
 * Troca de dono: esvazia o store ANTES de qualquer requisição da conta nova.
 *
 * Roda no CORPO DO RENDER, não num efeito, porque efeito só executa depois da
 * primeira pintura — e essa pintura já teria mostrado os links da conta
 * anterior. Por isso a função NÃO notifica assinantes: avisar outro componente
 * durante o render deste é o que o React proíbe. Ela só zera o módulo e sobe a
 * geração (descartando GET da conta antiga ainda em voo); cada instância lê o
 * store zerado no próprio render, que é o efeito desejado.
 *
 * Devolve `true` quando de fato limpou, para o chamador se realinhar.
 */
function resetLinksOwnerIfChanged(owner: string | null): boolean {
  if (sharedLinksOwner === owner) return false;
  linksGeneration += 1;
  sharedLinks = [];
  sharedLinksOwner = owner;
  return true;
}

/** Publica só se a geração de origem ainda for a corrente (ver acima). */
function publishLinksIfCurrent(next: UserLink[], generation: number, owner: string | null): void {
  if (generation !== linksGeneration) return;
  publishLinks(next, owner);
}

export function useLinks(): UseLinksReturn {
  const { isAuthenticated, user } = useAuth();
  const owner = isAuthenticated ? user?.id ?? null : null;
  // Antes de ler o store: se o dono mudou (login, logout, troca de conta), o
  // que está lá é de outra pessoa e é esvaziado agora — não num efeito, que só
  // roda depois de a lista alheia já ter sido pintada.
  resetLinksOwnerIfChanged(owner);

  // `useSyncExternalStore` é a primitiva do React para exatamente este caso:
  // estado que vive FORA do React e é lido por várias instâncias. Substituiu um
  // par `useState` + assinatura manual em que o valor do estado não era lido —
  // o render usava o store direto, e o `useState` só servia de gatilho
  // (achado do Sonar na PR #304: "useState não desestruturado em valor + setter").
  //
  // Lê-se o store, e não uma cópia local, porque toda escrita passa por
  // `publishLinks`: ele atualiza `sharedLinks` ANTES de notificar, então o store
  // nunca está atrás. Depois de uma troca de dono ele é o único dos dois que
  // está certo — instâncias montadas antes da troca guardariam a lista da conta
  // anterior, e o `LinksManager` seguiria pintando os links de outra pessoa até
  // um GET responder, justamente no caso em que esse GET falha.
  const visibleLinks = useSyncExternalStore(subscribeToLinks, () => sharedLinks);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const setLinks = useCallback(
    (update: UserLink[] | ((prev: UserLink[]) => UserLink[])) => {
      publishLinks(typeof update === 'function' ? update(sharedLinks) : update);
    },
    [],
  );

  const fetchLinks = useCallback(async () => {
    if (!isAuthenticated) {
      publishLinks([], null);
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
      publishLinksIfCurrent(normalizeLinksPayload(data), generation, owner);
    } catch (err: unknown) {
      console.error('Error fetching links:', err);
      setError(getErrorMessage(err, 'Erro ao carregar links'));
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, owner]);

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

        // Reordena a partir do estado CORRENTE, não do `links` capturado quando
        // a requisição começou: um `addLink` que termine enquanto o reorder está
        // em voo criaria um link cujo id não está em `linkIds`, e reconstruir a
        // lista só a partir de `linkIds` o apagaria da tela — o mesmo sumiço
        // silencioso que a geração resolveu para o GET atrasado. Os ids
        // conhecidos assumem a ordem pedida; os que chegaram depois ficam no
        // fim, preservados. Achado do CodeRabbit na PR #304.
        setLinks((prev) => {
          const byId = new Map(prev.map((link) => [link.id, link]));
          const ordered = linkIds
            .map((id) => byId.get(id))
            .filter((link): link is UserLink => link !== undefined);
          const orderedIds = new Set(ordered.map((link) => link.id));
          const untouched = prev.filter((link) => !orderedIds.has(link.id));
          return [...ordered, ...untouched];
        });
        return true;
      } catch (err: unknown) {
        console.error('Error reordering links:', err);
        setError(getErrorMessage(err, 'Erro ao reordenar links'));
        return false;
      }
    },
    // `links` saiu da dep: o updater lê o estado corrente por conta própria.
    [isAuthenticated, setLinks]
  );

  const refresh = useCallback(async () => {
    await fetchLinks();
  }, [fetchLinks]);

  return {
    links: visibleLinks,
    loading,
    error,
    addLink,
    removeLink,
    reorderLinks,
    refresh,
  };
}
