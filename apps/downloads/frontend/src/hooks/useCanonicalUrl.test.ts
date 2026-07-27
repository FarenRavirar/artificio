import { describe, expect, it, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCanonicalUrl } from './useCanonicalUrl';

// Spec 088 (T0.2) — os cinco comportamentos que a canonical precisa garantir.
// `VITE_PUBLIC_SITE_URL` chega vazia no vitest (vitest.config.ts), entao o
// href esperado se ancora em `window.location.origin` — mesmo fallback que
// roda em dev sem `.env`.

function canonicalTags(): HTMLLinkElement[] {
  return Array.from(
    document.head.querySelectorAll<HTMLLinkElement>('link[rel="canonical"]'),
  );
}

describe('useCanonicalUrl', () => {
  beforeEach(() => {
    document.head.querySelectorAll('link[rel="canonical"]').forEach((tag) => tag.remove());
  });

  it('cria a tag com href absoluto', () => {
    renderHook(() => useCanonicalUrl('/'));

    const tags = canonicalTags();
    expect(tags).toHaveLength(1);
    expect(tags[0].href).toBe(`${window.location.origin}/`);
  });

  it('mantem uma unica tag apos multiplos rerenders', () => {
    const { rerender } = renderHook(() => useCanonicalUrl('/'));

    rerender();
    rerender();
    rerender();

    expect(canonicalTags()).toHaveLength(1);
  });

  it('substitui tag pre-existente no head em vez de duplicar', () => {
    // Duas canonical no `head` fazem o crawler ignorar ambas — o hook tem que
    // limpar o que achar antes de inserir a sua.
    const stale = document.createElement('link');
    stale.rel = 'canonical';
    stale.href = 'https://exemplo.invalido/antigo';
    document.head.appendChild(stale);

    renderHook(() => useCanonicalUrl('/'));

    const tags = canonicalTags();
    expect(tags).toHaveLength(1);
    expect(tags[0].href).toBe(`${window.location.origin}/`);
    expect(document.head.contains(stale)).toBe(false);
  });

  it('mantem o alvo na raiz mesmo com query string na URL', () => {
    // O alvo e parametro fixo: recorte da listagem (`?q=`, `?sort=`, `?page=`)
    // consolida na raiz, senao cada filtro competiria como URL propria.
    window.history.pushState({}, '', '/catalogo?q=dragao&sort=rating&page=3');

    renderHook(() => useCanonicalUrl('/'));

    expect(canonicalTags()[0].href).toBe(`${window.location.origin}/`);

    window.history.pushState({}, '', '/');
  });

  it('remove a tag no unmount', () => {
    const { unmount } = renderHook(() => useCanonicalUrl('/'));
    expect(canonicalTags()).toHaveLength(1);

    unmount();

    expect(canonicalTags()).toHaveLength(0);
  });
});
