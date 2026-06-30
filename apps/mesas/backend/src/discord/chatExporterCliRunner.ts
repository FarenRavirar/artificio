import { spawn } from 'child_process';
import path from 'path';

export interface ChatExporterCliConfig {
  binary: string;
  token: string;
  channelId: string;
  outputDir: string;
  format?: 'Json';
  after?: string;
  cookies?: string;
  now?: () => Date;
  timeoutMs?: number;
}

export interface ChatExporterCliCommand {
  command: string;
  args: string[];
  outputPath: string;
}

function stamp(date: Date): string {
  return date.toISOString().replace(/[:.]/g, '-');
}

export function buildChatExporterCliCommand(config: ChatExporterCliConfig): ChatExporterCliCommand {
  const outputPath = path.join(config.outputDir, `discord-export-${config.channelId}-${stamp((config.now ?? (() => new Date()))())}.json`);
  const args = [
    'export',
    '-t',
    config.token,
    '-c',
    config.channelId,
    '-f',
    config.format ?? 'Json',
    '-o',
    outputPath,
  ];

  if (config.after) {
    args.push('--after', config.after);
  }
  if (config.cookies) {
    args.push('--cookies', config.cookies);
  }

  return { command: config.binary, args, outputPath };
}

export function redactedChatExporterCliCommand(command: ChatExporterCliCommand): string {
  return [command.command, ...command.args.map((arg, index, args) => {
    const previous = args[index - 1];
    return previous === '-t' || previous === '--cookies' ? '[redacted]' : arg;
  })].join(' ');
}

export async function runChatExporterCli(config: ChatExporterCliConfig): Promise<{ outputPath: string }> {
  const built = buildChatExporterCliCommand(config);
  const timeoutMs = config.timeoutMs ?? 10 * 60 * 1000;

  await new Promise<void>((resolve, reject) => {
    const child = spawn(built.command, built.args, {
      stdio: ['ignore', 'ignore', 'pipe'],
      windowsHide: true,
    });
    let stderr = '';
    let settled = false;
    const finish = (fn: () => void): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      finish(() => reject(new Error(`DiscordChatExporter excedeu timeout de ${timeoutMs}ms.`)));
    }, timeoutMs);
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf-8');
    });
    child.on('error', (error) => finish(() => reject(error)));
    child.on('close', (code) => {
      if (code === 0) {
        finish(resolve);
        return;
      }
      finish(() => reject(new Error(`DiscordChatExporter falhou com exit ${code}: ${stderr.slice(0, 500)}`)));
    });
  });

  return { outputPath: built.outputPath };
}
