export const HTTPS_ONLY_MESSAGE = 'Somente URLs https:// são aceitas.';
export const INVALID_URL_MESSAGE = 'URL inválida.';
export const INVALID_DISCORD_INVITE_MESSAGE =
  'Use um convite https://discord.gg/... ou https://discord.com/invite/...';

const EXPLICIT_SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const DISCORD_HOSTS = new Set(['discord.gg', 'discord.com', 'www.discord.com']);

export type ContactUrlResult =
  | { ok: true; value: string }
  | { ok: false; message: string };

export function canonicalizeHttpsUrl(value: unknown): ContactUrlResult {
  if (typeof value !== 'string') return { ok: false, message: INVALID_URL_MESSAGE };

  const trimmed = value.trim();
  if (!trimmed) return { ok: false, message: INVALID_URL_MESSAGE };

  const hasExplicitScheme = EXPLICIT_SCHEME.test(trimmed);
  if (hasExplicitScheme && !/^https:/i.test(trimmed)) {
    return { ok: false, message: HTTPS_ONLY_MESSAGE };
  }

  try {
    const parsed = new URL(hasExplicitScheme ? trimmed : `https://${trimmed}`);
    if (parsed.protocol !== 'https:') {
      return { ok: false, message: HTTPS_ONLY_MESSAGE };
    }
    if (!parsed.hostname) return { ok: false, message: INVALID_URL_MESSAGE };
    return { ok: true, value: parsed.toString() };
  } catch {
    return { ok: false, message: INVALID_URL_MESSAGE };
  }
}

export function canonicalizeDiscordInviteUrl(value: unknown): ContactUrlResult {
  const result = canonicalizeHttpsUrl(value);
  if (!result.ok) return result;

  const parsed = new URL(result.value);
  const hostname = parsed.hostname.toLowerCase();
  if (!DISCORD_HOSTS.has(hostname)) {
    return { ok: false, message: INVALID_DISCORD_INVITE_MESSAGE };
  }

  const hasInviteCode = hostname === 'discord.gg'
    ? /^\/[^/]+\/?$/.test(parsed.pathname)
    : /^\/invite\/[^/]+\/?$/i.test(parsed.pathname);

  return hasInviteCode
    ? result
    : { ok: false, message: INVALID_DISCORD_INVITE_MESSAGE };
}
