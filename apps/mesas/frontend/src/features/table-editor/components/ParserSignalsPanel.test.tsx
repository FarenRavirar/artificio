// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ParserSignalsPanel } from './ParserSignalsPanel';
import type { ParserSignals } from '../utils/parserSignals';

/**
 * Fase 6 (spec 096, T6.2/R5): as ambiguidades calculadas pelo backend são
 * EXIBIDAS ao mestre (o front antigo as ignorava). Painel de aviso — nunca
 * validação de publish (T6.5).
 */
function signals(overrides: Partial<ParserSignals> = {}): ParserSignals {
  return {
    missingFields: [],
    priceAmbiguous: false,
    scheduleAmbiguous: false,
    slotsAmbiguous: null,
    rawSystemHint: null,
    ...overrides,
  };
}

describe('ParserSignalsPanel (Fase 6, T6.2)', () => {
  it('sem sinais não renderiza nada', () => {
    const { container } = render(
      <ParserSignalsPanel signals={signals()} onSuggestSystem={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('ambiguidade de preço e de horário são exibidas com a parte a conferir', () => {
    render(
      <ParserSignalsPanel
        signals={signals({ priceAmbiguous: true, scheduleAmbiguous: true })}
        onSuggestSystem={vi.fn()}
      />,
    );

    expect(screen.getByText(/Preço ambíguo/)).toBeInTheDocument();
    expect(screen.getByText(/2\+ horários/)).toBeInTheDocument();
  });

  it('ambiguidade de vagas exibe o par lido (X/Y)', () => {
    render(
      <ParserSignalsPanel
        signals={signals({ slotsAmbiguous: { first: 2, second: 5 } })}
        onSuggestSystem={vi.fn()}
      />,
    );

    expect(screen.getByText(/"2\/5" não diz qual número é o quê/)).toBeInTheDocument();
  });

  it('missing_fields são traduzidos — a chave crua nunca aparece', () => {
    render(
      <ParserSignalsPanel
        signals={signals({ missingFields: ['day_of_week', 'price_type:ambiguous'] })}
        onSuggestSystem={vi.fn()}
      />,
    );

    expect(screen.getByText(/O dia da sessão não foi encontrado/)).toBeInTheDocument();
    expect(screen.getByText(/Preço ambíguo/)).toBeInTheDocument();
    expect(screen.queryByText('day_of_week')).not.toBeInTheDocument();
  });

  it('chave de missing_field desconhecida cai na frase genérica (contrato pode crescer)', () => {
    render(
      <ParserSignalsPanel
        signals={signals({ missingFields: ['campo_futuro:xyz'] })}
        onSuggestSystem={vi.fn()}
      />,
    );

    expect(screen.getByText(/Um campo não foi reconhecido no texto/)).toBeInTheDocument();
  });

  it('F8: sistema não casado exibe o hint e o botão de sugerir pré-preenchido', () => {
    const onSuggestSystem = vi.fn();
    render(
      <ParserSignalsPanel
        signals={signals({ rawSystemHint: 'Xyz Nada a Ver' })}
        onSuggestSystem={onSuggestSystem}
      />,
    );

    expect(screen.getByText(/O sistema "Xyz Nada a Ver" não está no catálogo/)).toBeInTheDocument();
    screen.getByRole('button', { name: /Sugerir sistema/ }).click();
    // O modal de sugestão abre pré-preenchido — SEM inventar correspondência
    // no catálogo (Falha 8 do §Gap 4).
    expect(onSuggestSystem).toHaveBeenCalledWith('Xyz Nada a Ver');
  });

  it('mensagens duplicadas entre ambiguidades e missing_fields não aparecem duas vezes', () => {
    render(
      <ParserSignalsPanel
        signals={signals({
          priceAmbiguous: true,
          missingFields: ['price_type:ambiguous'],
        })}
        onSuggestSystem={vi.fn()}
      />,
    );

    const priceMessages = screen.getAllByText(/Preço ambíguo/);
    expect(priceMessages).toHaveLength(1);
  });
});
