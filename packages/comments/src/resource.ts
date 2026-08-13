import { z } from 'zod';

import {
  CommentsClientError,
  normalizeCommentsError,
  type CommentsErrorShape,
} from './transport.js';

export const commentsResourceIdentitySchema = z.object({
  realm: z.enum(['beta', 'prod']),
  sourceApp: z.string().min(1).max(64),
  subjectType: z.string().min(1).max(64),
  subjectId: z.string().min(1).max(255),
  visibility: z.enum(['public', 'private']),
  userId: z.string().min(1).optional(),
}).superRefine((identity, context) => {
  if (identity.visibility === 'private' && !identity.userId) {
    context.addIssue({
      code: 'custom',
      path: ['userId'],
      message: 'userId é obrigatório para dados privados.',
    });
  }
});

export type CommentsResourceIdentity = z.input<typeof commentsResourceIdentitySchema>;

export function createCommentsResourceKey(identity: CommentsResourceIdentity): string {
  const parsed = commentsResourceIdentitySchema.parse(identity);
  return JSON.stringify([
    parsed.realm,
    parsed.sourceApp,
    parsed.subjectType,
    parsed.subjectId,
    parsed.visibility,
    parsed.userId ?? null,
  ]);
}

export interface FreshCommentsState<T> {
  readonly status: 'fresh';
  readonly data: T;
  readonly updatedAt: number;
  readonly ageMs: 0;
}

export interface StaleCommentsState<T> {
  readonly status: 'stale';
  readonly data: T;
  readonly updatedAt: number;
  readonly ageMs: number;
  readonly error: CommentsErrorShape;
}

export interface UnavailableCommentsState {
  readonly status: 'unavailable';
  readonly data: undefined;
  readonly updatedAt: null;
  readonly ageMs: null;
  readonly error: CommentsErrorShape | null;
}

export type CommentsResourceState<T> =
  | FreshCommentsState<T>
  | StaleCommentsState<T>
  | UnavailableCommentsState;

export interface CommentsResourceOptions<T> {
  readonly identity: CommentsResourceIdentity;
  /**
   * Recebe a identidade VIGENTE no momento da consulta, não a de construção.
   * Sem isso, um loader fechado sobre a identidade antiga continuaria buscando
   * dados do usuário/assunto anterior depois de `setIdentity`, e o resultado
   * seria gravado sob a chave nova — comentário privado de uma conta aparecendo
   * na seguinte, que é exatamente o que a chave por identidade existe para
   * impedir (achado de review, PR #259).
   */
  readonly load: (signal: AbortSignal, identity: CommentsResourceIdentity) => Promise<T>;
  readonly now?: () => number;
}

export interface CommentsResource<T> {
  readonly getSnapshot: () => CommentsResourceState<T>;
  readonly subscribe: (listener: () => void) => () => void;
  readonly load: () => Promise<CommentsResourceState<T>>;
  readonly setIdentity: (identity: CommentsResourceIdentity) => void;
  readonly logout: () => void;
  readonly dispose: () => void;
}

const emptyState = (): UnavailableCommentsState => ({
  status: 'unavailable',
  data: undefined,
  updatedAt: null,
  ageMs: null,
  error: null,
});

export function createCommentsResource<T>(options: CommentsResourceOptions<T>): CommentsResource<T> {
  const now = options.now ?? Date.now;
  let identity: CommentsResourceIdentity | null = commentsResourceIdentitySchema.parse(options.identity);
  let identityKey: string | null = createCommentsResourceKey(identity);
  let snapshot: CommentsResourceState<T> = emptyState();
  let lastSuccess: { key: string; data: T; updatedAt: number } | null = null;
  let activeRequest: AbortController | null = null;
  let disposed = false;
  const listeners = new Set<() => void>();

  const publish = (next: CommentsResourceState<T>): void => {
    snapshot = next;
    for (const listener of listeners) listener();
  };

  const reset = (): void => {
    activeRequest?.abort(new DOMException('Identidade alterada.', 'AbortError'));
    activeRequest = null;
    lastSuccess = null;
    publish(emptyState());
  };

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async load() {
      if (disposed) return snapshot;
      if (!identity || !identityKey) {
        const error = new CommentsClientError('invalid_input', 'Identidade ausente para carregar comentários.', {
          retryable: false,
        });
        publish({ ...emptyState(), error: error.toJSON() });
        return snapshot;
      }

      activeRequest?.abort(new DOMException('Consulta substituída.', 'AbortError'));
      const request = new AbortController();
      activeRequest = request;
      const requestKey = identityKey;
      // Captura a identidade junto da chave: as duas descrevem a mesma consulta,
      // e o loader precisa da identidade para não buscar o contexto anterior.
      const requestIdentity = identity;

      try {
        const data = await options.load(request.signal, requestIdentity);
        if (disposed || request.signal.aborted || requestKey !== identityKey) return snapshot;
        const updatedAt = now();
        lastSuccess = { key: requestKey, data, updatedAt };
        publish({ status: 'fresh', data, updatedAt, ageMs: 0 });
      } catch (error: unknown) {
        // Consulta substituída/desmontada não pode chegar atrasada e degradar
        // para stale um sucesso mais novo da mesma identidade.
        if (disposed || request.signal.aborted || requestKey !== identityKey) return snapshot;
        const normalized = normalizeCommentsError(error).toJSON();
        if (lastSuccess?.key === requestKey) {
          publish({
            status: 'stale',
            data: lastSuccess.data,
            updatedAt: lastSuccess.updatedAt,
            ageMs: Math.max(0, now() - lastSuccess.updatedAt),
            error: normalized,
          });
        } else {
          publish({ ...emptyState(), error: normalized });
        }
      } finally {
        if (activeRequest === request) activeRequest = null;
      }
      return snapshot;
    },
    setIdentity(nextIdentity) {
      const parsed = commentsResourceIdentitySchema.parse(nextIdentity);
      const nextKey = createCommentsResourceKey(parsed);
      identity = parsed;
      if (nextKey === identityKey) return;
      identityKey = nextKey;
      reset();
    },
    logout() {
      identity = null;
      identityKey = null;
      reset();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      reset();
      listeners.clear();
    },
  };
}
