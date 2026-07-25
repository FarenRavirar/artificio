import { render, screen } from '@testing-library/react';
import { SystemChainBadge } from './SystemChainBadge';

describe('SystemChainBadge', () => {
  it('renderiza cadeia completa sistema › edição › variante', () => {
    render(<SystemChainBadge systemName="D&D" editionName="5ª Edição" variantName="2024" />);
    expect(screen.getByText('D&D › 5ª Edição › 2024')).toBeInTheDocument();
  });

  it('renderiza só o sistema quando edição/variante ausentes', () => {
    render(<SystemChainBadge systemName="D&D" />);
    expect(screen.getByText('D&D')).toBeInTheDocument();
  });

  it('não renderiza nada quando não há sistema (fallback de ícone não se aplica sem dado)', () => {
    const { container } = render(<SystemChainBadge systemName={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
