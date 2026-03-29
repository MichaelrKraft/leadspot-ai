/**
 * Mautic OAuth Authentication API Routes
 *
 * GET /api/mautic/auth - Get authorization URL
 * POST /api/mautic/auth - Exchange code for tokens
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { cookies } from 'next/headers';
import { getMauticConfig } from '@/lib/mautic-server';
import { MauticClient } from '@/lib/mautic-client';

export async function GET(request: NextRequest) {
  try {
    const config = getMauticConfig();

    if (!config.baseUrl || !config.clientId) {
      return NextResponse.json(
        { error: 'Mautic is not configured. Please set MAUTIC_URL and MAUTIC_CLIENT_ID.' },
        { status: 500 }
      );
    }

    const redirectUri = `${request.nextUrl.origin}/api/mautic/callback`;

    // Generate CSRF nonce and store in httpOnly cookie (10 min TTL)
    const state = randomBytes(32).toString('hex');
    const cookieStore = await cookies();
    cookieStore.set('mautic_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
      path: '/',
    });

    // Build auth URL using a minimal client (no secret needed for URL generation)
    const client = new MauticClient({
      baseUrl: config.baseUrl,
      clientId: config.clientId,
      clientSecret: '',
    });
    const authUrl = client.getAuthorizationUrl(redirectUri, state);

    return NextResponse.json({
      authUrl,
      redirectUri,
      clientId: config.clientId,
    });
  } catch (error) {
    console.error('Auth config error:', error);
    return NextResponse.json(
      { error: 'Failed to get auth configuration' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { code, redirectUri } = await request.json();

    if (!code) {
      return NextResponse.json(
        { error: 'Authorization code is required' },
        { status: 400 }
      );
    }

    const config = getMauticConfig();
    const clientSecret = process.env.MAUTIC_CLIENT_SECRET;

    if (!config.baseUrl || !config.clientId || !clientSecret) {
      return NextResponse.json(
        { error: 'Missing Mautic configuration' },
        { status: 500 }
      );
    }

    const client = new MauticClient({
      baseUrl: config.baseUrl,
      clientId: config.clientId,
      clientSecret,
    });
    const tokens = await client.exchangeCodeForTokens(code, redirectUri);

    return NextResponse.json({
      success: true,
      expiresAt: tokens.expiresAt,
    });
  } catch (error) {
    console.error('Token exchange error:', error);
    return NextResponse.json(
      { error: 'Failed to exchange authorization code' },
      { status: 500 }
    );
  }
}
