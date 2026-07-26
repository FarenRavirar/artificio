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

  // Spec 087 (T2.5) — o credito virou a ASSINATURA do card: sobe acima do
  // titulo, sem o prefixo "Por" (o eyebrow ja e posicionalmente o autor), e
  // nunca some. Antes desta spec era a 3a linha, em "Por <credits>", e sumia
  // quando `credits` era null.
  it('mostra o crédito como eyebrow quando há autores/artistas', () => {
    renderCard({ ...baseMaterial, credits: 'Autora Exemplo' });
    expect(screen.getByText('Autora Exemplo')).toBeInTheDocument();
  });

  it('assume a autoria do acervo quando credits ausente, sem deixar buraco', () => {
    renderCard();
    expect(screen.getByText('Acervo Artifício')).toBeInTheDocument();
  });

  it('mostra estrelas e contagem quando há avaliações', () => {
    renderCard({ ...baseMaterial, avg_rating: 4.1, rating_count: 7 });
    expect(screen.getByText('4,1')).toBeInTheDocument();
    expect(screen.getByText('(7 avaliações)')).toBeInTheDocument();
    expect(screen.getByText('Avaliação 4,1 de 5 em 7 avaliações')).toBeInTheDocument();
  });

  it('não mostra bloco de avaliação quando rating_count é 0', () => {
    renderCard({ ...baseMaterial, avg_rating: null, rating_count: 0 });
    expect(screen.queryByText(/avaliaç/i)).not.toBeInTheDocument();
  });

  it('mantém alvo de clique único mesmo com estrelas presentes', () => {
    // As estrelas sao <span>, nunca <button>: se virarem focaveis, roubam o
    // clique do <Link> que cobre o card via before:absolute.
    renderCard({ ...baseMaterial, avg_rating: 4.5, rating_count: 12 });
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
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
