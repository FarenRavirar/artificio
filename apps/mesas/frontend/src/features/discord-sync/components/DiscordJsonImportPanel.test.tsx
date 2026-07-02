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
    previewFile: vi.fn(),
    importFile: vi.fn(),
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

    const textarea = screen.getByRole("textbox", { name: "JSON do DiscordChatExporter" });
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
    const textarea = screen.getByRole("textbox", { name: "JSON do DiscordChatExporter" });
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
    const textarea = screen.getByRole("textbox", { name: "JSON do DiscordChatExporter" });
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
    const textarea = screen.getByRole("textbox", { name: "JSON do DiscordChatExporter" });
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
    const textarea = screen.getByRole("textbox", { name: "JSON do DiscordChatExporter" });
    fireEvent.change(textarea, { target: { value: '{"test": true}' } });

    await waitFor(() => {
      expect(screen.getByText('Analisando JSON...')).toBeInTheDocument();
    }, { timeout: 1000 });
  });

  it('arquivo grande usa previewFile/importFile e mostra resultado', async () => {
    vi.mocked(discordSyncApi.previewFile).mockResolvedValue({
      guild: { id: 'g1', name: 'Império – RPG' },
      channel: { id: 'c1', name: 'campanhas' },
      dateRange: { after: '2026-07-01T00:00:00-03:00', before: undefined },
      exportedAt: '2026-07-01T16:26:44.4756727-03:00',
      messageCount: 50,
      totalAttachments: 39,
      totalEmbeds: 12,
    });
    vi.mocked(discordSyncApi.importFile).mockResolvedValue({
      total: 50,
      inserted: 50,
      updated: 0,
      ignored: 0,
      failed: 0,
      auto_parse: { total: 50, parsed: 38, discarded: 10, ignored: 2, errors: 0 },
    });

    const onNavigateToDrafts = vi.fn();
    render(<DiscordJsonImportPanel onNavigateToDrafts={onNavigateToDrafts} />);

    const input = screen.getByLabelText('Selecionar arquivo JSON do DiscordChatExporter');
    const largeJson = new File(['{', ' '.repeat(60 * 1024), '}'], 'teste.json', { type: 'application/json' });
    fireEvent.change(input, { target: { files: [largeJson] } });

    await waitFor(() => {
      expect(discordSyncApi.previewFile).toHaveBeenCalledWith(largeJson);
      expect(screen.getByText('Pré-visualização')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Importar'));

    await waitFor(() => {
      expect(discordSyncApi.importFile).toHaveBeenCalledWith(largeJson);
      expect(screen.getByText('Importação concluída')).toBeInTheDocument();
      expect(screen.getByText('Importadas')).toBeInTheDocument();
      expect(screen.getByText('Rascunhos')).toBeInTheDocument();
      expect(screen.getByText('38')).toBeInTheDocument();
      expect(screen.getByText('Os anúncios válidos foram convertidos em rascunhos revisáveis.')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Ver drafts'));
    expect(onNavigateToDrafts).toHaveBeenCalledOnce();
  });

  it('texto colado usa importJson com autoParse e mostra rascunhos gerados', async () => {
    vi.mocked(discordSyncApi.previewJson).mockResolvedValue({
      guild: { id: 'g1', name: 'Império – RPG' },
      channel: { id: 'c1', name: 'campanhas' },
      dateRange: null,
      exportedAt: '2026-07-01T16:26:44.4756727-03:00',
      messageCount: 1,
      totalAttachments: 0,
      totalEmbeds: 0,
    });
    vi.mocked(discordSyncApi.importJson).mockResolvedValue({
      total: 1,
      inserted: 1,
      updated: 0,
      ignored: 0,
      failed: 0,
      auto_parse: { total: 1, parsed: 1, discarded: 0, ignored: 0, errors: 0 },
    });

    render(<DiscordJsonImportPanel />);
    const textarea = screen.getByRole('textbox', { name: 'JSON do DiscordChatExporter' });
    fireEvent.change(textarea, { target: { value: '{"messages":[]}' } });

    await waitFor(() => {
      expect(discordSyncApi.previewJson).toHaveBeenCalled();
      expect(screen.getByText('Pré-visualização')).toBeInTheDocument();
    }, { timeout: 1000 });

    fireEvent.click(screen.getByText('Importar'));

    await waitFor(() => {
      expect(discordSyncApi.importJson).toHaveBeenCalledWith({ json: '{"messages":[]}' });
      expect(screen.getByText('Rascunhos')).toBeInTheDocument();
      expect(screen.getByText('Os anúncios válidos foram convertidos em rascunhos revisáveis.')).toBeInTheDocument();
    });
  });
});
