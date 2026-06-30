import { describe, expect, it } from 'vitest';
import { buildChatExporterCliCommand, redactedChatExporterCliCommand } from '../chatExporterCliRunner';

describe('chatExporterCliRunner', () => {
  it('monta comando pinado por env e redige token/cookies no log', () => {
    const command = buildChatExporterCliCommand({
      binary: '/opt/tools/DiscordChatExporter.Cli',
      token: 'token-secreto',
      channelId: '123',
      outputDir: '/tmp/incoming',
      cookies: 'cookie-secreto',
      after: '2026-06-29',
      now: () => new Date('2026-06-30T03:20:00.000Z'),
    });

    expect(command.command).toBe('/opt/tools/DiscordChatExporter.Cli');
    expect(command.args).toContain('token-secreto');
    expect(command.args).toContain('cookie-secreto');
    expect(command.outputPath).toContain('discord-export-123-2026-06-30T03-20-00-000Z.json');

    const logged = redactedChatExporterCliCommand(command);
    expect(logged).toContain('[redacted]');
    expect(logged).not.toContain('token-secreto');
    expect(logged).not.toContain('cookie-secreto');
  });
});
