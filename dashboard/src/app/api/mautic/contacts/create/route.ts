import { NextRequest, NextResponse } from 'next/server';
import { createMauticClient } from '@/lib/mautic-client';
import { getTokens } from '@/lib/token-store';

export async function POST(request: NextRequest) {
  try {
    // Get stored tokens
    const tokens = getTokens();
    if (!tokens) {
      return NextResponse.json(
        { error: 'Not authenticated. Please connect to Mautic first.' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { email, firstname, lastname, phone, company } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Create Mautic client
    const client = createMauticClient({
      mauticUrl: process.env.MAUTIC_URL || '',
      clientId: process.env.MAUTIC_CLIENT_ID!,
      clientSecret: process.env.MAUTIC_CLIENT_SECRET!,
    });

    // Set tokens
    client.setTokens(tokens);

    // Prepare contact fields
    const fields: Record<string, string> = { email };
    if (firstname) fields.firstname = firstname;
    if (lastname) fields.lastname = lastname;
    if (phone) fields.phone = phone;
    if (company) fields.company = company;

    // Create contact in Mautic
    const contact = await client.createContact(fields);

    return NextResponse.json({
      success: true,
      contact: {
        id: contact.id,
        email: contact.fields?.all?.email,
        firstname: contact.fields?.all?.firstname,
        lastname: contact.fields?.all?.lastname,
      },
    });
  } catch (error) {
    console.error('Contact creation error:', error);
    return NextResponse.json(
      {
        error: 'Failed to create contact',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
