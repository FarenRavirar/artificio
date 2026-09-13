import { describe, it, expect } from 'vitest';
import { redirectTo } from './redirect';

/**
 * O que estes testes travam é o `replace` — não o destino.
 *
 * As 6 rotas legadas usavam `<Navigate replace />` antes da migração para
 * framework mode (`App.tsx` em `49ac4b1`). A troca por `redirect()` perdeu o
 * `replace` em silêncio: o alias passou a EMPILHAR entrada de histórico, então
 * clicar em buscar (`AppShell.tsx:41`) levava a `/catalogo` e o Voltar caía em
 * `/busca`, que redirecionava de novo — o visitante ficava preso, sem conseguir
 * voltar à página anterior. Nada falhava; a navegação só não obedecia.
 *
 * Achado do Codex (P2) na PR #319.
 */
function chamar(loader: ReturnType<typeof redirectTo>, params: Record<string, string | undefined> = {}) {
  // O loader só lê `params`; o resto da assinatura não participa.
  return loader({ params } as unknown as Parameters<typeof loader>[0]) as Response;
}

describe('redirectTo — alias de rota legada', () => {
  it('substitui a entrada de histórico em vez de empilhar', () => {
    // 302 é o status que o helper `replace` do React Router emite, e o
    // `X-Remix-Replace` é o que instrui o cliente a usar `history.replaceState`.
    // Sem ele o Voltar volta para o alias e redireciona de novo.
    const response = chamar(redirectTo('/catalogo'));

    expect(response.headers.get('X-Remix-Replace')).toBe('true');
  });

  it('redireciona para o destino declarado', () => {
    const response = chamar(redirectTo('/catalogo'));

    expect(response.headers.get('Location')).toBe('/catalogo');
    expect(response.status).toBe(302);
  });

  it('preserva o `:sub?` do deep link antigo', () => {
    // `/gestao/moderacao/rascunhos` precisa chegar na aba certa, não na raiz da
    // seção — perder o `sub` transformaria link antigo em link quase-quebrado.
    const response = chamar(redirectTo('/gestao/mesas'), { sub: 'rascunhos' });

    expect(response.headers.get('Location')).toBe('/gestao/mesas/rascunhos');
    expect(response.headers.get('X-Remix-Replace')).toBe('true');
  });

  it('sem `sub`, não deixa barra sobrando no destino', () => {
    const response = chamar(redirectTo('/gestao/visao-geral'), { sub: undefined });

    expect(response.headers.get('Location')).toBe('/gestao/visao-geral');
  });
});
