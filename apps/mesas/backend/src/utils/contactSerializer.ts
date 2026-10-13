import {
  canonicalizeDiscordInviteUrl,
  canonicalizeHttpsUrl,
  canonicalizeSocialProfileUrl,
  isResolvableUrl,
  PROFILE_CONTACT_CHANNELS,
  SOCIAL_PROFILE_CHANNELS,
  URL_VALUE_CHANNELS,
} from './contactUrls.js';

export type SerializableContact = {
  channel: string;
  value: string;
  discord_server_url?: string | null;
  [key: string]: unknown;
};

export function serializeContact<T extends SerializableContact>(contact: T): T | null {
  let value = contact.value;
  if (SOCIAL_PROFILE_CHANNELS.has(contact.channel)) {
    // Mesma canonicalização da escrita: username cru vira perfil sob o domínio
    // da rede, host de fora é descartado. Sem isso, contato legado gravado
    // antes da regra continuaria chegando ao render em formato que ele recusa.
    const safeSocialUrl = canonicalizeSocialProfileUrl(contact.channel, value);
    if (!safeSocialUrl.ok) return null;
    value = safeSocialUrl.value;
  } else if (URL_VALUE_CHANNELS.has(contact.channel)) {
    const safeFormUrl = canonicalizeHttpsUrl(value);
    if (!safeFormUrl.ok) return null;
    // Mesma regra da escrita (`canonicalizeContactValue`) e do importador
    // (`extractContacts`, 2026-08-03): identificador solto não é link. Legado
    // gravado antes da regra (`form: uwill`, 2026-07-09) virava `https://uwill/`,
    // um CTA que só dá erro de DNS; aqui vira contato Discord, onde o nick é
    // localizável. O texto do mestre é preservado, só o canal muda.
    if (!isResolvableUrl(value)) {
      return { ...contact, channel: 'discord', value: contact.value.trim(), discord_server_url: null };
    }
    value = safeFormUrl.value;
  }

  let discordServerUrl = contact.discord_server_url;
  if (contact.channel !== 'discord') {
    discordServerUrl = null;
  } else if (discordServerUrl) {
    const safeDiscordUrl = canonicalizeDiscordInviteUrl(discordServerUrl);
    discordServerUrl = safeDiscordUrl.ok ? safeDiscordUrl.value : null;
  }

  return {
    ...contact,
    value,
    discord_server_url: discordServerUrl ?? null,
  };
}

export function serializeContacts<T extends SerializableContact>(contacts: readonly T[]): T[] {
  return contacts
    .map(serializeContact)
    .filter((contact): contact is T => contact !== null);
}

export function serializeContactMethods(value: unknown): SerializableContact[] {
  if (!Array.isArray(value)) return [];

  const contacts = value.filter((contact): contact is SerializableContact => (
    typeof contact === 'object'
    && contact !== null
    && typeof contact.channel === 'string'
    && PROFILE_CONTACT_CHANNELS.has(contact.channel)
    && typeof contact.value === 'string'
  ));
  return serializeContacts(contacts);
}
