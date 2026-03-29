import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await getServerSession(authConfig);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  const [user, wallet, agents] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        emailVerified: true,
        createdAt: true,
        image: true,
      },
    }),
    prisma.wallet.findUnique({
      where: { userId },
      include: { transactions: { orderBy: { createdAt: 'desc' } } },
    }),
    prisma.voiceAgent.findMany({
      where: { userId },
      include: {
        calls: {
          include: {
            transcript: true,
            usage: true,
          },
          orderBy: { startedAt: 'desc' },
        },
      },
    }),
  ]);

  const exportData = {
    exportedAt: new Date().toISOString(),
    user,
    wallet,
    voiceAgents: agents,
  };

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="leadspot-data-export-${userId}.json"`,
    },
  });
}
