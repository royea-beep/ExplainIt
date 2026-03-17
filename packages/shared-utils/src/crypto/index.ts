/**
 * AES-256-GCM Encryption utilities.
 * Extracted from KeyDrop + PostPilot.
 *
 * Usage:
 *   import { encrypt, decrypt, generateToken } from '@royea/shared-utils/crypto';
 *
 *   // Set ENCRYPTION_MASTER_KEY env var (64-char hex = 32 bytes)
 *   const encrypted = encrypt('sensitive data');
 *   const plain = decrypt(encrypted.ciphertext, encrypted.iv, encrypted.authTag);
 */

import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

export interface EncryptionConfig {
  /** Env var name for the master key (default: 'ENCRYPTION_MASTER_KEY') */
  keyEnvVar?: string;
  /** Direct key as hex string (64 chars). Use this OR keyEnvVar, not both. */
  key?: string;
}

let configuredKey: string | undefined;
let configuredEnvVar = 'ENCRYPTION_MASTER_KEY';

/** Configure encryption (call once at startup if using non-default env var) */
export function configureCrypto(config: EncryptionConfig): void {
  if (config.key) configuredKey = config.key;
  if (config.keyEnvVar) configuredEnvVar = config.keyEnvVar;
}

function getKey(): Buffer {
  const hex = configuredKey || process.env[configuredEnvVar];
  if (!hex || hex.length !== 64) {
    throw new Error(`Encryption key must be a 64-char hex string (32 bytes). Set ${configuredEnvVar} env var.`);
  }
  return Buffer.from(hex, 'hex');
}

export interface EncryptedData {
  ciphertext: string;
  iv: string;
  authTag: string;
}

/** Encrypt plaintext with AES-256-GCM */
export function encrypt(plaintext: string): EncryptedData {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  return {
    ciphertext: encrypted,
    iv: iv.toString('hex'),
    authTag: cipher.getAuthTag().toString('hex'),
  };
}

/** Decrypt ciphertext with AES-256-GCM */
export function decrypt(ciphertext: string, iv: string, authTag: string): string {
  const key = getKey();
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'hex'), {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));

  let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/** Generate a cryptographically secure random token (hex string) */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString('hex');
}

/** Generate a short random ID (URL-safe) */
export function generateId(length = 12): string {
  return randomBytes(Math.ceil(length * 0.75))
    .toString('base64url')
    .slice(0, length);
}
