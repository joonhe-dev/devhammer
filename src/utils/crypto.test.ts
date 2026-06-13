import { describe, it, expect } from 'vitest';
import { encrypt, decrypt, deriveKey, generateKey } from './crypto.js';

describe('crypto', () => {
  describe('deriveKey', () => {
    it('produces a 32-byte key from password and salt', () => {
      const salt = Buffer.alloc(32, 's');
      const key = deriveKey('mypassword', salt);
      expect(key).toBeInstanceOf(Buffer);
      expect(key.length).toBe(32);
    });

    it('produces different keys for different passwords', () => {
      const salt = Buffer.alloc(32, 's');
      const key1 = deriveKey('password1', salt);
      const key2 = deriveKey('password2', salt);
      expect(key1.equals(key2)).toBe(false);
    });

    it('produces different keys for different salts', () => {
      const salt1 = Buffer.alloc(32, 'a');
      const salt2 = Buffer.alloc(32, 'b');
      const key1 = deriveKey('samepassword', salt1);
      const key2 = deriveKey('samepassword', salt2);
      expect(key1.equals(key2)).toBe(false);
    });

    it('is deterministic for same inputs', () => {
      const salt = Buffer.alloc(32, 'x');
      const key1 = deriveKey('test', salt);
      const key2 = deriveKey('test', salt);
      expect(key1.equals(key2)).toBe(true);
    });
  });

  describe('encrypt / decrypt roundtrip', () => {
    it('encrypts and decrypts a simple string', () => {
      const plaintext = 'Hello, World!';
      const password = 'test-password-123';
      const encrypted = encrypt(plaintext, password);
      const decrypted = decrypt(encrypted, password);
      expect(decrypted).toBe(plaintext);
    });

    it('encrypts and decrypts an empty string', () => {
      const plaintext = '';
      const password = 'test-password';
      const encrypted = encrypt(plaintext, password);
      const decrypted = decrypt(encrypted, password);
      expect(decrypted).toBe(plaintext);
    });

    it('encrypts and decrypts a long string', () => {
      const plaintext = 'a'.repeat(10000);
      const password = 'long-password-test';
      const encrypted = encrypt(plaintext, password);
      const decrypted = decrypt(encrypted, password);
      expect(decrypted).toBe(plaintext);
    });

    it('encrypts and decrypts unicode content', () => {
      const plaintext = '你好世界 🌍 مرحبا';
      const password = 'unicode-test';
      const encrypted = encrypt(plaintext, password);
      const decrypted = decrypt(encrypted, password);
      expect(decrypted).toBe(plaintext);
    });

    it('encrypts and decrypts JSON content', () => {
      const plaintext = JSON.stringify({ key: 'value', num: 42, arr: [1, 2, 3] });
      const password = 'json-test';
      const encrypted = encrypt(plaintext, password);
      const decrypted = decrypt(encrypted, password);
      expect(decrypted).toBe(plaintext);
    });

    it('produces different ciphertext for same plaintext (due to random salt/iv)', () => {
      const plaintext = 'same data';
      const password = 'same-password';
      const encrypted1 = encrypt(plaintext, password);
      const encrypted2 = encrypt(plaintext, password);
      expect(encrypted1).not.toBe(encrypted2);
    });

    it('fails to decrypt with wrong password', () => {
      const plaintext = 'secret data';
      const encrypted = encrypt(plaintext, 'correct-password');
      expect(() => decrypt(encrypted, 'wrong-password')).toThrow();
    });
  });

  describe('generateKey', () => {
    it('produces a 64-character hex string (32 bytes)', () => {
      const key = generateKey();
      expect(key).toMatch(/^[0-9a-f]{64}$/);
    });

    it('produces unique keys on each call', () => {
      const key1 = generateKey();
      const key2 = generateKey();
      expect(key1).not.toBe(key2);
    });
  });
});
