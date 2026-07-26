import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MaterialCard } from './MaterialCard';
import type { Material } from '../types/material';

// Fase 6 (spec 086, T6.4): estende cobertura pra capa condicional (onError →
// placeholder), autores (credits), cenário e cadeia de sistema/edição/variante.

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

  it('mostra placeholder quando não há capa', () => {
    renderCard();
    expect(screen.getByText('Sem capa')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('mostra capa real quando cover_image_url existe', () => {
    renderCard({ ...baseMaterial, cover_image_url: 'https://example.test/capa.jpg' });
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://example.test/capa.jpg');
    expect(screen.queryByText('Sem capa')).not.toBeInTheDocument();
  });

  it('cai pro placeholder quando a capa falha ao carregar (onError)', () => {
    renderCard({ ...baseMaterial, cover_image_url: 'https://example.test/quebrada.jpg' });
    fireEvent.error(screen.getByRole('img'));
    expect(screen.getByText('Sem capa')).toBeInTheDocument();
  });

  it('mostra "Por <credits>" quando há autores/artistas', () => {
    renderCard({ ...baseMaterial, credits: 'Autora Exemplo' });
    expect(screen.getByText('Por Autora Exemplo')).toBeInTheDocument();
  });

  it('não mostra linha de autores quando credits ausente', () => {
    renderCard();
    expect(screen.queryByText(/^Por /)).not.toBeInTheDocument();
  });

  it('mostra "Para <cenário>" quando há cenário', () => {
    renderCard({ ...baseMaterial, scenario: 'Mundo pós-apocalíptico' });
    expect(screen.getByText('Para Mundo pós-apocalíptico')).toBeInTheDocument();
  });

  it('não mostra linha de cenário quando ausente', () => {
    renderCard();
    expect(screen.queryByText(/^Para /)).not.toBeInTheDocument();
  });

  it('mostra cadeia de sistema/edição/variante quando presente', () => {
    renderCard({ ...baseMaterial, system_name: 'D&D', edition_name: '5ª Edição', variant_name: null });
    expect(screen.getByText('D&D › 5ª Edição')).toBeInTheDocument();
  });

  it('não mostra badge de sistema quando ausente', () => {
    renderCard();
    expect(screen.queryByText(/D&D/)).not.toBeInTheDocument();
  });

  it('renderiza sem "undefined" quando nenhum campo novo está presente', () => {
    const { container } = renderCard();
    expect(container.textContent).not.toContain('undefined');
  });
});
