// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { commentsThreadSchema, type CommentsThread } from './conversation.js';
import { createCommentsClient } from './transport.js';
import { useConversationHost, type ConversationHostConfig } from './useConversationHost.js';

/**
 * Comportamento de ESTADO do host: `loadMore` e `reload` (T6.4, spec 090).
 *
 * `useConversationHost.test.ts` cobre o transporte — o que a requisição leva.
 * Aqui é o que fica na tela depois, que é onde os dois achados de review
 * moravam: `reload` que não esperava a árvore nova, e mesclagem impura dentro
 * do updater de `setPages`.
 *
 * Sem `@testing-library/react`: o pacote não a declara, e o padrão daqui é
 * `act` + `createRoot` (`CommentsConversation.test.tsx`). Adicionar dependência
 * para viabilizar teste é decisão do mantenedor, não efeito colateral.
 */

const CONFIG: ConversationHostConfig = {
  subjectType: 'site.post',
  sourceApp: 'site',
  conversationPath: '/api/v1/community/conversation',
  reportPath: (id) => `/api/v1/community/comments/${encodeURIComponent(id)}/reports`,
};

const comentario = (id: string) => ({
  id,
  parent_id: null,
  root_id: id,
  depth: 0,
  body_markdown: 'olá',
  created_at: '2026-08-16T10:00:00.000Z',
  edited_at: null,
  state: 'visible',
  author: { display_name: 'Ana', avatar_url: null, badge: null, state: 'active' },
  upvotes: 0,
  downvotes: 0,
  score: 0,
  my_vote: 0,
  legacy: null,
});

const arvore = (
  comentarios: string[],
  more: Array<{ parent_id: null; count: number; cursor: string }>,
  revision = 3,
): CommentsThread => commentsThreadSchema.parse({
  state: 'fresh',
  snapshot_revision: revision,
  comments: comentarios.map(comentario),
  more,
  truncated: more.length > 0,
});

const reactTestEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

beforeAll(() => {
  reactTestEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
});

afterAll(() => {
  reactTestEnvironment.IS_REACT_ACT_ENVIRONMENT = false;
});

const raizes: Root[] = [];

afterEach(() => {
  for (const root of raizes.splice(0)) act(() => root.unmount());
  vi.restoreAllMocks();
});

type Host = ReturnType<typeof useConversationHost>;

/**
 * Monta o hook e devolve a referência viva do que ele retorna, mais a contagem
 * de leituras que o resource disparou.
 */
function montarHost(leituras: CommentsThread[]) {
  const chamadas = { read: 0 };
  const client = createCommentsClient({
    transport: {
      execute: async () => {
        const indice = Math.min(chamadas.read, leituras.length - 1);
        chamadas.read += 1;
        return leituras[indice];
      },
    },
  });

  const capturado: { atual: Host | null } = { atual: null };
  function Sonda() {
    capturado.atual = useConversationHost({
      subjectId: '42',
      config: CONFIG,
      client,
    });
    return null;
  }

  const container = document.createElement('div');
  const root = createRoot(container);
  raizes.push(root);
  act(() => root.render(<Sonda />));

  return { capturado, chamadas };
}

/** Espera o `autoLoad` do resource assentar antes de asserir. */
async function assentar() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('estado do host da conversa', () => {
  it('acumula páginas de more concorrentes em vez de uma descartar a outra', async () => {
    const base = arvore(['a0000000-0000-4000-8000-000000000000'], [
      { parent_id: null, count: 1, cursor: 'c1' },
      { parent_id: null, count: 1, cursor: 'c2' },
    ]);
    const { capturado } = montarHost([base]);
    await assentar();

    const pagina1 = arvore(['a0000000-0000-4000-8000-000000000001'], [
      { parent_id: null, count: 1, cursor: 'c2' },
    ]);
    const pagina2 = arvore(['a0000000-0000-4000-8000-000000000002'], []);

    // As duas resolvem na MESMA volta: é o caso que o updater funcional (e
    // agora a ref) existe para cobrir. Lendo o valor capturado no render, a
    // segunda mesclagem partiria da árvore original e apagaria a primeira.
    await act(async () => {
      await Promise.all([
        capturado.atual!.loadMore(pagina1, { parent_id: null, count: 1, cursor: 'c1' }),
        capturado.atual!.loadMore(pagina2, { parent_id: null, count: 1, cursor: 'c2' }),
      ]);
    });

    const ids = capturado.atual!.state.data?.comments.map((c) => c.id) ?? [];
    expect(ids).toHaveLength(3);
  });

  it('reload espera a leitura nova antes de resolver', async () => {
    const primeira = arvore(['a0000000-0000-4000-8000-000000000000'], []);
    const segunda = arvore([
      'a0000000-0000-4000-8000-000000000000',
      'a0000000-0000-4000-8000-000000000009',
    ], [], 4);
    const { capturado, chamadas } = montarHost([primeira, segunda]);
    await assentar();

    const antes = chamadas.read;
    // O pacote faz `await onActionComplete?.()` antes de anunciar sucesso. Se
    // `reload` devolvesse `void`, o "Comentário publicado." apareceria com a
    // árvore antiga ainda na tela — o comentário recém-escrito parecendo
    // perdido.
    await act(async () => {
      await capturado.atual!.reload();
    });

    expect(chamadas.read).toBeGreaterThan(antes);
    expect(capturado.atual!.state.data?.comments).toHaveLength(2);
  });

  it('reload descarta a página mesclada, que é retrato da revisão anterior', async () => {
    const base = arvore(['a0000000-0000-4000-8000-000000000000'], [
      { parent_id: null, count: 1, cursor: 'c1' },
    ]);
    // MESMA revisão da base, de propósito: com revisão diferente o
    // `effectiveState` já descartaria a página mesclada sozinho, e o teste
    // passaria mesmo sem `setPages(null)` no `reload` — foi o que a mutação
    // mostrou. O caso que exige a limpeza é a recarga que devolve a mesma
    // revisão (moderação ocultou um comentário, por exemplo).
    const depois = arvore(['a0000000-0000-4000-8000-000000000000'], []);
    const { capturado } = montarHost([base, depois]);
    await assentar();

    await act(async () => {
      await capturado.atual!.loadMore(
        arvore(['a0000000-0000-4000-8000-000000000001'], []),
        { parent_id: null, count: 1, cursor: 'c1' },
      );
    });
    expect(capturado.atual!.state.data?.comments).toHaveLength(2);

    await act(async () => {
      await capturado.atual!.reload();
    });

    // Sem `setPages(null)` no `reload`, a página mesclada sobreviveria à
    // recarga e o `effectiveState` continuaria cobrindo a leitura nova até a
    // revisão mudar — escondendo o que acabou de ser escrito.
    expect(capturado.atual!.state.data?.comments).toHaveLength(1);
  });

  it('recarrega quando a revisão diverge, em vez de exibir árvore inconsistente', async () => {
    const base = arvore(['a0000000-0000-4000-8000-000000000000'], [
      { parent_id: null, count: 1, cursor: 'c1' },
    ]);
    const { capturado, chamadas } = montarHost([base]);
    await assentar();

    const antes = chamadas.read;
    // Revisão 9 contra a 3 da base: `mergeCommentsThreadPage` recusa, e o host
    // precisa degradar para recarga — nunca colar páginas incompatíveis.
    await act(async () => {
      await capturado.atual!.loadMore(
        arvore(['a0000000-0000-4000-8000-000000000001'], [], 9),
        { parent_id: null, count: 1, cursor: 'c1' },
      );
    });

    expect(chamadas.read).toBeGreaterThan(antes);
    expect(capturado.atual!.state.data?.comments).toHaveLength(1);
  });
});
