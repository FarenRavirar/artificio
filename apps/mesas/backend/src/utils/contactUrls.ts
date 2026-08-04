export const HTTPS_ONLY_MESSAGE = 'Somente URLs https:// são aceitas.';
export const INVALID_URL_MESSAGE = 'URL inválida.';
export const INVALID_DISCORD_INVITE_MESSAGE =
  'Use um convite https://discord.gg/... ou https://discord.com/invite/...';
export const UNRESOLVABLE_URL_MESSAGE =
  'Informe um endereço completo, como https://exemplo.com/inscricao. Se for um usuário do Discord, escolha o canal Discord.';

const EXPLICIT_SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const DISCORD_HOSTS = new Set(['discord.gg', 'discord.com', 'www.discord.com']);

/**
 * Canais cujo `value` é uma URL e por isso passa por canonicalizeHttpsUrl.
 *
 * Fonte única: `contactSchema` valida a escrita e `serializeContact` neutraliza
 * a leitura de dado legado. Divergir as duas listas reabriria o stored XSS pelo
 * lado que ficasse de fora, sem erro visível — por isso moram aqui, junto do
 * canonicalizador que ambas usam.
 */
export const URL_VALUE_CHANNELS = new Set(['form', 'facebook', 'instagram']);

/** Canais aceitos no perfil do mestre (subconjunto de CONTACT_CHANNELS). */
export const PROFILE_CONTACT_CHANNELS = new Set(['whatsapp', 'email', 'discord', 'form']);

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

/**
 * Host que um navegador consegue de fato resolver.
 *
 * `canonicalizeHttpsUrl` aceita qualquer host sintaticamente válido, então
 * `uwill` vira `https://uwill/` — URL bem-formada que morre em erro de DNS.
 * Para decidir se um texto é *link de contato* isso não basta: exige-se rótulo
 * com ponto (`exemplo.com`), sem começar nem terminar em ponto e com TLD
 * alfabético, o que descarta nick (`uwill`, `.zero9899`) e IP solto.
 */
const RESOLVABLE_HOST = /^(?=.{1,253}$)([A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,}$/;

export function isResolvableUrl(value: unknown): boolean {
  const result = canonicalizeHttpsUrl(value);
  if (!result.ok) return false;

  try {
    return RESOLVABLE_HOST.test(new URL(result.value).hostname);
  } catch {
    return false;
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
