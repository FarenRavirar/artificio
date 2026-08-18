import { useCallback, useMemo, useRef, useState } from 'react';

import {
  createCommentsClient,
  type CommentsTransportRequest,
} from './transport.js';
import { createCommentsResource } from './resource.js';
import {
  createCommentsConversationClient,
  mergeCommentsThreadPage,
  type CommentSortUi,
  type CommentsThread,
  type ConversationMoreNode,
} from './conversation.js';
import { useCommentsResource } from './react.js';

/**
 * Host da conversa — resource, client, paginação de `more` e recarga.
 *
 * ## Por que `.tsx` num arquivo sem JSX
 *
 * `packageBoundary.test.ts:52` varre **todo `.ts` da raiz de `src`** (exceto
 * `react.ts`) e recusa `import … from 'react'` — é a trava do requisito 21b,
 * que mantém o root do pacote utilizável em backend e SSR. Todo código React
 * daqui usa `.tsx` por isso, com JSX ou sem. Renomear este arquivo para `.ts`
 * quebra a suíte, e a mensagem de erro não diz o motivo.
 *
 * ## Por que isto vive no pacote, e não copiado em cada app
 *
 * `downloads` e `site` tinham a mesma implementação duplicada (72,9% de linhas
 * idênticas, medido pelo Sonar na PR #264). A duplicação não era só custo de
 * manutenção: as correções de review aplicadas no `site` — `reload` assíncrono
 * que descarta páginas mescladas, e `setPages` funcional — **não chegaram ao
 * `downloads`**, que ficou com os dois defeitos em produção. Duas cópias da
 * mesma lógica divergem no primeiro fix que só uma recebe, e foi exatamente o
 * que aconteceu.
 *
 * O que muda entre módulos é pouco e entra por parâmetro: `subjectType`,
 * `sourceApp`, o caminho da fachada e o `baseUrl` (o `downloads` tem
 * `VITE_API_URL`; o `site` fala same-origin). O resto — roteamento por
 * capacidade, transporte, chave de identidade, mesclagem de página — é o mesmo
 * contrato para todos, e é o que o `mesas` herda na Fase 7 sem uma terceira
 * cópia.
 */

/** Árvore acumulada por `more`, carimbada com a identidade que a produziu. */
type PaginaMesclada = { key: string; thread: CommentsThread } | null;

interface RouteCall {
  readonly path: string;
  readonly method: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT';
  readonly body?: unknown;
}

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

export interface ConversationHostConfig {
  /** `subject_type` do módulo — o mesmo literal do guard do backend. */
  readonly subjectType: string;
  /** Entra na chave do cache do resource, junto de realm e identidade. */
  readonly sourceApp: string;
  /** Caminho da fachada same-origin (ex.: `/api/v1/community/conversation`). */
  readonly conversationPath: string;
  /** Caminho da denúncia, que vive sob o prefixo de moderação. */
  readonly reportPath: (commentId: string) => string;
  /**
   * Prefixo de URL. Vazio para same-origin (o `site`); o `downloads` passa
   * `VITE_API_URL` porque frontend e backend são origens distintas lá.
   */
  readonly baseUrl?: string;
}

/**
 * Traduz capacidade → rota da fachada. É o único lugar do frontend que conhece
 * caminho de comentário; o componente fala por capacidade.
 */
function routeFor(request: CommentsTransportRequest, config: ConversationHostConfig): RouteCall {
  const input = request.input as Record<string, unknown>;
  const { conversationPath } = config;

  switch (request.capability) {
    case 'thread.read': {
      const query = new URLSearchParams({ subject_id: String(input.subjectId) });
      if (typeof input.sort === 'string') query.set('sort', input.sort);
      if (typeof input.cursor === 'string') query.set('cursor', input.cursor);
      return { path: `${conversationPath}?${query.toString()}`, method: 'GET' };
    }
    case 'comment.create':
      return {
        path: conversationPath,
        method: 'POST',
        body: { subject_id: input.subjectId, body_markdown: input.bodyMarkdown },
      };
    case 'comment.reply':
      return {
        path: `${conversationPath}/${encodeURIComponent(String(input.commentId))}/replies`,
        method: 'POST',
        body: { subject_id: input.subjectId, body_markdown: input.bodyMarkdown },
      };
    case 'comment.edit':
      return {
        path: `${conversationPath}/${encodeURIComponent(String(input.commentId))}`,
        method: 'PATCH',
        body: { body_markdown: input.bodyMarkdown },
      };
    case 'comment.withdraw':
      return {
        path: `${conversationPath}/${encodeURIComponent(String(input.commentId))}`,
        method: 'DELETE',
      };
    case 'vote.set':
      return {
        path: `${conversationPath}/${encodeURIComponent(String(input.commentId))}/vote`,
        method: 'PUT',
        body: { value: input.value },
      };
    case 'report.create':
      return {
        path: config.reportPath(String(input.commentId)),
        method: 'POST',
        body: { reason_code: input.reasonCode, details: input.details },
      };
    // Retirada por moderador global. Diferente das anteriores, o caminho NÃO
    // entra por `config`: a fachada de moderação é a mesma literal nos três
    // apps (`mesas/routes/communityModeration.ts:160`,
    // `downloads/.../communityModeration.ts:116`), montada a partir do molde
    // comum. Torná-la parâmetro convidaria a terceira divergência por app que
    // este arquivo existe para evitar.
    case 'moderation.remove':
      return {
        path: `/api/v1/community/moderation/comments/${encodeURIComponent(String(input.commentId))}/removal`,
        method: 'POST',
        body: { reason: input.reason },
      };
    case 'moderation.restore':
      return {
        path: `/api/v1/community/moderation/comments/${encodeURIComponent(String(input.commentId))}/restore`,
        method: 'POST',
        body: { reason: input.reason },
      };
    default:
      throw new Error(`Capacidade não roteada: ${request.capability}`);
  }
}

/**
 * Cria o client HTTP do módulo. Fica fora do hook de propósito: o host o
 * constrói **uma vez** no escopo do módulo, e não a cada render.
 */
export function createConversationTransport(config: ConversationHostConfig) {
  const baseUrl = config.baseUrl ?? '';

  return createCommentsClient({
    transport: {
      async execute(request: CommentsTransportRequest): Promise<unknown> {
        const route = routeFor(request, config);
        // `Content-Type` só quando há corpo: declará-lo em `GET`/`DELETE`
        // descreve um payload que não existe, e é o que faz uma requisição
        // simples virar preflighted em CORS — irrelevante no `site`, que é
        // same-origin, mas não no `downloads`, onde frontend e backend são
        // origens distintas. A fachada do backend já segue essa regra
        // (`communityComments.ts`, `isBodyless`).
        const headers: Record<string, string> = {};
        if (route.body !== undefined) headers['Content-Type'] = 'application/json';
        // A chave vem de quem dispara a ação — é o que faz a retentativa do
        // mesmo envio não duplicar a fala (`transport.ts:59-68`).
        if (request.idempotencyKey) headers['Idempotency-Key'] = request.idempotencyKey;

        const response = await fetch(`${baseUrl}${route.path}`, {
          method: route.method,
          credentials: 'include',
          headers,
          body: route.body === undefined ? undefined : JSON.stringify(route.body),
          // O `AbortSignal` vem do cliente do pacote, que já aplica o timeout de
          // 8s e o cancelamento por troca de consulta. Criar outro aqui daria
          // dois relógios para a mesma requisição.
          signal: request.signal,
        });

        if (response.status === 204) return undefined;

        const payload: unknown = await response.json().catch(() => null);
        if (!response.ok) throw new ConversationApiError(response.status, payload);
        return payload;
      },
    },
  });
}

export interface UseConversationHostOptions {
  /** `subject_id` do assunto — id do material, do post ou da mesa. */
  readonly subjectId: string;
  /** Identidade da conta; `undefined` quando anônimo. Entra na chave do cache. */
  readonly userId?: string;
  readonly realm?: 'beta' | 'prod';
  readonly config: ConversationHostConfig;
  readonly client: ReturnType<typeof createCommentsClient>;
}

export function useConversationHost({
  subjectId,
  userId,
  realm = 'prod',
  config,
  client: httpClient,
}: UseConversationHostOptions) {
  const [sort, setSort] = useState<CommentSortUi>('best');

  const subject = useMemo(
    () => ({ subjectType: config.subjectType, subjectId }),
    [config.subjectType, subjectId],
  );

  const client = useMemo(
    () => createCommentsConversationClient(httpClient, subject),
    [httpClient, subject],
  );

  /**
   * O resource é recriado quando a ordenação muda, e isso é deliberado.
   *
   * A alternativa seria manter o sort fora das dependências, lido por ref
   * dentro do `load` — mas ler ou escrever ref durante o render é proibido
   * pelas regras do React, e o valor devolvido por `useMemo` é tratado como
   * imutável pelo compilador. As duas tentativas foram reprovadas pelo lint.
   *
   * O custo real é pequeno: trocar de ordenação **já invalida** a lista
   * anterior — a árvore vem em outra ordem, com outro cursor. O que se perde é
   * o `stale` da ordenação antiga, que não serviria para desenhar a nova.
   */
  const resource = useMemo(
    () => createCommentsResource<CommentsThread>({
      identity: {
        realm,
        sourceApp: config.sourceApp,
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
    [client, config.sourceApp, realm, sort, subject, userId],
  );

  const state = useCommentsResource(resource);

  // `changeSort` só troca o estado: o resource novo (com o sort novo no `load`)
  // nasce no render seguinte e o `useCommentsResource` dispara `load()` sozinho
  // via `autoLoad`. Chamar `resource.load()` aqui consultaria o resource
  // ANTIGO, com a ordenação anterior.
  const changeSort = useCallback((next: CommentSortUi) => {
    setSort(next);
  }, []);

  /**
   * As páginas de `more` carregam a **identidade** que as produziu, e não só o
   * conteúdo.
   *
   * `snapshot_revision` sozinho não distingue conversas: ele é por assunto, e
   * dois assuntos recém-criados começam ambos em revisão baixa. Sem a chave,
   * trocar de assunto (ou de conta) mantinha `pages` do anterior e, quando as
   * revisões coincidiam, a árvore da conversa antiga aparecia na tela nova —
   * indistinguível de dado real.
   */
  const pagesKey = `${realm}|${subject.subjectType}|${subject.subjectId}|${userId ?? ''}|${sort}`;
  const [pages, setPages] = useState<PaginaMesclada>(null);
  /**
   * Espelho síncrono de `pages`, para `loadMore` mesclar contra o valor mais
   * recente sem precisar de lógica dentro do updater do `setPages` — que o
   * React exige puro, e chama duas vezes sob `StrictMode`.
   *
   * A ref é escrita nos MESMOS pontos que o estado, sempre antes dele. Se as
   * duas divergirem, a mesclagem seguinte parte de uma base que a tela não está
   * mostrando.
   */
  const pagesRef = useRef<PaginaMesclada>(null);
  const validPages = pages?.key === pagesKey ? pages.thread : null;

  /**
   * `async` e **descartando as páginas mescladas** (achado de review, PR #264).
   *
   * O pacote aguarda este retorno antes de anunciar sucesso
   * (`CommentsConversation.tsx`: `await onActionComplete?.()`). Devolvendo
   * `void` sem esperar, o "Comentário publicado." aparecia antes de a árvore
   * nova chegar. E sem `setPages(null)` a página mesclada do `more` sobrevive à
   * mutação: ela é um retrato da revisão anterior, e continuaria coberta pelo
   * `effectiveState` até a revisão mudar — escondendo justamente o comentário
   * que acabou de ser escrito.
   */
  const reload = useCallback(async () => {
    // Ref e estado zerados juntos: um `loadMore` disparado logo depois leria a
    // ref, e uma ref não limpa faria a mesclagem partir da árvore que a recarga
    // acabou de invalidar.
    pagesRef.current = null;
    setPages(null);
    await resource.load();
  }, [resource]);

  const loadMore = useCallback(async (page: CommentsThread, request: ConversationMoreNode) => {
    // A mesclagem acontece FORA do updater, contra o que a ref guarda (achado
    // de review, PR #264).
    //
    // A versão anterior chamava `mergeCommentsThreadPage` dentro do updater de
    // `setPages` e sinalizava falha mutando uma variável de escopo externo — as
    // duas coisas quebram o contrato de pureza que o React exige ali. Não é
    // teórico: `StrictMode` está ativo (`downloads/src/main.tsx:30`) e invoca o
    // updater **duas vezes**, então a mesclagem rodava duplicada e o efeito
    // colateral disparava duas vezes por página carregada.
    //
    // A ref resolve o que o updater funcional resolvia — ler o valor mais
    // recente em vez do capturado no render, para que duas páginas concorrentes
    // se acumulem em vez de uma descartar a outra — sem precisar de lógica
    // dentro dele.
    const atual = pagesRef.current;
    const base = atual?.key === pagesKey ? atual.thread : state.data;
    if (!base) return;

    let mesclada: CommentsThread;
    try {
      mesclada = mergeCommentsThreadPage(base, page, request.cursor);
    } catch {
      // Revisão divergente: recarrega em vez de exibir árvore inconsistente.
      pagesRef.current = null;
      setPages(null);
      await resource.load();
      return;
    }

    // A ref é atualizada ANTES do `setPages`: a próxima página que resolver
    // precisa enxergar esta mesclagem mesmo que o React ainda não tenha
    // recomposto o estado.
    pagesRef.current = { key: pagesKey, thread: mesclada };
    setPages(pagesRef.current);
  }, [pagesKey, resource, state.data]);

  // A página mesclada só vale enquanto o resource não trouxer leitura nova.
  const effectiveState = useMemo(() => {
    if (!validPages || state.status === 'unavailable') return state;
    if (state.data && state.data.snapshot_revision !== validPages.snapshot_revision) return state;
    return { ...state, data: validPages } as typeof state;
  }, [validPages, state]);

  return { state: effectiveState, sort, changeSort, client, loadMore, reload, resource };
}
