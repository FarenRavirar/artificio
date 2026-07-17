import { listForumThreads } from '../ingestMessages.js';

describe('listForumThreads', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('paginates public archived forum threads while Discord reports has_more', async () => {
    const responses = [
      {
        threads: [
          { id: 'active-1', parent_id: 'forum-1', name: 'Active thread' },
          { id: 'active-other', parent_id: 'forum-2', name: 'Other forum active thread' },
        ],
      },
      {
        threads: [
          {
            id: 'archived-1',
            parent_id: 'forum-1',
            name: 'Archived first page',
            thread_metadata: { archive_timestamp: '2026-05-10T00:00:00.000Z' },
          },
        ],
        has_more: true,
      },
      {
        threads: [
          {
            id: 'archived-2',
            parent_id: 'forum-1',
            name: 'Archived second page',
            thread_metadata: { archive_timestamp: '2026-05-01T00:00:00.000Z' },
          },
        ],
        has_more: false,
      },
    ];

    const fetchMock = vi.fn(async () => {
      const body = responses.shift();
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const threads = await listForumThreads({
      guildId: 'guild-1',
      forumChannelId: 'forum-1',
      token: 'bot-token',
    });

    expect(threads.map((thread) => thread.id).sort()).toEqual(['active-1', 'archived-1', 'archived-2']);
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      'https://discord.com/api/v10/channels/forum-1/threads/archived/public?limit=100&before=2026-05-10T00%3A00%3A00.000Z',
      expect.any(Object)
    );
  });
});
