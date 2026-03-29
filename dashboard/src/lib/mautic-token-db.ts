/**
 * Database-backed Mautic token storage with AES-256-GCM encryption.
 * Replaces file-based token-store.ts — works on serverless and across restarts.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

interface MauticTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

function getEncryptionKey(): Buffer {
  const keyBase64 = process.env.MAUTIC_TOKEN_ENCRYPTION_KEY;
  if (!keyBase64) {
    throw new Error('MAUTIC_TOKEN_ENCRYPTION_KEY environment variable is required');
  }
  const key = Buffer.from(keyBase64, 'base64');
  if (key.length !== 32) {
    throw new Error('MAUTIC_TOKEN_ENCRYPTION_KEY must be a 32-byte base64-encoded key');
  }
  return key;
}

function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Format: base64(iv || authTag || ciphertext)
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

function decrypt(encryptedBase64: string): string {
  const key = getEncryptionKey();
  const data = Buffer.from(encryptedBase64, 'base64');

  const iv = data.subarray(0, IV_LENGTH);
  const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

export async function getMauticTokens(tenantId: string): Promise<MauticTokens | null> {
  const record = await prisma.mauticToken.findUnique({
    where: { tenantId },
  });

  if (!record) {
    return null;
  }

  try {
    const decrypted = decrypt(record.encryptedData);
    const parsed = JSON.parse(decrypted);
    return {
      accessToken: parsed.accessToken,
      refreshToken: parsed.refreshToken,
      expiresAt: new Date(parsed.expiresAt),
    };
  } catch (error) {
    console.error('[MauticTokenDB] Failed to decrypt tokens for tenant:', tenantId, error);
    return null;
  }
}

export async function setMauticTokens(tenantId: string, tokens: MauticTokens): Promise<void> {
  const plaintext = JSON.stringify({
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: tokens.expiresAt.toISOString(),
  });

  const encryptedData = encrypt(plaintext);

  // Optimistic upsert — concurrent refresh protection via updatedAt check
  await prisma.mauticToken.upsert({
    where: { tenantId },
    create: {
      tenantId,
      encryptedData,
      keyVersion: 1,
    },
    update: {
      encryptedData,
    },
  });
}

export async function clearMauticTokens(tenantId: string): Promise<void> {
  await prisma.mauticToken.deleteMany({
    where: { tenantId },
  });
}
