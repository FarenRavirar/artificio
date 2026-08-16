import { useCallback, useMemo, useState } from 'react';
/**
 * Tudo vem de `/react`, e **não** do root — ao contrário do `downloads`.
 *
 * O barrel `.` reexporta `treeCursor.js`, que importa `node:crypto` (assinatura
 * de cursor é código de servidor). O Vite do `downloads` externaliza `node:*` e
 * engole isso; o build do Astro não, e falha com `"createHmac" is not exported
 * by "__vite-browser-external"` — medido em 2026-08-16.
 *
 * O subpath `/react` é o browser-safe do pacote e passou a reexportar as
 * funções de runtime justamente por isso (`packages/comments/src/react.ts`). A
 * fronteira do requisito 21b continua de pé: o root segue livre de React, para
 * o backend e o Astro server-side poderem consumi-lo.
 */
import {
  createCommentsClient,
  createCommentsConversationClient,
  createCommentsResource,
  mergeCommentsThreadPage,
  useCommentsResource,
  type CommentSortUi,
  type CommentsThread,
  type CommentsTransportRequest,
  type ConversationMoreNode,
} from '@artificio/comments/react';

/**
 * T6.4 (spec 090) — host da conversa no `site`.
 *
 * ## O que muda em relação ao `downloads`
 *
 * A fachada é a mesma ideia (`/api/v1/community/conversation`, same-origin,
 * `credentials: 'include'`), mas a **página é estática**: o blog é SSG e o
 * `subject_id` vem do `getStaticPaths`, gravado no HTML em tempo de build. Por
 * isso ele entra como parâmetro em vez de vir de rota do React — não existe
 * roteador no cliente para lê-lo.
 *
 * O `realm` também não pode ser inferido do bundle: o mesmo `dist` do Astro é
 * publicado em beta e em produção. Ele chega do servidor via atributo da ilha.
 */

const CONVERSATION_PATH = '/api/v1/community/conversation';

/** `subject_type` do módulo (`postSubjectGuard.ts`, mesmo literal). */
export const SITE_SUBJECT_TYPE = 'site.post';

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

    const response = await fetch(route.path, {
      method: route.method,
      credentials: 'include',
      headers,
      body: route.body === undefined ? undefined : JSON.stringify(route.body),
      // O `AbortSignal` vem do cliente do pacote, que já aplica o timeout de 8s
      // e o cancelamento por troca de consulta.
      signal: request.signal,
    });

    if (response.status === 204) return undefined;

    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) throw new ConversationApiError(response.status, payload);
    return payload;
  },
};

const commentsClient = createCommentsClient({ transport });

export interface UseSiteConversationOptions {
  /** `String(post.id)` — vem do `getStaticPaths`, gravado no HTML no build. */
  readonly postId: string;
  /** Identidade da conta; `undefined` quando anônimo. Entra na chave do cache. */
  readonly userId?: string;
  readonly realm?: 'beta' | 'prod';
}

export function useSiteConversation({ postId, userId, realm = 'prod' }: UseSiteConversationOptions) {
  const [sort, setSort] = useState<CommentSortUi>('best');

  const subject = useMemo(
    () => ({ subjectType: SITE_SUBJECT_TYPE, subjectId: postId }),
    [postId],
  );

  const client = useMemo(
    () => createCommentsConversationClient(commentsClient, subject),
    [subject],
  );

  /**
   * O resource é recriado quando a ordenação muda, e isso é deliberado: trocar
   * de ordenação já invalida a lista anterior (outra ordem, outro cursor). O
   * que se perde é o `stale` da ordenação antiga, que não serviria para
   * desenhar a nova.
   */
  const resource = useMemo(
    () => createCommentsResource<CommentsThread>({
      identity: {
        realm,
        sourceApp: 'site',
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

  // `changeSort` só troca o estado: o resource novo nasce no render seguinte e
  // o `useCommentsResource` dispara `load()` sozinho via `autoLoad`.
  const changeSort = useCallback((next: CommentSortUi) => {
    setSort(next);
  }, []);

  const reload = useCallback(() => {
    void resource.load();
  }, [resource]);

  /**
   * As páginas de `more` carregam a **identidade** que as produziu, não só o
   * conteúdo: `snapshot_revision` é por assunto, e dois posts recém-importados
   * começam ambos em revisão baixa. Sem a chave, trocar de post manteria as
   * páginas do anterior e, quando as revisões coincidissem, a conversa antiga
   * apareceria no post novo — indistinguível de dado real.
   */
  const pagesKey = `${realm}|${subject.subjectType}|${subject.subjectId}|${userId ?? ''}|${sort}`;
  const [pages, setPages] = useState<{ key: string; thread: CommentsThread } | null>(null);
  const validPages = pages?.key === pagesKey ? pages.thread : null;

  const loadMore = useCallback(async (page: CommentsThread, request: ConversationMoreNode) => {
    const current = validPages ?? state.data;
    if (!current) return;
    try {
      setPages({ key: pagesKey, thread: mergeCommentsThreadPage(current, page, request.cursor) });
    } catch {
      // Revisão divergente: recarrega em vez de exibir árvore inconsistente.
      setPages(null);
      void resource.load();
    }
  }, [pagesKey, resource, state.data, validPages]);

  // A página mesclada só vale enquanto o resource não trouxer leitura nova.
  const effectiveState = useMemo(() => {
    if (!validPages || state.status === 'unavailable') return state;
    if (state.data && state.data.snapshot_revision !== validPages.snapshot_revision) return state;
    return { ...state, data: validPages } as typeof state;
  }, [validPages, state]);

  return { state: effectiveState, sort, changeSort, client, loadMore, reload, resource };
}
