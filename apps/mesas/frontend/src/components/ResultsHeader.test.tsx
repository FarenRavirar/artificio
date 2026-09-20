import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ResultsHeader } from './ResultsHeader';

// Spec 103, T3.3: o catálogo saltava de `<h1>` para o `<h3>` do card, sem
// `<h2>` nenhum na rota. O heading da lista de resultados fecha o salto.

afterEach(cleanup);

const base = {
  count: 12,
  sort: 'popular',
  onSortChange: vi.fn(),
  isLoading: false,
  hasMore: false,
} as const;

describe('ResultsHeader — ordem de heading', () => {
  it('a contagem é um `<h2>`, o nível que falta entre a `<h1>` e o `<h3>` do card', () => {
    render(<ResultsHeader {...base} />);
    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading).toHaveTextContent('12 mesas encontradas');
  });

  it('o texto visível não mudou ao virar heading', () => {
    // A correção é de semântica, não de conteúdo: mudar o que o visitante lê
    // seria decisão de produto.
    render(<ResultsHeader {...base} count={1} />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('1 mesa encontrada');
  });

  it('não usa `aria-label`, que esconderia a contagem do leitor de tela', () => {
    // WAI-ARIA APG §Names and Descriptions: `aria-label` em papel que nomeia a
    // partir do conteúdo substitui o conteúdo descendente. O nome acessível
    // tem que ser o próprio texto.
    render(<ResultsHeader {...base} />);
    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading).not.toHaveAttribute('aria-label');
    // `getByRole` com `name` só acha se o nome acessível vier do texto.
    expect(screen.getByRole('heading', { name: /12 mesas encontradas/ })).toBe(heading);
  });

  it('carregando: o heading existe e continua no nível 2', () => {
    // Heading que aparece e desaparece tira e devolve uma entrada no índice do
    // leitor de tela a cada busca.
    render(<ResultsHeader {...base} isLoading />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Carregando...');
  });

  it('`hasMore` marca a contagem como parcial', () => {
    render(<ResultsHeader {...base} hasMore />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('12+ mesas encontradas');
  });

  it('nenhum heading de nível 3 ou mais fundo neste componente', () => {
    // O card traz o `<h3>`; se este componente também trouxesse, o salto
    // voltaria por outro caminho.
    render(<ResultsHeader {...base} />);
    expect(screen.queryAllByRole('heading', { level: 3 })).toHaveLength(0);
    expect(screen.queryAllByRole('heading', { level: 1 })).toHaveLength(0);
  });
});
