import { mkdtemp, mkdir, realpath, rm, symlink } from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  ensureDirectoryInsideBase,
  resolveDirectoryInsideBase,
} from '../chatExporterAutomationConfig.js';

const tempDirs: string[] = [];

async function makeDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'artificio-d13-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('contenção canônica do DiscordChatExporter', () => {
  it('aceita caminho relativo legítimo dentro da base e cria somente depois de validar', async () => {
    const baseDir = await makeDir();
    const result = await ensureDirectoryInsideBase(path.join('perfil-1', 'incoming'), baseDir);

    expect(result).toBe(path.join(await realpath(baseDir), 'perfil-1', 'incoming'));
  });

  it('rejeita travessia relativa com ..', async () => {
    const baseDir = await makeDir();

    await expect(resolveDirectoryInsideBase('../fora', baseDir))
      .rejects.toThrow('Diretório fora da base permitida');
  });

  it('rejeita caminho absoluto fora da base', async () => {
    const baseDir = await makeDir();
    const outsideDir = await makeDir();

    await expect(resolveDirectoryInsideBase(outsideDir, baseDir))
      .rejects.toThrow('Diretório fora da base permitida');
  });

  it('rejeita importDir symlink dentro da base apontando para fora', async () => {
    const baseDir = await makeDir();
    const outsideDir = await makeDir();
    const linkedDir = path.join(baseDir, 'perfil-link');
    await symlink(outsideDir, linkedDir, 'junction');

    await expect(resolveDirectoryInsideBase(linkedDir, baseDir))
      .rejects.toThrow('Diretório fora da base permitida');
  });

  it('rejeita incoming existente como symlink para fora', async () => {
    const baseDir = await makeDir();
    const outsideDir = await makeDir();
    const profileDir = path.join(baseDir, 'perfil-1');
    await mkdir(profileDir);
    await symlink(outsideDir, path.join(profileDir, 'incoming'), 'junction');

    await expect(ensureDirectoryInsideBase(path.join(profileDir, 'incoming'), baseDir))
      .rejects.toThrow('Diretório fora da base permitida');
  });
});
