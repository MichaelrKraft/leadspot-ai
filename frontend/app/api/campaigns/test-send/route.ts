import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const AGENT_SERVICE_URL = process.env.AGENT_SERVICE_URL || 'http://localhost:3008';

/**
 * POST /api/campaigns/test-send
 *
 * Sends a single test email for a campaign to a specified address.
 *
 * The agent-service must expose a matching endpoint:
 *   POST AGENT_SERVICE_URL/api/email/test-send
 *   Body: { to, subject, body, contactId, organizationId }
 *   → sends a test email via Resend
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { campaignId?: string; email?: string };
    const { campaignId, email } = body;

    if (!campaignId || !email) {
      return NextResponse.json({ error: 'campaignId and email are required' }, { status: 400 });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    // Fetch campaign details from backend
    const campaignResponse = await fetch(`${BACKEND_URL}/api/campaigns/${campaignId}`);
    if (!campaignResponse.ok) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }
    const campaign = await campaignResponse.json() as { name?: string; description?: string };

    // Call agent-service to send a single test email
    const agentResponse = await fetch(`${AGENT_SERVICE_URL}/api/email/test-send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: email,
        subject: `[TEST] ${campaign.name ?? 'Campaign'}`,
        body: campaign.description ?? '<p>This is a test email from your campaign.</p>',
        contactId: 'test-send',
        organizationId: 'test',
      }),
    });

    if (!agentResponse.ok) {
      const errorData = await agentResponse.json() as { error?: string };
      return NextResponse.json(
        { error: errorData.error ?? 'Failed to send test email' },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: `Test email sent to ${email}` });
  } catch (error) {
    console.error('[TestSend] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
