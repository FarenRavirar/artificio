import {
  canonicalizeDiscordInviteUrl,
  canonicalizeHttpsUrl,
  PROFILE_CONTACT_CHANNELS,
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
  if (URL_VALUE_CHANNELS.has(contact.channel)) {
    const safeFormUrl = canonicalizeHttpsUrl(value);
    if (!safeFormUrl.ok) return null;
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
