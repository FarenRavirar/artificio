// @vitest-environment jsdom
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DiscordSourceList } from './DiscordSourceList';
import type { DiscordSource } from '../types';

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../api/discordSyncApi', () => ({
  discordSyncApi: {
    discoverGuilds: vi.fn(),
    discoverChannels: vi.fn(),
    createSource: vi.fn(),
    updateSource: vi.fn(),
    deleteSource: vi.fn(),
  },
}));

const mockSources: DiscordSource[] = [
  {
    id: 'src-1',
    guild_id: 'guild-1',
    channel_id: 'channel-1',
    channel_name: 'chat-geral',
    channel_type: 'text',
    enabled: true,
    auto_sync_enabled: false,
    last_message_id: null,
    last_synced_at: null,
    created_at: '2024-06-01T00:00:00Z',
    updated_at: '2024-06-01T00:00:00Z',
  },
  {
    id: 'src-2',
    guild_id: 'guild-1',
    channel_id: 'channel-2',
    channel_name: 'anuncios',
    channel_type: 'announcement',
    enabled: false,
    auto_sync_enabled: false,
    last_message_id: null,
    last_synced_at: '2024-06-01T00:00:00Z',
    created_at: '2024-06-01T00:00:00Z',
    updated_at: '2024-06-01T00:00:00Z',
  },
  {
    id: 'src-3',
    guild_id: 'guild-2',
    channel_id: 'channel-3',
    channel_name: 'forum-rpg',
    channel_type: 'forum',
    enabled: true,
    auto_sync_enabled: false,
    last_message_id: null,
    last_synced_at: null,
    created_at: '2024-06-01T00:00:00Z',
    updated_at: '2024-06-01T00:00:00Z',
  },
];

describe('DiscordSourceList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza sem crash', () => {
    render(
      <DiscordSourceList
        sources={[]}
        onRefresh={vi.fn()}
        onFetchMessages={vi.fn()}
        fetchingSourceId={null}
      />,
    );

    expect(screen.getByText('Canais monitorados')).toBeInTheDocument();
  });

  it('mostra "Nenhum canal cadastrado" quando lista vazia', () => {
    render(
      <DiscordSourceList
        sources={[]}
        onRefresh={vi.fn()}
        onFetchMessages={vi.fn()}
        fetchingSourceId={null}
      />,
    );

    expect(screen.getByText('Nenhum canal cadastrado.')).toBeInTheDocument();
  });

  it('renderiza lista de sources', () => {
    render(
      <DiscordSourceList
        sources={mockSources}
        onRefresh={vi.fn()}
        onFetchMessages={vi.fn()}
        fetchingSourceId={null}
      />,
    );

    expect(screen.getByText('chat-geral')).toBeInTheDocument();
    expect(screen.getByText('anuncios')).toBeInTheDocument();
    expect(screen.getByText('forum-rpg')).toBeInTheDocument();
  });

  it('mostra badge de tipo para cada source', () => {
    render(
      <DiscordSourceList
        sources={mockSources}
        onRefresh={vi.fn()}
        onFetchMessages={vi.fn()}
        fetchingSourceId={null}
      />,
    );

    expect(screen.getByText('Texto')).toBeInTheDocument();
    expect(screen.getByText('Anúncio')).toBeInTheDocument();
    expect(screen.getByText('Fórum')).toBeInTheDocument();
  });

  it('mostra prefixo de canal para cada source', () => {
    render(
      <DiscordSourceList
        sources={mockSources}
        onRefresh={vi.fn()}
        onFetchMessages={vi.fn()}
        fetchingSourceId={null}
      />,
    );

    expect(screen.getByText('#channel-1')).toBeInTheDocument();
    expect(screen.getByText('#channel-2')).toBeInTheDocument();
    expect(screen.getByText('Fórum channel-3')).toBeInTheDocument();
  });

  it('mostra estado enabled/disabled', () => {
    render(
      <DiscordSourceList
        sources={mockSources}
        onRefresh={vi.fn()}
        onFetchMessages={vi.fn()}
        fetchingSourceId={null}
      />,
    );

    expect(screen.getAllByText('Habilitado')).toHaveLength(2);
    expect(screen.getByText('Desabilitado')).toBeInTheDocument();
  });

  it('botao "Adicionar canal" abre formulario', () => {
    render(
      <DiscordSourceList
        sources={mockSources}
        onRefresh={vi.fn()}
        onFetchMessages={vi.fn()}
        fetchingSourceId={null}
      />,
    );

    fireEvent.click(screen.getByText('+ Adicionar canal'));

    expect(screen.getByText('Salvar')).toBeInTheDocument();
    expect(screen.getByText('Cancelar')).toBeInTheDocument();
    expect(screen.getByText('Modo avançado')).toBeInTheDocument();
  });

  it('mostra botoes de acao por source', () => {
    render(
      <DiscordSourceList
        sources={mockSources}
        onRefresh={vi.fn()}
        onFetchMessages={vi.fn()}
        fetchingSourceId={null}
      />,
    );

    mockSources.forEach(source => {
      const btnLabel = source.channel_type === 'forum' ? 'Buscar posts' : 'Buscar mensagens';
      expect(screen.getAllByText(btnLabel).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('mostra sync timestamp quando disponivel', () => {
    render(
      <DiscordSourceList
        sources={mockSources}
        onRefresh={vi.fn()}
        onFetchMessages={vi.fn()}
        fetchingSourceId={null}
      />,
    );

    expect(screen.getByText(/sync/)).toBeInTheDocument();
  });

  it('chama onFetchMessages ao clicar em buscar', () => {
    const onFetchMessages = vi.fn();
    render(
      <DiscordSourceList
        sources={mockSources}
        onRefresh={vi.fn()}
        onFetchMessages={onFetchMessages}
        fetchingSourceId={null}
      />,
    );

    const sourceRow = screen.getByText('chat-geral').closest('[class*="rounded-lg"]') as HTMLElement;
    const fetchButton = within(sourceRow).getByText('Buscar mensagens');
    fireEvent.click(fetchButton);
    expect(onFetchMessages).toHaveBeenCalledWith(
      'src-1',
      expect.objectContaining({ since: expect.any(String), until: expect.any(String) }),
      expect.any(String),
    );
  });
});
