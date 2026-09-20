import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ScheduleFacetPicker } from './ScheduleFacetPicker';
import type { ScheduleFacetCounts } from '../hooks/useScheduleFacets';

/**
 * T7.4/T7.7 (spec 103) — controle de dia e faixa, e a política de opção vazia
 * decidida pelo mantenedor em 2026-09-18 (D6): a faixa sem mesa aparece com o
 * contador e desabilitada, em vez de ser removida da lista.
 */

// Contagem real medida em produção em 2026-09-18: madrugada tem 0 mesas, contra
// noite 55, tarde 11 e manhã 2. Nenhum dos 7 dias tem zero.
const productionCounts: ScheduleFacetCounts = {
  weekdays: {
    segunda: 10,
    'terça': 5,
    quarta: 9,
    quinta: 5,
    sexta: 14,
    'sábado': 23,
    domingo: 10,
  },
  dayparts: { manha: 2, tarde: 11, noite: 55, madrugada: 0 },
  loaded: true,
};

const baseProps = {
  weekdays: [],
  dayparts: [],
  counts: productionCounts,
  onWeekdayToggle: vi.fn(),
  onDaypartToggle: vi.fn(),
  idPrefix: 'catalog-advanced-desktop',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ScheduleFacetPicker — opção vazia (D6)', () => {
  it('a faixa sem mesa APARECE, com o contador zero', () => {
    render(<ScheduleFacetPicker {...baseProps} />);

    // Exceção deliberada a R22: lista fechada de 4 com um item ausente parece
    // controle quebrado. Ver o comentário do componente.
    const madrugada = screen.getByRole('button', { name: /madrugada/i });
    expect(madrugada).toBeInTheDocument();
    expect(madrugada).toHaveTextContent('(0)');
  });

  it('a faixa sem mesa não é clicável', () => {
    render(<ScheduleFacetPicker {...baseProps} />);

    const madrugada = screen.getByRole('button', { name: /madrugada/i });
    expect(madrugada).toBeDisabled();

    fireEvent.click(madrugada);
    expect(baseProps.onDaypartToggle).not.toHaveBeenCalled();
  });

  it('faixa MARCADA com zero segue clicável, para poder desmarcar', () => {
    render(<ScheduleFacetPicker {...baseProps} dayparts={['madrugada']} />);

    // Desabilitar o que está marcado prenderia o filtro ativo: sem "Limpar tudo"
    // não haveria como desfazer (achado do CodeRabbit na PR #327).
    const madrugada = screen.getByRole('button', { name: /madrugada/i });
    expect(madrugada).toBeEnabled();

    fireEvent.click(madrugada);
    expect(baseProps.onDaypartToggle).toHaveBeenCalledWith('madrugada');
  });

  it('a faixa com mesa é clicável e devolve o valor da URL', () => {
    render(<ScheduleFacetPicker {...baseProps} />);

    fireEvent.click(screen.getByRole('button', { name: /noite/i }));
    expect(baseProps.onDaypartToggle).toHaveBeenCalledWith('noite');
  });

  it('enquanto a contagem não carrega, nada é desabilitado nem mostra número', () => {
    render(
      <ScheduleFacetPicker
        {...baseProps}
        counts={{ weekdays: {}, dayparts: {}, loaded: false }}
      />,
    );

    // Desabilitar por dado ausente esconderia opção que tem mesa.
    const madrugada = screen.getByRole('button', { name: /madrugada/i });
    expect(madrugada).toBeEnabled();
    expect(madrugada).not.toHaveTextContent('(0)');
  });
});

describe('ScheduleFacetPicker — dia da semana', () => {
  it('renderiza os 7 dias, em ordem de calendário', () => {
    render(<ScheduleFacetPicker {...baseProps} />);

    const labels = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
    for (const label of labels) {
      expect(screen.getByRole('button', { name: new RegExp(label, 'i') })).toBeInTheDocument();
    }
  });

  it('devolve o valor COM acento, igual ao que o banco guarda', () => {
    render(<ScheduleFacetPicker {...baseProps} />);

    fireEvent.click(screen.getByRole('button', { name: /sábado/i }));
    // `sabado` sem acento não casa o CHECK da migration 12 e não traria linha.
    expect(baseProps.onWeekdayToggle).toHaveBeenCalledWith('sábado');
  });

  it('marca só o que está selecionado (aria-pressed)', () => {
    render(<ScheduleFacetPicker {...baseProps} weekdays={['sexta']} />);

    expect(screen.getByRole('button', { name: /sexta/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /sábado/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('múltipla escolha: dois dias marcados ficam os dois pressionados', () => {
    render(<ScheduleFacetPicker {...baseProps} weekdays={['sexta', 'sábado']} />);

    expect(screen.getByRole('button', { name: /sexta/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /sábado/i })).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('ScheduleFacetPicker — acessibilidade (E9)', () => {
  it('os dois grupos têm nome acessível próprio', () => {
    render(<ScheduleFacetPicker {...baseProps} />);

    expect(screen.getByRole('group', { name: /dia da semana/i })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: /horário/i })).toBeInTheDocument();
  });

  it('os ids dependem do idPrefix, para desktop e mobile coexistirem', () => {
    const { container } = render(<ScheduleFacetPicker {...baseProps} idPrefix="catalog-advanced-mobile" />);

    expect(container.querySelector('#catalog-advanced-mobile-weekday')).not.toBeNull();
    expect(container.querySelector('#catalog-advanced-mobile-daypart')).not.toBeNull();
  });

  it('todo controle é alcançável e acionável por teclado', () => {
    render(<ScheduleFacetPicker {...baseProps} />);

    const segunda = screen.getByRole('button', { name: /segunda/i });
    segunda.focus();
    expect(segunda).toHaveFocus();

    // `button` nativo aciona por Enter e Espaço sem handler de tecla próprio; o
    // clique sintético é o que o browser despacha nesse caso.
    fireEvent.click(segunda);
    expect(baseProps.onWeekdayToggle).toHaveBeenCalledWith('segunda');
  });

  it('a opção desabilitada sai da ordem de tabulação', () => {
    render(<ScheduleFacetPicker {...baseProps} />);

    const madrugada = screen.getByRole('button', { name: /madrugada/i });
    madrugada.focus();
    // `disabled` num `button` nativo já impede foco; sem isso o teclado pararia
    // num controle que não faz nada.
    expect(madrugada).not.toHaveFocus();
  });
});
