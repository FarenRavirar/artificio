import 'dotenv/config';
import { mkdir } from 'fs/promises';
import path from 'path';
import { buildChatExporterCliCommand, redactedChatExporterCliCommand, runChatExporterCli } from '../discord/chatExporterCliRunner';

async function main() {
  const rootDir = process.env.DISCORD_CHAT_EXPORTER_IMPORT_DIR;
  const token = process.env.DISCORD_CHAT_EXPORTER_TOKEN;
  const channelId = process.env.DISCORD_CHAT_EXPORTER_CHANNEL_ID;
  const binary = process.env.DISCORD_CHAT_EXPORTER_BIN ?? 'DiscordChatExporter.Cli';
  const cookies = process.env.DISCORD_CHAT_EXPORTER_COOKIES;
  const after = process.env.DISCORD_CHAT_EXPORTER_AFTER;

  if (!rootDir || !token || !channelId) {
    console.error('[exportDiscordChatExporter] Configure DISCORD_CHAT_EXPORTER_IMPORT_DIR, DISCORD_CHAT_EXPORTER_TOKEN e DISCORD_CHAT_EXPORTER_CHANNEL_ID.');
    process.exit(1);
  }

  const incomingDir = path.join(rootDir, 'incoming');
  await mkdir(incomingDir, { recursive: true });

  const config = { binary, token, channelId, outputDir: incomingDir, cookies, after };
  const command = buildChatExporterCliCommand(config);
  console.log(`[exportDiscordChatExporter] Rodando: ${redactedChatExporterCliCommand(command)}`);

  const result = await runChatExporterCli(config);
  console.log(`[exportDiscordChatExporter] JSON gerado: ${result.outputPath}`);
}

main().catch((error) => {
  console.error('[exportDiscordChatExporter] Erro fatal:', error instanceof Error ? error.message : error);
  process.exit(1);
});
