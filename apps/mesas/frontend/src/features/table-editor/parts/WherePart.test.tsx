// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WherePart } from './WherePart';
import { createDefaultEditorState } from '../hooks/useTableEditor';
import type { TableEditorApi } from '../hooks/useTableEditor';

/**
 * Teste da parte "Onde joga" — o contrato de exibição por modalidade
 * (spec 096, R23/A26): VTT/comunicação só em online OU híbrida (isOnline,
 * espelho do refine do backend tableValidators.ts:436-445); cidade/estado em
 * presencial OU híbrida (showsLocation — modalidade com componente
 * presencial). A26 valida exatamente estes casos.
 */
vi.mock('../../../hooks/useVttPlatforms', () => ({
  useVttPlatforms: () => ({ platforms: [], loading: false, error: null }),
}));
vi.mock('../../../hooks/useCommunicationPlatforms', () => ({
  useCommunicationPlatforms: () => ({ platforms: [], loading: false, error: null }),
}));

function makeApi(modality: 'online' | 'presencial' | 'hibrida'): TableEditorApi {
  return {
    state: { ...createDefaultEditorState(), modality },
    patch: vi.fn(),
    replaceState: vi.fn(),
    validateFieldOnBlur: vi.fn(),
    errors: {},
    revealedPending: false,
    publish: vi.fn(async () => true),
    publishError: null,
    publishing: false,
    isDirty: false,
    draftStatus: 'idle',
    isEditing: false,
    isActive: false,
    showRestoreModal: false,
    savedDraft: null,
    handleRestoreDraft: vi.fn(),
    handleDiscardDraft: vi.fn(),
    firstErrorFieldToFocus: null,
    gmProfileLoading: false,
    hasGmProfile: false,
    inheritedEdits: { displayName: false, bio: false, contacts: false },
    hasInheritedEdit: false,
    syncProfileToMaster: vi.fn(async () => true),
    syncingProfile: false,
  };
}

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [] }) }),
  );
});

describe('WherePart — exibição por modalidade (R23/A26)', () => {
  it('online: VTT/comunicação visíveis, cidade/estado NÃO', () => {
    render(<WherePart api={makeApi('online')} />);
    expect(screen.getByLabelText(/Plataforma de jogo/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Cidade/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Estado/)).not.toBeInTheDocument();
  });

  it('presencial: cidade/estado visíveis, VTT/comunicação NÃO', () => {
    render(<WherePart api={makeApi('presencial')} />);
    expect(screen.getByLabelText(/Cidade/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Estado/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Plataforma de jogo/)).not.toBeInTheDocument();
  });

  it('híbrida: cidade/estado visíveis (A26) E VTT/comunicação visíveis (isOnline preservado)', () => {
    render(<WherePart api={makeApi('hibrida')} />);
    expect(screen.getByLabelText(/Cidade/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Estado/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Plataforma de jogo/)).toBeInTheDocument();
  });
});

describe('WherePart — D5: trocar para online limpa city/state', () => {
  it('presencial → online limpa os dois campos de localização no MESMO patch', () => {
    const api = makeApi('presencial');
    render(<WherePart api={api} />);

    fireEvent.change(screen.getByLabelText(/Modalidade/), { target: { value: 'online' } });

    // Sem a limpeza, o valor antigo ficaria no estado e iria no payload
    // (campo invisível não limpo — mesmo defeito corrigido em
    // handlePriceTypeChange do ValuesPart).
    expect(api.patch).toHaveBeenCalledWith({ modality: 'online', city: '', state: '' });
  });

  it('híbrida → online também limpa (a ida para online apaga sempre)', () => {
    const api = makeApi('hibrida');
    render(<WherePart api={api} />);

    fireEvent.change(screen.getByLabelText(/Modalidade/), { target: { value: 'online' } });

    expect(api.patch).toHaveBeenCalledWith({ modality: 'online', city: '', state: '' });
  });

  it('online → híbrida NÃO limpa (só a troca PARA online apaga os campos)', () => {
    const api = makeApi('online');
    render(<WherePart api={api} />);

    fireEvent.change(screen.getByLabelText(/Modalidade/), { target: { value: 'hibrida' } });

    expect(api.patch).toHaveBeenCalledWith({ modality: 'hibrida' });
  });
});
