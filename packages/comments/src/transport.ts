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
  /**
   * `Idempotency-Key` do `contrato-http-v1.md` §6, presente só nas escritas não
   * idempotentes (criação, resposta, edição, denúncia).
   *
   * Quem escolhe é o CHAMADOR, não o adapter: uma chave inventada por chamada
   * não sobrevive à retentativa. O caso que ela existe para cobrir é o envio que
   * dá timeout DEPOIS de o servidor confirmar a escrita — reenviar o formulário
   * com chave nova duplica o comentário ou a denúncia; com a mesma chave, o
   * servidor devolve a resposta original (achado de review, PR #259).
   */
  readonly idempotencyKey?: string;
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

  // Serializa sem `commentsErrorSchema.parse`: este método é chamado no caminho
  // de degradação (`load()` reportando falha), e o construtor aceita entrada que
  // o schema recusaria — mensagem vazia, `status: 0`. Validar aqui trocaria o
  // erro real por um `ZodError` lançado de dentro do tratamento de erro, que é
  // onde menos se pode falhar (achado de review, PR #259).
  toJSON(): CommentsErrorShape {
    return {
      code: this.code,
      message: this.message,
      status: this.status,
      retryable: this.retryable,
    };
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
  /** Ver `CommentsTransportRequest.idempotencyKey`. Formato: `contrato-http-v1.md` §6. */
  readonly idempotencyKey?: string;
}

/** 8-128 ASCII imprimível (`contrato-http-v1.md` §6, tabela de cabeçalhos). */
const IDEMPOTENCY_KEY_PATTERN = /^[\x20-\x7E]{8,128}$/;

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
  // A promise do transporte já existe quando chegamos aqui. Sair sem anexar
  // handler deixaria a rejeição dela sem tratamento — `unhandledRejection`
  // derruba o processo Node do backend consumidor, e não é o erro de verdade que
  // aparece no log. O `catch` vazio é deliberado: o motivo real é o
  // `signal.reason` lançado logo abaixo (achado de review, PR #259).
  if (signal.aborted) {
    void promise.catch(() => {});
    throw signal.reason;
  }

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

      // Recusa a chave malformada aqui, e não no servidor: `422` depois de o
      // formulário ser enviado é pior que erro imediato, e uma chave fora do
      // formato não protege contra duplicata nenhuma.
      const idempotencyKey = executeOptions?.idempotencyKey;
      if (idempotencyKey !== undefined && !IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)) {
        throw new CommentsClientError('invalid_input', 'Idempotency-Key fora do formato exigido pelo contrato.', {
          retryable: false,
        });
      }

      const execution = createExecutionSignal(executeOptions?.signal, timeoutMs);
      try {
        // Já cancelado antes de começar: não vale disparar a requisição só para
        // descartá-la. `createExecutionSignal` propaga o abort do chamador, então
        // este teste cobre o caso de signal já abortado na entrada.
        if (execution.signal.aborted) throw execution.signal.reason;

        const raw = await waitForTransport(options.transport.execute({
          capability: operation.capability,
          kind: operation.kind,
          input: parsedInput.data,
          signal: execution.signal,
          idempotencyKey,
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
        // Erro já classificado sai intacto. Sem este rethrow, um
        // `schema_incompatible` (resposta fora do contrato) que chegasse junto de
        // um timeout na corrida seria reetiquetado como `timeout`, e o consumidor
        // trataria contrato quebrado como falha de rede retentável (achado de
        // review, PR #259).
        if (error instanceof CommentsClientError) throw error;

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
