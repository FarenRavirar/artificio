// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SystemPicker } from './SystemPicker';
import type { SystemTreeNode } from '../types/systems';

const tree: SystemTreeNode[] = [
  {
    id: 'dnd',
    name: 'Dungeons & Dragons',
    name_pt: null,
    slug: 'dungeons-dragons',
    parent_id: null,
    node_type: 'system',
    path_slug: 'dungeons-dragons',
    aliases: ['D&D', 'DnD'],
    children: [
      {
        id: 'dnd-3-5',
        name: '3.5e',
        name_pt: null,
        slug: '3-5e',
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
        slug: '5e',
        parent_id: 'dnd',
        node_type: 'edition',
        path_slug: 'dungeons-dragons/5e',
        aliases: ['5th ed'],
        children: [
          {
            id: 'dnd-2024',
            name: '2024',
            name_pt: null,
            slug: '2024',
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
    slug: 'vampire',
    parent_id: null,
    node_type: 'system',
    path_slug: 'vampire',
    aliases: [],
    children: [],
  },
];

describe('SystemPicker', () => {
  it('renderiza árvore com nome próprio, nome PT, aliases e caminho selecionado', () => {
    const onSelectionChange = vi.fn();

    render(
      <SystemPicker
        tree={tree}
        selectedIds={['dnd-2024']}
        onSelectionChange={onSelectionChange}
        idPrefix="systems"
      />
    );

    expect(screen.getByText('Dungeons & Dragons')).toBeInTheDocument();
    expect(screen.getAllByText('nome PT: —').length).toBeGreaterThan(0);
    expect(screen.getByText('D&D +1')).toBeInTheDocument();
    expect(screen.getByText('5e')).toBeInTheDocument();
    expect(screen.getByText('nome PT: 5ª edição')).toBeInTheDocument();
    expect(screen.getByText('Dungeons & Dragons › 5e › 2024')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Limpar seleção' }));
    expect(onSelectionChange).toHaveBeenCalledWith([]);
  });

  it('filtra mantendo ancestral visível e seleciona em modo single', () => {
    const onSelectionChange = vi.fn();

    render(
      <SystemPicker
        tree={tree}
        selectedIds={[]}
        onSelectionChange={onSelectionChange}
        idPrefix="systems"
      />
    );

    fireEvent.change(screen.getByPlaceholderText('Buscar sistema, edição ou variante...'), {
      target: { value: '2024' },
    });

    expect(screen.getByText('Dungeons & Dragons')).toBeInTheDocument();
    expect(screen.getByText('5e')).toBeInTheDocument();
    expect(screen.getByText('2024')).toBeInTheDocument();
    expect(screen.queryByText('Vampire')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /2024.*nome PT:/ }));
    expect(onSelectionChange).toHaveBeenCalledWith(['dnd-2024']);
  });

  it('mostra ações por role quando busca não encontra resultado', () => {
    const onSuggest = vi.fn();
    const onCreateNow = vi.fn();

    render(
      <SystemPicker
        tree={tree}
        selectedIds={[]}
        onSelectionChange={vi.fn()}
        idPrefix="systems"
        role="admin"
        onSuggest={onSuggest}
        onCreateNow={onCreateNow}
      />
    );

    fireEvent.change(screen.getByPlaceholderText('Buscar sistema, edição ou variante...'), {
      target: { value: 'Shadowdark' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Sugerir/i }));
    fireEvent.click(screen.getByRole('button', { name: /Criar agora/i }));

    expect(onSuggest).toHaveBeenCalledWith('Shadowdark');
    expect(onCreateNow).toHaveBeenCalledWith('Shadowdark');
  });

  it('permite múltipla seleção e remoção individual', () => {
    const onSelectionChange = vi.fn();

    render(
      <SystemPicker
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
});
