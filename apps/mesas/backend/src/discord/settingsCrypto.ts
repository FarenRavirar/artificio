import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

const LEGACY_SETTINGS_SALT = 'discord-settings';
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const ENCRYPTION_VERSION = 'v2';

export class DiscordSettingsSecretUnavailableError extends Error {
  constructor() {
    super('JWT_SECRET não configurado para criptografar credenciais Discord.');
    this.name = 'DiscordSettingsSecretUnavailableError';
  }
}

function getKey(salt: Buffer | string): Buffer {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new DiscordSettingsSecretUnavailableError();
  }
  return scryptSync(secret, salt, 32);
}

export function encryptDiscordSetting(plaintext: string): string {
  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', getKey(salt), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [
    ENCRYPTION_VERSION,
    salt.toString('hex'),
    iv.toString('hex'),
    authTag.toString('hex'),
    ciphertext.toString('base64'),
  ].join(':');
}

export function decryptDiscordSetting(value: string): string {
  const parts = value.split(':');
  if (parts[0] === ENCRYPTION_VERSION) {
    const [, saltHex, ivHex, authTagHex, ciphertextBase64] = parts;
    if (!saltHex || !ivHex || !authTagHex || !ciphertextBase64) {
      throw new Error('Formato de credencial Discord cifrada inválido.');
    }

    const decipher = createDecipheriv('aes-256-gcm', getKey(Buffer.from(saltHex, 'hex')), Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(ciphertextBase64, 'base64')),
      decipher.final(),
    ]);
    return plaintext.toString('utf8');
  }

  const [ivHex, authTagHex, ciphertextBase64] = parts;
  if (!ivHex || !authTagHex || !ciphertextBase64) {
    throw new Error('Formato de credencial Discord cifrada inválido.');
  }

  const decipher = createDecipheriv('aes-256-gcm', getKey(LEGACY_SETTINGS_SALT), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextBase64, 'base64')),
    decipher.final(),
  ]);
  return plaintext.toString('utf8');
}
