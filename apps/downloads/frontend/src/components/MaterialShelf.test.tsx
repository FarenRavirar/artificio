import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MaterialShelf } from './MaterialShelf';
import type { Material } from '../types/material';

// Spec 087 (T2.1/T2.4) — prateleira do modo vitrine.

function makeMaterial(overrides: Partial<Material> = {}): Material {
  return {
    id: 'mat-1',
    slug: 'material-1',
    title: 'Material 1',
    summary: null,
    description: null,
    material_type: 'adventure',
    access_kind: 'external_link',
    external_url: 'https://example.test/a.pdf',
    creator_id: 'user-1',
    creator_slug: 'criador-1',
    editorial_state: 'published',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function renderShelf(props: Partial<Parameters<typeof MaterialShelf>[0]> = {}) {
  return render(
    <MemoryRouter>
      <MaterialShelf
        shelfId="recentes"
        title="Recém adicionados"
        seeAllTo="/catalogo?sort=recent"
        items={[makeMaterial()]}
        {...props}
      />
    </MemoryRouter>,
  );
}

describe('MaterialShelf', () => {
  it('renderiza título, "Ver tudo" e os cards', () => {
    renderShelf();
    expect(screen.getByRole('heading', { name: 'Recém adicionados' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver tudo' })).toHaveAttribute(
      'href',
      '/catalogo?sort=recent',
    );
    expect(screen.getByText('Material 1')).toBeInTheDocument();
  });

  // Requisito 16 — prateleira sem item elegivel NAO renderiza. Titulo seguido
  // de trilho vazio promete conteudo que nao existe; pior que ausencia.
  it('não renderiza nada quando não há material elegível', () => {
    const { container } = renderShelf({ items: [] });
    expect(container).toBeEmptyDOMElement();
  });

  it('ainda mostra o cabeçalho enquanto carrega, para não piscar layout', () => {
    renderShelf({ items: [], isLoading: true });
    expect(screen.getByRole('heading', { name: 'Recém adicionados' })).toBeInTheDocument();
  });

  it('associa o trilho ao título por aria-labelledby', () => {
    renderShelf();
    expect(screen.getByRole('region', { name: 'Recém adicionados' })).toBeInTheDocument();
  });
});
