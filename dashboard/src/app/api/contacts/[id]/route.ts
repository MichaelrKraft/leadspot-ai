import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/lib/auth';
import { getMauticClientForTenant, persistRefreshedTokens } from '@/lib/mautic-server';
import { prisma } from '@/lib/prisma';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authConfig);
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { tenantId } = session.user;
  const contactId = params.id;

  try {
    // Delete VoiceTranscripts for calls linked to this contact (GDPR right to erasure)
    await prisma.voiceTranscript.deleteMany({
      where: {
        call: { contactId, tenantId },
      },
    });

    // Delete the Mautic contact via API
    const client = await getMauticClientForTenant(tenantId);
    await client.deleteContact(contactId);
    await persistRefreshedTokens(tenantId, client);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete contact error:', error);
    return NextResponse.json({ error: 'Failed to delete contact' }, { status: 500 });
  }
}
