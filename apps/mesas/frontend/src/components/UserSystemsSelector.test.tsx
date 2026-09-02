// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { UserSystemsSelector } from './UserSystemsSelector';
import type { SystemTreeNode } from '../types/systems';
import type { UseSystemsSearchReturn } from '../hooks/useSystemsSearch';

/**
 * UserSystemsSelector — lista os NOMES dos sistemas selecionados (spec 099 B9).
 *
 * Antes o componente só contava ("N sistema(s) que você mestra") sem listar
 * quais. Os nomes resolvem por system_id no catálogo (`useSystemsCatalog.flat`)
 * — nunca se grava nome, só id. O `SystemPicker` é stub aqui: o comportamento
 * da árvore é coberto em SystemPicker.test.tsx e no pacote catalog-ui.
 */

const { tree } = vi.hoisted(() => {
  const tree: SystemTreeNode[] = [
    {
      id: 'sys-dnd',
      name: 'Dungeons & Dragons',
      name_pt: null,
      slug: 'dungeons-dragons',
      parent_id: null,
      node_type: 'system',
      depth: 0,
      path_slug: 'dungeons-dragons',
      aliases: [],
      children: [],
    },
    {
      id: 'sys-coc',
      name: 'Call of Cthulhu',
      name_pt: null,
      slug: 'call-of-cthulhu',
      parent_id: null,
      node_type: 'system',
      depth: 0,
      path_slug: 'call-of-cthulhu',
      aliases: [],
      children: [],
    },
  ];
  return { tree };
});

const { fetchSystemsByIds } = vi.hoisted(() => ({
  // Tipado pela assinatura real do hook, sem NOMEAR o `signal`: o wrapper do
  // `vi.mock` abaixo repassa os dois argumentos, então declarar só um quebrava
  // o `tsc -b` do CI (TS2554); nomear um parâmetro não usado quebra o lint,
  // porque este app não configura `argsIgnorePattern`.
  fetchSystemsByIds: vi.fn<UseSystemsSearchReturn['fetchSystemsByIds']>(async (ids) =>
    // Espelha a rota: devolve só o que existe, id desconhecido some da resposta
    // em vez de virar erro (systems.ts:60-63).
    tree.filter((node) => ids.includes(node.id)),
  ),
}));

// O mock devolve um OBJETO NOVO a cada chamada, com funções novas — de
// propósito. É o comportamento de um hook não memoizado (e o do mock do
// GmProfileFields, que foi onde o loop apareceu): se o componente puser essas
// funções na lista de dependências do efeito, o ciclo
// render→efeito→setState→render fecha e a suíte trava sem terminar.
vi.mock('../hooks/useSystemsSearch', () => ({
  useSystemsSearch: () => ({
    fetchSystemOptions: async () => [],
    fetchChildOptions: async () => [],
    fetchSystemsByIds: (ids: string[], signal: AbortSignal) =>
      fetchSystemsByIds(ids, signal),
  }),
}));

vi.mock('./SystemPicker', () => ({
  SystemPicker: () => <div data-testid="system-picker" />,
}));

describe('UserSystemsSelector — listagem de sistemas escolhidos (spec 099 B9)', () => {
  it('lista os nomes dos sistemas selecionados além da contagem (type gm)', async () => {
    render(
      <UserSystemsSelector
        type="gm"
        selectedSystemIds={['sys-dnd', 'sys-coc']}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
      />
    );

    expect(screen.getByText('2 sistema(s) que você mestra')).toBeTruthy();
    await waitFor(() => expect(screen.getByText('Dungeons & Dragons')).toBeTruthy());
    expect(screen.getByText('Call of Cthulhu')).toBeTruthy();
  });

  it('lista os nomes também para favoritos e tolera id que não existe mais no catálogo', async () => {
    render(
      <UserSystemsSelector
        type="favorite"
        selectedSystemIds={['sys-coc', 'sys-removido-do-catalogo']}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
      />
    );

    // Contagem é a verdade dos ids salvos; a lista mostra o que resolve.
    expect(screen.getByText('2 favorito(s)')).toBeTruthy();
    await waitFor(() => expect(screen.getByText('Call of Cthulhu')).toBeTruthy());
    expect(screen.queryByText('sys-removido-do-catalogo')).not.toBeInTheDocument();
  });

  it('não monta a lista quando nada está selecionado', () => {
    const { container } = render(
      <UserSystemsSelector
        type="gm"
        selectedSystemIds={[]}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
      />
    );

    expect(screen.getByText('0 sistema(s) que você mestra')).toBeTruthy();
    expect(container.querySelector('.selected-systems-list')).toBeNull();
  });
});

describe('UserSystemsSelector — carga sob demanda (spec 099 G5b)', () => {
  it('não baixa o catálogo inteiro: resolve só os ids salvos, numa requisição', async () => {
    fetchSystemsByIds.mockClear();

    render(
      <UserSystemsSelector
        type="gm"
        selectedSystemIds={['sys-dnd', 'sys-coc']}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
      />
    );

    await waitFor(() => expect(fetchSystemsByIds).toHaveBeenCalledTimes(1));
    // Os dois ids numa chamada só — não uma por sistema.
    expect(fetchSystemsByIds.mock.calls[0][0]).toEqual(['sys-dnd', 'sys-coc']);
  });

  it('sem seleção, não pede nada', async () => {
    fetchSystemsByIds.mockClear();

    render(
      <UserSystemsSelector
        type="gm"
        selectedSystemIds={[]}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
      />
    );

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(fetchSystemsByIds).not.toHaveBeenCalled();
  });

  it('falha ao resolver nomes avisa que os sistemas continuam salvos', async () => {
    fetchSystemsByIds.mockRejectedValueOnce(new Error('network down'));

    render(
      <UserSystemsSelector
        type="gm"
        selectedSystemIds={['sys-dnd']}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
      />
    );

    // A contagem vem dos ids salvos e continua correta; só os nomes falharam.
    // Lista vazia sem aviso leria como "o site apagou meus sistemas".
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(screen.getByText('1 sistema(s) que você mestra')).toBeTruthy();
  });
});

describe('UserSystemsSelector — identidade instável do fetch (regressão)', () => {
  it('não reentra em loop quando a função de busca muda de identidade', async () => {
    // Bug introduzido e medido em 2026-09-01: com `fetchSystemsByIds` na lista
    // de dependências do efeito, um hook que devolva função nova a cada render
    // fecha o ciclo render→efeito→setState→render. O sintoma não é erro: a
    // suíte inteira TRAVA sem terminar (600s sem saída), que é a forma mais
    // cara de falhar. A função entra por ref justamente por isso.
    fetchSystemsByIds.mockClear();

    const { rerender } = render(
      <UserSystemsSelector
        type="gm"
        selectedSystemIds={['sys-dnd']}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
      />
    );

    await waitFor(() => expect(fetchSystemsByIds).toHaveBeenCalledTimes(1));

    // Re-render sem mudar a seleção: nada a rebuscar.
    rerender(
      <UserSystemsSelector
        type="gm"
        selectedSystemIds={['sys-dnd']}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
      />
    );

    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(fetchSystemsByIds).toHaveBeenCalledTimes(1);
  });
});
