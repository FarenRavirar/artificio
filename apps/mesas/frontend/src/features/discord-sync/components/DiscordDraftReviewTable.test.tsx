// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import toast from 'react-hot-toast';
import { DiscordDraftReviewTable } from './DiscordDraftReviewTable';
import type { DiscordDraft } from '../types';

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@artificio/ui', () => ({
  useConfirm: () => ({ confirm: vi.fn().mockResolvedValue(true) }),
}));

const mockGetDrafts = vi.fn();
const mockSyncReady = vi.fn();
const mockUpdateDraft = vi.fn();
const mockSyncDraft = vi.fn();
const mockReparseDraft = vi.fn();
const mockPurgeRejected = vi.fn();

vi.mock('../api/discordSyncApi', () => ({
  discordSyncApi: {
    getDrafts: (...args: unknown[]) => mockGetDrafts(...args),
    syncReady: (...args: unknown[]) => mockSyncReady(...args),
    updateDraft: (...args: unknown[]) => mockUpdateDraft(...args),
    syncDraft: (...args: unknown[]) => mockSyncDraft(...args),
    reparseDraft: (...args: unknown[]) => mockReparseDraft(...args),
    purgeRejectedDrafts: (...args: unknown[]) => mockPurgeRejected(...args),
  },
}));

vi.mock('./DiscordDraftPreview', () => ({
  DiscordDraftPreview: ({ draft, onClose, onUpdate }: { draft: DiscordDraft; onClose: () => void; onUpdate: (d: DiscordDraft) => void }) => (
    <div data-testid="draft-preview">
      <span data-testid="preview-draft-id">{draft.id}</span>
      <button data-testid="btn-preview-close" onClick={onClose}>Fechar preview</button>
      <button data-testid="btn-preview-update" onClick={() => onUpdate(draft)}>Atualizar</button>
    </div>
  ),
}));

const mockDrafts: DiscordDraft[] = [
  {
    id: 'draft-1',
    discord_message_id: 'dm-1',
    table_id: null,
    parsed_payload: { table: { title: 'Mesa A' } },
    normalized_payload: { missing_fields: [] } as unknown as DiscordDraft['normalized_payload'],
    confidence: 0.95,
    status: 'ready',
    review_notes: null,
    created_at: '2024-06-01T00:00:00Z',
    updated_at: '2024-06-01T00:00:00Z',
  },
  {
    id: 'draft-2',
    discord_message_id: 'dm-2',
    table_id: 'table-2',
    parsed_payload: { table: { title: 'Mesa B', system_name: 'D&D', cover_url: 'https://img.com/capa.jpg' } },
    normalized_payload: null,
    confidence: null,
    status: 'synced',
    review_notes: 'Revisar contato',
    created_at: '2024-06-02T00:00:00Z',
    updated_at: '2024-06-02T00:00:00Z',
  },
  {
    id: 'draft-3',
    discord_message_id: 'dm-3',
    table_id: null,
    parsed_payload: { table: { title: 'Mesa C' } },
    normalized_payload: { missing_fields: ['title'] } as unknown as DiscordDraft['normalized_payload'],
    confidence: 0.5,
    status: 'ready',
    review_notes: null,
    created_at: '2024-06-03T00:00:00Z',
    updated_at: '2024-06-03T00:00:00Z',
  },
];

describe('DiscordDraftReviewTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDrafts.mockResolvedValue(mockDrafts);
  });

  it('renderiza sem crash', async () => {
    render(<DiscordDraftReviewTable />);

    await waitFor(() => {
      expect(screen.getByText('Mesa A')).toBeInTheDocument();
    });
  });

  it('carrega e exibe drafts', async () => {
    render(<DiscordDraftReviewTable />);

    await waitFor(() => {
      expect(screen.getByText('Mesa A')).toBeInTheDocument();
      expect(screen.getByText('Mesa B')).toBeInTheDocument();
      expect(screen.getByText('Mesa C')).toBeInTheDocument();
    });
  });

  it('mostra status dos drafts', async () => {
    render(<DiscordDraftReviewTable />);

    await waitFor(() => {
      expect(screen.getByText('Pronto')).toBeInTheDocument();
      expect(screen.getByText('Sincronizado')).toBeInTheDocument();
    });
  });

  it('mostra confidence quando disponivel', async () => {
    render(<DiscordDraftReviewTable />);

    await waitFor(() => {
      expect(screen.getByText('95%')).toBeInTheDocument();
    });
  });

  it('mostra "mesa vinculada" quando draft tem table_id', async () => {
    render(<DiscordDraftReviewTable />);

    await waitFor(() => {
      expect(screen.getByText('mesa vinculada')).toBeInTheDocument();
    });
  });

  it('abre preview ao clicar em draft', async () => {
    render(<DiscordDraftReviewTable />);

    await waitFor(() => {
      expect(screen.getByText('Mesa A')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Mesa A'));

    expect(screen.getByTestId('draft-preview')).toBeInTheDocument();
    expect(screen.getByTestId('preview-draft-id')).toHaveTextContent('draft-1');
  });

  it('fecha preview ao clicar em fechar', async () => {
    render(<DiscordDraftReviewTable />);

    await waitFor(() => {
      expect(screen.getByText('Mesa A')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Mesa A'));
    expect(screen.getByTestId('draft-preview')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('btn-preview-close'));
    expect(screen.queryByTestId('draft-preview')).not.toBeInTheDocument();
  });

  it('mostra seletor de filtro de status', async () => {
    render(<DiscordDraftReviewTable />);

    await waitFor(() => {
      expect(screen.getByText('Recarregar')).toBeInTheDocument();
    });

    expect(screen.getByText('Todos os status')).toBeInTheDocument();
  });

  it('mostra "Sincronizar todos prontos" quando ha drafts ready sem missing_fields', async () => {
    render(<DiscordDraftReviewTable showSyncReady={true} />);
    expect(mockGetDrafts).toHaveBeenCalled();

    await waitFor(() => {
      expect(screen.getByText('Sincronizar todos prontos (1)')).toBeInTheDocument();
    });
  });

  it('mostra "Nenhum draft encontrado" quando lista vazia', async () => {
    mockGetDrafts.mockResolvedValue([]);
    render(<DiscordDraftReviewTable />);

    await waitFor(() => {
      expect(screen.getByText('Nenhum draft encontrado.')).toBeInTheDocument();
    });
  });

  it('nao mostra "Limpar descartados" quando nao ha drafts rejeitados', async () => {
    render(<DiscordDraftReviewTable />);

    await waitFor(() => {
      expect(screen.getByText('Recarregar')).toBeInTheDocument();
    });

    expect(screen.queryByText(/Limpar descartados/)).not.toBeInTheDocument();
  });

  it('mostra "Limpar descartados" e apaga ao confirmar', async () => {
    mockPurgeRejected.mockResolvedValue({ deleted: 2 });
    mockGetDrafts.mockResolvedValue([
      { ...mockDrafts[0], id: 'draft-rej-1', status: 'rejected' },
      { ...mockDrafts[2], id: 'draft-rej-2', status: 'rejected' },
    ]);

    render(<DiscordDraftReviewTable />);

    await waitFor(() => {
      expect(screen.getByText('Limpar descartados')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Limpar descartados'));

    await waitFor(() => {
      // origin default 'all' (filtro de origem inicial)
      expect(mockPurgeRejected).toHaveBeenCalledWith('all');
    });
  });

  it('mostra erro quando o purge falha (payload inesperado ou rede)', async () => {
    mockPurgeRejected.mockRejectedValue(new Error('Resposta de limpeza em formato inesperado.'));
    mockGetDrafts.mockResolvedValue([
      { ...mockDrafts[0], id: 'draft-rej-1', status: 'rejected' },
    ]);

    render(<DiscordDraftReviewTable />);

    await waitFor(() => {
      expect(screen.getByText('Limpar descartados')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Limpar descartados'));

    await waitFor(() => {
      expect(toast.error as Mock).toHaveBeenCalledWith('Resposta de limpeza em formato inesperado.');
    });
  });

  it('chama getDrafts com filtro de status', async () => {
    render(<DiscordDraftReviewTable />);

    await waitFor(() => {
      expect(screen.getByText('Recarregar')).toBeInTheDocument();
    });

    // WS2: há 2 comboboxes (origem + status). O status é o segundo.
    const selects = screen.getAllByRole('combobox');
    const select = selects.length > 1 ? selects[1] : selects[0];

    fireEvent.change(select, { target: { value: 'ready' } });

    await waitFor(() => {
      expect(mockGetDrafts).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'ready' }),
      );
    });
  });
});
