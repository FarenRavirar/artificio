// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DiscordDraftPreview } from './DiscordDraftPreview';
import type { DiscordDraft, DraftApiOperations } from '../types';

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('./DraftEditorTab', () => ({
  DraftEditorTab: () => <div data-testid="draft-editor-tab">Editor</div>,
}));

vi.mock('../useDraftForm', () => ({
  useDraftForm: () => ({
    form: {
      title: '', description: '', system_id: '', system_name: '',
      type: 'campanha', modality: 'online', price_type: 'gratuita', price_value: '',
      slots_total: '', slots_open: '', day_of_week: '', start_time: '',
      frequency: 'semanal', contact_url: '', contact_discord: '',
      cover_url: '', cover_url_source: '', cover_quality: '',
    },
    updateForm: vi.fn(),
    dirty: false,
    systems: [],
    systemsLoading: false,
    missingFields: [],
    canSync: false,
    syncing: false,
    reparsing: false,
    savingFields: false,
    savingStatus: false,
    editingStatus: false,
    setEditingStatus: vi.fn(),
    newStatus: 'draft',
    setNewStatus: vi.fn(),
    reviewNotes: '',
    setReviewNotes: vi.fn(),
    activeTab: 'editor',
    setActiveTab: vi.fn(),
    coverUploading: false,
    coverError: null,
    coverPreviewUrl: '',
    coverInputRef: { current: null },
    slotsInterpretation: 'filled_total',
    setSlotsInterpretation: vi.fn(),
    slotsAmbiguity: null,
    payloadMissingFields: [],
    handleSystemChange: vi.fn(),
    handleSaveFields: vi.fn(),
    handleCoverUpload: vi.fn(),
    handleRemoveCover: vi.fn(),
    handleConfirmSlots: vi.fn(),
    handleSync: vi.fn(),
    handleReparse: vi.fn(),
    handleSaveStatus: vi.fn(),
  }),
}));

const mockDraft: DiscordDraft = {
  id: 'draft-1',
  discord_message_id: 'dm-1',
  table_id: null,
  parsed_payload: { table: {} },
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
};

describe('DiscordDraftPreview', () => {
  it('renderiza o modal de preview', () => {
    render(
      <DiscordDraftPreview
        draft={mockDraft}
        onUpdate={vi.fn()}
        onClose={vi.fn()}
        api={mockApi}
      />,
    );

    expect(screen.getByText('Draft de mesa')).toBeInTheDocument();
    expect(screen.getByText('draft-1')).toBeInTheDocument();
  });

  it('mostra status Revisar por padrao', () => {
    render(
      <DiscordDraftPreview
        draft={mockDraft}
        onUpdate={vi.fn()}
        onClose={vi.fn()}
        api={mockApi}
      />,
    );

    expect(screen.getByText('Revisar')).toBeInTheDocument();
  });

  it('mostra botoes de acao: Reparsar, Salvar campos, Sincronizar', () => {
    render(
      <DiscordDraftPreview
        draft={mockDraft}
        onUpdate={vi.fn()}
        onClose={vi.fn()}
        api={mockApi}
      />,
    );

    expect(screen.getByText('Reparsar')).toBeInTheDocument();
    expect(screen.getByText('Salvar campos')).toBeInTheDocument();
    expect(screen.getByText('Sincronizar como mesa')).toBeInTheDocument();
  });

  it('mostra abas de navegacao', () => {
    render(
      <DiscordDraftPreview
        draft={mockDraft}
        onUpdate={vi.fn()}
        onClose={vi.fn()}
        api={mockApi}
      />,
    );

    expect(screen.getByText('Campos')).toBeInTheDocument();
    expect(screen.getByText('Normalizado')).toBeInTheDocument();
    expect(screen.getByText('Bruto')).toBeInTheDocument();
  });

  it('renderiza o DraftEditorTab na aba editor', () => {
    render(
      <DiscordDraftPreview
        draft={mockDraft}
        onUpdate={vi.fn()}
        onClose={vi.fn()}
        api={mockApi}
      />,
    );

    expect(screen.getByTestId('draft-editor-tab')).toBeInTheDocument();
  });
});
