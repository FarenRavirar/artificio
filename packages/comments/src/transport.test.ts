import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import {
  CommentsClientError,
  createCommentsClient,
  defineCommentsOperation,
  type CommentsTransport,
} from './transport.js';

const readOperation = defineCommentsOperation({
  capability: 'thread.read',
  kind: 'query',
  inputSchema: z.object({ subjectId: z.string().min(1) }),
  outputSchema: z.object({ comments: z.array(z.object({ id: z.string() })) }),
});

describe('createCommentsClient', () => {
  // Restaura os timers mesmo quando a asserção falha no meio do teste. Inline,
  // um `expect` que estoura antes da linha deixaria os fake timers ativos e
  // contaminaria os testes seguintes com falha que não é deles.
  afterEach(() => {
    vi.useRealTimers();
  });

  it('valida entrada antes do adapter e saída antes de devolver ao consumidor', async () => {
    const execute = vi.fn(async () => ({ comments: [{ id: 'c1' }] }));
    const client = createCommentsClient({ transport: { execute } });

    await expect(client.execute(readOperation, { subjectId: '' })).rejects.toMatchObject({
      code: 'invalid_input',
    });
    expect(execute).not.toHaveBeenCalled();

    await expect(client.execute(readOperation, { subjectId: 'material-1' })).resolves.toEqual({
      comments: [{ id: 'c1' }],
    });
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({
        capability: 'thread.read',
        input: { subjectId: 'material-1' },
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it('recusa payload externo incompatível com o schema de saída', async () => {
    const client = createCommentsClient({
      transport: { execute: async () => ({ comments: 'não é array' }) },
    });

    await expect(client.execute(readOperation, { subjectId: 'material-1' })).rejects.toMatchObject({
      code: 'schema_incompatible',
    });
  });

  it('aborta uma chamada pendurada no timeout', async () => {
    vi.useFakeTimers();
    const transport: CommentsTransport<'thread.read'> = {
      execute: ({ signal }) => new Promise((_, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), { once: true });
      }),
    };
    const client = createCommentsClient({ transport, timeoutMs: 250 });

    const pending = client.execute(readOperation, { subjectId: 'material-1' });
    const rejection = expect(pending).rejects.toMatchObject({ code: 'timeout' });
    await vi.advanceTimersByTimeAsync(250);

    await rejection;
  });

  it('propaga cancelamento do consumidor sem confundi-lo com timeout', async () => {
    const controller = new AbortController();
    const transport: CommentsTransport<'thread.read'> = {
      execute: ({ signal }) => new Promise((_, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), { once: true });
      }),
    };
    const client = createCommentsClient({ transport, timeoutMs: 10_000 });

    const pending = client.execute(
      readOperation,
      { subjectId: 'material-1' },
      { signal: controller.signal },
    );
    controller.abort();

    await expect(pending).rejects.toMatchObject({ code: 'cancelled' });
  });

  it('falha fechada em mutação e nunca fabrica sucesso otimista', async () => {
    const mutation = defineCommentsOperation({
      capability: 'comment.create',
      kind: 'mutation',
      inputSchema: z.object({ body: z.string().min(1) }),
      outputSchema: z.object({ id: z.string() }),
    });
    const client = createCommentsClient({
      transport: {
        execute: async () => {
          throw new CommentsClientError('http_error', 'accounts indisponível', { status: 500 });
        },
      },
    });

    await expect(client.execute(mutation, { body: 'texto' })).rejects.toMatchObject({
      code: 'http_error',
      status: 500,
    });
  });

  // A chave tem que ser escolhida pelo chamador e chegar intacta ao adapter:
  // é o que permite reenviar o mesmo formulário depois de um timeout sem
  // duplicar a escrita (achado de review, PR #259).
  it('repassa a Idempotency-Key do chamador ao transporte, sem reinventá-la', async () => {
    const mutation = defineCommentsOperation({
      capability: 'comment.create',
      kind: 'mutation',
      inputSchema: z.object({ body: z.string().min(1) }),
      outputSchema: z.object({ ok: z.literal(true) }),
    });
    const recebidas: (string | undefined)[] = [];
    const client = createCommentsClient({
      transport: {
        execute: async (request) => {
          recebidas.push(request.idempotencyKey);
          return { ok: true };
        },
      },
    });

    const chave = 'envio-formulario-0001';
    await client.execute(mutation, { body: 'texto' }, { idempotencyKey: chave });
    await client.execute(mutation, { body: 'texto' }, { idempotencyKey: chave });

    expect(recebidas).toEqual([chave, chave]);
  });

  it('recusa Idempotency-Key fora do formato do contrato antes de chamar o transporte', async () => {
    const mutation = defineCommentsOperation({
      capability: 'comment.create',
      kind: 'mutation',
      inputSchema: z.object({ body: z.string().min(1) }),
      outputSchema: z.object({ ok: z.literal(true) }),
    });
    const execute = vi.fn();
    const client = createCommentsClient({ transport: { execute } });

    // 7 caracteres: abaixo do mínimo de 8 exigido por `contrato-http-v1.md` §6.
    await expect(
      client.execute(mutation, { body: 'texto' }, { idempotencyKey: 'curta12' }),
    ).rejects.toMatchObject({ code: 'invalid_input', retryable: false });

    expect(execute).not.toHaveBeenCalled();
  });
});
