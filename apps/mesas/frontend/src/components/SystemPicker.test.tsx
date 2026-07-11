// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SystemPicker } from './SystemPicker';
import type { SystemTreeNode } from '../types/systems';

// Comportamento de árvore em cascata/busca/multi-seleção é coberto em
// packages/catalog-ui/src/CatalogTree.test.tsx (I8.6, spec 062). Este arquivo
// cobre só o que é específico do wrapper: mapeamento SystemTreeNode -> CatalogUiNode.
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
    children: [],
  },
];

describe('SystemPicker (wrapper mesas sobre @artificio/catalog-ui)', () => {
  it('mapeia slug (SystemTreeNode) e renderiza via CatalogTree', () => {
    render(
      <SystemPicker
        tree={tree}
        selectedIds={[]}
        onSelectionChange={vi.fn()}
        idPrefix="systems"
      />
    );

    expect(screen.queryByText('Dungeons & Dragons')).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Buscar sistema...'), {
      target: { value: 'Dungeons' },
    });

    expect(screen.getByText('Dungeons & Dragons')).toBeInTheDocument();
  });

  it('onEdit recebe o SystemTreeNode original (não o CatalogUiNode mapeado)', () => {
    const onEdit = vi.fn();

    render(
      <SystemPicker
        tree={tree}
        selectedIds={[]}
        onSelectionChange={vi.fn()}
        idPrefix="systems"
        role="admin"
        onEdit={onEdit}
      />
    );

    fireEvent.change(screen.getByPlaceholderText('Buscar sistema...'), {
      target: { value: 'Dungeons' },
    });

    fireEvent.click(screen.getByLabelText('Editar Dungeons & Dragons'));

    expect(onEdit).toHaveBeenCalledWith(tree[0]);
  });

  it('seleção retorna IDs originais (single)', () => {
    const onSelectionChange = vi.fn();

    render(
      <SystemPicker
        tree={tree}
        selectedIds={[]}
        onSelectionChange={onSelectionChange}
        idPrefix="systems"
        mode="single"
      />
    );

    fireEvent.change(screen.getByPlaceholderText('Buscar sistema...'), {
      target: { value: 'Dungeons' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Dungeons & Dragons/ }));

    expect(onSelectionChange).toHaveBeenCalledWith(['dnd']);
  });
});
