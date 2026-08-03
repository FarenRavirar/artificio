export const HTTPS_ONLY_MESSAGE = 'Somente URLs https:// são aceitas.';
export const INVALID_DISCORD_INVITE_MESSAGE =
  'Use um convite https://discord.gg/... ou https://discord.com/invite/...';

export type SafeUrlResult =
  | { success: true; url: string }
  | { success: false; message: string };

const EXPLICIT_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

export function validateHttpsUrl(value: string): SafeUrlResult {
  const trimmed = value.trim();
  if (!trimmed) return { success: false, message: 'URL obrigatória.' };

  if (EXPLICIT_SCHEME.test(trimmed) && !/^https:/i.test(trimmed)) {
    return { success: false, message: HTTPS_ONLY_MESSAGE };
  }

  try {
    const parsed = new URL(EXPLICIT_SCHEME.test(trimmed) ? trimmed : `https://${trimmed}`);
    if (parsed.protocol !== 'https:' || !parsed.hostname) {
      return { success: false, message: HTTPS_ONLY_MESSAGE };
    }
    return { success: true, url: parsed.toString() };
  } catch {
    return { success: false, message: 'URL inválida. Use um endereço https:// válido.' };
  }
}

export function toSafeHttpsUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const result = validateHttpsUrl(value);
  return result.success ? result.url : null;
}

export function toSafeDiscordInviteUrl(value: string | null | undefined): string | null {
  const safeUrl = toSafeHttpsUrl(value);
  if (!safeUrl) return null;

  const parsed = new URL(safeUrl);
  const hostname = parsed.hostname.toLowerCase();
  const segments = parsed.pathname.split('/').filter(Boolean);
  const validDiscordGg = hostname === 'discord.gg' && segments.length === 1;
  const validDiscordCom =
    (hostname === 'discord.com' || hostname === 'www.discord.com') &&
    segments.length === 2 &&
    segments[0].toLowerCase() === 'invite';

  return validDiscordGg || validDiscordCom ? safeUrl : null;
}

export function openSafeExternalUrl(value: string | null | undefined): boolean {
  const safeUrl = toSafeHttpsUrl(value);
  if (!safeUrl) return false;
  window.open(safeUrl, '_blank', 'noopener,noreferrer');
  return true;
}
