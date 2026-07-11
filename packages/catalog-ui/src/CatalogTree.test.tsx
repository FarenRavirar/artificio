// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CatalogTree } from './CatalogTree.js';
import type { CatalogUiNode } from './types.js';

const tree: CatalogUiNode[] = [
  {
    id: 'dnd',
    name: 'Dungeons & Dragons',
    name_pt: null,
    canonical_slug: 'dungeons-dragons',
    parent_id: null,
    node_type: 'system',
    path_slug: 'dungeons-dragons',
    aliases: ['D&D', 'DnD'],
    children: [
      {
        id: 'dnd-3-5',
        name: '3.5e',
        name_pt: null,
        canonical_slug: '3-5e',
        parent_id: 'dnd',
        node_type: 'edition',
        path_slug: 'dungeons-dragons/3-5e',
        aliases: [],
        children: [],
      },
      {
        id: 'dnd-5e',
        name: '5e',
        name_pt: '5ª edição',
        canonical_slug: '5e',
        parent_id: 'dnd',
        node_type: 'edition',
        path_slug: 'dungeons-dragons/5e',
        aliases: ['5th ed'],
        children: [
          {
            id: 'dnd-2024',
            name: '2024',
            name_pt: null,
            canonical_slug: '2024',
            parent_id: 'dnd-5e',
            node_type: 'variant',
            path_slug: 'dungeons-dragons/5e/2024',
            aliases: [],
            children: [],
          },
        ],
      },
    ],
  },
  {
    id: 'vampiro',
    name: 'Vampire',
    name_pt: 'Vampiro',
    canonical_slug: 'vampire',
    parent_id: null,
    node_type: 'system',
    path_slug: 'vampire',
    aliases: [],
    children: [],
  },
];

describe('CatalogTree', () => {
  it('não lista sistemas antes de digitar (evita despejar a árvore inteira)', () => {
    render(
      <CatalogTree
        tree={tree}
        selectedIds={[]}
        onSelectionChange={vi.fn()}
        idPrefix="systems"
      />
    );

    expect(screen.queryByText('Dungeons & Dragons')).not.toBeInTheDocument();
    expect(screen.queryByText('Vampire')).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Buscar sistema...'), {
      target: { value: 'Dungeons' },
    });

    expect(screen.getByText('Dungeons & Dragons')).toBeInTheDocument();
    expect(screen.queryByText('5e')).not.toBeInTheDocument();
    expect(screen.queryByText('2024')).not.toBeInTheDocument();
  });

  it('ao selecionar sistema, mostra edições dele; ao selecionar edição, mostra variantes', () => {
    const onSelectionChange = vi.fn();
    const { rerender } = render(
      <CatalogTree
        tree={tree}
        selectedIds={[]}
        onSelectionChange={onSelectionChange}
        idPrefix="systems"
      />
    );

    fireEvent.change(screen.getByPlaceholderText('Buscar sistema...'), {
      target: { value: 'Dungeons' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Dungeons & Dragons/ }));
    expect(onSelectionChange).toHaveBeenCalledWith(['dnd']);

    rerender(
      <CatalogTree
        tree={tree}
        selectedIds={['dnd']}
        onSelectionChange={onSelectionChange}
        idPrefix="systems"
      />
    );

    expect(screen.getByText('3.5e')).toBeInTheDocument();
    expect(screen.getByText('5e')).toBeInTheDocument();
    expect(screen.queryByText('2024')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^5e/ }));
    expect(onSelectionChange).toHaveBeenCalledWith(['dnd-5e']);

    rerender(
      <CatalogTree
        tree={tree}
        selectedIds={['dnd-5e']}
        onSelectionChange={onSelectionChange}
        idPrefix="systems"
      />
    );

    expect(screen.getByText('2024')).toBeInTheDocument();
  });

  it('busca filtra só o nível de sistemas', () => {
    render(
      <CatalogTree
        tree={tree}
        selectedIds={[]}
        onSelectionChange={vi.fn()}
        idPrefix="systems"
      />
    );

    fireEvent.change(screen.getByPlaceholderText('Buscar sistema...'), {
      target: { value: 'Vamp' },
    });

    expect(screen.getByText('Vampire')).toBeInTheDocument();
    expect(screen.queryByText('Dungeons & Dragons')).not.toBeInTheDocument();
  });

  it('oculta resultados vazios quando configurado como busca fechada', () => {
    render(
      <CatalogTree
        tree={tree}
        selectedIds={[]}
        onSelectionChange={vi.fn()}
        idPrefix="systems"
        showEmptySearchResults={false}
      />,
    );

    expect(screen.queryByText('Dungeons & Dragons')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Buscar sistema...'), {
      target: { value: 'Dungeons' },
    });

    expect(screen.getByText('Dungeons & Dragons')).toBeInTheDocument();
  });

  it('mostra ações por role quando busca não encontra resultado', () => {
    const onSuggest = vi.fn();
    const onCreateNow = vi.fn();

    render(
      <CatalogTree
        tree={tree}
        selectedIds={[]}
        onSelectionChange={vi.fn()}
        idPrefix="systems"
        role="admin"
        onSuggest={onSuggest}
        onCreateNow={onCreateNow}
      />
    );

    fireEvent.change(screen.getByPlaceholderText('Buscar sistema...'), {
      target: { value: 'Shadowdark' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Sugerir/i }));
    fireEvent.click(screen.getByRole('button', { name: /Criar agora/i }));

    expect(onSuggest).toHaveBeenCalledWith('Shadowdark');
    expect(onCreateNow).toHaveBeenCalledWith('Shadowdark');
  });

  it('em modo multi, clicar no sistema também revela edições (drill-down independente da seleção)', () => {
    const onSelectionChange = vi.fn();

    render(
      <CatalogTree
        tree={tree}
        selectedIds={[]}
        onSelectionChange={onSelectionChange}
        idPrefix="systems"
        mode="multi"
      />
    );

    fireEvent.change(screen.getByPlaceholderText('Buscar sistema...'), {
      target: { value: 'Dungeons' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Dungeons & Dragons/ }));

    expect(onSelectionChange).toHaveBeenCalledWith(['dnd']);
    expect(screen.getByText('3.5e')).toBeInTheDocument();
    expect(screen.getByText('5e')).toBeInTheDocument();
  });

  it('permite múltipla seleção de sistemas e remoção individual', () => {
    const onSelectionChange = vi.fn();

    render(
      <CatalogTree
        tree={tree}
        selectedIds={['dnd', 'vampiro']}
        onSelectionChange={onSelectionChange}
        idPrefix="systems"
        mode="multi"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Remover Vampire' }));
    expect(onSelectionChange).toHaveBeenCalledWith(['dnd']);
  });

  it('admin vê botão de adicionar em cada nível', () => {
    render(
      <CatalogTree
        tree={tree}
        selectedIds={['dnd']}
        onSelectionChange={vi.fn()}
        idPrefix="systems"
        role="admin"
        onCreateNow={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /Adicionar sistema/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Adicionar edição/ })).toBeInTheDocument();
  });
});
