/**
 * Mautic OAuth Callback Handler
 *
 * GET /api/mautic/callback - Handle OAuth redirect from Mautic
 */

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';
import { getMauticConfig } from '@/lib/mautic-server';
import { MauticClient } from '@/lib/mautic-client';

export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get('code');
    const error = request.nextUrl.searchParams.get('error');

    if (error) {
      console.error('OAuth error:', error);
      return NextResponse.redirect(
        new URL(`/?error=${encodeURIComponent(error)}`, request.nextUrl.origin)
      );
    }

    if (!code) {
      return NextResponse.redirect(
        new URL('/?error=no_code', request.nextUrl.origin)
      );
    }

    // Validate CSRF state parameter
    const receivedState = request.nextUrl.searchParams.get('state');
    const cookieStore = await cookies();
    const storedState = cookieStore.get('mautic_oauth_state')?.value;

    if (!receivedState || !storedState) {
      return NextResponse.json({ error: 'Missing CSRF state' }, { status: 400 });
    }

    // Timing-safe comparison to prevent timing attacks
    const receivedBuf = Buffer.from(receivedState, 'hex');
    const storedBuf = Buffer.from(storedState, 'hex');
    const isValid =
      receivedBuf.length === storedBuf.length && timingSafeEqual(receivedBuf, storedBuf);

    if (!isValid) {
      return NextResponse.json({ error: 'Invalid CSRF state' }, { status: 400 });
    }

    // Delete the cookie immediately after validation
    cookieStore.delete('mautic_oauth_state');

    const config = getMauticConfig();
    const clientSecret = process.env.MAUTIC_CLIENT_SECRET;

    if (!config.baseUrl || !config.clientId || !clientSecret) {
      return NextResponse.redirect(
        new URL('/?error=mautic_not_configured', request.nextUrl.origin)
      );
    }

    const redirectUri = `${request.nextUrl.origin}/api/mautic/callback`;
    const client = new MauticClient({
      baseUrl: config.baseUrl,
      clientId: config.clientId,
      clientSecret,
    });
    const tokens = await client.exchangeCodeForTokens(code, redirectUri);

    // TODO: persist tokens via setMauticTokens(tenantId, tokens) once tenantId
    // is available in the callback (e.g. via state parameter or session).
    console.log('[MauticCallback] Tokens exchanged successfully, expiresAt:', tokens.expiresAt);

    // Redirect to dashboard with success
    return NextResponse.redirect(
      new URL('/?auth=success', request.nextUrl.origin)
    );
  } catch (error) {
    console.error('Callback error:', error);
    return NextResponse.redirect(
      new URL('/?error=token_exchange_failed', request.nextUrl.origin)
    );
  }
}
