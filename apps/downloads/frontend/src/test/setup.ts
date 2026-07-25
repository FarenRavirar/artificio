import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import * as React from 'react';

expect.extend(matchers);

// Achado real (review PR #201, CodeRabbit, nitpick): mock de @artificio/ui
// (Header/Footer/useTheme/useChangelogBadge/CHANGELOG_UPDATE_MARKERS/
// DynamicChangelogModal) estava duplicado, idêntico, em 28 arquivos de
// teste. Setup global do vitest roda antes de cada arquivo, então mockar
// aqui elimina a duplicação sem precisar de vi.mock por arquivo (que exige
// factory inline por causa do hoisting do vitest — import de helper externo
// dentro da factory quebra com "Cannot access before initialization").
vi.mock('@artificio/ui', () => ({
  Header: () => React.createElement('div', { 'data-testid': 'header' }),
  Footer: () => React.createElement('div', { 'data-testid': 'footer' }),
  useTheme: () => ({ theme: 'dark' }),
  useChangelogBadge: () => ({ hasNewUpdate: false, markSeen: () => undefined }),
  CHANGELOG_UPDATE_MARKERS: { downloads: 'test-marker' },
  DynamicChangelogModal: () => null,
}));

afterEach(() => {
  cleanup();
});

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});
