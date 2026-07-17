import { describe, expect, it } from 'vitest';
import { buildChatExporterCliCommand, redactedChatExporterCliCommand } from '../chatExporterCliRunner.js';

describe('chatExporterCliRunner', () => {
  it('monta comando pinado por env e redige token no log', () => {
    const command = buildChatExporterCliCommand({
      binary: '/opt/tools/DiscordChatExporter.Cli',
      token: 'token-secreto',
      channelId: '123',
      outputDir: '/tmp/incoming',
      after: '2026-06-29',
      media: true,
      now: () => new Date('2026-06-30T03:20:00.000Z'),
    });

    expect(command.command).toBe('/opt/tools/DiscordChatExporter.Cli');
    expect(command.args).toContain('token-secreto');
    expect(command.args).toContain('--after');
    expect(command.args).toContain('2026-06-29');
    expect(command.args).toContain('--media');
    expect(command.args).not.toContain('--cookies');
    expect(command.outputPath).toContain('discord-export-123-2026-06-30T03-20-00-000Z.json');

    const logged = redactedChatExporterCliCommand(command);
    expect(logged).toContain('[redacted]');
    expect(logged).not.toContain('token-secreto');
  });
});
