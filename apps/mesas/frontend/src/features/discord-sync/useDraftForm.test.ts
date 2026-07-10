// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDraftForm } from './useDraftForm';
import type { DiscordDraft, DraftApiOperations } from './types';

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('./draftFormUtils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./draftFormUtils')>();
  return {
    ...actual,
    validateForm: vi.fn().mockImplementation(actual.validateForm),
  };
});

vi.mock('../../hooks/useSystemsCatalog', () => ({
  useSystemsCatalog: () => ({
    tree: [],
    flat: [],
    loading: false,
    error: null,
    forceRefresh: vi.fn().mockResolvedValue([]),
  }),
}));

const mockDraft: DiscordDraft = {
  id: 'draft-1',
  discord_message_id: 'dm-1',
  table_id: null,
  parsed_payload: {
    table: {
      title: 'Mesa Teste',
      description: 'Descricao',
      system_id: 'sys-1',
      system_name: 'D&D',
      type: 'campanha',
      modality: 'online',
      price_type: 'gratuita',
      slots_total: 4,
      slots_open: 2,
      day_of_week: 'sábado',
      start_time: '19:00',
      frequency: 'semanal',
      contact_url: 'https://discord.gg/abc',
      contact_discord: '',
    },
  },
  normalized_payload: null,
  confidence: null,
  status: 'draft',
  review_notes: null,
  created_at: '2024-06-01T00:00:00Z',
  updated_at: '2024-06-01T00:00:00Z',
};

const mockApi: DraftApiOperations = {
  updateDraft: vi.fn(),
  syncDraft: vi.fn(),
  reparseDraft: vi.fn(),
  getDraft: vi.fn(),
};

describe('useDraftForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('inicializa com estado do draft', () => {
    const { result } = renderHook(() => useDraftForm(mockDraft, mockApi, vi.fn()));

    expect(result.current.form.title).toBe('Mesa Teste');
    expect(result.current.form.description).toBe('Descricao');
    expect(result.current.form.type).toBe('campanha');
    expect(result.current.form.slots_total).toBe('4');
    expect(result.current.form.slots_open).toBe('2');
    expect(result.current.dirty).toBe(false);
    expect(result.current.activeTab).toBe('editor');
  });

  it('CodeRabbit PR #144: applySuggestion(system_name) com objeto nao-diff nao grava "[object Object]" no form', () => {
    const { result } = renderHook(() => useDraftForm(mockDraft, mockApi, vi.fn()));

    act(() => {
      result.current.applySuggestion('system_name', { some: 'unexpected shape' });
    });

    expect(result.current.form.system_name).not.toContain('[object Object]');
    expect(result.current.form.system_name).toBe('D&D');
  });

  it('updateForm altera campo e marca dirty', () => {
    const { result } = renderHook(() => useDraftForm(mockDraft, mockApi, vi.fn()));

    act(() => {
      result.current.updateForm('title', 'Novo Titulo');
    });

    expect(result.current.form.title).toBe('Novo Titulo');
    expect(result.current.dirty).toBe(true);
  });

  it('handleSaveFields chama api.updateDraft e atualiza', async () => {
    const onUpdate = vi.fn();
    const updatedDraft: DiscordDraft = { ...mockDraft, status: 'ready' as const };
    vi.mocked(mockApi.updateDraft).mockResolvedValue(updatedDraft);

    const { result } = renderHook(() => useDraftForm(mockDraft, mockApi, onUpdate));

    expect(result.current.savingFields).toBe(false);

    await act(async () => {
      await result.current.handleSaveFields();
    });

    expect(mockApi.updateDraft).toHaveBeenCalledWith(
      'draft-1',
      expect.objectContaining({
        status: 'ready',
        normalized_payload: expect.any(Object),
      }),
    );
    expect(onUpdate).toHaveBeenCalledWith(updatedDraft);
  });

  it('handleSaveFields marca como needs_review se houver campos pendentes', async () => {
    const draftSemTitulo: DiscordDraft = {
      ...mockDraft,
      parsed_payload: { table: {} },
    };
    const onUpdate = vi.fn();

    const { result } = renderHook(() => useDraftForm(draftSemTitulo, mockApi, onUpdate));

    await act(async () => {
      await result.current.handleSaveFields();
    });

    expect(mockApi.updateDraft).toHaveBeenCalledWith(
      'draft-1',
      expect.objectContaining({
        status: 'needs_review',
      }),
    );
  });

  it('handleSaveFields lida com erro da api', async () => {
    vi.mocked(mockApi.updateDraft).mockRejectedValue(new Error('Erro de rede'));
    const onUpdate = vi.fn();

    const { result } = renderHook(() => useDraftForm(mockDraft, mockApi, onUpdate));

    await act(async () => {
      await result.current.handleSaveFields();
    });

    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('setActiveTab altera a aba ativa', () => {
    const { result } = renderHook(() => useDraftForm(mockDraft, mockApi, vi.fn()));

    act(() => {
      result.current.setActiveTab('parsed');
    });

    expect(result.current.activeTab).toBe('parsed');
  });

  it('setNewStatus altera o status', () => {
    const { result } = renderHook(() => useDraftForm(mockDraft, mockApi, vi.fn()));

    act(() => {
      result.current.setNewStatus('ready');
    });

    expect(result.current.newStatus).toBe('ready');
  });

  it('missingFields computa campos pendentes do form', () => {
    const draftVazio: DiscordDraft = {
      ...mockDraft,
      parsed_payload: { table: {} },
    };

    const { result } = renderHook(() => useDraftForm(draftVazio, mockApi, vi.fn()));

    expect(result.current.missingFields.length).toBeGreaterThan(0);
  });

  it('canSync e false quando dirty', () => {
    const { result } = renderHook(() => useDraftForm(mockDraft, mockApi, vi.fn()));

    act(() => {
      result.current.updateForm('title', 'Alterado');
    });

    expect(result.current.canSync).toBe(false);
  });
});
