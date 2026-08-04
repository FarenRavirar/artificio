import { access, mkdtemp, rm } from 'fs/promises';
import os from 'os';
import path from 'path';
import express, { type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../db', () => ({
  db: {
    selectFrom: vi.fn(),
    insertInto: vi.fn(),
    updateTable: vi.fn(),
    deleteFrom: vi.fn(),
  },
}));

vi.mock('../../middleware/auth', () => ({
  requireAdmin: (_req: Request, _res: Response, next: NextFunction) => next(),
}));

vi.mock('../../discord/settingsCrypto', () => ({
  encryptDiscordSetting: vi.fn((value: string) => value),
  decryptDiscordSetting: vi.fn(() => 'token-global-valido'),
  DiscordSettingsSecretUnavailableError: class extends Error {},
  DiscordSettingsDecryptError: class extends Error {},
}));

vi.mock('../../discord/config', () => ({ getDiscordBotToken: vi.fn() }));
vi.mock('../../discord/discovery', () => ({
  discoverChannelDelta: vi.fn(),
  validateDiscordToken: vi.fn(),
  DiscordDiscoveryError: class extends Error {},
}));

vi.mock('../../discord/chatExporterCliRunner', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../discord/chatExporterCliRunner.js')>();
  return { ...actual, runChatExporterCli: vi.fn() };
});

vi.mock('../../discord/chatExporterProfileRunner', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../discord/chatExporterProfileRunner.js')>();
  return { ...actual, runFolderImport: vi.fn() };
});

import { db } from '../../db/index.js';
import { runChatExporterCli } from '../../discord/chatExporterCliRunner.js';
import { runFolderImport } from '../../discord/chatExporterProfileRunner.js';
import router from './chatExporterAutomation.js';

const tempDirs: string[] = [];
const originalBaseDir = process.env.DISCORD_CHAT_EXPORTER_IMPORT_BASE_DIR;

function selectChain(row: unknown) {
  return {
    select: vi.fn().mockReturnThis(),
    selectAll: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    executeTakeFirst: vi.fn().mockResolvedValue(row),
  };
}

function mockStoredConfig(importDir: string) {
  vi.mocked(db.selectFrom)
    .mockReturnValueOnce(selectChain({
      value: JSON.stringify({
        enabled: true,
        authType: 'user',
        frequency: 'daily',
        time: '03:20',
        timezone: 'America/Sao_Paulo',
        importDir,
        channelId: '123456789',
      }),
      updated_at: new Date(),
    }) as never)
    .mockReturnValueOnce(selectChain({ value: 'token-cifrado', updated_at: new Date() }) as never);
}

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/admin/discord/chat-exporter', router);
  return app;
}

beforeEach(async () => {
  vi.clearAllMocks();
  const baseDir = await mkdtemp(path.join(os.tmpdir(), 'artificio-d13-route-'));
  tempDirs.push(baseDir);
  process.env.DISCORD_CHAT_EXPORTER_IMPORT_BASE_DIR = baseDir;
});

afterEach(async () => {
  if (originalBaseDir === undefined) delete process.env.DISCORD_CHAT_EXPORTER_IMPORT_BASE_DIR;
  else process.env.DISCORD_CHAT_EXPORTER_IMPORT_BASE_DIR = originalBaseDir;
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('D13 — rotas globais do DiscordChatExporter', () => {
  it('PUT /config rejeita importDir fora da base antes de persistir', async () => {
    mockStoredConfig('global');

    const response = await request(makeApp())
      .put('/api/v1/admin/discord/chat-exporter/config')
      .send({ importDir: '../fora' });

    expect(response.status).toBe(422);
    expect(response.body.error).toContain('fora da base permitida');
    expect(db.insertInto).not.toHaveBeenCalled();
    expect(db.updateTable).not.toHaveBeenCalled();
  });

  it('POST /test rejeita travessia relativa, retorna erro claro e não monta comando', async () => {
    mockStoredConfig('../fora');

    const response = await request(makeApp()).post('/api/v1/admin/discord/chat-exporter/test');

    expect(response.status).toBe(200);
    expect(response.body.data.ok).toBe(false);
    expect(response.body.data.command).toBeNull();
    expect(response.body.data.errors).toContain('Diretório fora da base permitida para importação.');
    expect(runChatExporterCli).not.toHaveBeenCalled();
  });

  it('POST /run rejeita caminho absoluto externo antes da CLI', async () => {
    const outsideDir = await mkdtemp(path.join(os.tmpdir(), 'artificio-d13-outside-'));
    tempDirs.push(outsideDir);
    mockStoredConfig(outsideDir);

    const response = await request(makeApp()).post('/api/v1/admin/discord/chat-exporter/run');

    expect(response.status).toBe(422);
    expect(response.body.error).toContain('fora da base permitida');
    expect(runChatExporterCli).not.toHaveBeenCalled();
    await expect(access(path.join(outsideDir, 'incoming'))).rejects.toThrow();
  });

  it('POST /test preserva caminho relativo legítimo dentro da base', async () => {
    mockStoredConfig('global');

    const response = await request(makeApp()).post('/api/v1/admin/discord/chat-exporter/test');

    expect(response.status).toBe(200);
    expect(response.body.data.ok).toBe(true);
    expect(response.body.data.errors).toEqual([]);
    expect(response.body.data.command).toContain(path.join('global', 'incoming'));
  });

  it('POST /run preserva exportação legítima dentro da base', async () => {
    mockStoredConfig('global');
    vi.mocked(runChatExporterCli).mockResolvedValue({ outputPath: 'export.json' });
    vi.mocked(runFolderImport).mockResolvedValue({
      rootDir: 'global',
      incoming: 0,
      processed: 0,
      errors: 0,
      retainedDeleted: 0,
      files: [],
    });

    const response = await request(makeApp()).post('/api/v1/admin/discord/chat-exporter/run');

    expect(response.status).toBe(200);
    expect(runChatExporterCli).toHaveBeenCalledWith(expect.objectContaining({
      outputDir: expect.stringContaining(path.join('global', 'incoming')),
    }));
    expect(runFolderImport).toHaveBeenCalledWith(expect.stringContaining('global'), undefined);
  });
});
