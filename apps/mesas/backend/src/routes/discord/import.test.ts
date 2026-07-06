import express from 'express';
import request from 'supertest';
import type { Mock } from 'vitest';
import importRouter from './import';
import { db } from '../../db';
import { importDiscordChatExporterJson } from '../../discord/chatExporterImportService';
import { reparseOneMessage } from './utils';

vi.mock('../../db', () => ({
  db: {
    selectFrom: vi.fn(),
  },
}));

vi.mock('../../discord/chatExporterImportService', () => ({
  importDiscordChatExporterJson: vi.fn(),
  extractJsonPayload: vi.fn((body: unknown) => ({ payload: body })),
  parseUploadedJsonBuffer: vi.fn(),
}));

vi.mock('../../discord/shared', () => ({
  loadSystemsForParser: vi.fn().mockResolvedValue([]),
  loadVttPlatformsForParser: vi.fn().mockResolvedValue([]),
  loadCommunicationPlatformsForParser: vi.fn().mockResolvedValue([]),
}));

vi.mock('./utils', () => ({
  validateReparseMessageIds: vi.fn(() => undefined),
  buildContentIndex: vi.fn(() => new Map()),
  reparseOneMessage: vi.fn(),
  recordImportRun: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./preview', () => ({
  uploadJsonFile: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

vi.mock('../../middleware/auth', () => ({
  requireAdmin: [(req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.user = { userId: 'admin-test', role: 'admin' };
    next();
  }],
}));

const mockDb = db as unknown as { selectFrom: Mock };
const mockImport = importDiscordChatExporterJson as unknown as Mock;
const mockReparseOne = reparseOneMessage as unknown as Mock;

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/import-json', importRouter);
  return app;
}

function chain(overrides: Record<string, Mock> = {}) {
  const methods = ['select', 'selectAll', 'where', 'orderBy', 'limit'];
  const result: Record<string, Mock> = {};
  for (const method of methods) result[method] = vi.fn().mockReturnThis();
  return Object.assign(result, overrides);
}

function fakeMessage(id: string) {
  return { discord_message_id: id, discord_channel_id: 'chan-1', status: 'pending', content_raw: 'x' };
}

describe('POST /import-json auto-parse batching (DEB-058-XX)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReparseOne.mockResolvedValue('parsed');
  });

  it('processes more than 500 importedMessages across multiple batches instead of truncating', async () => {
    const importedMessages = Array.from({ length: 1200 }, (_, i) => ({
      channelId: 'chan-1',
      messageId: `msg-${i}`,
    }));
    mockImport.mockResolvedValue({
      total: 1200, inserted: 1200, updated: 0, ignored: 0, failed: 0, importedMessages,
    });

    // 3 chamadas ao selectFrom esperadas: lotes de 500, 500, 200.
    const batchSizes = [500, 500, 200];
    mockDb.selectFrom.mockImplementation(() => chain({
      execute: vi.fn().mockResolvedValue(
        Array.from({ length: batchSizes[mockDb.selectFrom.mock.calls.length - 1] }, (_, i) => fakeMessage(`m-${i}`)),
      ),
    }));

    const response = await request(makeApp())
      .post('/import-json')
      .send({ autoParse: true, guild: {}, channel: {}, messages: [] });

    expect(response.status).toBe(200);
    expect(mockDb.selectFrom).toHaveBeenCalledTimes(3);
    expect(response.body.data.auto_parse.total).toBe(1200);
    expect(response.body.data.auto_parse.parsed).toBe(1200);
  });
});

describe('POST /import-json/reparse batching (DEB-058-XX)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReparseOne.mockResolvedValue('parsed');
  });

  it('loops without messageIds until a batch returns fewer than 500 rows', async () => {
    const responses = [
      Array.from({ length: 500 }, (_, i) => fakeMessage(`a-${i}`)),
      Array.from({ length: 300 }, (_, i) => fakeMessage(`b-${i}`)),
    ];
    let call = 0;
    mockDb.selectFrom.mockImplementation(() => chain({
      execute: vi.fn().mockResolvedValue(responses[call++] ?? []),
    }));

    const response = await request(makeApp())
      .post('/import-json/reparse')
      .send({});

    expect(response.status).toBe(200);
    expect(mockDb.selectFrom).toHaveBeenCalledTimes(2);
    expect(response.body.data.total).toBe(800);
    expect(response.body.data.reparsed).toBe(800);
    expect(response.body.data.truncated).toBe(false);
  });

  it('stops at the safety cap and reports truncated=true when pending never drops below batch size', async () => {
    mockDb.selectFrom.mockImplementation(() => chain({
      execute: vi.fn().mockResolvedValue(Array.from({ length: 500 }, (_, i) => fakeMessage(`c-${i}`))),
    }));

    const response = await request(makeApp())
      .post('/import-json/reparse')
      .send({});

    expect(response.status).toBe(200);
    expect(mockDb.selectFrom).toHaveBeenCalledTimes(20);
    expect(response.body.data.total).toBe(10000);
    expect(response.body.data.truncated).toBe(true);
  });
});
