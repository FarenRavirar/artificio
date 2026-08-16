import { act, renderHook, waitFor } from '@testing-library/react';
import { useCommunityConversation } from './useCommunityConversation';
import type { CommentsThread, ConversationMoreNode } from '@artificio/comments';

/**
 * T5.4 (spec 090) — travas do host da conversa que só aparecem no hook.
 *
 * O que este arquivo guarda é a **identidade** da conversa carregada. O
 * componente já cobre rota, credencial e degradação
 * (`MaterialConversation.test.tsx`); o que passa por baixo dele é a paginação
 * de `more`, que vive em estado próprio e sobrevive a re-render — inclusive ao
 * re-render que troca de material.
 */

/** `conversationCommentSchema` exige UUID em `id`/`root_id` — string livre reprova o parse inteiro. */
const ID_A = '11111111-1111-4111-8111-111111111111';
const ID_B = '22222222-2222-4222-8222-222222222222';

function thread(id: string, body: string, revision = 1): CommentsThread {
  return {
    state: 'fresh',
    snapshot_revision: revision,
    comments: [
      {
        id,
        root_id: id,
        parent_id: null,
        depth: 0,
        body_markdown: body,
        created_at: '2026-08-01T10:00:00.000Z',
        edited_at: null,
        state: 'visible',
        author: { display_name: 'Alguém', avatar_url: null, badge: null, state: 'active' },
        upvotes: 0,
        downvotes: 0,
        score: 0,
        my_vote: 0,
        legacy: null,
        viewer_is_author: false,
      },
    ],
    more: [],
    truncated: false,
  } as unknown as CommentsThread;
}

function jsonResponse(body: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/**
 * Corpos visíveis agora — **espera positiva**, nunca `waitFor` com asserção
 * negativa.
 *
 * `waitFor(() => expect(x).not.toContain(y))` passa na PRIMEIRA avaliação, antes
 * de o rerender propagar, e por isso passa igual com o defeito presente. Foi o
 * que aconteceu na primeira versão deste arquivo: dois testes verdes que não
 * testavam nada. A forma correta é esperar o estado esperado **chegar** e só
 * então afirmar o que não pode estar nele.
 */
async function corposApos(
  ler: () => readonly string[],
  esperado: string,
): Promise<readonly string[]> {
  await waitFor(() => expect(ler()).toContain(esperado));
  return ler();
}

describe('páginas de "carregar mais" pertencem a uma conversa só', () => {
  /**
   * O defeito que este teste existe para pegar: `snapshot_revision` é por
   * assunto, então dois materiais recém-criados chegam ambos em revisão 1.
   * Enquanto as páginas mescladas não carregavam a identidade que as produziu,
   * trocar de material mantinha a árvore anterior na tela — comentário de outro
   * material, sem nada que o distinguisse de dado real.
   */
  it('descarta a página mesclada ao trocar de material, mesmo com a mesma revisão', async () => {
    vi.stubGlobal('fetch', vi.fn(() => jsonResponse(thread(ID_B, 'Fala do material 2'))));

    const { result, rerender } = renderHook(
      ({ materialId }: { materialId: string }) =>
        useCommunityConversation({ materialId, userId: 'user-1' }),
      { initialProps: { materialId: 'material-1' } },
    );

    await waitFor(() => expect(result.current.state.status).toBe('fresh'));

    // Mescla uma página no material 1. Mesma `snapshot_revision` do material 2:
    // é exatamente a colisão que o teste precisa reproduzir.
    await act(async () => {
      await result.current.loadMore(
        thread(ID_A, 'Fala do material 1'),
        { cursor: 'cursor-1' } as ConversationMoreNode,
      );
    });

    rerender({ materialId: 'material-2' });

    const corpos = await corposApos(
      () => (result.current.state.data?.comments ?? []).map((c) => c.body_markdown ?? ''),
      'Fala do material 2',
    );
    expect(corpos).not.toContain('Fala do material 1');
  });

  it('descarta a página mesclada ao trocar de conta', async () => {
    vi.stubGlobal('fetch', vi.fn(() => jsonResponse(thread(ID_B, 'Fala vista pela conta B'))));

    const { result, rerender } = renderHook(
      ({ userId }: { userId: string }) =>
        useCommunityConversation({ materialId: 'material-1', userId }),
      { initialProps: { userId: 'user-a' } },
    );

    await waitFor(() => expect(result.current.state.status).toBe('fresh'));

    await act(async () => {
      await result.current.loadMore(
        thread(ID_A, 'Fala vista pela conta A'),
        { cursor: 'cursor-1' } as ConversationMoreNode,
      );
    });

    rerender({ userId: 'user-b' });

    const corpos = await corposApos(
      () => (result.current.state.data?.comments ?? []).map((c) => c.body_markdown ?? ''),
      'Fala vista pela conta B',
    );
    expect(corpos).not.toContain('Fala vista pela conta A');
  });
});
