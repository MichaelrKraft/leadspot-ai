/**
 * Phone number utilities — normalization, validation, and display formatting.
 *
 * All external calls go through E.164 format (+1XXXXXXXXXX for US numbers).
 * The LiveKit SIP API requires E.164 when dialing.
 */

/**
 * Normalize a raw phone number string to E.164 format.
 *
 * Accepted input formats (US numbers only):
 *   - 10-digit: "5551234567"
 *   - 10-digit with separators: "(555) 123-4567", "555-123-4567", "555.123.4567"
 *   - 11-digit starting with 1: "15551234567", "+15551234567"
 *
 * @throws {Error} when the stripped digit count is not 10 or 11.
 */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');

  if (digits.length === 10) {
    return `+1${digits}`;
  }

  if (digits.length === 11 && digits[0] === '1') {
    return `+${digits}`;
  }

  throw new Error(
    `Invalid phone number format: "${raw}". Expected a 10-digit US number or E.164.`,
  );
}

/**
 * Attempt to normalize without throwing.
 *
 * @returns The E.164 string, or `null` when the input cannot be parsed.
 */
export function tryNormalizePhone(raw: string): string | null {
  try {
    return normalizePhone(raw);
  } catch {
    return null;
  }
}

/**
 * Return true when the string is a syntactically valid E.164 phone number.
 *
 * This covers all ITU-T E.164 numbers (not just US), which is intentional —
 * outbound SIP requires E.164 regardless of country.
 */
export function isValidE164(phone: string): boolean {
  return /^\+[1-9]\d{1,14}$/.test(phone);
}

/**
 * Format an E.164 US number for human-readable display.
 *
 * "+15551234567" → "(555) 123-4567"
 *
 * Falls back to the raw E.164 string for non-US numbers or unexpected formats.
 */
export function formatPhoneForDisplay(e164: string): string {
  const match = e164.match(/^\+1(\d{3})(\d{3})(\d{4})$/);
  if (match) {
    return `(${match[1]}) ${match[2]}-${match[3]}`;
  }
  return e164;
}
