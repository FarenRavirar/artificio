// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { UserSystemsSelector } from './UserSystemsSelector';
import type { SystemTreeNode } from '../types/systems';

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

vi.mock('../hooks/useSystemsCatalog', () => ({
  useSystemsCatalog: () => ({
    tree,
    flat: tree.map((node) => ({ ...node, parent: null, ancestors: [] })),
    loading: false,
    error: null,
    forceRefresh: async () => undefined,
  }),
}));

vi.mock('./SystemPicker', () => ({
  SystemPicker: () => <div data-testid="system-picker" />,
}));

describe('UserSystemsSelector — listagem de sistemas escolhidos (spec 099 B9)', () => {
  it('lista os nomes dos sistemas selecionados além da contagem (type gm)', () => {
    render(
      <UserSystemsSelector
        type="gm"
        selectedSystemIds={['sys-dnd', 'sys-coc']}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
      />
    );

    expect(screen.getByText('2 sistema(s) que você mestra')).toBeTruthy();
    expect(screen.getByText('Dungeons & Dragons')).toBeTruthy();
    expect(screen.getByText('Call of Cthulhu')).toBeTruthy();
  });

  it('lista os nomes também para favoritos e tolera id que não existe mais no catálogo', () => {
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
    expect(screen.getByText('Call of Cthulhu')).toBeTruthy();
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
