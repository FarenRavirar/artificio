import { useEffect } from 'react';

// Spec 088 (T0.1) — canonical route-aware, herdada da T4.4 da spec 087.
//
// O alvo e PARAMETRO FIXO, nunca derivado da rota ou da query string atual.
// Motivo: `/` e `/catalogo` servem exatamente o mesmo conteudo (decisao
// central da 087 — home = catalogo) e as query strings sao recortes da mesma
// listagem. Derivar o canonical da URL corrente apontaria cada recorte pra si
// mesmo, que e justamente a diluicao de sinal que a tag existe pra evitar.
//
// Por que hook e nao tag estatica no `index.html`: o fallback SPA serviria o
// mesmo `index.html` pra ficha, painel e gestao, e todas herdariam um
// canonical apontando pro catalogo. A tag tem que nascer e morrer com a
// pagina que a declara.

function resolveBaseUrl(): string {
  const configured = import.meta.env.VITE_PUBLIC_SITE_URL;
  // A var e injetada no build (Dockerfile/compose). Em teste e em dev sem
  // `.env` ela chega vazia — cair pro `window.location.origin` mantem o href
  // absoluto (exigencia do canonical) em vez de emitir URL relativa invalida.
  if (typeof configured === 'string' && configured.trim().length > 0) {
    return configured.trim().replace(/\/+$/, '');
  }
  return window.location.origin;
}

/**
 * Declara o `<link rel="canonical">` da pagina atual.
 *
 * @param path Caminho absoluto do alvo (ex.: `/`). Fixo por chamada — nao
 *   passar a rota corrente nem a query string.
 */
export function useCanonicalUrl(path: string): void {
  useEffect(() => {
    const href = new URL(path, `${resolveBaseUrl()}/`).toString();

    // Remove qualquer canonical pre-existente antes de inserir a propria:
    // duas tags no `head` fazem o crawler ignorar ambas.
    document.head
      .querySelectorAll('link[rel="canonical"]')
      .forEach((tag) => tag.remove());

    const link = document.createElement('link');
    link.rel = 'canonical';
    link.href = href;
    document.head.appendChild(link);

    return () => {
      link.remove();
    };
  }, [path]);
}
