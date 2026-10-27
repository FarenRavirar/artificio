// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { reportClientError, resetReportedErrors } from './reportClientError';

/**
 * Spec 106 R19. O relato nunca pode estourar o limite de corpo do servidor: um 413
 * silencioso apaga o erro (o beacon nao confere a resposta e o erro ja foi marcado).
 */
describe('reportClientError', () => {
  const beacon = vi.fn(() => true);

  beforeEach(() => {
    resetReportedErrors();
    beacon.mockClear();
    Object.defineProperty(navigator, 'sendBeacon', { value: beacon, configurable: true });
  });
  afterEach(() => vi.restoreAllMocks());

  it('trunca message, stack e componentStack antes de serializar', async () => {
    const err = new Error('m'.repeat(5000));
    err.stack = 's'.repeat(20000);
    reportClientError(err, { routePattern: '/x', errorInfo: { componentStack: 'c'.repeat(20000) } });

    const [, blob] = beacon.mock.calls[0] as unknown as [string, Blob];
    const sent = JSON.parse(await blob.text());
    expect(sent.message).toHaveLength(500);
    expect(sent.stack).toHaveLength(4000);
    expect(sent.componentStack).toHaveLength(4000);
    expect(blob.size).toBeLessThan(16 * 1024);
  });

  it('mesmo erro so e enviado 1 vez por sessao', () => {
    reportClientError(new Error('boom'), { routePattern: '/x' });
    reportClientError(new Error('boom'), { routePattern: '/x' });
    expect(beacon).toHaveBeenCalledTimes(1);
  });

  it('nunca lanca, mesmo com beacon quebrado', () => {
    beacon.mockImplementationOnce(() => {
      throw new Error('bloqueado');
    });
    expect(() => reportClientError(new Error('x'))).not.toThrow();
  });
});
