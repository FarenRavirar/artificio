import { mkdtemp, rm } from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DiscordChatExporterProfile } from '../../db/types.js';

vi.mock('../../db', () => ({
  db: {
    insertInto: vi.fn(),
    updateTable: vi.fn(),
  },
}));

vi.mock('../chatExporterCliRunner', () => ({ runChatExporterCli: vi.fn() }));
vi.mock('../chatExporterFolderImportService', () => ({ processDiscordChatExporterFolder: vi.fn() }));

import { runChatExporterCli } from '../chatExporterCliRunner.js';
import { runProfileExport } from '../chatExporterProfileRunner.js';

const tempDirs: string[] = [];
const originalBaseDir = process.env.DISCORD_CHAT_EXPORTER_IMPORT_BASE_DIR;

beforeEach(async () => {
  vi.clearAllMocks();
  const baseDir = await mkdtemp(path.join(os.tmpdir(), 'artificio-d13-profile-base-'));
  tempDirs.push(baseDir);
  process.env.DISCORD_CHAT_EXPORTER_IMPORT_BASE_DIR = baseDir;
});

afterEach(async () => {
  if (originalBaseDir === undefined) delete process.env.DISCORD_CHAT_EXPORTER_IMPORT_BASE_DIR;
  else process.env.DISCORD_CHAT_EXPORTER_IMPORT_BASE_DIR = originalBaseDir;
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('runProfileExport — contenção antes da CLI', () => {
  it('rejeita import_dir legado externo antes de mkdir/CLI, cobrindo execução manual e cron', async () => {
    const outsideDir = await mkdtemp(path.join(os.tmpdir(), 'artificio-d13-profile-outside-'));
    tempDirs.push(outsideDir);
    const profile = {
      import_dir: outsideDir,
      channel_id: '123456789',
      after: null,
      media: false,
    } as DiscordChatExporterProfile;

    await expect(runProfileExport(profile, 'token', undefined))
      .rejects.toThrow('Diretório fora da base permitida');
    expect(runChatExporterCli).not.toHaveBeenCalled();
  });
});
