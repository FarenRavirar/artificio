import 'dotenv/config';
import { db } from '../db/index.js';
import { ingestMessages } from '../discord/index.js';
import { discordConfig } from '../discord/index.js';

async function main() {
  const botToken = discordConfig.botToken;
  if (!botToken) {
    console.error('[syncDiscordChannels] DISCORD_BOT_TOKEN não configurado. Abortando.');
    process.exit(1);
  }

  const sources = await db
    .selectFrom('discord_import_sources')
    .selectAll()
    .where('enabled', '=', true)
    .execute();

  if (sources.length === 0) {
    console.log('[syncDiscordChannels] Nenhuma fonte habilitada encontrada.');
    return;
  }

  console.log(`[syncDiscordChannels] Processando ${sources.length} fonte(s)...`);

  for (const source of sources) {
    console.log(`[syncDiscordChannels] Canal: ${source.channel_name ?? source.channel_id}`);
    try {
      const result = await ingestMessages({
        sourceId: source.id,
        channelId: source.channel_id,
        guildId: source.guild_id,
        botToken,
        // after= busca mensagens mais recentes que o ultimo cursor salvo
        afterMessageId: source.last_message_id ?? undefined,
      });

      await db
        .updateTable('discord_import_sources')
        .set({
          last_synced_at: new Date(),
          updated_at: new Date(),
          // Avanca o cursor para o ID mais recente desta execucao
          ...(result.newestMessageId ? { last_message_id: result.newestMessageId } : {}),
        })
        .where('id', '=', source.id)
        .execute();

      console.log(
        `[syncDiscordChannels] ${source.channel_id}: +${result.inserted} inseridas, ${result.updated} atualizadas, cursor=${result.newestMessageId ?? 'sem novas'}`
      );
    } catch (err: unknown) {
      console.error(
        `[syncDiscordChannels] Erro no canal ${source.channel_id}:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  console.log('[syncDiscordChannels] Concluído.');
  process.exit(0);
}

main().catch((err) => {
  console.error('[syncDiscordChannels] Erro fatal:', err);
  process.exit(1);
});
