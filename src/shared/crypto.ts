import { createCipheriv, createDecipheriv, pbkdf2 as pbkdf2Callback, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { VaultConfig } from './models';

const pbkdf2 = promisify(pbkdf2Callback);

export interface EncryptedPayload {
  iv: string;
  authTag: string;
  ciphertext: string;
}

export function generateSalt(): string {
  return randomBytes(16).toString('base64');
}

export async function derivePasswordHash(password: string, authSaltBase64: string, iterations: number): Promise<string> {
  const salt = Buffer.from(authSaltBase64, 'base64');
  const derived = await pbkdf2(password, salt, iterations, 32, 'sha256');
  return derived.toString('base64');
}

export async function deriveAesKey(password: string, encSaltBase64: string, iterations: number): Promise<Buffer> {
  const salt = Buffer.from(encSaltBase64, 'base64');
  return pbkdf2(password, salt, iterations, 32, 'sha256');
}

export async function verifyPassword(password: string, config: VaultConfig): Promise<boolean> {
  const derived = await derivePasswordHash(password, config.authSalt, config.pbkdf2Iterations);
  const expected = Buffer.from(config.passwordHash, 'base64');
  const actual = Buffer.from(derived, 'base64');

  if (expected.length !== actual.length) {
    return false;
  }

  return timingSafeEqual(expected, actual);
}

export function encryptText(plaintext: string, key: Buffer): EncryptedPayload {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  };
}

export function decryptText(payload: EncryptedPayload, key: Buffer): string {
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(payload.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(payload.authTag, 'base64'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, 'base64')),
    decipher.final(),
  ]);
  return plaintext.toString('utf8');
}

