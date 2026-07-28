import crypto from 'crypto';

/**
 * Encryption utility using AES-256-GCM for securely storing
 * sensitive values (API keys, secrets) at rest in the database.
 *
 * The encryption key is derived from the ENCRYPTION_KEY env var.
 * If no key is configured, encryption is disabled (dev fallback).
 *
 * Format: hex(iv):hex(ciphertext):hex(authTag)
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

let _derivedKey: Buffer | null = null;

function getEncryptionKey(): Buffer | null {
  if (_derivedKey) return _derivedKey;

  const secret = process.env.ENCRYPTION_KEY;
  if (!secret) return null;

  // Derive a 256-bit key from the secret using SHA-256
  _derivedKey = crypto.createHash('sha256').update(secret).digest();
  return _derivedKey;
}

/**
 * Encrypt a plaintext value.
 * Returns null if no encryption key is configured (dev fallback).
 */
export function encrypt(plaintext: string): string | null {
  const key = getEncryptionKey();
  if (!key) {
    // Dev fallback: store as-is (never use in production without ENCRYPTION_KEY)
    if (process.env.NODE_ENV === 'production') {
      throw new Error('ENCRYPTION_KEY is not configured');
    }
    return `unencrypted:${plaintext}`;
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
  ciphertext += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return `${iv.toString('hex')}:${ciphertext}:${authTag}`;
}

/**
 * Decrypt a previously encrypted value.
 * Supports both encrypted format and dev fallback.
 */
export function decrypt(encrypted: string): string | null {
  if (!encrypted) return null;

  if (encrypted.startsWith('unencrypted:')) {
    // Dev fallback
    return encrypted.slice('unencrypted:'.length);
  }

  const key = getEncryptionKey();
  if (!key) return null;

  const parts = encrypted.split(':');
  if (parts.length !== 3) return null;

  const [ivHex, ciphertext, authTagHex] = parts;
  if (!ivHex || !ciphertext || !authTagHex) return null;

  try {
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let plaintext = decipher.update(ciphertext, 'hex', 'utf8');
    plaintext += decipher.final('utf8');
    return plaintext;
  } catch {
    return null;
  }
}
