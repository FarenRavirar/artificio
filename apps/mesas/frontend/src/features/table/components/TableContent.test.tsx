// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TableContent } from './TableContent';
import type { TableViewModel } from '../types/tableView.types';

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

describe('TableContent — Fase 7 (R24 cenário)', () => {
  it('mostra cenário do catálogo quando preenchido (R24)', () => {
    render(<TableContent vm={makeVm({ scenario: 'Forgotten Realms', settingName: undefined })} />);
    expect(screen.getByText('Forgotten Realms')).toBeTruthy();
  });

  it('mostra cenário do catálogo e ambientação livre juntos (R24)', () => {
    render(<TableContent vm={makeVm({ scenario: 'Forgotten Realms', settingName: 'Realms esquecidos' })} />);
    expect(screen.getByText('Forgotten Realms')).toBeTruthy();
    expect(screen.getByText('Realms esquecidos')).toBeTruthy();
  });

  it('não renderiza seção Cenário quando ambos vazios (R21)', () => {
    render(<TableContent vm={makeVm({ scenario: undefined, settingName: undefined, settingStyles: undefined })} />);
    expect(screen.queryByText('🗺️ Cenário')).toBeNull();
  });
});
