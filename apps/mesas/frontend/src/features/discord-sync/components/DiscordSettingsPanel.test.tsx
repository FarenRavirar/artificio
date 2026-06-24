// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DiscordSettingsPanel } from './DiscordSettingsPanel';
import type { DiscordSettings, DiscordBotTokenSettings } from '../types';

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../api/discordSyncApi', () => ({
  discordSyncApi: {
    getDiscordSettings: vi.fn(),
    saveDiscordBotToken: vi.fn(),
    deleteDiscordBotToken: vi.fn(),
  },
}));

import { discordSyncApi } from '../api/discordSyncApi';

const tokenSet: DiscordSettings = {
  bot_token: { is_set: true, preview: 'MTIz', updated_at: '2024-06-01T00:00:00Z' },
};
const tokenSaveResult: DiscordBotTokenSettings = {
  is_set: true, preview: 'NDU2', updated_at: '2024-06-01T00:00:00Z',
};
const tokenUnset: DiscordSettings = {
  bot_token: { is_set: false, preview: null, updated_at: null },
};

describe('DiscordSettingsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza estado de carregamento inicial', () => {
    vi.mocked(discordSyncApi.getDiscordSettings).mockReturnValue(new Promise(() => {}));
    render(<DiscordSettingsPanel />);
    expect(screen.getByText('Carregando...')).toBeInTheDocument();
  });

  it('renderiza formulario de configuracao apos carregar', async () => {
    vi.mocked(discordSyncApi.getDiscordSettings).mockResolvedValue(tokenSet);
    render(<DiscordSettingsPanel />);

    await waitFor(() => {
      expect(screen.getByText('Bot configurado')).toBeInTheDocument();
    });

    expect(screen.getByLabelText('Token do bot Discord')).toBeInTheDocument();
    expect(screen.getByText('Salvar token')).toBeInTheDocument();
    expect(screen.getByText('Remover token')).toBeInTheDocument();
  });

  it('mostra preview do token', async () => {
    vi.mocked(discordSyncApi.getDiscordSettings).mockResolvedValue(tokenSet);
    render(<DiscordSettingsPanel />);

    await waitFor(() => {
      expect(screen.getByText('MTIz')).toBeInTheDocument();
    });
  });

  it('mostra estado "Token nao configurado" quando is_set=false', async () => {
    vi.mocked(discordSyncApi.getDiscordSettings).mockResolvedValue(tokenUnset);
    render(<DiscordSettingsPanel />);

    await waitFor(() => {
      expect(screen.getByText('Token não configurado')).toBeInTheDocument();
    });
  });

  it('mostra confirmacao de remocao ao clicar "Remover token"', async () => {
    vi.mocked(discordSyncApi.getDiscordSettings).mockResolvedValue(tokenSet);
    render(<DiscordSettingsPanel />);

    await waitFor(() => {
      expect(screen.getByText('Remover token')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Remover token'));

    expect(screen.getByText('Confirmar remoção')).toBeInTheDocument();
    expect(screen.getByText('Cancelar')).toBeInTheDocument();
  });

  it('exibe mensagem de validacao ao salvar token vazio', async () => {
    vi.mocked(discordSyncApi.getDiscordSettings).mockResolvedValue(tokenSet);
    render(<DiscordSettingsPanel />);

    await waitFor(() => {
      expect(screen.getByText('Salvar token')).toBeInTheDocument();
    });

    const input = screen.getByLabelText('Token do bot Discord');
    fireEvent.change(input, { target: { value: '' } });

    fireEvent.click(screen.getByText('Salvar token'));

    expect(screen.getByText('Informe o token antes de salvar.')).toBeInTheDocument();
  });

  it('chama saveDiscordBotToken ao salvar token valido', async () => {
    vi.mocked(discordSyncApi.getDiscordSettings).mockResolvedValue(tokenSet);
    vi.mocked(discordSyncApi.saveDiscordBotToken).mockResolvedValue(tokenSaveResult);

    render(<DiscordSettingsPanel />);

    await waitFor(() => {
      expect(screen.getByText('Salvar token')).toBeInTheDocument();
    });

    const input = screen.getByLabelText('Token do bot Discord');
    fireEvent.change(input, { target: { value: 'a'.repeat(60) } });

    fireEvent.click(screen.getByText('Salvar token'));

    await waitFor(() => {
      expect(discordSyncApi.saveDiscordBotToken).toHaveBeenCalledWith({ token: 'a'.repeat(60) });
    });
  });

  it('chama deleteDiscordBotToken ao confirmar remocao', async () => {
    vi.mocked(discordSyncApi.getDiscordSettings).mockResolvedValue(tokenSet);
    vi.mocked(discordSyncApi.deleteDiscordBotToken).mockResolvedValue(undefined);

    render(<DiscordSettingsPanel />);

    await waitFor(() => {
      expect(screen.getByText('Remover token')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Remover token'));
    fireEvent.click(screen.getByText('Confirmar remoção'));

    await waitFor(() => {
      expect(discordSyncApi.deleteDiscordBotToken).toHaveBeenCalledTimes(1);
    });
  });
});
