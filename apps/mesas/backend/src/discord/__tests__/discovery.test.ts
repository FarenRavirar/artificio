import type { Mock } from 'vitest';

vi.mock('../config', () => ({
  requireDiscordBotToken: vi.fn(),
}));

import { discoverDiscordGuilds, discoverDiscordChannels, DiscordDiscoveryError } from '../discovery.js';
import { requireDiscordBotToken } from '../config.js';
import { DiscordSettingsDecryptError } from '../settingsCrypto.js';

function mockFetch(status: number, body: unknown): void {
  global.fetch = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  ) as unknown as typeof fetch;
}

describe('discordGetUnknown path (via discoverDiscordGuilds)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireDiscordBotToken as Mock).mockResolvedValue('bot-token');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('discovers guilds sorted by name', async () => {
    mockFetch(200, [
      { id: 'g2', name: 'Zeta', icon: null, approximate_member_count: 10 },
      { id: 'g1', name: 'Alpha', icon: 'abc123', approximate_member_count: 50 },
    ]);

    const guilds = await discoverDiscordGuilds();

    expect(guilds).toHaveLength(2);
    expect(guilds[0].name).toBe('Alpha');
    expect(guilds[1].name).toBe('Zeta');
    expect(guilds[0].icon).toBe('abc123');
    expect(guilds[1].approximate_member_count).toBe(10);
  });

  it('throws DiscordDiscoveryError when Discord returns 401', async () => {
    mockFetch(401, { message: 'Unauthorized' });

    await expect(discoverDiscordGuilds()).rejects.toMatchObject({ statusCode: 422 });
    await expect(discoverDiscordGuilds()).rejects.toThrow(/Token do bot inválido/i);
  });

  it('maps unreadable stored bot token to actionable non-retry error', async () => {
    (requireDiscordBotToken as Mock).mockRejectedValue(new DiscordSettingsDecryptError());

    await expect(discoverDiscordGuilds()).rejects.toMatchObject({ statusCode: 422 });
    await expect(discoverDiscordGuilds()).rejects.toThrow(/Regrave o token/i);
  });

  it('throws DiscordDiscoveryError when Discord returns 403', async () => {
    mockFetch(403, { message: 'Forbidden' });

    await expect(discoverDiscordGuilds()).rejects.toThrow(DiscordDiscoveryError);
    await expect(discoverDiscordGuilds()).rejects.toThrow(/não tem permissão/i);
  });

  it('throws DiscordDiscoveryError when Discord returns 404', async () => {
    mockFetch(404, { message: 'Not Found' });

    await expect(discoverDiscordGuilds()).rejects.toThrow(DiscordDiscoveryError);
    await expect(discoverDiscordGuilds()).rejects.toThrow(/não encontrado/i);
  });

  it('throws DiscordDiscoveryError when Discord returns 429', async () => {
    mockFetch(429, { message: 'Too Many Requests' });

    await expect(discoverDiscordGuilds()).rejects.toThrow(DiscordDiscoveryError);
    await expect(discoverDiscordGuilds()).rejects.toThrow(/limitou/i);
  });
});

describe('discoverDiscordChannels', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireDiscordBotToken as Mock).mockResolvedValue('bot-token');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('discovers channels sorted by position and name, with category names', async () => {
    mockFetch(200, [
      { id: 'cat-1', name: 'Categorias', type: 4, position: 0 },
      { id: 'ch-2', name: 'segundo-canal', type: 0, position: 2, parent_id: 'cat-1', guild_id: 'g1' },
      { id: 'ch-1', name: 'primeiro-canal', type: 0, position: 1, parent_id: 'cat-1', guild_id: 'g1' },
      { id: 'forum-1', name: 'meu-forum', type: 15, position: 3, parent_id: null, guild_id: 'g1' },
      { id: 'ann-1', name: 'avisos', type: 5, position: 0, parent_id: null, guild_id: 'g1' },
    ]);

    const channels = await discoverDiscordChannels('g1');

    expect(channels).toHaveLength(4);
    expect(channels[0].kind).toBe('announcement');
    expect(channels[1].kind).toBe('text');
    expect(channels[2].kind).toBe('text');
    expect(channels[3].kind).toBe('forum');
    expect(channels[1].parent_name).toBe('Categorias');
    expect(channels[3].parent_name).toBeNull();
  });

  it('returns empty array when no discoverable channels exist', async () => {
    mockFetch(200, [
      { id: 'cat-1', name: 'Secret', type: 4, position: 0 },
      { id: 'voice-1', name: 'Voz', type: 2, position: 1 },
    ]);

    const channels = await discoverDiscordChannels('g1');
    expect(channels).toHaveLength(0);
  });

  it('throws DiscordDiscoveryError on fetch failure', async () => {
    mockFetch(500, { message: 'Server Error' });

    await expect(discoverDiscordChannels('g1')).rejects.toThrow(DiscordDiscoveryError);
  });
});
