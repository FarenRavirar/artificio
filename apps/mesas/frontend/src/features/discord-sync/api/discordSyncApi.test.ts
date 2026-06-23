// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { discordSyncApi } from './discordSyncApi';

const okJson = (data: unknown) => ({
  ok: true,
  status: 200,
  text: async () => JSON.stringify({ data }),
  headers: new Headers(),
  json: async () => ({ data }),
}) as Response;

const okVoid = () => ({
  ok: true,
  status: 204,
  text: async () => '',
  headers: new Headers(),
}) as Response;

describe('discordSyncApi', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('getDiscordSettings', () => {
    it('faz GET /settings e retorna settings parseadas', async () => {
      fetchMock.mockResolvedValue(okJson({ bot_token: { is_set: true, preview: 'MTIz', updated_at: null } }));
      const result = await discordSyncApi.getDiscordSettings();
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, opts] = fetchMock.mock.calls[0];
      expect(url).toContain('/api/v1/admin/discord-sync/settings');
      expect(opts?.method).toBeUndefined();
      expect(result.bot_token.is_set).toBe(true);
      expect(result.bot_token.preview).toBe('MTIz');
    });

    it('retorna fallback vazio quando resposta e invalida', async () => {
      fetchMock.mockResolvedValue(okJson(null));
      const result = await discordSyncApi.getDiscordSettings();
      expect(result.bot_token.is_set).toBe(false);
      expect(result.bot_token.preview).toBeNull();
    });
  });

  describe('saveDiscordBotToken', () => {
    it('faz PUT /settings/bot-token com token no body', async () => {
      fetchMock.mockResolvedValue(okJson({ is_set: true, preview: 'NDU2', updated_at: '2024-01-01' }));
      const result = await discordSyncApi.saveDiscordBotToken({ token: 'abc123' });
      const [, opts] = fetchMock.mock.calls[0];
      expect(opts?.method).toBe('PUT');
      expect(JSON.parse(opts?.body as string)).toEqual({ token: 'abc123' });
      expect(result.is_set).toBe(true);
    });
  });

  describe('deleteDiscordBotToken', () => {
    it('faz DELETE /settings/bot-token', async () => {
      fetchMock.mockResolvedValue(okVoid());
      await discordSyncApi.deleteDiscordBotToken();
      const [, opts] = fetchMock.mock.calls[0];
      expect(opts?.method).toBe('DELETE');
    });
  });

  describe('discoverGuilds', () => {
    it('faz GET /discovery/guilds e retorna lista parseada', async () => {
      const guilds = [{ id: 'g1', name: 'Server', icon: null, approximate_member_count: 100 }];
      fetchMock.mockResolvedValue(okJson(guilds));
      const result = await discordSyncApi.discoverGuilds();
      expect(fetchMock.mock.calls[0][0]).toContain('/discovery/guilds');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Server');
    });

    it('lanca erro quando resposta e invalida', async () => {
      fetchMock.mockResolvedValue(okJson([{ id: 'g1' }]));
      await expect(discordSyncApi.discoverGuilds()).rejects.toThrow('formato inesperado');
    });
  });

  describe('discoverChannels', () => {
    it('faz GET /discovery/guilds/:id/channels', async () => {
      fetchMock.mockResolvedValue(okJson([]));
      await discordSyncApi.discoverChannels('guild-1');
      expect(fetchMock.mock.calls[0][0]).toContain('/discovery/guilds/guild-1/channels');
    });
  });

  describe('getSources', () => {
    it('faz GET /sources', async () => {
      fetchMock.mockResolvedValue(okJson([]));
      const result = await discordSyncApi.getSources();
      expect(fetchMock.mock.calls[0][0]).toContain('/sources');
      expect(result).toEqual([]);
    });
  });

  describe('createSource', () => {
    it('faz POST /sources com body', async () => {
      fetchMock.mockResolvedValue(okJson({ id: 's1', guild_id: 'g1', channel_id: 'c1', channel_type: 'text', enabled: true }));
      await discordSyncApi.createSource({ guild_id: 'g1', channel_id: 'c1', channel_type: 'text' });
      const [, opts] = fetchMock.mock.calls[0];
      expect(opts?.method).toBe('POST');
      expect(JSON.parse(opts?.body as string)).toMatchObject({ guild_id: 'g1', channel_id: 'c1' });
    });
  });

  describe('updateSource', () => {
    it('faz PATCH /sources/:id', async () => {
      fetchMock.mockResolvedValue(okJson({ id: 's1' }));
      await discordSyncApi.updateSource('s1', { enabled: false });
      const [, opts] = fetchMock.mock.calls[0];
      expect(opts?.method).toBe('PATCH');
      expect(fetchMock.mock.calls[0][0]).toContain('/sources/s1');
    });
  });

  describe('deleteSource', () => {
    it('faz DELETE /sources/:id', async () => {
      fetchMock.mockResolvedValue(okJson({ message: 'removido' }));
      await discordSyncApi.deleteSource('s1');
      const [, opts] = fetchMock.mock.calls[0];
      expect(opts?.method).toBe('DELETE');
    });
  });

  describe('fetchMessages', () => {
    it('faz POST /fetch com body', async () => {
      fetchMock.mockResolvedValue(okJson({ inserted: 5, updated: 0, total: 5, newestMessageId: null, threadsScanned: 0, sourceKind: 'text' }));
      await discordSyncApi.fetchMessages({ source_id: 's1', limit: 50 });
      const [, opts] = fetchMock.mock.calls[0];
      expect(opts?.method).toBe('POST');
      expect(fetchMock.mock.calls[0][0]).toContain('/fetch');
    });
  });

  describe('getMessages', () => {
    it('faz GET /messages com query string', async () => {
      fetchMock.mockResolvedValue(okJson([]));
      await discordSyncApi.getMessages({ source_id: 's1', status: 'pending', limit: 10 });
      const url = fetchMock.mock.calls[0][0] as string;
      expect(url).toContain('/messages?');
      expect(url).toContain('source_id=s1');
      expect(url).toContain('status=pending');
      expect(url).toContain('limit=10');
    });
  });

  describe('updateMessage', () => {
    it('faz PATCH /messages/:id', async () => {
      fetchMock.mockResolvedValue(okJson({
        id: 'm1', source_id: 's1', discord_message_id: 'dm1',
        discord_channel_id: 'c1', discord_guild_id: 'g1',
        discord_parent_channel_id: null, discord_thread_id: null,
        discord_thread_name: null, discord_author_id: null,
        discord_author_name: null, discord_message_url: null,
        content_raw: '', attachments: [], embeds: [],
        message_created_at: null, message_edited_at: null,
        content_hash: 'h', source_kind: 'discord_bot',
        status: 'parsed', parse_error: null,
        created_at: '2024-01-01', updated_at: '2024-01-01',
      }));
      const result = await discordSyncApi.updateMessage('m1', { status: 'parsed' });
      expect(result.status).toBe('parsed');
      const [, opts] = fetchMock.mock.calls[0];
      expect(opts?.method).toBe('PATCH');
    });
  });

  describe('parseMessage', () => {
    it('faz POST /messages/:id/parse', async () => {
      fetchMock.mockResolvedValue(okJson({
        id: 'd1', discord_message_id: null, table_id: null, parsed_payload: {}, normalized_payload: null,
        confidence: null, status: 'draft', review_notes: null, created_at: '', updated_at: '',
      }));
      await discordSyncApi.parseMessage('m1');
      const [, opts] = fetchMock.mock.calls[0];
      expect(opts?.method).toBe('POST');
      expect(fetchMock.mock.calls[0][0]).toContain('/messages/m1/parse');
    });
  });

  describe('getDrafts', () => {
    it('faz GET /drafts com query string', async () => {
      fetchMock.mockResolvedValue(okJson([]));
      await discordSyncApi.getDrafts({ status: 'ready', limit: 50 });
      const url = fetchMock.mock.calls[0][0] as string;
      expect(url).toContain('/drafts?');
      expect(url).toContain('status=ready');
      expect(url).toContain('limit=50');
    });
  });

  describe('getDraft', () => {
    it('faz GET /drafts/:id', async () => {
      fetchMock.mockResolvedValue(okJson({
        id: 'd1', discord_message_id: null, table_id: null, parsed_payload: {}, normalized_payload: null,
        confidence: null, status: 'draft', review_notes: null, created_at: '', updated_at: '',
      }));
      await discordSyncApi.getDraft('d1');
      expect(fetchMock.mock.calls[0][0]).toContain('/drafts/d1');
    });
  });

  describe('updateDraft', () => {
    it('faz PATCH /drafts/:id', async () => {
      fetchMock.mockResolvedValue(okJson({
        id: 'd1', discord_message_id: null, table_id: null, parsed_payload: {}, normalized_payload: null,
        confidence: null, status: 'ready', review_notes: null, created_at: '', updated_at: '',
      }));
      await discordSyncApi.updateDraft('d1', { status: 'ready' });
      const [, opts] = fetchMock.mock.calls[0];
      expect(opts?.method).toBe('PATCH');
    });
  });

  describe('syncDraft', () => {
    it('faz POST /drafts/:id/sync', async () => {
      fetchMock.mockResolvedValue(okJson({ tableId: 't1', created: true }));
      const result = await discordSyncApi.syncDraft('d1');
      expect(result.tableId).toBe('t1');
      expect(result.created).toBe(true);
      const [, opts] = fetchMock.mock.calls[0];
      expect(opts?.method).toBe('POST');
    });
  });

  describe('syncReady', () => {
    it('faz POST /sync-ready', async () => {
      fetchMock.mockResolvedValue(okJson({ synced: 3, failed: 0, errors: [] }));
      const result = await discordSyncApi.syncReady();
      expect(result.synced).toBe(3);
    });
  });

  describe('importJson', () => {
    it('faz POST /import-json e retorna resultado parseado', async () => {
      fetchMock.mockResolvedValue(okJson({ total: 10, inserted: 8, updated: 2, ignored: 0, failed: 0 }));
      const result = await discordSyncApi.importJson({ json: '{}' });
      expect(result.inserted).toBe(8);
    });

    it('lanca erro se resposta for invalida', async () => {
      fetchMock.mockResolvedValue(okJson({ total: 'dez' }));
      await expect(discordSyncApi.importJson({ json: '{}' })).rejects.toThrow('formato inesperado');
    });
  });

  describe('previewJson', () => {
    it('faz POST /import-json/preview e retorna resultado parseado', async () => {
      fetchMock.mockResolvedValue(okJson({
        guild: { id: 'g1', name: 'Server' },
        channel: { id: 'c1', name: 'chat' },
        dateRange: null,
        exportedAt: null,
        messageCount: 100,
        messagesWithAttachments: 10,
        messagesWithEmbeds: 5,
      }));
      const result = await discordSyncApi.previewJson({ json: '{}' });
      expect(result.guild.name).toBe('Server');
      expect(result.messageCount).toBe(100);
    });
  });

  describe('reingestForce', () => {
    it('faz POST /sources/:id/reingest-force', async () => {
      fetchMock.mockResolvedValue(okJson({ inserted: 0, updated: 0, total: 0, newestMessageId: null, threadsScanned: 0, sourceKind: 'text', deleted: 0 }));
      await discordSyncApi.reingestForce('s1');
      const [, opts] = fetchMock.mock.calls[0];
      expect(opts?.method).toBe('POST');
      expect(fetchMock.mock.calls[0][0]).toContain('/sources/s1/reingest-force');
    });
  });

  describe('parseBatch', () => {
    it('faz POST /messages/parse-batch', async () => {
      fetchMock.mockResolvedValue(okJson({ processed: 10, succeeded: 8, failed: 2 }));
      const result = await discordSyncApi.parseBatch();
      expect(result.processed).toBe(10);
    });
  });

  describe('diagnoseMessageContent', () => {
    it('faz POST /messages/:id/diagnose-content', async () => {
      fetchMock.mockResolvedValue(okJson({
        discord_message_id: 'dm1', discord_channel_id: 'c1', discord_thread_name: null,
        db_content_length: 0, api_content_length: 0, api_attachments_count: 0, api_embeds_count: 0,
        api_content_preview: '', likely_missing_message_content_intent: false, diagnosis: 'ok',
      }));
      await discordSyncApi.diagnoseMessageContent('m1');
      expect(fetchMock.mock.calls[0][0]).toContain('/messages/m1/diagnose-content');
    });
  });

  describe('reparseDraft', () => {
    it('faz POST /drafts/:id/reparse', async () => {
      fetchMock.mockResolvedValue(okJson({
        id: 'd1', discord_message_id: null, table_id: null, parsed_payload: {}, normalized_payload: null,
        confidence: null, status: 'draft', review_notes: null, created_at: '', updated_at: '',
      }));
      await discordSyncApi.reparseDraft('d1');
      const [, opts] = fetchMock.mock.calls[0];
      expect(opts?.method).toBe('POST');
      expect(fetchMock.mock.calls[0][0]).toContain('/drafts/d1/reparse');
    });
  });
});
