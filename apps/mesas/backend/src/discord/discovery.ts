import { z } from 'zod';
import { requireDiscordBotToken } from './config.js';
import { DiscordSettingsDecryptError, DiscordSettingsSecretUnavailableError } from './settingsCrypto.js';
import type { DiscordSourceChannelType } from './types.js';

const DISCORD_API_BASE = 'https://discord.com/api/v10';
const DISCORD_BOT_HEADERS: Record<string, string> = {
  'User-Agent': process.env.DISCORD_BOT_USER_AGENT?.trim() || 'ArtificioMesasBot/1.0 (+https://artificiorpg.com)',
  Accept: '*/*',
};
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
    return new DiscordDiscoveryError('Token do bot inválido ou revogado. Gere um novo token no Discord e salve novamente.', 422);
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

async function resolveBotToken(overrideToken?: string): Promise<string> {
  if (overrideToken?.trim()) return overrideToken;
  try {
    return await requireDiscordBotToken();
  } catch (error: unknown) {
    if (error instanceof DiscordSettingsDecryptError) {
      throw new DiscordDiscoveryError('Token do bot salvo está ilegível. Regrave o token do Discord e tente novamente.', 422);
    }
    if (error instanceof DiscordSettingsSecretUnavailableError) {
      throw new DiscordDiscoveryError('Chave de criptografia ausente para ler o token do Discord.', 503);
    }
    if (error instanceof Error && error.message.includes('DISCORD_BOT_TOKEN não configurado')) {
      throw new DiscordDiscoveryError('Token de bot não configurado. Salve o token do bot Discord antes de listar servidores/canais.', 422);
    }
    throw error;
  }
}

// overrideToken: token bot de um perfil ainda não salvo (form.token) — sem ele,
// a descoberta usa sempre o bot token global salvo, mesmo quando o perfil vai
// usar um bot diferente (perfil bot com token próprio não conseguia listar
// nada antes de salvar).
async function discordGetUnknown(path: string, overrideToken?: string): Promise<unknown> {
  const token = await resolveBotToken(overrideToken);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch(`${DISCORD_API_BASE}${path}`, {
      headers: { ...DISCORD_BOT_HEADERS, Authorization: `Bot ${token.trim()}` },
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

export async function discoverDiscordGuilds(overrideToken?: string): Promise<DiscordDiscoveredGuild[]> {
  const payload = await discordGetUnknown('/users/@me/guilds?with_counts=true', overrideToken);
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

export async function discoverDiscordChannels(guildId: string, overrideToken?: string): Promise<DiscordDiscoveredChannel[]> {
  const payload = await discordGetUnknown(`/guilds/${encodeURIComponent(guildId)}/channels`, overrideToken);
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
