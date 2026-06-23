// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DiscordJsonImportPanel } from './DiscordJsonImportPanel';

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../api/discordSyncApi', () => ({
  discordSyncApi: {
    previewJson: vi.fn(),
    importJson: vi.fn(),
  },
}));

import { discordSyncApi } from '../api/discordSyncApi';

describe('DiscordJsonImportPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza sem crash', () => {
    render(<DiscordJsonImportPanel />);
    expect(screen.getByText('Importar JSON do DiscordChatExporter')).toBeInTheDocument();
  });

  it('mostra estado inicial (textarea vazio, botoes)', () => {
    render(<DiscordJsonImportPanel />);

    const textarea = screen.getByLabelText('JSON do DiscordChatExporter');
    expect(textarea).toBeInTheDocument();
    expect(textarea).toHaveValue('');

    expect(screen.getByText('Importar')).toBeInTheDocument();
    expect(screen.getByText('Selecionar arquivo')).toBeInTheDocument();
    expect(screen.getByText('Limpar')).toBeInTheDocument();
  });

  it('botao Importar desabilitado no estado empty', () => {
    render(<DiscordJsonImportPanel />);
    expect(screen.getByText('Importar')).toBeDisabled();
  });

  it('textarea aceita input', () => {
    render(<DiscordJsonImportPanel />);
    const textarea = screen.getByLabelText('JSON do DiscordChatExporter');
    fireEvent.change(textarea, { target: { value: '{}' } });
    expect(textarea).toHaveValue('{}');
  });

  it('chama previewJson quando texto e inserido (debounce)', async () => {
    vi.mocked(discordSyncApi.previewJson).mockResolvedValue({
      guild: { id: 'g1', name: 'Servidor Teste' },
      channel: { id: 'c1', name: 'chat-geral' },
      dateRange: null,
      exportedAt: '2024-06-01T00:00:00Z',
      messageCount: 50,
      totalAttachments: 5,
      totalEmbeds: 3,
    });

    render(<DiscordJsonImportPanel />);
    const textarea = screen.getByLabelText('JSON do DiscordChatExporter');
    fireEvent.change(textarea, { target: { value: '{"some":"data"}' } });

    await waitFor(() => {
      expect(discordSyncApi.previewJson).toHaveBeenCalled();
    }, { timeout: 1000 });
  });

  it('mostra preview apos preview bem sucedido', async () => {
    vi.mocked(discordSyncApi.previewJson).mockResolvedValue({
      guild: { id: 'g1', name: 'Servidor Teste' },
      channel: { id: 'c1', name: 'chat-geral' },
      dateRange: null,
      exportedAt: '2024-06-01T00:00:00Z',
      messageCount: 50,
      totalAttachments: 5,
      totalEmbeds: 3,
    });

    render(<DiscordJsonImportPanel />);
    const textarea = screen.getByLabelText('JSON do DiscordChatExporter');
    fireEvent.change(textarea, { target: { value: '{"some":"data"}' } });

    await waitFor(() => {
      expect(screen.getByText('Pré-visualização')).toBeInTheDocument();
    }, { timeout: 1000 });

    expect(screen.getByText('Servidor Teste')).toBeInTheDocument();
    expect(screen.getByText('chat-geral')).toBeInTheDocument();
  });

  it('mostra "Analisando JSON..." durante preview', async () => {
    vi.mocked(discordSyncApi.previewJson).mockImplementation(() => new Promise(() => {}));

    render(<DiscordJsonImportPanel />);
    const textarea = screen.getByLabelText('JSON do DiscordChatExporter');
    fireEvent.change(textarea, { target: { value: '{"test": true}' } });

    await waitFor(() => {
      expect(screen.getByText('Analisando JSON...')).toBeInTheDocument();
    }, { timeout: 1000 });
  });
});
