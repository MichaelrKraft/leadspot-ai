/**
 * Tests for AES-256-GCM token encryption in mautic-token-db.ts.
 *
 * The encrypt/decrypt helpers are private to the module, so we exercise them
 * through the exported public API (getMauticTokens / setMauticTokens /
 * clearMauticTokens).  The Prisma client is mocked globally in setup.ts.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { randomBytes } from 'crypto';

// A valid 32-byte base64-encoded key for all tests.
const VALID_KEY_32_BYTES = randomBytes(32).toString('base64');

// Set env before importing the module under test so getEncryptionKey() succeeds.
process.env.MAUTIC_TOKEN_ENCRYPTION_KEY = VALID_KEY_32_BYTES;

// Import AFTER setting env so the module captures the value at load time.
import { getMauticTokens, setMauticTokens, clearMauticTokens } from '@/lib/mautic-token-db';
import { prisma } from '@/lib/prisma';

// Cast to mocked type so TypeScript is happy with vi.fn() methods.
const mockPrisma = prisma as unknown as {
  mauticToken: {
    findUnique: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
    deleteMany: ReturnType<typeof vi.fn>;
  };
};

describe('mautic-token-db', () => {
  const tenantId = 'tenant-abc-123';
  const sampleTokens = {
    accessToken: 'access-token-value',
    refreshToken: 'refresh-token-value',
    expiresAt: new Date('2030-01-01T00:00:00.000Z'),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // Happy path: round-trip encryption
  // -----------------------------------------------------------------------
  describe('encrypt / decrypt round-trip', () => {
    it('should store and retrieve tokens unchanged', async () => {
      // Capture the encrypted payload written by setMauticTokens.
      let capturedEncryptedData: string | undefined;
      mockPrisma.mauticToken.upsert.mockImplementation(async ({ create }: { create: { encryptedData: string } }) => {
        capturedEncryptedData = create.encryptedData;
        return { tenantId, encryptedData: capturedEncryptedData, keyVersion: 1 };
      });

      await setMauticTokens(tenantId, sampleTokens);

      expect(capturedEncryptedData).toBeDefined();
      expect(typeof capturedEncryptedData).toBe('string');

      // Feed the captured ciphertext back through getMauticTokens.
      mockPrisma.mauticToken.findUnique.mockResolvedValue({
        tenantId,
        encryptedData: capturedEncryptedData,
        keyVersion: 1,
      });

      const result = await getMauticTokens(tenantId);

      expect(result).not.toBeNull();
      expect(result!.accessToken).toBe(sampleTokens.accessToken);
      expect(result!.refreshToken).toBe(sampleTokens.refreshToken);
      expect(result!.expiresAt.toISOString()).toBe(sampleTokens.expiresAt.toISOString());
    });

    it('should produce different ciphertext for the same plaintext on each call (random IV)', async () => {
      const ciphertexts: string[] = [];

      mockPrisma.mauticToken.upsert.mockImplementation(async ({ create }: { create: { encryptedData: string } }) => {
        ciphertexts.push(create.encryptedData);
        return { tenantId, encryptedData: create.encryptedData, keyVersion: 1 };
      });

      // Encrypt the same tokens twice — IVs must differ so ciphertexts must differ.
      await setMauticTokens(tenantId, sampleTokens);
      await setMauticTokens(tenantId, sampleTokens);

      expect(ciphertexts).toHaveLength(2);
      expect(ciphertexts[0]).not.toBe(ciphertexts[1]);
    });
  });

  // -----------------------------------------------------------------------
  // Tampered / wrong key produces null (decrypt returns null on error)
  // -----------------------------------------------------------------------
  describe('decryption failure handling', () => {
    it('should return null when stored data is corrupted (tampered ciphertext)', async () => {
      // Store real ciphertext first.
      let realCiphertext: string | undefined;
      mockPrisma.mauticToken.upsert.mockImplementation(async ({ create }: { create: { encryptedData: string } }) => {
        realCiphertext = create.encryptedData;
        return { tenantId, encryptedData: realCiphertext, keyVersion: 1 };
      });
      await setMauticTokens(tenantId, sampleTokens);

      // Corrupt it: flip some bytes in the base64 payload.
      const buf = Buffer.from(realCiphertext!, 'base64');
      buf[buf.length - 1] ^= 0xff; // flip last byte (inside ciphertext)
      const corrupted = buf.toString('base64');

      mockPrisma.mauticToken.findUnique.mockResolvedValue({
        tenantId,
        encryptedData: corrupted,
        keyVersion: 1,
      });

      const result = await getMauticTokens(tenantId);

      // The implementation catches decryption errors and returns null.
      expect(result).toBeNull();
    });

    it('should return null when decrypting with a different key (wrong key)', async () => {
      // Encrypt with the current valid key.
      let ciphertext: string | undefined;
      mockPrisma.mauticToken.upsert.mockImplementation(async ({ create }: { create: { encryptedData: string } }) => {
        ciphertext = create.encryptedData;
        return { tenantId, encryptedData: ciphertext, keyVersion: 1 };
      });
      await setMauticTokens(tenantId, sampleTokens);

      // Switch to a different key so decryption will fail the auth tag check.
      const wrongKey = randomBytes(32).toString('base64');
      process.env.MAUTIC_TOKEN_ENCRYPTION_KEY = wrongKey;

      mockPrisma.mauticToken.findUnique.mockResolvedValue({
        tenantId,
        encryptedData: ciphertext,
        keyVersion: 1,
      });

      const result = await getMauticTokens(tenantId);

      // Restore the valid key for subsequent tests.
      process.env.MAUTIC_TOKEN_ENCRYPTION_KEY = VALID_KEY_32_BYTES;

      expect(result).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // getMauticTokens edge cases
  // -----------------------------------------------------------------------
  describe('getMauticTokens', () => {
    it('should return null when no record exists in the database', async () => {
      mockPrisma.mauticToken.findUnique.mockResolvedValue(null);

      const result = await getMauticTokens(tenantId);

      expect(result).toBeNull();
      expect(mockPrisma.mauticToken.findUnique).toHaveBeenCalledWith({
        where: { tenantId },
      });
    });

    it('should pass tenantId to the database lookup', async () => {
      mockPrisma.mauticToken.findUnique.mockResolvedValue(null);

      await getMauticTokens('specific-tenant-id');

      expect(mockPrisma.mauticToken.findUnique).toHaveBeenCalledWith({
        where: { tenantId: 'specific-tenant-id' },
      });
    });
  });

  // -----------------------------------------------------------------------
  // setMauticTokens persistence behaviour
  // -----------------------------------------------------------------------
  describe('setMauticTokens', () => {
    it('should call prisma.mauticToken.upsert with the correct tenantId', async () => {
      mockPrisma.mauticToken.upsert.mockResolvedValue({ tenantId, encryptedData: 'x', keyVersion: 1 });

      await setMauticTokens(tenantId, sampleTokens);

      expect(mockPrisma.mauticToken.upsert).toHaveBeenCalledOnce();
      const call = mockPrisma.mauticToken.upsert.mock.calls[0][0] as {
        where: { tenantId: string };
        create: { tenantId: string; keyVersion: number };
      };
      expect(call.where.tenantId).toBe(tenantId);
      expect(call.create.tenantId).toBe(tenantId);
      expect(call.create.keyVersion).toBe(1);
    });

    it('should store a non-empty base64 string as encryptedData', async () => {
      let storedData: string | undefined;
      mockPrisma.mauticToken.upsert.mockImplementation(async ({ create }: { create: { encryptedData: string } }) => {
        storedData = create.encryptedData;
        return { tenantId, encryptedData: storedData, keyVersion: 1 };
      });

      await setMauticTokens(tenantId, sampleTokens);

      expect(storedData).toBeTruthy();
      // Should be a valid base64 string (no spaces, valid characters).
      expect(storedData).toMatch(/^[A-Za-z0-9+/]+=*$/);
    });
  });

  // -----------------------------------------------------------------------
  // clearMauticTokens
  // -----------------------------------------------------------------------
  describe('clearMauticTokens', () => {
    it('should call prisma.mauticToken.deleteMany with the correct tenantId', async () => {
      mockPrisma.mauticToken.deleteMany.mockResolvedValue({ count: 1 });

      await clearMauticTokens(tenantId);

      expect(mockPrisma.mauticToken.deleteMany).toHaveBeenCalledWith({
        where: { tenantId },
      });
    });

    it('should not throw when no record exists to delete', async () => {
      mockPrisma.mauticToken.deleteMany.mockResolvedValue({ count: 0 });

      await expect(clearMauticTokens('nonexistent-tenant')).resolves.not.toThrow();
    });
  });

  // -----------------------------------------------------------------------
  // Environment variable validation
  // -----------------------------------------------------------------------
  describe('getEncryptionKey validation', () => {
    it('should throw when MAUTIC_TOKEN_ENCRYPTION_KEY is not set', async () => {
      const saved = process.env.MAUTIC_TOKEN_ENCRYPTION_KEY;
      delete process.env.MAUTIC_TOKEN_ENCRYPTION_KEY;

      // The module reads the env on every call via getEncryptionKey().
      // setMauticTokens will trigger encrypt() which calls getEncryptionKey().
      await expect(setMauticTokens(tenantId, sampleTokens)).rejects.toThrow(
        'MAUTIC_TOKEN_ENCRYPTION_KEY environment variable is required',
      );

      process.env.MAUTIC_TOKEN_ENCRYPTION_KEY = saved;
    });

    it('should throw when key decodes to wrong length (not 32 bytes)', async () => {
      const saved = process.env.MAUTIC_TOKEN_ENCRYPTION_KEY;
      // 16-byte key → 32-byte base64, but AES-256 requires 32-byte key.
      process.env.MAUTIC_TOKEN_ENCRYPTION_KEY = randomBytes(16).toString('base64');

      await expect(setMauticTokens(tenantId, sampleTokens)).rejects.toThrow(
        'MAUTIC_TOKEN_ENCRYPTION_KEY must be a 32-byte base64-encoded key',
      );

      process.env.MAUTIC_TOKEN_ENCRYPTION_KEY = saved;
    });
  });
});
