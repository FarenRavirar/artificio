const DISCORD_EPHEMERAL_IMAGE_HOSTS = new Set([
  'cdn.discordapp.com',
  'cdn.discordapp.net',
  'media.discordapp.com',
  'media.discordapp.net',
]);

export function isEphemeralDiscordImageUrl(value: unknown): boolean {
  if (typeof value !== 'string') return false;

  const trimmed = value.trim();
  if (!trimmed) return false;

  try {
    const url = new URL(trimmed);
    return DISCORD_EPHEMERAL_IMAGE_HOSTS.has(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export function sanitizePublicImageUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (!trimmed || isEphemeralDiscordImageUrl(trimmed)) return null;

  return trimmed;
}
