import { mkdtemp, readdir, readFile, rm, utimes, writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanupDiscordChatExporterFolder, processDiscordChatExporterFolder } from '../chatExporterFolderImportService.js';
import type { ImportResult } from '../chatExporterAdapter.js';

const tempDirs: string[] = [];

async function makeRoot(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'artificio-052-'));
  tempDirs.push(dir);
  return dir;
}

async function list(dir: string): Promise<string[]> {
  return (await readdir(dir)).sort((a, b) => a.localeCompare(b));
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('processDiscordChatExporterFolder', () => {
  it('processa lote misto e isola arquivo ruim sem travar arquivo válido', async () => {
    const rootDir = await makeRoot();
    const incoming = path.join(rootDir, 'incoming');
    await processDiscordChatExporterFolder({
      rootDir,
      importJson: async () => ({ total: 0, inserted: 0, updated: 0, ignored: 0, failed: 0 }),
      now: () => new Date('2026-06-29T12:00:00.000Z'),
    });

    await writeFile(path.join(incoming, 'ok.json'), JSON.stringify({ messages: [] }), 'utf-8');
    await writeFile(path.join(incoming, 'quebrado.json'), '{"messages":[', 'utf-8');

    const importJson = vi.fn(async (_payload: unknown): Promise<ImportResult> => (
      { total: 1, inserted: 1, updated: 0, ignored: 0, failed: 0 }
    ));

    const result = await processDiscordChatExporterFolder({
      rootDir,
      importJson,
      now: () => new Date('2026-06-29T12:30:00.000Z'),
    });

    expect(result.processed).toBe(1);
    expect(result.errors).toBe(1);
    expect(importJson).toHaveBeenCalledTimes(1);
    expect(await list(incoming)).toEqual([]);
    expect(await list(path.join(rootDir, 'processing'))).toEqual([]);
    expect((await list(path.join(rootDir, 'processed'))).some((name) => name.endsWith('ok.json'))).toBe(true);
    expect((await list(path.join(rootDir, 'error'))).some((name) => name.endsWith('quebrado.json'))).toBe(true);
  });

  it('não reprocessa arquivo já movido para processed', async () => {
    const rootDir = await makeRoot();
    await processDiscordChatExporterFolder({
      rootDir,
      importJson: async () => ({ total: 0, inserted: 0, updated: 0, ignored: 0, failed: 0 }),
      now: () => new Date('2026-06-29T12:00:00.000Z'),
    });

    await writeFile(path.join(rootDir, 'incoming', 'uma-vez.json'), JSON.stringify({ messages: [] }), 'utf-8');

    const importJson = vi.fn(async (_payload: unknown): Promise<ImportResult> => (
      { total: 1, inserted: 1, updated: 0, ignored: 0, failed: 0 }
    ));

    await processDiscordChatExporterFolder({
      rootDir,
      importJson,
      now: () => new Date('2026-06-29T12:30:00.000Z'),
    });
    const second = await processDiscordChatExporterFolder({
      rootDir,
      importJson,
      now: () => new Date('2026-06-29T12:31:00.000Z'),
    });

    expect(importJson).toHaveBeenCalledTimes(1);
    expect(second.incoming).toBe(0);
    expect(second.processed).toBe(0);
    expect(second.errors).toBe(0);
  });

  it('recupera arquivo deixado em processing por execução interrompida', async () => {
    const rootDir = await makeRoot();
    await processDiscordChatExporterFolder({
      rootDir,
      importJson: async () => ({ total: 0, inserted: 0, updated: 0, ignored: 0, failed: 0 }),
      now: () => new Date('2026-06-29T12:00:00.000Z'),
    });

    await writeFile(path.join(rootDir, 'processing', 'interrompido.json'), JSON.stringify({ messages: [] }), 'utf-8');
    const importJson = vi.fn(async (_payload: unknown): Promise<ImportResult> => (
      { total: 1, inserted: 1, updated: 0, ignored: 0, failed: 0 }
    ));

    const result = await processDiscordChatExporterFolder({
      rootDir,
      importJson,
      now: () => new Date('2026-06-29T12:30:00.000Z'),
    });

    expect(importJson).toHaveBeenCalledTimes(1);
    expect(result.incoming).toBe(0);
    expect(result.processed).toBe(1);
    expect(await list(path.join(rootDir, 'processing'))).toEqual([]);
    expect((await list(path.join(rootDir, 'processed'))).some((name) => name.endsWith('interrompido.json'))).toBe(true);
  });

  it('grava metadado sem conteúdo bruto do JSON', async () => {
    const rootDir = await makeRoot();
    await processDiscordChatExporterFolder({
      rootDir,
      importJson: async () => ({ total: 0, inserted: 0, updated: 0, ignored: 0, failed: 0 }),
      now: () => new Date('2026-06-29T12:00:00.000Z'),
    });
    await writeFile(path.join(rootDir, 'incoming', 'ok.json'), JSON.stringify({ secretish: 'nao-logar', messages: [] }), 'utf-8');

    await processDiscordChatExporterFolder({
      rootDir,
      importJson: async () => ({ total: 1, inserted: 1, updated: 0, ignored: 0, failed: 0 }),
      now: () => new Date('2026-06-29T12:30:00.000Z'),
    });

    const metaFile = (await list(path.join(rootDir, 'processed'))).find((name) => name.endsWith('.meta.json'));
    expect(metaFile).toBeTruthy();
    const meta = await readFile(path.join(rootDir, 'processed', metaFile!), 'utf-8');
    expect(meta).toContain('"fileHash"');
    expect(meta).not.toContain('nao-logar');
  });

  it('remove arquivos antigos conforme retenção configurada', async () => {
    const rootDir = await makeRoot();
    await processDiscordChatExporterFolder({
      rootDir,
      importJson: async () => ({ total: 0, inserted: 0, updated: 0, ignored: 0, failed: 0 }),
      now: () => new Date('2026-06-29T12:00:00.000Z'),
    });

    const oldProcessed = path.join(rootDir, 'processed', 'old.json');
    const keepProcessed = path.join(rootDir, 'processed', 'keep.json');
    const oldError = path.join(rootDir, 'error', 'old-error.json');
    await writeFile(oldProcessed, '{}', 'utf-8');
    await writeFile(keepProcessed, '{}', 'utf-8');
    await writeFile(oldError, '{}', 'utf-8');

    const oldDate = new Date('2026-06-01T12:00:00.000Z');
    const keepDate = new Date('2026-06-28T12:00:00.000Z');
    await utimes(oldProcessed, oldDate, oldDate);
    await utimes(oldError, oldDate, oldDate);
    await utimes(keepProcessed, keepDate, keepDate);

    const deleted = await cleanupDiscordChatExporterFolder({
      rootDir,
      retention: { processedDays: 14, errorDays: 30 },
      now: () => new Date('2026-06-30T12:00:00.000Z'),
    });

    expect(deleted).toBe(1);
    expect(await list(path.join(rootDir, 'processed'))).toEqual(['keep.json']);
    expect(await list(path.join(rootDir, 'error'))).toEqual(['old-error.json']);
  });

  it('recusa rootDir fora da base permitida', async () => {
    const allowedBaseDir = await makeRoot();
    const outsideRoot = await makeRoot();

    await expect(processDiscordChatExporterFolder({
      rootDir: outsideRoot,
      allowedBaseDir,
      importJson: async () => ({ total: 0, inserted: 0, updated: 0, ignored: 0, failed: 0 }),
    })).rejects.toThrow('Diretório fora da base permitida');
  });
});
