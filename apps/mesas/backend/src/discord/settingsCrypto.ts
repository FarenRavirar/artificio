import { createDecipheriv, scryptSync } from 'node:crypto';
import {
  encryptSecret,
  decryptSecret,
  SecretUnavailableError,
  SecretDecryptError,
} from '@artificio/config/secret-crypto';

const LEGACY_SETTINGS_SALT = 'discord-settings';

// Compatibilidade retroativa: consumidores esperam estas classes com nomes do mesas.
export class DiscordSettingsSecretUnavailableError extends SecretUnavailableError {
  constructor() {
    super('JWT_SECRET não configurado para criptografar credenciais Discord.');
    this.name = 'DiscordSettingsSecretUnavailableError';
  }
}

export class DiscordSettingsDecryptError extends SecretDecryptError {
  constructor() {
    super('Credencial Discord ilegível com a chave atual. Regrave o token.');
    this.name = 'DiscordSettingsDecryptError';
  }
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new DiscordSettingsSecretUnavailableError();
  }
  return secret;
}

export function encryptDiscordSetting(plaintext: string): string {
  return encryptSecret(plaintext, getJwtSecret());
}

export function decryptDiscordSetting(value: string): string {
  const parts = value.split(':');

  // v2: delega p/ o util compartilhado (AES-256-GCM + scrypt com salt aleatório)
  if (parts[0] === 'v2') {
    try {
      return decryptSecret(value, getJwtSecret());
    } catch (error: unknown) {
      // Preserva o erro específico do mesas: consumidores esperam a classe/nome
      // do mesas via instanceof. SecretDecryptError genérico vira o do mesas (REV-025).
      if (error instanceof DiscordSettingsSecretUnavailableError || error instanceof DiscordSettingsDecryptError) {
        throw error;
      }
      throw new DiscordSettingsDecryptError();
    }
  }

  // Legado (pré-v2): salt fixo 'discord-settings', AES-256-GCM
  try {
    const [ivHex, authTagHex, ciphertextBase64] = parts;
    if (!ivHex || !authTagHex || !ciphertextBase64) {
      throw new Error('Formato de credencial Discord cifrada inválido.');
    }

    const key = scryptSync(getJwtSecret(), LEGACY_SETTINGS_SALT, 32);
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(ciphertextBase64, 'base64')),
      decipher.final(),
    ]);
    return plaintext.toString('utf8');
  } catch (error: unknown) {
    if (error instanceof DiscordSettingsSecretUnavailableError || error instanceof DiscordSettingsDecryptError) {
      throw error;
    }
    throw new DiscordSettingsDecryptError();
  }
}
