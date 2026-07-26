import { render, screen } from '@testing-library/react';
import { MaterialRating } from './MaterialRating';

// Spec 087 (T2.5) — estrelas do card. O ponto sensivel e o preenchimento
// PARCIAL: arredondar esconde a diferenca entre 4,0 e 4,4, que e exatamente a
// informacao que a media bayesiana produz.

function fillsOf(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('span[style*="linear-gradient"]')).map(
    (node) => (node as HTMLElement).style.backgroundImage,
  );
}

describe('MaterialRating', () => {
  it('mostra nota, contagem e rótulo acessível', () => {
    render(<MaterialRating avgRating={4.1} ratingCount={7} />);
    expect(screen.getByText('4,1')).toBeInTheDocument();
    expect(screen.getByText('(7 avaliações)')).toBeInTheDocument();
    expect(screen.getByText('Avaliação 4,1 de 5 em 7 avaliações')).toBeInTheDocument();
  });

  it('singulariza a contagem quando há uma avaliação só', () => {
    render(<MaterialRating avgRating={5} ratingCount={1} />);
    expect(screen.getByText('(1 avaliação)')).toBeInTheDocument();
  });

  // Requisito 15 — ausencia de avaliacao NUNCA vira "0 estrelas".
  it('não renderiza nada quando não há avaliação', () => {
    const { container } = render(<MaterialRating avgRating={null} ratingCount={0} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('não renderiza nada quando a nota é nula mesmo com contagem', () => {
    const { container } = render(<MaterialRating avgRating={null} ratingCount={3} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('preenche parcialmente a estrela em que a nota cai, sem arredondar', () => {
    const { container } = render(<MaterialRating avgRating={4.4} ratingCount={10} />);
    const fills = fillsOf(container);

    expect(fills).toHaveLength(5);
    // Quatro cheias...
    for (const fill of fills.slice(0, 4)) {
      expect(fill).toContain('100%');
    }
    // ...e a quinta com a fracao real, nao 0% nem 100%.
    expect(fills[4]).toContain('40%');
  });

  it('não deixa nota fora da faixa estourar as estrelas', () => {
    const { container } = render(<MaterialRating avgRating={7.3} ratingCount={2} />);
    expect(fillsOf(container).every((fill) => fill.includes('100%'))).toBe(true);
    expect(screen.getByText('5,0')).toBeInTheDocument();
  });

  it('não expõe elemento focável que roube o clique do card', () => {
    render(<MaterialRating avgRating={4.5} ratingCount={12} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
