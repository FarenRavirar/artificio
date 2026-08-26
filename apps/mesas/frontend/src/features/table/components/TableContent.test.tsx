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

describe('TableContent — T7.2b (spec 096): regras da mesa no público', () => {
  it('exibe a seção "Regras da Mesa" quando tableRules tem conteúdo', () => {
    render(<TableContent vm={makeVm({ tableRules: 'Sem PVP. Sessão zero obrigatória.' })} />);
    expect(screen.getByText('📜 Regras da Mesa')).toBeTruthy();
    expect(screen.getByText(/Sem PVP\. Sessão zero obrigatória\./)).toBeTruthy();
  });

  it('omite a seção quando tableRules está ausente', () => {
    render(<TableContent vm={makeVm({ tableRules: undefined })} />);
    expect(screen.queryByText('📜 Regras da Mesa')).toBeNull();
  });

  // A nota da certificação DDAL (`certifications.ddal.rulesNotes`) vive em
  // TableTechnical: um não pode substituir o outro (T7.2b).
  it('não confunde a nota DDAL com as regras da mesa', () => {
    render(
      <TableContent
        vm={makeVm({
          tableRules: undefined,
          certifications: { ddal: { rulesNotes: 'Nota da certificação DDAL' } },
        })}
      />,
    );
    expect(screen.queryByText('📜 Regras da Mesa')).toBeNull();
    expect(screen.queryByText(/Nota da certificação DDAL/)).toBeNull();
  });
});
