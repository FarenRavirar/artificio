import { describe, expect, it, vi } from 'vitest';
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
    vi.useRealTimers();
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
});
