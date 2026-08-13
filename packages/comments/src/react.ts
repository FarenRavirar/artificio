import { useEffect, useSyncExternalStore } from 'react';

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
  useEffect(() => {
    if (autoLoad) void resource.load();
    return () => {
      if (disposeOnUnmount) resource.dispose();
    };
  }, [autoLoad, disposeOnUnmount, resource]);

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
