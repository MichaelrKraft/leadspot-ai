import { NextResponse } from 'next/server';
import { clearTokens } from '@/lib/token-store';

/**
 * Disconnect from Mautic by clearing stored OAuth tokens
 */
export async function POST() {
  try {
    // Clear the stored tokens
    clearTokens();

    return NextResponse.json({
      success: true,
      message: 'Successfully disconnected from Mautic',
    });
  } catch (error) {
    console.error('Disconnect error:', error);
    return NextResponse.json(
      {
        error: 'Failed to disconnect from Mautic',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
