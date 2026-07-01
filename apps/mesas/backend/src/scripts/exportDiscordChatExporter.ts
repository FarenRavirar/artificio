import 'dotenv/config';
import { mkdir } from 'fs/promises';
import path from 'path';
import { z } from 'zod';
import { db } from '../db';
import { buildChatExporterCliCommand, redactedChatExporterCliCommand, runChatExporterCli } from '../discord/chatExporterCliRunner';
import { decryptDiscordSetting } from '../discord/settingsCrypto';

const configSchema = z.object({
  enabled: z.boolean().default(false),
  importDir: z.string().trim().min(1),
  channelId: z.string().trim().min(1),
  after: z.string().trim().optional(),
}).partial();

async function setting(key: string): Promise<string | null> {
  const row = await db.selectFrom('discord_settings')
    .select('value')
    .where('guild_id', 'is', null)
    .where('key', '=', key)
    .executeTakeFirst();
  return row?.value ?? null;
}

async function loadDbConfig() {
  const rawConfig = await setting('chat_exporter_config');
  if (!rawConfig) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(rawConfig);
  } catch {
    console.warn('[exportDiscordChatExporter] chat_exporter_config com JSON inválido; ignorando.');
    return null;
  }
  const parsed = configSchema.safeParse(raw);
  if (!parsed.success) return null;
  const token = await setting('chat_exporter_token');
  return {
    ...parsed.data,
    token: token ? decryptDiscordSetting(token) : null,
  };
}

async function main() {
  const dbConfig = await loadDbConfig();
  if (dbConfig && dbConfig.enabled === false) {
    console.log('[exportDiscordChatExporter] Desativado por configuração do admin.');
    return;
  }

  const rootDir = dbConfig?.importDir ?? process.env.DISCORD_CHAT_EXPORTER_IMPORT_DIR;
  const token = dbConfig?.token ?? process.env.DISCORD_CHAT_EXPORTER_TOKEN;
  const channelId = dbConfig?.channelId ?? process.env.DISCORD_CHAT_EXPORTER_CHANNEL_ID;
  const binary = process.env.DISCORD_CHAT_EXPORTER_BIN ?? 'DiscordChatExporter.Cli';
  const after = dbConfig?.after ?? process.env.DISCORD_CHAT_EXPORTER_AFTER;

  if (!rootDir || !token || !channelId) {
    console.error('[exportDiscordChatExporter] Configure DISCORD_CHAT_EXPORTER_IMPORT_DIR, DISCORD_CHAT_EXPORTER_TOKEN e DISCORD_CHAT_EXPORTER_CHANNEL_ID.');
    process.exit(1);
  }

  const incomingDir = path.join(rootDir, 'incoming');
  await mkdir(incomingDir, { recursive: true });

  const config = { binary, token, channelId, outputDir: incomingDir, after };
  const command = buildChatExporterCliCommand(config);
  console.log(`[exportDiscordChatExporter] Rodando: ${redactedChatExporterCliCommand(command)}`);

  const result = await runChatExporterCli(config);
  console.log(`[exportDiscordChatExporter] JSON gerado: ${result.outputPath}`);
}

main().catch((error) => {
  console.error('[exportDiscordChatExporter] Erro fatal:', error instanceof Error ? error.message : error);
  process.exit(1);
});
