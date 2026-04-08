import { describe, expect, it } from 'vitest';
import { decryptText, derivePasswordHash, encryptText, verifyPassword } from '@/shared/crypto';
import type { VaultConfig } from '@/shared/models';

describe('crypto helpers', () => {
  it('round-trips encrypted content', () => {
    const key = Buffer.alloc(32, 7);
    const payload = encryptText('hello world', key);
    expect(decryptText(payload, key)).toBe('hello world');
  });

  it('produces different ciphertext for different IVs', () => {
    const key = Buffer.alloc(32, 9);
    const left = encryptText('same text', key);
    const right = encryptText('same text', key);
    expect(left.ciphertext).not.toBe(right.ciphertext);
    expect(left.iv).not.toBe(right.iv);
  });

  it('fails when auth tag is wrong', () => {
    const key = Buffer.alloc(32, 3);
    const payload = encryptText('secret', key);
    payload.authTag = Buffer.alloc(16, 1).toString('base64');
    expect(() => decryptText(payload, key)).toThrow();
  });

  it('fails when ciphertext is tampered', () => {
    const key = Buffer.alloc(32, 5);
    const payload = encryptText('secret', key);
    const tampered = Buffer.from(payload.ciphertext, 'base64');
    tampered[0] = tampered[0] ^ 0xff;
    payload.ciphertext = tampered.toString('base64');
    expect(() => decryptText(payload, key)).toThrow();
  });

  it('round-trips empty and long strings', () => {
    const key = Buffer.alloc(32, 11);
    expect(decryptText(encryptText('', key), key)).toBe('');

    const longText = 'x'.repeat(20_000);
    expect(decryptText(encryptText(longText, key), key)).toBe(longText);
  });

  it('verifies password hashes', async () => {
    const salt = Buffer.alloc(16, 1).toString('base64');
    const config: VaultConfig = {
      authSalt: salt,
      encSalt: Buffer.alloc(16, 2).toString('base64'),
      pbkdf2Iterations: 1000,
      passwordHash: await derivePasswordHash('correct horse battery staple', salt, 1000),
    };

    await expect(verifyPassword('correct horse battery staple', config)).resolves.toBe(true);
    await expect(verifyPassword('wrong password', config)).resolves.toBe(false);
  });
});
