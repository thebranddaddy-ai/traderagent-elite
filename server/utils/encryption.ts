import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Encrypts text using AES-256-GCM
 * @param text - Plain text to encrypt
 * @param key - Encryption key (must be 32 bytes)
 * @returns Encrypted text in format: iv:authTag:encryptedData
 */
export function encrypt(text: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  // Return format: iv:authTag:encryptedData
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts text encrypted with AES-256-GCM
 * @param encryptedText - Encrypted text in format: iv:authTag:encryptedData
 * @param key - Encryption key (must be 32 bytes)
 * @returns Decrypted plain text
 */
export function decrypt(encryptedText: string): string {
  const key = getEncryptionKey();
  const parts = encryptedText.split(':');
  
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted text format');
  }
  
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Gets encryption key from environment variable
 * Generates a secure key if not set (development only)
 */
function getEncryptionKey(): Buffer {
  const envKey = process.env.ENCRYPTION_KEY;
  
  if (!envKey) {
    console.warn('⚠️  ENCRYPTION_KEY not set! Using insecure development key.');
    console.warn('⚠️  Set ENCRYPTION_KEY in Replit secrets for production!');
    // Development fallback (32 bytes)
    return Buffer.from('dev-key-not-secure-change-this-32b');
  }
  
  // Convert hex string to buffer or use raw string
  if (envKey.length === 64) {
    // Assume it's hex (32 bytes = 64 hex chars)
    return Buffer.from(envKey, 'hex');
  } else if (envKey.length >= 32) {
    // Use first 32 bytes
    return Buffer.from(envKey.slice(0, 32));
  } else {
    throw new Error('ENCRYPTION_KEY must be at least 32 characters or 64 hex characters');
  }
}

/**
 * Generates a secure 32-byte encryption key in hex format
 * Use this to generate your ENCRYPTION_KEY for Replit secrets
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('hex');
}
