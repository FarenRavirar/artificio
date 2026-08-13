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
