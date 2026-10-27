import type { ErrorInfo } from 'react';

/**
 * Spec 106 R19. Manda ao proprio servidor o erro de renderizacao/rota que a pessoa
 * viu, sem depender de ela abrir o widget de feedback. Chamado pelo `onError` do
 * `HydratedRouter` e pelo `ErrorBoundary.componentDidCatch`.
 *
 * Contrato: NUNCA lanca e nunca bloqueia. Falha de envio e silenciosa (o proprio
 * relato de erro nao pode virar outro erro). So o que o servidor precisa: tipo do
 * erro, rota, navegador. Sem cookie, sem corpo de requisicao, sem query string.
 */
const ENDPOINT = '/api/v1/client-errors';

// Mesmo erro so e relatado 1 vez por sessao de navegador: um laco de render que
// dispara 1000 erros vira 1 envio, nao 1000.
const sent = new Set<string>();

export interface ClientErrorContext {
  /** Padrao da rota (`/mestre/:slug`), nao o caminho real. */
  routePattern?: string;
  errorInfo?: Pick<ErrorInfo, 'componentStack'>;
}

export function reportClientError(error: unknown, context: ClientErrorContext = {}): void {
  try {
    if (typeof window === 'undefined') return;

    const err = error instanceof Error ? error : new Error(typeof error === 'string' ? error : 'Erro desconhecido');
    const componentStack = context.errorInfo?.componentStack ?? '';
    const routePattern = context.routePattern ?? '';
    const key = `${routePattern}|${err.message}|${componentStack.split('\n').find((l) => l.trim()) ?? ''}`;
    if (sent.has(key)) return;
    sent.add(key);

    const body = JSON.stringify({
      message: err.message,
      stack: err.stack ?? '',
      componentStack,
      routePattern,
      path: window.location.pathname,
      userAgent: navigator.userAgent,
      build: import.meta.env.MODE,
    });

    // `sendBeacon` sobrevive a navegacao/fechamento da aba; `fetch keepalive` e o
    // plano B para quando o navegador recusa o beacon (corpo grande, bloqueio).
    const beaconOk =
      typeof navigator.sendBeacon === 'function' &&
      navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' }));
    if (!beaconOk) {
      void fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
        keepalive: true,
        credentials: 'same-origin',
      }).catch(() => {});
    }
  } catch {
    // relatar erro nunca pode gerar erro
  }
}

/** So para teste. */
export function resetReportedErrors(): void {
  sent.clear();
}
