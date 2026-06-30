import { createHash } from 'crypto';
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'fs/promises';
import path from 'path';
import { importDiscordChatExporterJson } from './chatExporterImportService';
import type { ImportResult } from './chatExporterAdapter';

export type FolderImportStatus = 'processed' | 'error';

export interface FolderImportFileResult {
  fileName: string;
  status: FolderImportStatus;
  fileHash: string;
  result?: ImportResult;
  error?: string;
}

export interface FolderImportRunResult {
  rootDir: string;
  incoming: number;
  processed: number;
  errors: number;
  retainedDeleted: number;
  files: FolderImportFileResult[];
}

interface FolderImportOptions {
  rootDir: string;
  importJson?: (payload: unknown) => Promise<ImportResult>;
  now?: () => Date;
  retention?: {
    processedDays?: number;
    errorDays?: number;
  };
}

const FOLDERS = ['incoming', 'processing', 'processed', 'error'] as const;

function safeStamp(date: Date): string {
  return date.toISOString().replace(/[:.]/g, '-');
}

function jsonFiles(names: string[]): string[] {
  return names
    .filter((name) => name.toLowerCase().endsWith('.json'))
    .filter((name) => !name.includes('/') && !name.includes('\\'))
    .sort((a, b) => a.localeCompare(b));
}

function hashBuffer(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Erro desconhecido';
}

async function ensureFolders(rootDir: string): Promise<void> {
  await Promise.all(FOLDERS.map((folder) => mkdir(path.join(rootDir, folder), { recursive: true })));
}

async function moveWithMeta(params: {
  from: string;
  toDir: string;
  originalName: string;
  stamp: string;
  meta: FolderImportFileResult;
}): Promise<void> {
  const destinationName = `${params.stamp}-${params.originalName}`;
  const destination = path.join(params.toDir, destinationName);
  await rename(params.from, destination);
  await writeFile(`${destination}.meta.json`, `${JSON.stringify(params.meta, null, 2)}\n`, 'utf-8');
}

async function cleanupOldFiles(dir: string, ttlDays: number | undefined, now: Date): Promise<number> {
  if (ttlDays === undefined || ttlDays < 0) return 0;
  const cutoff = now.getTime() - ttlDays * 24 * 60 * 60 * 1000;
  let deleted = 0;

  for (const name of await readdir(dir)) {
    if (name.includes('/') || name.includes('\\')) continue;
    const target = path.join(dir, name);
    const info = await stat(target);
    if (!info.isFile() || info.mtime.getTime() > cutoff) continue;
    await rm(target, { force: true });
    deleted++;
  }

  return deleted;
}

export async function cleanupDiscordChatExporterFolder(options: Pick<FolderImportOptions, 'rootDir' | 'retention' | 'now'>): Promise<number> {
  const rootDir = path.resolve(options.rootDir);
  const now = (options.now ?? (() => new Date()))();
  await ensureFolders(rootDir);
  return (
    await cleanupOldFiles(path.join(rootDir, 'processed'), options.retention?.processedDays, now)
  ) + (
    await cleanupOldFiles(path.join(rootDir, 'error'), options.retention?.errorDays, now)
  );
}

export async function processDiscordChatExporterFolder(options: FolderImportOptions): Promise<FolderImportRunResult> {
  const rootDir = path.resolve(options.rootDir);
  const importJson = options.importJson ?? importDiscordChatExporterJson;
  const now = options.now ?? (() => new Date());

  await ensureFolders(rootDir);

  const incomingDir = path.join(rootDir, 'incoming');
  const processingDir = path.join(rootDir, 'processing');
  const processedDir = path.join(rootDir, 'processed');
  const errorDir = path.join(rootDir, 'error');
  const processingFiles = jsonFiles(await readdir(processingDir));
  const incomingFiles = jsonFiles(await readdir(incomingDir));
  const files = [
    ...processingFiles.map((fileName) => ({ fileName, from: path.join(processingDir, fileName), originalName: fileName })),
    ...incomingFiles.map((fileName) => ({ fileName, from: path.join(incomingDir, fileName), originalName: fileName })),
  ];
  const results: FolderImportFileResult[] = [];

  for (const file of files) {
    const stamp = safeStamp(now());
    const processingPath = file.from.startsWith(processingDir)
      ? file.from
      : path.join(processingDir, `${stamp}-${file.fileName}`);

    if (!file.from.startsWith(processingDir)) {
      await rename(file.from, processingPath);
    }

    const buffer = await readFile(processingPath);
    const fileHash = hashBuffer(buffer);

    try {
      const payload = JSON.parse(buffer.toString('utf-8')) as unknown;
      const result = await importJson(payload);
      const meta: FolderImportFileResult = { fileName: file.originalName, status: 'processed', fileHash, result };
      await moveWithMeta({ from: processingPath, toDir: processedDir, originalName: file.originalName, stamp, meta });
      results.push(meta);
    } catch (error) {
      const meta: FolderImportFileResult = { fileName: file.originalName, status: 'error', fileHash, error: errorMessage(error) };
      await moveWithMeta({ from: processingPath, toDir: errorDir, originalName: file.originalName, stamp, meta });
      results.push(meta);
    }
  }

  return {
    rootDir,
    incoming: incomingFiles.length,
    processed: results.filter((file) => file.status === 'processed').length,
    errors: results.filter((file) => file.status === 'error').length,
    retainedDeleted: await cleanupDiscordChatExporterFolder({ rootDir, retention: options.retention, now }),
    files: results,
  };
}
