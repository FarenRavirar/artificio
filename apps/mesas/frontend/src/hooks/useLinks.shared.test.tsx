// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
// `let` porque cada teste reimporta o módulo para zerar o store (ver beforeEach).
let { useLinks } = await import('./useLinks');

/**
 * Estado compartilhado entre instâncias do `useLinks` (spec 099, fase G).
 *
 * Antes cada chamada guardava a própria lista em `useState`, e as escritas
 * atualizavam só quem chamou. Com um consumidor por tela isso nunca apareceu;
 * a fase G criou o segundo — a lateral do editor CONTA os links para a
 * pendência de "Onde te achar", enquanto o `LinksManager` é quem ADICIONA.
 * O mestre adicionava um link, a lista crescia e o contador ao lado ficava
 * parado até recarregar a página — contradizendo o "número cai ao preencher,
 * sem recarregar" que o A12 promete. Achado do Codex na PR #304.
 */

const { authGet, authPost, authPatch } = vi.hoisted(() => ({
  authGet: vi.fn(),
  authPost: vi.fn(),
  authPatch: vi.fn(),
}));

const { authState } = vi.hoisted(() => ({
  authState: { isAuthenticated: true, user: { id: 'user-a' } as { id: string } | null },
}));

vi.mock('../utils/authenticatedFetch', () => ({
  authGet, authPost, authDelete: vi.fn(), authPatch,
}));
vi.mock('../contexts/useAuth', () => ({ useAuth: () => authState }));

// Shape completo do `isUserLink` (useLinks.ts:60): faltando qualquer um destes
// campos o payload é descartado na normalização, e o teste falharia por
// fixture pobre em vez de por defeito real.
const link = (id: string, url: string) => ({
  id,
  user_id: 'u1',
  url,
  type: 'youtube',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
});

const jsonOk = (data: unknown) => ({
  ok: true,
  headers: { get: () => 'application/json' },
  json: async () => ({ data }),
});

beforeEach(async () => {
  authGet.mockReset();
  authPost.mockReset();
  authPatch.mockReset();
  authGet.mockResolvedValue(jsonOk([]));
  authState.isAuthenticated = true;
  authState.user = { id: 'user-a' };

  // O store é de MÓDULO: sem zerar, o que um teste publica vaza para o
  // seguinte e a ordem dos testes passa a importar — o segundo passaria por
  // herdar o link do primeiro, não por mérito próprio. `resetModules` +
  // reimportação dá a cada teste um store limpo.
  vi.resetModules();
  ({ useLinks } = await import('./useLinks'));
});

describe('useLinks — estado compartilhado entre instâncias (G)', () => {
  it('link adicionado numa instância aparece na outra, sem recarregar', async () => {
    // Duas instâncias, como na tela real: o LinksManager e a lateral que conta.
    const escritor = renderHook(() => useLinks());
    const contador = renderHook(() => useLinks());

    await waitFor(() => expect(escritor.result.current.loading).toBe(false));
    expect(contador.result.current.links).toHaveLength(0);

    authPost.mockResolvedValue(jsonOk(link('l1', 'https://youtube.com/@mestre')));

    await act(async () => {
      await escritor.result.current.addLink('https://youtube.com/@mestre');
    });

    // É esta asserção que falha com estado local por instância.
    await waitFor(() => expect(contador.result.current.links).toHaveLength(1));
    expect(escritor.result.current.links).toHaveLength(1);
  });

  it('a lista inicial de uma instância nova já reflete o que o store tem', async () => {
    authGet.mockResolvedValue(jsonOk([link('l2', 'https://twitch.tv/mestre')]));

    const primeira = renderHook(() => useLinks());
    await waitFor(() => expect(primeira.result.current.links).toHaveLength(1));

    // Montada depois, a segunda não deve piscar vazia enquanto refaz o GET.
    const segunda = renderHook(() => useLinks());
    expect(segunda.result.current.links).toHaveLength(1);
  });
});

describe('useLinks — GET atrasado não sobrescreve mutação (geração)', () => {
  it('resposta de um GET anterior à mutação é descartada', async () => {
    // Duas instâncias na mesma tela disparam dois GETs. Se um deles responder
    // DEPOIS de um addLink bem-sucedido, publicar a lista antiga apagaria da
    // tela o link recém-criado — sem erro nenhum, e o mestre só o veria de
    // volta ao recarregar. Com estado local por instância isso não acontecia:
    // o GET atrasado só sujava a própria cópia.
    let concluirGetLento!: (r: unknown) => void;
    authGet.mockReturnValueOnce(new Promise((resolve) => { concluirGetLento = resolve; }));

    const { result } = renderHook(() => useLinks());

    authPost.mockResolvedValue(jsonOk(link('novo', 'https://youtube.com/@mestre')));
    await act(async () => {
      await result.current.addLink('https://youtube.com/@mestre');
    });
    expect(result.current.links).toHaveLength(1);

    // Só AGORA o GET antigo responde, com a lista de antes da mutação.
    await act(async () => {
      concluirGetLento(jsonOk([]));
      await Promise.resolve();
    });

    // O link criado sobrevive: a resposta velha não é mais autoritativa.
    expect(result.current.links).toHaveLength(1);
    expect(result.current.links[0].id).toBe('novo');
  });
});

describe('useLinks — store é por CONTA, não global (troca de sessão)', () => {
  it('links da conta anterior somem mesmo quando o GET da conta nova FALHA', async () => {
    // O logout não recarrega a página: `AuthContext.clearSession` só mexe em
    // estado React, e um store de módulo sobrevive a isso. Se a lista antiga
    // continuasse publicada, bastaria o GET da conta nova falhar para o
    // LinksManager mostrar os links de OUTRA pessoa — com botão de remover ao
    // lado. Achado do CodeRabbit na PR #304.
    authGet.mockResolvedValue(jsonOk([link('l1', 'https://youtube.com/@conta-a')]));

    const { result, rerender } = renderHook(() => useLinks());
    await waitFor(() => expect(result.current.links).toHaveLength(1));

    // Troca de conta, e o GET da conta B falha.
    authState.user = { id: 'user-b' };
    authGet.mockRejectedValue(new Error('rede caiu'));
    rerender();

    // É esta asserção que falha com store global: sem dono, a lista de A
    // permanece na tela de B.
    expect(result.current.links).toHaveLength(0);
    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.links).toHaveLength(0);
  });

  it('logout esvazia o store', async () => {
    authGet.mockResolvedValue(jsonOk([link('l1', 'https://youtube.com/@conta-a')]));
    const { result, rerender } = renderHook(() => useLinks());
    await waitFor(() => expect(result.current.links).toHaveLength(1));

    authState.isAuthenticated = false;
    authState.user = null;
    rerender();

    expect(result.current.links).toHaveLength(0);
  });
});

describe('useLinks — reorder preserva link criado durante a requisição', () => {
  it('addLink concluído com reorder em voo não some da lista', async () => {
    authGet.mockResolvedValue(jsonOk([link('a', 'https://youtube.com/@a'), link('b', 'https://twitch.tv/b')]));
    const { result } = renderHook(() => useLinks());
    await waitFor(() => expect(result.current.links).toHaveLength(2));

    // Reorder em voo: só conhece 'a' e 'b'.
    let concluirReorder!: (r: unknown) => void;
    authPatch.mockReturnValueOnce(new Promise((resolve) => { concluirReorder = resolve; }));
    let reorderPromise!: Promise<boolean>;
    act(() => {
      reorderPromise = result.current.reorderLinks(['b', 'a']);
    });

    // Enquanto isso, um link novo é criado.
    authPost.mockResolvedValue(jsonOk(link('c', 'https://spotify.com/c')));
    await act(async () => {
      await result.current.addLink('https://spotify.com/c');
    });
    expect(result.current.links).toHaveLength(3);

    await act(async () => {
      concluirReorder({ ok: true, headers: { get: () => 'application/json' }, json: async () => ({}) });
      await reorderPromise;
    });

    // 'c' sobrevive: reconstruir a lista só a partir de `linkIds` o apagaria.
    expect(result.current.links.map((l) => l.id)).toEqual(['b', 'a', 'c']);
  });
});

describe('useLinks — mutação em voo não publica na conta nova', () => {
  it('addLink da conta A que resolve APÓS a troca não entra na lista de B', async () => {
    // Mesma corrida que a geração resolvia para o GET, deixada aberta para as
    // mutações: o POST de A responde depois de B assumir a tela, e o link de
    // outra pessoa apareceria na lista de B — com botão de remover ao lado.
    // Achado do CodeRabbit na PR #304.
    const { result, rerender } = renderHook(() => useLinks());
    await waitFor(() => expect(result.current.loading).toBe(false));

    let concluirPost!: (r: unknown) => void;
    authPost.mockReturnValueOnce(new Promise((resolve) => { concluirPost = resolve; }));

    let addPromise!: Promise<unknown>;
    act(() => {
      addPromise = result.current.addLink('https://youtube.com/@conta-a');
    });

    // Troca de conta ANTES de o POST responder.
    authState.user = { id: 'user-b' };
    rerender();
    expect(result.current.links).toHaveLength(0);

    await act(async () => {
      concluirPost(jsonOk(link('de-a', 'https://youtube.com/@conta-a')));
      await addPromise;
    });

    // É esta asserção que falha sem a guarda de dono no setLinks.
    expect(result.current.links).toHaveLength(0);
  });
});
