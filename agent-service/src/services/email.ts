/**
 * Email delivery service using Resend
 * Handles suppression checks, CAN-SPAM compliance, and delivery recording
 */
import { Resend } from 'resend';
import crypto from 'crypto';

let resendClient: Resend | null = null;

function getResend(): Resend {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('RESEND_API_KEY environment variable is not set');
    }
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

const BACKEND_API_URL = process.env.LEADSPOT_API_URL || 'http://localhost:8000';
const UNSUBSCRIBE_SECRET = process.env.UNSUBSCRIBE_SECRET || process.env.JWT_SECRET || 'change-me-in-production';
const FROM_EMAIL = process.env.FROM_EMAIL || 'outreach@mail.leadspot.ai';
const PHYSICAL_ADDRESS = process.env.PHYSICAL_ADDRESS || '123 Business St, City, ST 00000';
const APP_URL = process.env.APP_URL || 'http://localhost:3006';

export interface SendEmailOptions {
  to: string;
  subject: string;
  body: string; // HTML or plain text
  contactId: string;
  campaignId?: string;
  organizationId: string;
  fromName?: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  suppressed?: boolean;
}

/**
 * Generate a signed unsubscribe token for a contact
 */
export function generateUnsubscribeToken(contactId: string, email: string): string {
  const payload = `${contactId}:${email}:${Date.now()}`;
  const hmac = crypto.createHmac('sha256', UNSUBSCRIBE_SECRET);
  hmac.update(payload);
  const signature = hmac.digest('hex');
  return Buffer.from(`${payload}:${signature}`).toString('base64url');
}

/**
 * Verify an unsubscribe token
 */
export function verifyUnsubscribeToken(token: string): { contactId: string; email: string } | null {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const parts = decoded.split(':');
    if (parts.length !== 4) return null;
    const [contactId, email, , signature] = parts;
    const payload = `${contactId}:${email}:${parts[2]}`;
    const hmac = crypto.createHmac('sha256', UNSUBSCRIBE_SECRET);
    hmac.update(payload);
    const expectedSig = hmac.digest('hex');
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
      return null;
    }
    return { contactId, email };
  } catch {
    return null;
  }
}

/**
 * Check if an email address is suppressed (bounced, unsubscribed, complained)
 */
async function isEmailSuppressed(email: string): Promise<boolean> {
  try {
    const response = await fetch(`${BACKEND_API_URL}/api/suppressions/${encodeURIComponent(email.toLowerCase())}`);
    return response.status === 200;
  } catch (error) {
    // If suppression check fails, err on the side of caution and allow sending
    console.warn(`[EmailService] Suppression check failed for ${email}:`, error);
    return false;
  }
}

/**
 * Record a sent email in the backend database
 */
async function recordSentEmail(options: SendEmailOptions, messageId: string): Promise<void> {
  try {
    await fetch(`${BACKEND_API_URL}/api/emails/record-send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contact_id: options.contactId,
        campaign_id: options.campaignId,
        subject: options.subject,
        to_addr: options.to,
        from_addr: FROM_EMAIL,
        body: options.body,
        message_id: messageId,
        user_id: 'agent-service',
      }),
    });
  } catch (error) {
    console.warn('[EmailService] Failed to record sent email in backend:', error);
    // Non-fatal — email was already sent
  }
}

/**
 * Add CAN-SPAM required footer to email HTML
 */
function addComplianceFooter(htmlBody: string, unsubscribeUrl: string): string {
  const footer = `
<br/><br/>
<hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
<p style="font-size: 12px; color: #888; text-align: center; margin: 0;">
  ${PHYSICAL_ADDRESS}<br/>
  <a href="${unsubscribeUrl}" style="color: #888;">Unsubscribe</a> from these emails.
</p>`;

  if (htmlBody.includes('</body>')) {
    return htmlBody.replace('</body>', `${footer}</body>`);
  }
  return htmlBody + footer;
}

/**
 * Send an email with full compliance and tracking
 */
export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  const { to, subject, body, contactId, campaignId, fromName } = options;

  // 1. Suppression check
  const suppressed = await isEmailSuppressed(to);
  if (suppressed) {
    console.log(`[EmailService] Skipping suppressed email: ${to}`);
    return { success: false, suppressed: true, error: 'Email address is suppressed' };
  }

  // 2. Generate unsubscribe URL
  const token = generateUnsubscribeToken(contactId, to);
  const unsubscribeUrl = `${APP_URL}/api/unsubscribe?token=${token}`;

  // 3. Add compliance footer
  const htmlBody = addComplianceFooter(body, unsubscribeUrl);

  // 4. Send via Resend
  try {
    const resend = getResend();
    const fromAddress = fromName ? `${fromName} <${FROM_EMAIL}>` : FROM_EMAIL;

    const result = await resend.emails.send({
      from: fromAddress,
      to: [to],
      subject,
      html: htmlBody,
      headers: {
        'List-Unsubscribe': `<${unsubscribeUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    });

    if (result.error) {
      console.error(`[EmailService] Resend error for ${to}:`, result.error);
      return { success: false, error: result.error.message };
    }

    const messageId = result.data?.id ?? '';
    console.log(`[EmailService] Email sent to ${to}, messageId: ${messageId}`);

    // 5. Record in backend (non-blocking)
    void campaignId; // referenced via options below
    recordSentEmail(options, messageId).catch(() => {});

    return { success: true, messageId };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[EmailService] Failed to send email to ${to}:`, message);
    return { success: false, error: message };
  }
}
