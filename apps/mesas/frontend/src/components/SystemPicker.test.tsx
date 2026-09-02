// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

/**
 * Fontes server-side atravessando o wrapper (spec 099, fase G — G7/G5b).
 *
 * O `SystemPicker` declarava `tree` obrigatória e zero `fetch*`: furar só o
 * `CatalogTree` não teria entregado nada a quem passa por aqui. O que este
 * bloco protege é a FRONTEIRA — o consumidor fala `SystemTreeNode` (com
 * `slug`), o pacote recebe `CatalogUiNode` (com `canonical_slug`), e a
 * conversão acontece aqui, igual `tree` sempre fez.
 */
describe('SystemPicker — fontes server-side (G7/G5b)', () => {
  it('converte o resultado da busca para o contrato do pacote', async () => {
    const fetchSystemOptions = vi.fn(async () => tree);

    render(
      <SystemPicker
        selectedIds={[]}
        onSelectionChange={vi.fn()}
        idPrefix="systems"
        mode="multi"
        fetchSystemOptions={fetchSystemOptions}
      />
    );

    fireEvent.change(screen.getByPlaceholderText('Buscar sistema...'), {
      target: { value: 'Dungeons' },
    });

    await waitFor(() => expect(fetchSystemOptions).toHaveBeenCalled());
    // Renderizar prova a conversão: sem ela o nó chega sem `canonical_slug` e
    // o matcher do pacote quebraria em vez de listar.
    await waitFor(() =>
      expect(screen.getByText('Dungeons & Dragons')).toBeInTheDocument(),
    );
  });

  it('funciona SEM `tree` — é o ponto da G5b', async () => {
    render(
      <SystemPicker
        selectedIds={['dnd']}
        selectedNodes={tree}
        onSelectionChange={vi.fn()}
        idPrefix="systems"
        mode="multi"
        fetchSystemOptions={async () => []}
      />
    );

    // Nomeia a seleção salva sem baixar o catálogo: sem `selectedNodes` o
    // usuário veria a contagem certa e os nomes sumidos.
    expect(screen.getByText('Dungeons & Dragons')).toBeInTheDocument();
  });

  it('`fetchChildOptions` recebe o id do pai, não o nó do pacote', async () => {
    const fetchChildOptions = vi.fn(async () => []);

    render(
      <SystemPicker
        selectedIds={[]}
        onSelectionChange={vi.fn()}
        idPrefix="systems"
        mode="multi"
        fetchSystemOptions={async () => tree}
        fetchChildOptions={fetchChildOptions}
      />
    );

    fireEvent.change(screen.getByPlaceholderText('Buscar sistema...'), {
      target: { value: 'Dungeons' },
    });
    await waitFor(() =>
      expect(screen.getByText('Dungeons & Dragons')).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByText('Dungeons & Dragons'));

    // A assinatura do app é `(parentId, signal)`: quem consome no `mesas` não
    // deve precisar conhecer o formato de nó do pacote.
    await waitFor(() => expect(fetchChildOptions).toHaveBeenCalled());
    expect(fetchChildOptions.mock.calls[0][0]).toBe('dnd');
  });
});
