import { PassThrough } from 'node:stream';
import type { AppLoadContext, EntryContext } from 'react-router';
import { ServerRouter } from 'react-router';
import { createReadableStreamFromReadable } from '@react-router/node';
import { renderToPipeableStream } from 'react-dom/server';
import { isbot } from 'isbot';

const ABORT_DELAY = 5_000;

/**
 * Render no servidor (spec 102 T4.2).
 *
 * A distinção por bot aqui NÃO é dynamic rendering — o conteúdo é o MESMO nos
 * dois caminhos. O que muda é só o momento de despachar: navegador recebe o
 * stream assim que a casca está pronta (`onShellReady`), enquanto crawler
 * espera o documento inteiro (`onAllReady`), porque ele não executa JS e
 * abandonaria um HTML incompleto. Era exatamente o oposto do `@og_proxy`, que
 * servia HTML DIFERENTE por user-agent e é o que esta task remove.
 */
export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
  _loadContext: AppLoadContext,
) {
  return new Promise((resolve, reject) => {
    let shellRendered = false;
    const userAgent = request.headers.get('user-agent');
    const waitForAll = (userAgent && isbot(userAgent)) || routerContext.isSpaMode;
    const readyOption = waitForAll ? 'onAllReady' : 'onShellReady';

    const { pipe, abort } = renderToPipeableStream(
      // `abortDelay` saiu de `ServerRouterProps` no v7: o corte do stream é
      // responsabilidade de quem renderiza, e é o `setTimeout(abort)` no fim
      // desta função que o faz.
      <ServerRouter context={routerContext} url={request.url} />,
      {
        [readyOption]() {
          shellRendered = true;
          const body = new PassThrough();
          const stream = createReadableStreamFromReadable(body);

          responseHeaders.set('Content-Type', 'text/html');

          resolve(
            new Response(stream, {
              headers: responseHeaders,
              status: responseStatusCode,
            }),
          );

          pipe(body);
        },
        onShellError(error: unknown) {
          reject(error);
        },
        onError(error: unknown) {
          responseStatusCode = 500;
          // Erro depois da casca despachada já foi para o cliente pelo stream;
          // logar de novo só polui. Antes dela, é erro real de render.
          if (shellRendered) return;
          console.error(error);
        },
      },
    );

    setTimeout(abort, ABORT_DELAY);
  });
}
