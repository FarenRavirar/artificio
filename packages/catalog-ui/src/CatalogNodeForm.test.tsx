// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CatalogNodeForm } from './CatalogNodeForm.js';
import type { CatalogUiNode } from './types.js';

const parents: CatalogUiNode[] = [
  {
    id: 'root', parent_id: null, node_type: 'system', name: 'Sistema', name_pt: null,
    canonical_slug: 'sistema', path_slug: 'sistema', children: [],
  },
  {
    id: 'edition', parent_id: 'root', node_type: 'edition', name: 'Edição', name_pt: null,
    canonical_slug: 'edicao', path_slug: 'sistema/edicao', children: [],
  },
  {
    id: 'variant', parent_id: 'edition', node_type: 'variant', name: 'Variante', name_pt: null,
    canonical_slug: 'variante', path_slug: 'sistema/edicao/variante', children: [],
  },
];

describe('CatalogNodeForm hierarchy', () => {
  it('offers only the exact parent type for edition and variant', () => {
    render(
      <CatalogNodeForm
        idPrefix="catalog"
        selected={null}
        parentOptions={parents}
        onSave={vi.fn()}
      />,
    );

    const type = screen.getByLabelText('Tipo');
    fireEvent.change(type, { target: { value: 'edition' } });
    let parent = screen.getByLabelText('Pai');
    expect(parent).toHaveTextContent('Sistema');
    expect(parent).not.toHaveTextContent('Edição');
    expect(parent).not.toHaveTextContent('Variante');

    fireEvent.change(type, { target: { value: 'variant' } });
    parent = screen.getByLabelText('Pai');
    expect(parent).not.toHaveTextContent('Sistema');
    expect(parent).toHaveTextContent('Edição');
    expect(parent).not.toHaveTextContent('Variante');
    expect(screen.queryByText('Subsistema')).not.toBeInTheDocument();
  });

  it('requires a parent outside the system root', () => {
    render(
      <CatalogNodeForm
        idPrefix="catalog-required"
        selected={null}
        parentOptions={parents}
        onSave={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Nova edição' } });
    fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: 'edition' } });
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled();
  });
});
