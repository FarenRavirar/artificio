import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { createCommentsResource } from './resource.js';
import {
  CommentsClientError,
  createCommentsClient,
  defineCommentsOperation,
  type CommentsErrorCode,
  type CommentsTransport,
} from './transport.js';

const operation = defineCommentsOperation({
  capability: 'thread.read',
  kind: 'query',
  inputSchema: z.object({}),
  outputSchema: z.object({ comments: z.array(z.object({ id: z.string() })) }),
});

function renderHost(status: string): string {
  return renderToStaticMarkup(createElement(
    'main',
    { 'data-testid': 'host' },
    createElement('h1', null, 'Aplicação consumidora'),
    createElement('section', { role: 'status' }, `Comentários: ${status}`),
  ));
}

describe('degradação isolada da aplicação host', () => {
  // Restaura os timers mesmo quando a asserção falha no meio do teste (ver nota
  // equivalente em `transport.test.ts`).
  afterEach(() => {
    vi.useRealTimers();
  });

  const failures: ReadonlyArray<{
    name: string;
    code: CommentsErrorCode;
    status?: number;
  }> = [
    { name: '500', code: 'http_error', status: 500 },
    { name: 'HTML no lugar de JSON', code: 'unexpected_content_type' },
    { name: 'JSON malformado', code: 'malformed_json' },
    // T8.6 exige cinco modos; `unavailable` é o circuito aberto — a fachada
    // recusa antes de tentar a rede, e o host precisa sobreviver igual.
    { name: 'circuito aberto', code: 'unavailable', status: 503 },
  ];

  for (const failure of failures) {
    it(`mantém o host renderizado para ${failure.name}`, async () => {
      const client = createCommentsClient({
        transport: {
          execute: async () => {
            throw new CommentsClientError(failure.code, failure.name, { status: failure.status });
          },
        },
      });
      const resource = createCommentsResource({
        identity: {
          realm: 'prod', sourceApp: 'site', subjectType: 'post', subjectId: 'post-1', visibility: 'public',
        },
        load: (signal) => client.execute(operation, {}, { signal }),
      });

      await resource.load();

      const html = renderHost(resource.getSnapshot().status);
      expect(html).toContain('Aplicação consumidora');
      expect(html).toContain('Comentários: unavailable');
    });
  }

  // Quinto modo de T8.6. Diferente dos casos da tabela acima, aqui o transporte
  // lança o erro **cru** de rede (o que `fetch` faz num ECONNREFUSED), para que
  // a classificação exercitada seja a de `normalizeCommentsError` — lançar um
  // `CommentsClientError` pronto pularia justamente o trecho sob teste.
  it('mantém o host renderizado para conexão recusada', async () => {
    const client = createCommentsClient({
      transport: {
        execute: async () => {
          throw Object.assign(new TypeError('fetch failed'), { code: 'ECONNREFUSED' });
        },
      },
    });
    const resource = createCommentsResource({
      identity: {
        realm: 'prod', sourceApp: 'site', subjectType: 'post', subjectId: 'post-1', visibility: 'public',
      },
      load: (signal) => client.execute(operation, {}, { signal }),
    });

    await resource.load();

    expect(resource.getSnapshot()).toMatchObject({
      status: 'unavailable',
      error: { code: 'transport_error' },
    });
    expect(renderHost(resource.getSnapshot().status)).toContain('Aplicação consumidora');
  });

  it('mantém o host renderizado para schema incompatível', async () => {
    const client = createCommentsClient({ transport: { execute: async () => ({ comments: false }) } });
    const resource = createCommentsResource({
      identity: {
        realm: 'prod', sourceApp: 'site', subjectType: 'post', subjectId: 'post-1', visibility: 'public',
      },
      load: (signal) => client.execute(operation, {}, { signal }),
    });

    await resource.load();

    expect(resource.getSnapshot()).toMatchObject({
      status: 'unavailable',
      error: { code: 'schema_incompatible' },
    });
    expect(renderHost(resource.getSnapshot().status)).toContain('Aplicação consumidora');
  });

  it('mantém o host renderizado para timeout', async () => {
    vi.useFakeTimers();
    const transport: CommentsTransport<'thread.read'> = {
      execute: ({ signal }) => new Promise((_, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), { once: true });
      }),
    };
    const client = createCommentsClient({ transport, timeoutMs: 50 });
    const resource = createCommentsResource({
      identity: {
        realm: 'prod', sourceApp: 'site', subjectType: 'post', subjectId: 'post-1', visibility: 'public',
      },
      load: (signal) => client.execute(operation, {}, { signal }),
    });

    const pending = resource.load();
    await vi.advanceTimersByTimeAsync(50);
    await pending;

    expect(resource.getSnapshot()).toMatchObject({ status: 'unavailable', error: { code: 'timeout' } });
    expect(renderHost(resource.getSnapshot().status)).toContain('Aplicação consumidora');
  });
});
