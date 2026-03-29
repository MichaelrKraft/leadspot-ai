import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getToken } from 'next-auth/jwt';
import { authConfig } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  const session = await getServerSession(authConfig);

  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const token = await getToken({ req: request });

  if (token?.jti) {
    // Add JWT ID to denylist
    const exp = token.exp ? new Date((token.exp as number) * 1000) : new Date(Date.now() + 30 * 60 * 1000);

    await prisma.revokedToken.create({
      data: {
        jti: token.jti as string,
        userId: token.userId as string,
        expiresAt: exp,
      },
    });
  }

  return NextResponse.json({ success: true });
}
