import { useEffect, useRef, useSyncExternalStore } from 'react';

import type { CommentsResource, CommentsResourceState } from './resource.js';

export interface UseCommentsResourceOptions {
  readonly autoLoad?: boolean;
  readonly disposeOnUnmount?: boolean;
}

/**
 * Liga uma instância efêmera do resource ao React. A instância é fornecida
 * pelo host: logout/troca de conta continuam explícitos e nenhum cache global
 * sobrevive à árvore montada.
 */
export function useCommentsResource<T>(
  resource: CommentsResource<T>,
  options: UseCommentsResourceOptions = {},
): CommentsResourceState<T> {
  const snapshot = useSyncExternalStore(
    resource.subscribe,
    resource.getSnapshot,
    resource.getSnapshot,
  );

  const autoLoad = options.autoLoad ?? true;
  const disposeOnUnmount = options.disposeOnUnmount ?? true;

  // Carga e descarte moram em efeitos separados de propósito. Juntos, com
  // `disposeOnUnmount` nas dependências, alternar essa flag em runtime rodava a
  // limpeza e destruía um resource ainda em uso — o host perdia a conversa por
  // mudar uma opção (achado de review, PR #259).
  useEffect(() => {
    if (autoLoad) void resource.load();
  }, [autoLoad, resource]);

  // `disposeOnUnmount` é lido por ref para ficar fora das dependências: o
  // descarte só pode disparar quando a instância do resource é trocada ou o
  // componente desmonta, nunca porque a opção mudou.
  const disposeOnUnmountRef = useRef(disposeOnUnmount);
  disposeOnUnmountRef.current = disposeOnUnmount;

  useEffect(() => () => {
    if (disposeOnUnmountRef.current) resource.dispose();
  }, [resource]);

  return snapshot;
}

export {
  CommentsConversation,
  type CommentViewerPermissions,
  type CommentsConversationProps,
  type CommentsConversationSlot,
  type CommentsConversationSlots,
} from './CommentsConversation.js';

/**
 * Política única de capacidades da conversa. Os três apps a consomem em vez de
 * manter cópia local — ver o cabeçalho de `viewerPermissions.ts` para o defeito
 * que a duplicação produziu.
 */
export {
  canModerateComments,
  resolveViewerPermissions,
  type ViewerPermissionsInput,
} from './viewerPermissions.js';

export type {
  CommentReportReason,
  CommentSortUi,
  CommentsConversationClient,
  CommentsThread,
  ConversationComment,
  ConversationMoreNode,
} from './conversation.js';

export type {
  CommentsResource,
  CommentsResourceIdentity,
  CommentsResourceState,
  FreshCommentsState,
  StaleCommentsState,
  UnavailableCommentsState,
} from './resource.js';

/**
 * Funções de runtime que o host da UI precisa, reexportadas por este subpath
 * **porque o barrel `.` não é browser-safe** (T6.4, spec 090).
 *
 * `index.ts` reexporta `treeCursor.js`, que abre com
 * `import { createHmac, timingSafeEqual } from 'node:crypto'` — assinatura de
 * cursor é código de servidor, e nada do cliente a alcança. Mas o barrel arrasta
 * o módulo inteiro para qualquer bundle que importe do root: o build do Astro
 * falha com `"createHmac" is not exported by "__vite-browser-external"`, medido
 * em 2026-08-16 ao adotar a conversa no `site`.
 *
 * O `downloads` não expôs isso porque o Vite dele externaliza `node:*` em vez de
 * quebrar — o defeito estava lá desde a Fase 4, esperando um consumidor mais
 * estrito. Importar daqui resolve na origem, sem `alias` de bundler em cada app
 * (que teria de ser repetido no `mesas` na Fase 7) e sem `polyfill` de crypto
 * no cliente, que embarcaria código de servidor no navegador.
 */
export {
  createCommentsClient,
  type CommentsClient,
  type CommentsClientOptions,
  type CommentsTransport,
  type CommentsTransportRequest,
} from './transport.js';

export {
  createCommentsResource,
  type CommentsResourceOptions,
} from './resource.js';

export {
  createCommentsConversationClient,
  mergeCommentsThreadPage,
  commentsThreadSchema,
} from './conversation.js';

/**
 * Host da conversa, compartilhado pelos módulos (T6.4, spec 090).
 *
 * Extraído das cópias de `downloads` e `site`, que tinham 72,9% de linhas
 * idênticas — e, pior, divergiam: as correções de review do `site` não haviam
 * chegado ao `downloads`, deixando dois defeitos lá em produção. Sai por
 * `/react` porque depende de hooks.
 */
export {
  createConversationTransport,
  useConversationHost,
  ConversationApiError,
  type ConversationHostConfig,
  type UseConversationHostOptions,
} from './useConversationHost.js';

export {
  CommentAppealForm,
  CommentReportPanel,
  CommunityModerationWorkspace,
  type CommentAppealFormProps,
  type CommentReportPanelProps,
  type CommunityModerationWorkspaceProps,
} from './CommunityModerationWorkspace.js';

export {
  moderationCaseSchema,
  commentVersionsSchema,
  moderationLogSchema,
  moderationQueueSchema,
  moderatorAppealSchema,
  ownReportsSchema,
  reportReasonsSchema,
  sanctionHistorySchema,
  type CommunityModerationAdapter,
  type CommentVersion,
  // Tipos das props do workspace: sem eles o consumidor recebe o componente
  // mas não consegue tipar o que passa para ele, e acabaria redeclarando o
  // shape à mão — que é a divergência que este pacote existe para evitar
  // (achado de review, PR #262).
  type ModerationQueue,
  type ModerationCase,
  type ModeratorAppeal,
  type SanctionHistoryEntry,
  type ModerationLogEntry,
  type ReportReason,
  type OwnReport,
} from './moderation.js';
