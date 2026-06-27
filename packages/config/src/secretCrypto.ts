/**
 * AES-256-GCM com scrypt — cifra/decifra segredos com chave fornecida.
 *
 * Extraído de `apps/mesas/backend/src/discord/settingsCrypto.ts` (spec 047)
 * como utilitário compartilhado para o monorepo (WS3, spec 048).
 *
 * Formato de saída: `v2:<salt_hex>:<iv_hex>:<auth_tag_hex>:<ciphertext_base64>`
 * - salt: 16 bytes aleatórios (scrypt entropy)
 * - iv: 12 bytes aleatórios (AES-GCM nonce)
 * - authTag: 16 bytes (GCM autenticação)
 * - ciphertext: base64 do payload cifrado
 *
 * NUNCA logar plaintext/ciphertext/key em produção.
 */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const KEY_LENGTH = 32; // 256 bits
const ENCRYPTION_VERSION = 'v2';

/** Chave de cifra ausente ou não configurada. */
export class SecretUnavailableError extends Error {
  constructor(reason?: string) {
    super(reason ?? 'Chave de cifra não configurada.');
    this.name = 'SecretUnavailableError';
  }
}

/** Falha ao decifrar: chave errada, formato inválido ou auth-tag corrompido. */
export class SecretDecryptError extends Error {
  constructor(reason?: string) {
    super(reason ?? 'Falha ao decifrar: chave inválida ou formato corrompido.');
    this.name = 'SecretDecryptError';
  }
}

function deriveKey(secret: string, salt: Buffer): Buffer {
  return scryptSync(secret, salt, KEY_LENGTH);
}

/**
 * Cifra `plaintext` com AES-256-GCM usando `secret` como chave mestra.
 * @returns ciphertext no formato `v2:<salt>:<iv>:<authTag>:<ciphertext>`.
 */
export function encryptSecret(plaintext: string, secret: string): string {
  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);
  const key = deriveKey(secret, salt);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
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

/**
 * Decifra `value` (formato `v2:<salt>:<iv>:<authTag>:<ciphertext>`) com AES-256-GCM.
 * @returns plaintext original.
 * @throws {SecretDecryptError} se o formato for inválido ou a chave não bater.
 */
export function decryptSecret(value: string, secret: string): string {
  const parts = value.split(':');
  if (parts[0] !== ENCRYPTION_VERSION || parts.length !== 5) {
    throw new SecretDecryptError('Formato de segredo cifrado inválido.');
  }
  const [, saltHex, ivHex, authTagHex, ciphertextBase64] = parts;
  if (!saltHex || !ivHex || !authTagHex || !ciphertextBase64) {
    throw new SecretDecryptError('Formato de segredo cifrado incompleto.');
  }

  const key = deriveKey(secret, Buffer.from(saltHex, 'hex'));
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));

  try {
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(ciphertextBase64, 'base64')),
      decipher.final(),
    ]);
    return plaintext.toString('utf8');
  } catch (error: unknown) {
    throw new SecretDecryptError(
      error instanceof Error ? error.message : 'Falha ao decifrar.',
    );
  }
}
