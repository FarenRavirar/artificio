// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TableActionPanel } from './TableActionPanel';
import type { TableViewModel } from '../types/tableView.types';

/**
 * Factory de TableViewModel mínima para os testes da Fase 7 (R21/R22/R23/R24).
 * A fase só exibe campos que já viajam no ViewModel; os testes cobrem a regra
 * "preenchido aparece, vazio some" sobre os quatro requisitos.
 */
function makeVm(overrides: Partial<TableViewModel> = {}): TableViewModel {
  return {
    cta: { label: 'Entrar', disabled: false, variant: 'primary', action: 'scroll-contact' },
    urgency: { label: '2 vagas disponíveis', tone: 'low', icon: '✓' },
    visibility: { showPrice: false, showSchedules: false, showMaster: true, showFullDetails: true, compact: false },
    id: 't1',
    slug: 'mesa-teste',
    title: 'Mesa Teste',
    system: 'D&D 5e',
    experience: 'Iniciante',
    modality: 'online',
    slotsLeft: 2,
    slotsTotal: 5,
    slotsFilled: 3,
    slotsOpen: 2,
    isFull: false,
    certifications: {},
    schedules: [],
    contentWarnings: [],
    safetyTools: [],
    status: 'active',
    publisherRole: 'gm',
    contacts: [],
    language: 'pt-BR',
    ...overrides,
  };
}

describe('TableActionPanel — Fase 7 (R21/R22/R23/R24)', () => {
  it('mostra vagas com total (R22): "2 de 5 vagas"', () => {
    render(<TableActionPanel vm={makeVm({ slotsTotal: 5, slotsOpen: 2, slotsLeft: 2 })} />);
    expect(screen.getByText('Vagas')).toBeTruthy();
    expect(screen.getByText('2 de 5 vagas')).toBeTruthy();
  });

  it('mostra vagas com total também em mesa lotada (R22)', () => {
    render(<TableActionPanel vm={makeVm({ slotsTotal: 5, slotsOpen: 0, slotsLeft: 0, isFull: true })} />);
    expect(screen.getByText('0 de 5 vagas')).toBeTruthy();
  });

  it('mostra "Mesa de N jogadores" quando slotsOpen é nulo (T7.5)', () => {
    render(<TableActionPanel vm={makeVm({ slotsTotal: 5, slotsOpen: undefined, slotsLeft: 5, slotsFilled: 0 })} />);
    expect(screen.getByText('Mesa de 5 jogadores')).toBeTruthy();
  });

  it('não renderiza linha de vagas quando slotsTotal é nulo', () => {
    render(
      <TableActionPanel
        vm={makeVm({ slotsTotal: undefined as unknown as number, slotsOpen: undefined, slotsLeft: 0 })}
      />,
    );
    expect(screen.queryByText('Vagas')).toBeNull();
  });

  it('mostra local quando city/state preenchidos (R23)', () => {
    render(<TableActionPanel vm={makeVm({ city: 'São Paulo', state: 'SP' })} />);
    expect(screen.getByText('Local')).toBeTruthy();
    expect(screen.getByText('São Paulo, SP')).toBeTruthy();
  });

  it('mostra só cidade quando state é vazio (R23)', () => {
    render(<TableActionPanel vm={makeVm({ city: 'Curitiba', state: undefined })} />);
    expect(screen.getByText('Curitiba')).toBeTruthy();
  });

  it('não renderiza local quando ambos vazios (R23)', () => {
    render(<TableActionPanel vm={makeVm({ city: undefined, state: undefined })} />);
    expect(screen.queryByText('Local')).toBeNull();
  });

  it('mostra idioma quando preenchido (R24)', () => {
    render(<TableActionPanel vm={makeVm({ language: 'English' })} />);
    expect(screen.getByText('Idioma')).toBeTruthy();
    expect(screen.getByText('English')).toBeTruthy();
  });

  // Achado real (review PR #280, codex, P2): esconder `pt-BR` contradizia o aceite 13
  // ("todo campo preenchido aparece"). E `pt-BR` nao e default de banco — o default do
  // schema e 'Português'; `pt-BR` vem do sync de importada e da escolha do mestre.
  it('mostra idioma tambem quando e pt-BR (R21/R24, aceite 13)', () => {
    render(<TableActionPanel vm={makeVm({ language: 'pt-BR' })} />);
    expect(screen.getByText('Idioma')).toBeTruthy();
    expect(screen.getByText('pt-BR')).toBeTruthy();
  });

  it('não renderiza idioma quando o campo esta vazio (R21)', () => {
    render(<TableActionPanel vm={makeVm({ language: '' })} />);
    expect(screen.queryByText('Idioma')).toBeNull();
  });
});

/**
 * PricePanel — pacote mensal (price_value_monthly). Regras de produto:
 * catálogo mostra só o avulso; página da mesa mostra os dois quando o mensal
 * existe; economia % é derivada só na exibição, apenas quando mensal < avulso.
 */
describe('TableActionPanel — PricePanel com pacote mensal', () => {
  const showPrice = { showPrice: true, showSchedules: false, showMaster: true, showFullDetails: true, compact: false };

  it('mostra pacote mensal e economia derivada quando mensal < avulso', () => {
    render(
      <TableActionPanel
        vm={makeVm({ visibility: showPrice, price: 55, priceFrequency: 'sessao', priceMonthly: 40 })}
      />,
    );
    // A8: o avulso de R$ 55 permanece visível junto com o pacote mensal.
    expect(screen.getByText('R$ 55', { exact: false })).toBeTruthy();
    const monthlyLine = screen.getByText('Pacote mensal:', { exact: false });
    expect(monthlyLine).toBeTruthy();
    // A8: "R$ 40 / sessão" — valor individual do pacote mensal explícito.
    expect(monthlyLine.textContent).toContain('R$ 40 / sessão');
    // 1 - 40/55 = 27.27... → arredondado para 27
    expect(screen.getByText('economize ~27%')).toBeTruthy();
    // A8: economia exibida apenas como percentual — nenhum valor monetário
    // derivado (ex.: "economize R$ 15") pode aparecer.
    expect(screen.queryByText(/economize R\$/)).toBeNull();
    expect(screen.queryByText('R$ 15', { exact: false })).toBeNull();
  });

  it('não mostra economia quando mensal >= avulso, mas mostra o valor mensal', () => {
    render(
      <TableActionPanel
        vm={makeVm({ visibility: showPrice, price: 40, priceFrequency: 'sessao', priceMonthly: 40 })}
      />,
    );
    expect(screen.getByText('Pacote mensal:', { exact: false })).toBeTruthy();
    expect(screen.queryByText(/economize ~/)).toBeNull();
  });

  it('não renderiza linha mensal quando priceMonthly ausente', () => {
    render(
      <TableActionPanel
        vm={makeVm({ visibility: showPrice, price: 55, priceFrequency: 'sessao', priceMonthly: undefined })}
      />,
    );
    expect(screen.queryByText('Pacote mensal:', { exact: false })).toBeNull();
    expect(screen.getByText('R$ 55', { exact: false })).toBeTruthy();
  });
});

/**
 * PricePanel — banner de mesa gratuita (doações). Regras de produto (sessão
 * 26-08-22_1): gratuita renderiza banner claro mesmo sem showPrice (price_value
 * é null nesse caso); doações são exclusivas de gratuita; valor sugerido
 * opcional. priceType é a fonte de verdade — VM antigo (priceType ausente)
 * mantém o comportamento anterior.
 */
describe('TableActionPanel — PricePanel de mesa gratuita (doações)', () => {
  const showPrice = { showPrice: true, showSchedules: false, showMaster: true, showFullDetails: true, compact: false };

  it('mostra banner "Gratuita" sem doação, mesmo com showPrice false e price ausente', () => {
    render(
      <TableActionPanel
        vm={makeVm({ priceType: 'gratuita', price: undefined, acceptsDonations: false })}
      />,
    );
    expect(screen.getByText(/Gratuita/)).toBeTruthy();
    expect(screen.getByText('Mesa gratuita — sem cobrança, jogue de graça.')).toBeTruthy();
    expect(screen.queryByText(/Aceita doações/)).toBeNull();
  });

  it('mostra "Aceita doações" sem valor sugerido quando só o flag está marcado', () => {
    render(
      <TableActionPanel
        vm={makeVm({
          priceType: 'gratuita',
          price: undefined,
          acceptsDonations: true,
          suggestedDonationValue: undefined,
        })}
      />,
    );
    expect(screen.getByText(/Gratuita/)).toBeTruthy();
    expect(screen.getByText(/Aceita doações/)).toBeTruthy();
    expect(screen.queryByText(/Valor sugerido/)).toBeNull();
  });

  it('mostra valor sugerido quando doação está marcada com valor', () => {
    render(
      <TableActionPanel
        vm={makeVm({
          priceType: 'gratuita',
          price: undefined,
          acceptsDonations: true,
          suggestedDonationValue: 10,
        })}
      />,
    );
    expect(screen.getByText(/Gratuita/)).toBeTruthy();
    expect(screen.getByText(/Aceita doações/)).toBeTruthy();
    expect(screen.getByText(/Valor sugerido: R\$ 10 \/ sessão/)).toBeTruthy();
    expect(screen.getByText('Doação combinada diretamente com o mestre, fora da plataforma.')).toBeTruthy();
  });

  it('mesa paga continua renderizando o painel pago (badge "Paga", sem banner de gratuita)', () => {
    render(
      <TableActionPanel
        vm={makeVm({ visibility: showPrice, priceType: 'paga', price: 55, priceFrequency: 'sessao' })}
      />,
    );
    expect(screen.getByText(/Paga/)).toBeTruthy();
    expect(screen.getByText('R$ 55', { exact: false })).toBeTruthy();
    expect(screen.queryByText('Mesa gratuita — sem cobrança, jogue de graça.')).toBeNull();
  });

  it('VM antigo (priceType ausente, paga com price) mantém comportamento anterior', () => {
    render(
      <TableActionPanel
        vm={makeVm({ visibility: showPrice, price: 55, priceFrequency: 'sessao' })}
      />,
    );
    expect(screen.getByText(/Paga/)).toBeTruthy();
  });

  it('VM antigo (priceType ausente, sem showPrice) não renderiza painel', () => {
    render(<TableActionPanel vm={makeVm({ price: undefined })} />);
    expect(screen.queryByText(/Gratuita/)).toBeNull();
    expect(screen.queryByText(/Paga/)).toBeNull();
  });
});

/**
 * Ficha técnica (QuickInfoPanel) — faixa etária (R24/A27, spec 096). Mesma
 * regra dos demais campos da ficha: preenchido aparece, vazio some. A exceção
 * de produto: 'livre' legítima NÃO ganha linha — silêncio é o correto.
 */
describe('TableActionPanel — faixa etária na ficha técnica (R24/A27)', () => {
  it('mostra linha "Faixa etária" com o valor quando há faixa real', () => {
    render(<TableActionPanel vm={makeVm({ ageRating: '+16' })} />);
    expect(screen.getByText('Faixa etária')).toBeTruthy();
    expect(screen.getByText('+16')).toBeTruthy();
  });

  it('mostra linha "Faixa etária" com "Livre" para mesa livre', () => {
    // Decisão do mantenedor (2026-08-24): ao escolher Livre, tem que aparecer
    // — na ficha é a linha comum, sem selo de restrição.
    render(<TableActionPanel vm={makeVm({ ageRating: 'livre' })} />);
    expect(screen.getByText('Faixa etária')).toBeTruthy();
    expect(screen.getByText('Livre')).toBeTruthy();
  });

  it('não mostra linha quando a faixa é ausente', () => {
    render(<TableActionPanel vm={makeVm({ ageRating: undefined })} />);
    expect(screen.queryByText('Faixa etária')).toBeNull();
  });

  it('não mostra linha para valor fora do enum (lista positiva)', () => {
    render(
      <TableActionPanel
        vm={makeVm({ ageRating: 'Livre' as unknown as TableViewModel['ageRating'] })}
      />,
    );
    expect(screen.queryByText('Faixa etária')).toBeNull();
    expect(screen.queryByText('Livre')).toBeNull();
  });
});
