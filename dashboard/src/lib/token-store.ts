/**
 * File-based token store
 * Persists tokens across server restarts
 */

import fs from 'fs';
import path from 'path';

interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

interface StoredTokensJSON {
  accessToken: string;
  refreshToken: string;
  expiresAt: string; // ISO date string
}

// Store tokens in project root (gitignored)
const TOKEN_FILE = path.join(process.cwd(), '.tokens.json');

export function getTokens(): StoredTokens | null {
  try {
    if (!fs.existsSync(TOKEN_FILE)) {
      return null;
    }

    const data = fs.readFileSync(TOKEN_FILE, 'utf-8');
    const parsed: StoredTokensJSON = JSON.parse(data);

    return {
      accessToken: parsed.accessToken,
      refreshToken: parsed.refreshToken,
      expiresAt: new Date(parsed.expiresAt),
    };
  } catch (error) {
    console.error('Error reading tokens:', error);
    return null;
  }
}

export function setTokens(tokens: StoredTokens | null): void {
  try {
    if (tokens === null) {
      clearTokens();
      return;
    }

    const data: StoredTokensJSON = {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt.toISOString(),
    };

    fs.writeFileSync(TOKEN_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error writing tokens:', error);
  }
}

export function clearTokens(): void {
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      fs.unlinkSync(TOKEN_FILE);
    }
  } catch (error) {
    console.error('Error clearing tokens:', error);
  }
}
