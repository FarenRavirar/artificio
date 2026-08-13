import { z } from 'zod';

/**
 * Capacidades são explícitas para que cada fachada exponha somente o que o
 * domínio autorizou. O pacote não conhece URL, cookie ou credencial de serviço.
 */
export const COMMENT_CAPABILITIES = [
  'thread.read',
  'comment.create',
  'comment.reply',
  'comment.edit',
  'comment.withdraw',
  'vote.set',
  'report.create',
  'report.withdraw',
  'appeal.create',
  'appeal.read',
  'appeal.decide',
  'moderation.queue',
  'moderation.read',
  'moderation.remove',
  'moderation.restore',
  'notification.read',
  'notification.mark_read',
] as const;

export const commentCapabilitySchema = z.enum(COMMENT_CAPABILITIES);
export type CommentCapability = z.infer<typeof commentCapabilitySchema>;
export type CommentsOperationKind = 'query' | 'mutation';

export interface CommentsOperation<
  TCapability extends CommentCapability,
  TInputSchema extends z.ZodType,
  TOutputSchema extends z.ZodType,
> {
  readonly capability: TCapability;
  readonly kind: CommentsOperationKind;
  readonly inputSchema: TInputSchema;
  readonly outputSchema: TOutputSchema;
}

export function defineCommentsOperation<
  const TCapability extends CommentCapability,
  TInputSchema extends z.ZodType,
  TOutputSchema extends z.ZodType,
>(operation: CommentsOperation<TCapability, TInputSchema, TOutputSchema>): CommentsOperation<
  TCapability,
  TInputSchema,
  TOutputSchema
> {
  return operation;
}

export interface CommentsTransportRequest<TCapability extends CommentCapability = CommentCapability> {
  readonly capability: TCapability;
  readonly kind: CommentsOperationKind;
  readonly input: unknown;
  readonly signal: AbortSignal;
}

export interface CommentsTransport<TCapability extends CommentCapability = CommentCapability> {
  execute(request: CommentsTransportRequest<TCapability>): Promise<unknown>;
}

export const COMMENTS_ERROR_CODES = [
  'invalid_input',
  'schema_incompatible',
  'timeout',
  'cancelled',
  'http_error',
  'unexpected_content_type',
  'malformed_json',
  'unavailable',
  'transport_error',
] as const;

export const commentsErrorCodeSchema = z.enum(COMMENTS_ERROR_CODES);
export type CommentsErrorCode = z.infer<typeof commentsErrorCodeSchema>;

export const commentsErrorSchema = z.object({
  code: commentsErrorCodeSchema,
  message: z.string().min(1),
  status: z.number().int().min(100).max(599).optional(),
  retryable: z.boolean(),
});

export type CommentsErrorShape = z.infer<typeof commentsErrorSchema>;

export class CommentsClientError extends Error implements CommentsErrorShape {
  readonly code: CommentsErrorCode;
  readonly status?: number;
  readonly retryable: boolean;

  constructor(
    code: CommentsErrorCode,
    message: string,
    options: { status?: number; retryable?: boolean; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = 'CommentsClientError';
    this.code = code;
    this.status = options.status;
    this.retryable = options.retryable ?? (
      code === 'timeout'
      || code === 'http_error'
      || code === 'unavailable'
      || code === 'transport_error'
    );
  }

  toJSON(): CommentsErrorShape {
    return commentsErrorSchema.parse({
      code: this.code,
      message: this.message,
      status: this.status,
      retryable: this.retryable,
    });
  }
}

export function normalizeCommentsError(error: unknown): CommentsClientError {
  if (error instanceof CommentsClientError) return error;
  if (error instanceof DOMException && error.name === 'TimeoutError') {
    return new CommentsClientError('timeout', 'A operação de comentários excedeu o tempo limite.', {
      cause: error,
    });
  }
  if (error instanceof DOMException && error.name === 'AbortError') {
    return new CommentsClientError('cancelled', 'A operação de comentários foi cancelada.', {
      retryable: false,
      cause: error,
    });
  }
  return new CommentsClientError('transport_error', 'O transporte de comentários falhou.', {
    cause: error,
  });
}

export const COMMENTS_REQUEST_TIMEOUT_MS = 8_000;

export interface CommentsClientOptions<TCapability extends CommentCapability> {
  readonly transport: CommentsTransport<TCapability>;
  readonly timeoutMs?: number;
}

export interface CommentsExecuteOptions {
  readonly signal?: AbortSignal;
}

interface ExecutionSignal {
  readonly signal: AbortSignal;
  readonly timedOut: () => boolean;
  readonly cleanup: () => void;
}

function createExecutionSignal(signal: AbortSignal | undefined, timeoutMs: number): ExecutionSignal {
  const controller = new AbortController();
  let timeoutReached = false;

  const cancelFromCaller = (): void => {
    controller.abort(signal?.reason ?? new DOMException('Operação cancelada.', 'AbortError'));
  };

  if (signal?.aborted) cancelFromCaller();
  else signal?.addEventListener('abort', cancelFromCaller, { once: true });

  const timeout = setTimeout(() => {
    timeoutReached = true;
    controller.abort(new DOMException('Tempo limite excedido.', 'TimeoutError'));
  }, timeoutMs);

  return {
    signal: controller.signal,
    timedOut: () => timeoutReached,
    cleanup: () => {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', cancelFromCaller);
    },
  };
}

async function waitForTransport(promise: Promise<unknown>, signal: AbortSignal): Promise<unknown> {
  if (signal.aborted) throw signal.reason;

  let onAbort: (() => void) | undefined;
  const aborted = new Promise<never>((_, reject) => {
    onAbort = () => reject(signal.reason);
    signal.addEventListener('abort', onAbort, { once: true });
  });

  try {
    return await Promise.race([promise, aborted]);
  } finally {
    if (onAbort) signal.removeEventListener('abort', onAbort);
  }
}

export interface CommentsClient<TCapability extends CommentCapability> {
  execute<
    TOperationCapability extends TCapability,
    TInputSchema extends z.ZodType,
    TOutputSchema extends z.ZodType,
  >(
    operation: CommentsOperation<TOperationCapability, TInputSchema, TOutputSchema>,
    input: z.input<TInputSchema>,
    options?: CommentsExecuteOptions,
  ): Promise<z.output<TOutputSchema>>;
}

export function createCommentsClient<TCapability extends CommentCapability>(
  options: CommentsClientOptions<TCapability>,
): CommentsClient<TCapability> {
  const timeoutMs = options.timeoutMs ?? COMMENTS_REQUEST_TIMEOUT_MS;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new TypeError('timeoutMs deve ser um número positivo.');
  }

  return {
    async execute(operation, input, executeOptions) {
      const parsedInput = operation.inputSchema.safeParse(input);
      if (!parsedInput.success) {
        throw new CommentsClientError('invalid_input', 'Entrada inválida para a operação de comentários.', {
          retryable: false,
          cause: parsedInput.error,
        });
      }

      const execution = createExecutionSignal(executeOptions?.signal, timeoutMs);
      try {
        const raw = await waitForTransport(options.transport.execute({
          capability: operation.capability,
          kind: operation.kind,
          input: parsedInput.data,
          signal: execution.signal,
        }), execution.signal);
        const parsedOutput = operation.outputSchema.safeParse(raw);
        if (!parsedOutput.success) {
          throw new CommentsClientError(
            'schema_incompatible',
            'Resposta incompatível com o contrato de comentários.',
            { retryable: false, cause: parsedOutput.error },
          );
        }
        return parsedOutput.data;
      } catch (error: unknown) {
        if (execution.timedOut()) {
          throw new CommentsClientError('timeout', 'A operação de comentários excedeu o tempo limite.', {
            cause: error,
          });
        }
        if (executeOptions?.signal?.aborted) {
          throw new CommentsClientError('cancelled', 'A operação de comentários foi cancelada.', {
            retryable: false,
            cause: error,
          });
        }
        throw normalizeCommentsError(error);
      } finally {
        execution.cleanup();
      }
    },
  };
}
