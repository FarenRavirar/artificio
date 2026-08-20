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

  it('mostra idioma quando diferente de pt-BR (R24)', () => {
    render(<TableActionPanel vm={makeVm({ language: 'English' })} />);
    expect(screen.getByText('Idioma')).toBeTruthy();
    expect(screen.getByText('English')).toBeTruthy();
  });

  it('não renderiza idioma quando é pt-BR (R24)', () => {
    render(<TableActionPanel vm={makeVm({ language: 'pt-BR' })} />);
    expect(screen.queryByText('Idioma')).toBeNull();
  });
});
