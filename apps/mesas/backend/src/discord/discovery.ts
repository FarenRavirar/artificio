import { z } from 'zod';
import { requireDiscordBotToken } from './config';
import type { DiscordSourceChannelType } from './types';

const DISCORD_API_BASE = 'https://discord.com/api/v10';
const DISCOVERABLE_CHANNEL_TYPES = new Set([0, 5, 15]);
const CHANNEL_KIND_BY_TYPE = new Map<number, DiscordSourceChannelType>([
  [0, 'text'],
  [5, 'announcement'],
  [15, 'forum'],
]);

const discordGuildSchema = z.object({
  id: z.string(),
  name: z.string(),
  icon: z.string().nullable().optional(),
  approximate_member_count: z.number().nullable().optional(),
});

const discordChannelSchema = z.object({
  id: z.string(),
  guild_id: z.string().optional(),
  name: z.string().nullable().optional(),
  type: z.number(),
  position: z.number().optional(),
  parent_id: z.string().nullable().optional(),
});

const discordGuildsSchema = z.array(discordGuildSchema);
const discordChannelsSchema = z.array(discordChannelSchema);

export interface DiscordDiscoveredGuild {
  id: string;
  name: string;
  icon: string | null;
  approximate_member_count: number | null;
}

export interface DiscordDiscoveredChannel {
  id: string;
  guild_id: string;
  name: string;
  type: number;
  kind: DiscordSourceChannelType;
  position: number | null;
  parent_id: string | null;
  parent_name: string | null;
}

export class DiscordDiscoveryError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = 'DiscordDiscoveryError';
  }
}

function mapDiscordStatus(status: number): DiscordDiscoveryError {
  if (status === 401) {
    return new DiscordDiscoveryError('Token do bot inválido ou revogado. Gere um novo token no Discord e salve novamente.', 502);
  }
  if (status === 403) {
    return new DiscordDiscoveryError('O bot não tem permissão para acessar esse servidor ou canal no Discord.', 403);
  }
  if (status === 404) {
    return new DiscordDiscoveryError('Servidor ou canal não encontrado para o bot configurado.', 404);
  }
  if (status === 429) {
    return new DiscordDiscoveryError('Discord limitou temporariamente as requisições. Aguarde um momento e tente novamente.', 502);
  }
  return new DiscordDiscoveryError('Discord não respondeu como esperado. Tente novamente em instantes.', 502);
}

async function discordGetUnknown(path: string): Promise<unknown> {
  const token = await requireDiscordBotToken();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch(`${DISCORD_API_BASE}${path}`, {
      headers: { Authorization: `Bot ${token.trim()}` },
      signal: controller.signal,
    });

    if (!res.ok) {
      throw mapDiscordStatus(res.status);
    }

    return res.json() as Promise<unknown>;
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new DiscordDiscoveryError('Discord demorou demais para responder. Tente novamente em instantes.', 502);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function discoverDiscordGuilds(): Promise<DiscordDiscoveredGuild[]> {
  const payload = await discordGetUnknown('/users/@me/guilds?with_counts=true');
  const parsed = discordGuildsSchema.safeParse(payload);
  if (!parsed.success) {
    throw new DiscordDiscoveryError('Discord retornou uma lista de servidores em formato inesperado.', 502);
  }

  return parsed.data
    .map((guild) => ({
      id: guild.id,
      name: guild.name,
      icon: guild.icon ?? null,
      approximate_member_count: guild.approximate_member_count ?? null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

const discordDeltaMessageSchema = z.object({ id: z.string() });
const discordDeltaMessagesSchema = z.array(discordDeltaMessageSchema);

/** Limite de página do Discord (`/channels/:id/messages?limit=`). 100 = teto da API. */
export const DISCORD_DELTA_PAGE_LIMIT = 100;

export interface DiscordChannelDelta {
  /** Mensagens novas no canal desde `afterMessageId` (limitado a uma página). */
  newCount: number;
  /** `true` quando a página encheu — há pelo menos `newCount` novas (pode ser mais). */
  capped: boolean;
  /** Snowflake da mensagem mais recente já importada, ou null se nunca importou. */
  afterMessageId: string | null;
}

/**
 * Dry-read: conta mensagens novas no canal desde a última importada, sem baixar nada.
 * Uma página só (teto 100) — barato e suficiente para o indicador "a atualizar".
 * Sem `afterMessageId` (canal nunca importado) o Discord não aceita `after`; nesse caso
 * retornamos apenas se há QUALQUER mensagem (1 = tem conteúdo a importar).
 */
export async function discoverChannelDelta(
  channelId: string,
  afterMessageId: string | null,
): Promise<DiscordChannelDelta> {
  const query = new URLSearchParams({ limit: String(DISCORD_DELTA_PAGE_LIMIT) });
  if (afterMessageId) query.set('after', afterMessageId);
  const payload = await discordGetUnknown(`/channels/${encodeURIComponent(channelId)}/messages?${query}`);
  const parsed = discordDeltaMessagesSchema.safeParse(payload);
  if (!parsed.success) {
    throw new DiscordDiscoveryError('Discord retornou mensagens em formato inesperado.', 502);
  }
  const newCount = parsed.data.length;
  return {
    newCount,
    capped: newCount >= DISCORD_DELTA_PAGE_LIMIT,
    afterMessageId,
  };
}

export async function discoverDiscordChannels(guildId: string): Promise<DiscordDiscoveredChannel[]> {
  const payload = await discordGetUnknown(`/guilds/${encodeURIComponent(guildId)}/channels`);
  const parsed = discordChannelsSchema.safeParse(payload);
  if (!parsed.success) {
    throw new DiscordDiscoveryError('Discord retornou uma lista de canais em formato inesperado.', 502);
  }

  const categoryNames = new Map(
    parsed.data
      .filter((channel) => channel.type === 4 && channel.name)
      .map((channel) => [channel.id, channel.name as string]),
  );

  return parsed.data
    .filter((channel) => DISCOVERABLE_CHANNEL_TYPES.has(channel.type) && channel.name)
    .map((channel) => ({
      id: channel.id,
      guild_id: channel.guild_id ?? guildId,
      name: channel.name as string,
      type: channel.type,
      kind: CHANNEL_KIND_BY_TYPE.get(channel.type) ?? 'text',
      position: channel.position ?? null,
      parent_id: channel.parent_id ?? null,
      parent_name: channel.parent_id ? categoryNames.get(channel.parent_id) ?? null : null,
    }))
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.name.localeCompare(b.name, 'pt-BR'));
}
