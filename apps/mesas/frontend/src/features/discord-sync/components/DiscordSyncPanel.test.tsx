// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DiscordSyncPanel } from './DiscordSyncPanel';

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('./DiscordSettingsPanel', () => ({
  DiscordSettingsPanel: () => <div data-testid="settings-panel">Configuracoes</div>,
}));
vi.mock('./DiscordSourceList', () => ({
  DiscordSourceList: ({ sources }: { sources: unknown[] }) => (
    <div data-testid="source-list">Fontes ({sources.length})</div>
  ),
}));
vi.mock('./DiscordDraftReviewTable', () => ({
  DiscordDraftReviewTable: () => <div data-testid="draft-table">Drafts</div>,
}));
vi.mock('./DiscordJsonImportPanel', () => ({
  DiscordJsonImportPanel: () => <div data-testid="import-panel">Import JSON</div>,
}));

vi.mock('../api/discordSyncApi', () => ({
  discordSyncApi: {
    getSources: vi.fn(),
    getMessages: vi.fn(),
    fetchMessages: vi.fn(),
    updateMessage: vi.fn(),
    parseMessage: vi.fn(),
    diagnoseMessageContent: vi.fn(),
    reingestForce: vi.fn(),
    parseBatch: vi.fn(),
    syncReady: vi.fn(),
  },
}));

import { discordSyncApi } from '../api/discordSyncApi';

describe('DiscordSyncPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(discordSyncApi.getSources).mockResolvedValue([]);
    vi.mocked(discordSyncApi.getMessages).mockResolvedValue([]);
  });

  it('renderiza titulo e abas sem crash', async () => {
    render(<DiscordSyncPanel />);

    expect(screen.getByText('Discord Sync — Covil do Lich')).toBeInTheDocument();
    expect(screen.getByText('Configuração')).toBeInTheDocument();
    expect(screen.getByText('Fontes')).toBeInTheDocument();
    expect(screen.getByText('Mensagens')).toBeInTheDocument();
    expect(screen.getByText('Drafts')).toBeInTheDocument();
    expect(screen.getByText('Importar JSON')).toBeInTheDocument();
  });

  it('mostra painel de configuracao por padrao', async () => {
    render(<DiscordSyncPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('settings-panel')).toBeInTheDocument();
    });
  });

  it('troca para aba fontes ao clicar', async () => {
    render(<DiscordSyncPanel />);

    fireEvent.click(screen.getByText('Fontes'));

    await waitFor(() => {
      expect(screen.getByTestId('source-list')).toBeInTheDocument();
    });
  });

  it('troca para aba Drafts ao clicar', async () => {
    render(<DiscordSyncPanel />);

    fireEvent.click(screen.getByText('Drafts'));

    await waitFor(() => {
      expect(screen.getByTestId('draft-table')).toBeInTheDocument();
    });
  });

  it('troca para aba Importar JSON ao clicar', async () => {
    render(<DiscordSyncPanel />);

    fireEvent.click(screen.getByText('Importar JSON'));

    await waitFor(() => {
      expect(screen.getByTestId('import-panel')).toBeInTheDocument();
    });
  });

  it('carrega sources ao montar', async () => {
    render(<DiscordSyncPanel />);

    await waitFor(() => {
      expect(discordSyncApi.getSources).toHaveBeenCalledTimes(1);
    });
  });

  it('mostra loading nas fontes enquanto carrega', async () => {
    vi.mocked(discordSyncApi.getSources).mockImplementation(() => new Promise(() => {}));
    render(<DiscordSyncPanel />);

    fireEvent.click(screen.getByText('Fontes'));

    expect(screen.getByText('Carregando...')).toBeInTheDocument();
  });
});
