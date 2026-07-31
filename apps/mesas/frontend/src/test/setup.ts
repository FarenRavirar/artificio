import { expect, afterEach } from 'vitest';
import { cleanup, configure } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

// Estende expect com matchers do jest-dom
expect.extend(matchers);

// `waitFor`/`findBy*` usam 1s por padrão, independente do `testTimeout` do
// Vitest. Na suíte do monorepo estes 191 testes de jsdom disputam CPU com os
// outros 37 pacotes, e 1s não cobre o atraso de agendamento — mesma causa do
// timeout de `suggestionModals` tratado em `vitest.config.ts`. Sem ambiente
// carregado nada muda: o `waitFor` sai assim que a condição vira verdadeira.
configure({ asyncUtilTimeout: 5_000 });

// Cleanup após cada teste
afterEach(() => {
  cleanup();
});

// Mock de window.matchMedia (necessário para alguns componentes)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {}, // deprecated
    removeListener: () => {}, // deprecated
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// Mock de IntersectionObserver (necessário para lazy loading)
globalThis.IntersectionObserver = class IntersectionObserver implements IntersectionObserver {
  readonly root: Element | Document | null = null;
  readonly rootMargin: string = '';
  readonly scrollMargin: string = '';
  readonly thresholds: ReadonlyArray<number> = [];

  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return [];
  }
  unobserve() {}
};
