// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DraftEditorTab } from './DraftEditorTab';
import type { DraftForm } from '../draftFormUtils';
import type { DiscordSlotsAmbiguity } from '../types';
import type { SystemTreeNode } from '../../../types/systems';

const defaultForm: DraftForm = {
  title: 'Mesa Teste',
  description: 'Descricao detalhada',
  system_id: 'sys-1',
  system_name: 'D&D 5e',
  type: 'campanha',
  modality: 'online',
  price_type: 'gratuita',
  price_value: '',
  slots_total: '4',
  slots_open: '2',
  day_of_week: 'sábado',
  start_time: '19:00',
  frequency: 'semanal',
  contact_url: 'https://discord.gg/abc',
  contact_discord: 'user#1234',
  cover_url: 'https://img.com/capa.jpg',
  cover_url_source: '',
  cover_quality: 'standard',
};

const defaultSystems: SystemTreeNode[] = [
  { id: 'sys-1', name: 'Dungeons & Dragons', name_pt: 'D&D 5e', slug: 'dnd-5e', parent_id: null, node_type: 'system', path_slug: null },
  { id: 'sys-2', name: 'Tormenta', name_pt: null, slug: 'tormenta', parent_id: null, node_type: 'system', path_slug: null },
];

function renderTab(overrides?: Partial<Parameters<typeof DraftEditorTab>[0]>) {
  const defaultProps = {
    form: defaultForm,
    missingFields: [],
    systems: defaultSystems,
    systemsLoading: false,
    coverPreviewUrl: 'https://img.com/capa.jpg',
    coverError: null,
    coverUploading: false,
    coverInputRef: { current: null } as React.RefObject<HTMLInputElement | null>,
    shouldShowSlotsDisambiguation: false,
    slotsAmbiguity: null as DiscordSlotsAmbiguity | null,
    slotsInterpretation: 'filled_total' as const,
    savingFields: false,
    onUpdateForm: vi.fn(),
    onSystemChange: vi.fn(),
    onCoverUpload: vi.fn(),
    onRemoveCover: vi.fn(),
    onSetSlotsInterpretation: vi.fn(),
    onConfirmSlots: vi.fn(),
    ...overrides,
  } satisfies Parameters<typeof DraftEditorTab>[0];
  return render(<DraftEditorTab {...defaultProps} />);
}

describe('DraftEditorTab', () => {
  it('renderiza campos do formulario', () => {
    renderTab();
    expect(screen.getByDisplayValue('Mesa Teste')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Descricao detalhada')).toBeInTheDocument();
    expect(screen.getByDisplayValue('4')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2')).toBeInTheDocument();
    expect(screen.getByDisplayValue('19:00')).toBeInTheDocument();
    expect(screen.getByDisplayValue('https://discord.gg/abc')).toBeInTheDocument();
  });

  it('renderiza selects com valores corretos', () => {
    renderTab();
    expect(screen.getByDisplayValue('Campanha')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Online')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Gratuita')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Semanal')).toBeInTheDocument();
  });

  it('renderiza lista de sistemas no select', () => {
    renderTab();
    expect(screen.getByText('D&D 5e')).toBeInTheDocument();
    expect(screen.getByText('Tormenta')).toBeInTheDocument();
  });

  it('mostra campos pendentes quando missingFields nao vazio', () => {
    renderTab({ missingFields: ['Título', 'Descrição'] });
    expect(screen.getByText(/Campos pendentes/)).toBeInTheDocument();
    expect(screen.getByText((_, element) => element?.textContent === 'Campos pendentes: Título, Descrição')).toBeInTheDocument();
  });

  it('mostra preview da capa', () => {
    renderTab();
    const img = screen.getByAltText('Capa do draft');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://img.com/capa.jpg');
  });

  it('mostra "Sem capa" quando nao ha preview', () => {
    renderTab({ coverPreviewUrl: '' });
    expect(screen.getByText('Sem capa')).toBeInTheDocument();
  });

  it('mostra erro de capa quando coverError nao nulo', () => {
    renderTab({ coverError: 'Erro ao enviar imagem' });
    expect(screen.getByText('Erro ao enviar imagem')).toBeInTheDocument();
  });

  it('input de valor desabilitado quando price_type e gratuita', () => {
    renderTab({ form: { ...defaultForm, price_type: 'gratuita', price_value: '' } });
    const valorInput = screen.getByPlaceholderText('0') as HTMLInputElement;
    expect(valorInput).toBeDisabled();
  });

  it('input de valor habilitado quando price_type e paga', () => {
    renderTab({ form: { ...defaultForm, price_type: 'paga', price_value: '25' } });
    const valorInput = screen.getByDisplayValue('25');
    expect(valorInput).not.toBeDisabled();
  });

  it('chama onUpdateForm ao digitar no titulo', () => {
    const onUpdateForm = vi.fn();
    renderTab({ onUpdateForm });
    const titleInput = screen.getByDisplayValue('Mesa Teste');
    fireEvent.change(titleInput, { target: { value: 'Novo Titulo' } });
    expect(onUpdateForm).toHaveBeenCalledWith('title', 'Novo Titulo');
  });

  it('chama onSystemChange ao selecionar sistema', () => {
    const onSystemChange = vi.fn();
    renderTab({ onSystemChange });
    const systemSelect = screen.getByDisplayValue('D&D 5e');
    fireEvent.change(systemSelect, { target: { value: 'sys-2' } });
    expect(onSystemChange).toHaveBeenCalledWith('sys-2');
  });

  it('mostra botoes de capa', () => {
    renderTab();
    expect(screen.getByText('Substituir')).toBeInTheDocument();
    expect(screen.getByText('Remover')).toBeInTheDocument();
  });

  it('mostra disambiguacao de slots quando shouldShowSlotsDisambiguation', () => {
    renderTab({
      shouldShowSlotsDisambiguation: true,
      slotsAmbiguity: { first: 3, second: 5, source: 'x_slash_y' },
    });
    expect(screen.getByText(/Como interpretar/)).toBeInTheDocument();
    expect(screen.getByText('Confirmar')).toBeInTheDocument();
  });
});
