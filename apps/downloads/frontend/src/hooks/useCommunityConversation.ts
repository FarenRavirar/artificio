import { useCallback, useMemo, useState } from 'react';
// Lógica pura vem do ROOT; só o que depende de React sai de `/react`. A
// separação é a trava do requisito 21b (`packageBoundary.test.ts`): importar
// `createCommentsClient` de `/react` funcionaria, mas apagaria a fronteira que
// mantém o root utilizável em backend e SSR.
import {
  createCommentsClient,
  createCommentsConversationClient,
  createCommentsResource,
  mergeCommentsThreadPage,
  type CommentSortUi,
  type CommentsThread,
  type CommentsTransportRequest,
  type ConversationMoreNode,
} from '@artificio/comments';
import { useCommentsResource } from '@artificio/comments/react';

/**
 * T5.4 (spec 090) — host da conversa no `downloads`.
 *
 * ## O contrato de quem chama o quê
 *
 * O pacote não conhece URL, cookie nem credencial (`transport.ts`): ele define
 * capacidades (`thread.read`, `comment.create`, …) e o host as liga à fachada
 * do próprio app. Aqui elas viram chamadas same-origin para
 * `/api/v1/community/conversation`, com `credentials: 'include'` — o navegador
 * **nunca** alcança `/internal/v1` (requisito 6a), e a credencial de serviço
 * vive só no backend.
 *
 * ## Por que não React Query, sendo que o resto do app usa
 *
 * Estado de conversa é do `CommentsResource` (T4.6): ele guarda a última
 * leitura boa e degrada para `stale`/`unavailable` sozinho, com a chave incluindo
 * a identidade da conta (T4.7) — coisas que teriam de ser reconstruídas sobre
 * React Query e divergiriam do que os outros dois consumidores fazem. A
 * moderação usa React Query porque lá o contrato é de listas paginadas comuns.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL ?? '';
const CONVERSATION_PATH = '/api/v1/community/conversation';

/** `subject_type` do módulo (`materialSubjectGuard.ts`, mesmo literal). */
export const DOWNLOADS_SUBJECT_TYPE = 'downloads.material';

export class ConversationApiError extends Error {
  readonly status: number;
  readonly payload: unknown;

  constructor(status: number, payload: unknown) {
    super(`Falha na conversa: HTTP ${status}`);
    this.name = 'ConversationApiError';
    this.status = status;
    this.payload = payload;
  }
}

interface RouteCall {
  readonly path: string;
  readonly method: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT';
  readonly body?: unknown;
}

/**
 * Traduz capacidade → rota da fachada. É o único lugar do frontend que conhece
 * caminho de comentário; o componente fala por capacidade.
 */
function routeFor(request: CommentsTransportRequest): RouteCall {
  const input = request.input as Record<string, unknown>;

  switch (request.capability) {
    case 'thread.read': {
      const query = new URLSearchParams({ subject_id: String(input.subjectId) });
      if (typeof input.sort === 'string') query.set('sort', input.sort);
      if (typeof input.cursor === 'string') query.set('cursor', input.cursor);
      return { path: `${CONVERSATION_PATH}?${query.toString()}`, method: 'GET' };
    }
    case 'comment.create':
      return {
        path: CONVERSATION_PATH,
        method: 'POST',
        body: { subject_id: input.subjectId, body_markdown: input.bodyMarkdown },
      };
    case 'comment.reply':
      return {
        path: `${CONVERSATION_PATH}/${encodeURIComponent(String(input.commentId))}/replies`,
        method: 'POST',
        body: { subject_id: input.subjectId, body_markdown: input.bodyMarkdown },
      };
    case 'comment.edit':
      return {
        path: `${CONVERSATION_PATH}/${encodeURIComponent(String(input.commentId))}`,
        method: 'PATCH',
        body: { body_markdown: input.bodyMarkdown },
      };
    case 'comment.withdraw':
      return {
        path: `${CONVERSATION_PATH}/${encodeURIComponent(String(input.commentId))}`,
        method: 'DELETE',
      };
    case 'vote.set':
      return {
        path: `${CONVERSATION_PATH}/${encodeURIComponent(String(input.commentId))}/vote`,
        method: 'PUT',
        body: { value: input.value },
      };
    case 'report.create':
      return {
        path: `/api/v1/community/comments/${encodeURIComponent(String(input.commentId))}/reports`,
        method: 'POST',
        body: { reason_code: input.reasonCode, details: input.details },
      };
    default:
      throw new Error(`Capacidade não roteada: ${request.capability}`);
  }
}

const transport = {
  async execute(request: CommentsTransportRequest): Promise<unknown> {
    const route = routeFor(request);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    // A chave vem do pacote, que a recebe de quem dispara a ação — é o que faz
    // a retentativa do mesmo envio não duplicar a fala (`transport.ts:59-68`).
    if (request.idempotencyKey) headers['Idempotency-Key'] = request.idempotencyKey;

    const response = await fetch(`${API_BASE_URL}${route.path}`, {
      method: route.method,
      credentials: 'include',
      headers,
      body: route.body === undefined ? undefined : JSON.stringify(route.body),
      // O `AbortSignal` vem do cliente do pacote, que já aplica o timeout de 8s
      // e o cancelamento por troca de consulta. Criar outro aqui daria dois
      // relógios para a mesma requisição.
      signal: request.signal,
    });

    if (response.status === 204) return undefined;

    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) throw new ConversationApiError(response.status, payload);
    return payload;
  },
};

const commentsClient = createCommentsClient({ transport });

export interface UseCommunityConversationOptions {
  readonly materialId: string;
  /** Identidade da conta; `undefined` quando anônimo. Entra na chave do cache. */
  readonly userId?: string;
  readonly realm?: 'beta' | 'prod';
}

/**
 * Monta resource, client e paginação de `more` para uma ficha de material.
 *
 * O resource é criado **por assunto e identidade** (T4.7): trocar de conta ou de
 * material descarta o que estava em memória, em vez de mostrar a conversa da
 * sessão anterior.
 */
export function useCommunityConversation({
  materialId,
  userId,
  realm = 'prod',
}: UseCommunityConversationOptions) {
  const [sort, setSort] = useState<CommentSortUi>('best');

  const subject = useMemo(
    () => ({ subjectType: DOWNLOADS_SUBJECT_TYPE, subjectId: materialId }),
    [materialId],
  );

  const client = useMemo(
    () => createCommentsConversationClient(commentsClient, subject),
    [subject],
  );

  /**
   * O resource é recriado quando a ordenação muda, e isso é deliberado.
   *
   * A alternativa seria manter o sort fora das dependências, lido por ref
   * dentro do `load` — mas ler ou escrever ref durante o render é proibido
   * pelas regras do React (`Cannot access refs during render`), e o valor
   * devolvido por `useMemo` é tratado como imutável pelo compilador
   * (`This value cannot be modified`). As duas tentativas foram reprovadas pelo
   * lint antes de chegar aqui.
   *
   * O custo real é pequeno: trocar de ordenação **já invalida** a lista
   * anterior — a árvore vem em outra ordem, com outro cursor. O que se perde é
   * o `stale` da ordenação antiga, que não serviria para desenhar a nova.
   */
  const resource = useMemo(
    () => createCommentsResource<CommentsThread>({
      identity: {
        realm,
        sourceApp: 'downloads',
        subjectType: subject.subjectType,
        subjectId: subject.subjectId,
        // A conversa é pública; a identidade entra na chave só quando há
        // sessão, para que `my_vote` de uma conta não sobreviva à troca para
        // outra.
        visibility: userId ? 'private' : 'public',
        userId,
      },
      load: (signal) => client.read(sort, undefined, signal),
    }),
    [client, realm, sort, subject, userId],
  );

  const state = useCommentsResource(resource);

  // `changeSort` só troca o estado: o resource novo (com o sort novo no `load`)
  // nasce no render seguinte e o `useCommentsResource` dispara `load()` sozinho
  // via `autoLoad`. Chamar `resource.load()` aqui consultaria o resource
  // ANTIGO, com a ordenação anterior — a lista voltaria errada e só acertaria
  // no clique seguinte.
  const changeSort = useCallback((next: CommentSortUi) => {
    setSort(next);
  }, []);

  const reload = useCallback(() => {
    void resource.load();
  }, [resource]);

  /**
   * Incorpora uma página de `more`. A mesclagem é do pacote
   * (`mergeCommentsThreadPage`), que recusa misturar revisões diferentes — se o
   * snapshot mudou, o certo é recarregar do zero, não colar páginas
   * incompatíveis.
   */
  const [pages, setPages] = useState<CommentsThread | null>(null);
  const loadMore = useCallback(async (page: CommentsThread, request: ConversationMoreNode) => {
    const current = pages ?? state.data;
    if (!current) return;
    try {
      setPages(mergeCommentsThreadPage(current, page, request.cursor));
    } catch {
      // Revisão divergente: recarrega em vez de exibir árvore inconsistente.
      setPages(null);
      void resource.load();
    }
  }, [pages, resource, state.data]);

  // A página mesclada só vale enquanto o resource não trouxer leitura nova.
  const effectiveState = useMemo(() => {
    if (!pages || state.status === 'unavailable') return state;
    if (state.data && state.data.snapshot_revision !== pages.snapshot_revision) return state;
    return { ...state, data: pages } as typeof state;
  }, [pages, state]);

  return { state: effectiveState, sort, changeSort, client, loadMore, reload, resource };
}
