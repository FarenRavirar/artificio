import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MaterialCard } from './MaterialCard';
import type { Material } from '../types/material';

// T6.2 (spec 073) — card tem alvo de clique unico e nao trunca nome cego.

const baseMaterial: Material = {
  id: 'mat-1',
  slug: 'aventura-exemplo',
  title: 'Uma Aventura de Exemplo com Nome Bem Longo',
  summary: 'Resumo curto da aventura.',
  description: null,
  material_type: 'adventure',
  access_kind: 'external_link',
  external_url: 'https://example.test/arquivo.pdf',
  creator_id: 'user-1',
  creator_slug: 'criador-exemplo',
  editorial_state: 'published',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

function renderCard(material: Material = baseMaterial) {
  return render(
    <MemoryRouter>
      <MaterialCard material={material} />
    </MemoryRouter>,
  );
}

describe('MaterialCard', () => {
  it('renderiza titulo completo sem truncar', () => {
    renderCard();
    expect(screen.getByText(baseMaterial.title)).toBeInTheDocument();
  });

  it('tem um unico link como alvo de clique, apontando para a ficha', () => {
    renderCard();
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute('href', `/materiais/${baseMaterial.slug}`);
  });

  it('mostra badge de tipo e de acesso', () => {
    renderCard();
    expect(screen.getByText('adventure')).toBeInTheDocument();
    expect(screen.getByText('Link externo')).toBeInTheDocument();
  });
});
