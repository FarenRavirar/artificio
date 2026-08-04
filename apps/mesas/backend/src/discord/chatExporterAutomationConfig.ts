import { mkdir, realpath } from 'fs/promises';
import path from 'path';

export const DISCORD_CHAT_EXPORTER_LAYOUT = {
  incoming: 'incoming',
  processing: 'processing',
  processed: 'processed',
  error: 'error',
} as const;

export const DISCORD_CHAT_EXPORTER_RETENTION = {
  processedDays: 14,
  errorDays: 30,
} as const;

export const DISCORD_CHAT_EXPORTER_SYSTEMD = {
  serviceName: 'artificio-mesas-discord-import.service',
  timerName: 'artificio-mesas-discord-import.timer',
  schedule: '03:20:00 America/Sao_Paulo',
} as const;

// Fronteira legitima de import_dir (achado SonarCloud "path canonicalized from
// CLI-controlled data must be validated", PR #151, 2026-07-12; D13, sessão
// 26-08-03_1): perfis usam <base>/<profileId>, gerado pelo backend; a configuração
// global aceita importDir de admin. Ambos ficam contidos nesta mesma base antes
// de mkdir/CLI. Fonte única evita divergência entre geração e validação.
export function resolveChatExporterBaseDir(): string {
  return process.env.DISCORD_CHAT_EXPORTER_IMPORT_BASE_DIR?.trim()
    || process.env.DISCORD_CHAT_EXPORTER_IMPORT_DIR?.trim()
    || '/data/chat-exporter';
}

export class ChatExporterImportDirError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ChatExporterImportDirError';
  }
}

function isInsideBase(targetPath: string, baseDir: string): boolean {
  const relative = path.relative(baseDir, targetPath);
  return relative === '' || (
    relative !== '..'
    && !relative.startsWith(`..${path.sep}`)
    && !path.isAbsolute(relative)
  );
}

function assertInsideBase(targetPath: string, baseDir: string): void {
  if (!isInsideBase(targetPath, baseDir)) {
    throw new ChatExporterImportDirError('Diretório fora da base permitida para importação.');
  }
}

function isMissingPathError(error: unknown): boolean {
  return error instanceof Error
    && 'code' in error
    && (error.code === 'ENOENT' || error.code === 'ENOTDIR');
}

async function nearestExistingRealPath(targetPath: string): Promise<string> {
  let current = targetPath;
  while (true) {
    try {
      return await realpath(current);
    } catch (error: unknown) {
      if (!isMissingPathError(error)) throw error;
      const parent = path.dirname(current);
      if (parent === current) throw error;
      current = parent;
    }
  }
}

/**
 * Resolve um caminho sem criá-lo e prova que nenhum ancestral existente usa
 * symlink para escapar da base. Caminhos relativos são relativos à base, não
 * ao cwd do processo.
 */
export async function resolveDirectoryInsideBase(targetPath: string, baseDir: string): Promise<string> {
  const lexicalBase = path.resolve(baseDir);
  const lexicalTarget = path.isAbsolute(targetPath)
    ? path.resolve(targetPath)
    : path.resolve(lexicalBase, targetPath);
  assertInsideBase(lexicalTarget, lexicalBase);

  let realBase: string;
  try {
    realBase = await realpath(lexicalBase);
  } catch (error: unknown) {
    throw new ChatExporterImportDirError('Base do DiscordChatExporter não existe ou não está acessível.', { cause: error });
  }

  try {
    const realAncestor = await nearestExistingRealPath(lexicalTarget);
    assertInsideBase(realAncestor, realBase);
    return lexicalTarget;
  } catch (error: unknown) {
    if (error instanceof ChatExporterImportDirError) throw error;
    throw new ChatExporterImportDirError('Diretório de importação não está acessível.', { cause: error });
  }
}

/** Valida antes do mkdir e revalida o caminho real depois da criação. */
export async function ensureDirectoryInsideBase(targetPath: string, baseDir: string): Promise<string> {
  const safeTarget = await resolveDirectoryInsideBase(targetPath, baseDir);
  await mkdir(safeTarget, { recursive: true });

  const realBase = await realpath(path.resolve(baseDir));
  const realTarget = await realpath(safeTarget);
  assertInsideBase(realTarget, realBase);
  return realTarget;
}
