// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DiscordDraftPreview } from './DiscordDraftPreview';
import type { DiscordDraft, DraftApiOperations } from '../types';
import { authGet, authPut } from '../../../services/apiClient';

// Aba ativa controlável por teste: o mock de useDraftForm é estático, então o
// valor de activeTab precisa ser mutável para exercitar as abas Bruto/Normalizado
// (cópia de JSON, R11). vi.hoisted garante a init antes das factories de vi.mock.
const mockActiveTab = vi.hoisted(() => ({ current: 'editor' as string }));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../../../services/apiClient', () => ({
  authGet: vi.fn(),
  authPut: vi.fn(),
}));

vi.mock('@artificio/ui', () => ({
  useConfirm: () => ({ confirm: vi.fn().mockResolvedValue(true) }),
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
    activeTab: mockActiveTab.current,
    setActiveTab: vi.fn(),
    coverUploading: false,
    coverError: null,
    coverPreviewUrl: '',
    coverInputRef: { current: null },
    slotsInterpretation: 'filled_total',
    setSlotsInterpretation: vi.fn(),
    slotsAmbiguity: null,
    payloadMissingFields: [],
    fieldInsights: {},
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
  beforeEach(() => {
    // GET /admin/tables/:id (mount effect, achado do mantenedor 2026-07-08 —
    // resolve slug/status real pro botão "Ver Mesa Publicada"). Default: falha,
    // pra não interferir nos testes que não tratam desse fluxo.
    vi.mocked(authGet).mockResolvedValue({ ok: false } as Response);
    mockActiveTab.current = 'editor';
  });

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
    expect(screen.getByRole('dialog', { name: 'Draft de mesa' })).toBeInTheDocument();
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

  it('mostra aba Duplicatas apenas quando API de leitura e decisao existem', () => {
    const { rerender } = render(
      <DiscordDraftPreview
        draft={mockDraft}
        onUpdate={vi.fn()}
        onClose={vi.fn()}
        api={{ ...mockApi, listDuplicateCandidates: vi.fn() }}
      />,
    );

    expect(screen.queryByText('Duplicatas')).not.toBeInTheDocument();

    rerender(
      <DiscordDraftPreview
        draft={mockDraft}
        onUpdate={vi.fn()}
        onClose={vi.fn()}
        api={{ ...mockApi, listDuplicateCandidates: vi.fn(), resolveDuplicateCandidate: vi.fn() }}
      />,
    );

    expect(screen.getByText('Duplicatas')).toBeInTheDocument();
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

  const mockSyncedDraft: DiscordDraft = {
    ...mockDraft,
    id: 'draft-2',
    status: 'synced',
    table_id: 'table-123',
  };

  it('nao mostra botao Publicar mesa quando draft nao tem table_id', () => {
    render(
      <DiscordDraftPreview
        draft={mockDraft}
        onUpdate={vi.fn()}
        onClose={vi.fn()}
        api={mockApi}
      />,
    );

    expect(screen.queryByText('Publicar mesa')).not.toBeInTheDocument();
  });

  it('mostra botao Publicar mesa quando draft sincronizado tem table_id', () => {
    render(
      <DiscordDraftPreview
        draft={mockSyncedDraft}
        onUpdate={vi.fn()}
        onClose={vi.fn()}
        api={mockApi}
      />,
    );

    expect(screen.getByText('Publicar mesa')).toBeInTheDocument();
  });

  it('publica mesa com sucesso e troca botao por link Ver Mesa Publicada', async () => {
    vi.mocked(authPut).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { id: 'table-123', slug: 'mesa-publicada', status: 'active' } }),
    } as Response);

    render(
      <DiscordDraftPreview
        draft={mockSyncedDraft}
        onUpdate={vi.fn()}
        onClose={vi.fn()}
        api={mockApi}
      />,
    );

    fireEvent.click(screen.getByText('Publicar mesa'));

    await waitFor(() => {
      expect(authPut).toHaveBeenCalledWith('/api/v1/admin/tables/table-123', { status: 'active' });
    });
    await waitFor(() => {
      expect(screen.getByText('Ver Mesa Publicada')).toBeInTheDocument();
    });
    expect(screen.queryByText('Publicar mesa')).not.toBeInTheDocument();
  });

  it('mostra link Ver Mesa Publicada direto (sem clicar) quando mesa ja estava publicada', async () => {
    vi.mocked(authGet).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { status: 'active', slug: 'mesa-ja-publicada' } }),
    } as Response);

    render(
      <DiscordDraftPreview
        draft={mockSyncedDraft}
        onUpdate={vi.fn()}
        onClose={vi.fn()}
        api={mockApi}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Ver Mesa Publicada')).toBeInTheDocument();
    });
    expect(screen.queryByText('Publicar mesa')).not.toBeInTheDocument();
  });

  it('mostra erro do backend quando publicacao falha', async () => {
    vi.mocked(authPut).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'Mesa nao pode ser publicada.' }),
    } as Response);

    render(
      <DiscordDraftPreview
        draft={mockSyncedDraft}
        onUpdate={vi.fn()}
        onClose={vi.fn()}
        api={mockApi}
      />,
    );

    fireEvent.click(screen.getByText('Publicar mesa'));

    await waitFor(() => {
      expect(authPut).toHaveBeenCalled();
    });
    // Botao permanece visivel — publicacao nao foi confirmada
    await waitFor(() => {
      expect(screen.getByText('Publicar mesa')).toBeInTheDocument();
    });
  });

  it('mostra erro generico quando authPut rejeita (falha de rede)', async () => {
    vi.mocked(authPut).mockRejectedValue(new Error('network error'));

    render(
      <DiscordDraftPreview
        draft={mockSyncedDraft}
        onUpdate={vi.fn()}
        onClose={vi.fn()}
        api={mockApi}
      />,
    );

    fireEvent.click(screen.getByText('Publicar mesa'));

    await waitFor(() => {
      expect(screen.getByText('Publicar mesa')).not.toBeDisabled();
    });
    expect(screen.queryByText('Mesa publicada')).not.toBeInTheDocument();
  });

  describe('Copiar anúncio (R1/R2/D1)', () => {
    it('mostra botão "Copiar anúncio" quando a mesa vinculada está ativa e não expirada', async () => {
      vi.mocked(authGet).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          data: {
            slug: 'mesa-ativa',
            title: 'Mesa Ativa',
            status: 'active',
            archived_at: null,
            origin: 'manual',
            created_at: '2024-06-01T00:00:00Z',
            starts_at: null,
          },
        }),
      } as Response);

      render(
        <DiscordDraftPreview
          draft={mockSyncedDraft}
          onUpdate={vi.fn()}
          onClose={vi.fn()}
          api={mockApi}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText('Copiar anúncio')).toBeInTheDocument();
      });
    });

    it('não mostra "Copiar anúncio" quando a mesa vinculada é draft (D1: ausente, não desabilitado)', async () => {
      vi.mocked(authGet).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          data: { slug: 'mesa-draft', title: 'Mesa Draft', status: 'draft' },
        }),
      } as Response);

      render(
        <DiscordDraftPreview
          draft={mockSyncedDraft}
          onUpdate={vi.fn()}
          onClose={vi.fn()}
          api={mockApi}
        />,
      );

      await waitFor(() => {
        expect(authGet).toHaveBeenCalled();
      });
      // D1: o botão não existe (não há estado desabilitado) antes de publicar.
      expect(screen.queryByText('Copiar anúncio')).not.toBeInTheDocument();
      expect(screen.queryByText('Ver Mesa Publicada')).not.toBeInTheDocument();
    });

    it('não mostra "Copiar anúncio" para mesa importada expirada mesmo active — predicado mais forte que publishedSlug', async () => {
      vi.mocked(authGet).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          data: {
            slug: 'mesa-expirada',
            title: 'Mesa Expirada',
            status: 'active',
            archived_at: null,
            origin: 'imported',
            created_at: '2020-01-01T00:00:00Z',
            starts_at: null,
          },
        }),
      } as Response);

      render(
        <DiscordDraftPreview
          draft={mockSyncedDraft}
          onUpdate={vi.fn()}
          onClose={vi.fn()}
          api={mockApi}
        />,
      );

      // "Ver Mesa Publicada" aparece (status active + slug), mas o anúncio não
      // (expiração de importado) — prova que o predicado não é publishedSlug puro.
      await waitFor(() => {
        expect(screen.getByText('Ver Mesa Publicada')).toBeInTheDocument();
      });
      expect(screen.queryByText('Copiar anúncio')).not.toBeInTheDocument();
    });
  });

  describe('Copiar JSON (R11)', () => {
    const originalClipboard = navigator.clipboard;
    const writeText = vi.fn();

    const jsonDraft: DiscordDraft = {
      ...mockDraft,
      parsed_payload: { raw: 'payload-bruto' },
      normalized_payload: { clean: 'payload-normalizado' },
    };

    beforeEach(() => {
      writeText.mockReset();
      writeText.mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText },
      });
    });

    afterEach(() => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: originalClipboard,
      });
    });

    it('copia o JSON bruto com aria-label correto na aba Bruto', async () => {
      mockActiveTab.current = 'parsed';

      render(
        <DiscordDraftPreview
          draft={jsonDraft}
          onUpdate={vi.fn()}
          onClose={vi.fn()}
          api={mockApi}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Copiar JSON bruto' }));

      await waitFor(() => {
        expect(writeText).toHaveBeenCalledWith(JSON.stringify({ raw: 'payload-bruto' }, null, 2));
      });
    });

    it('copia o JSON normalizado com aria-label correto na aba Normalizado', async () => {
      mockActiveTab.current = 'normalized';

      render(
        <DiscordDraftPreview
          draft={jsonDraft}
          onUpdate={vi.fn()}
          onClose={vi.fn()}
          api={mockApi}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Copiar JSON normalizado' }));

      await waitFor(() => {
        expect(writeText).toHaveBeenCalledWith(JSON.stringify({ clean: 'payload-normalizado' }, null, 2));
      });
    });
  });
});
