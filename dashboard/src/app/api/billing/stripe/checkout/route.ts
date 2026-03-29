import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

// Initialize Stripe
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2025-12-15.clover' })
  : null;

// Predefined top-up amounts
const TOP_UP_OPTIONS = [
  { amount: 10, label: '$10', description: '~100 voice minutes' },
  { amount: 25, label: '$25', description: '~250 voice minutes' },
  { amount: 50, label: '$50', description: '~500 voice minutes' },
  { amount: 100, label: '$100', description: '~1000 voice minutes' },
];

// GET /api/billing/stripe/checkout - Get available top-up options
export async function GET() {
  return NextResponse.json({
    options: TOP_UP_OPTIONS,
    stripeConfigured: !!stripe,
  });
}

// POST /api/billing/stripe/checkout - Create Stripe checkout session
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, amount, successUrl, cancelUrl } = body;

    if (!userId || !amount) {
      return NextResponse.json(
        { error: 'userId and amount are required' },
        { status: 400 }
      );
    }

    // Validate amount
    if (amount < 5 || amount > 500) {
      return NextResponse.json(
        { error: 'Amount must be between $5 and $500' },
        { status: 400 }
      );
    }

    // Check if Stripe is configured
    if (!stripe) {
      // Return mock session for development
      return NextResponse.json({
        sessionId: `mock_session_${Date.now()}`,
        url: null,
        mode: 'development',
        message: 'Stripe not configured. In production, this would redirect to Stripe checkout.',
      });
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Voice AI Credits',
              description: `Add $${amount} to your wallet (~${amount * 10} voice minutes)`,
            },
            unit_amount: amount * 100, // Convert to cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: successUrl || `${process.env.NEXT_PUBLIC_APP_URL}/billing?success=true`,
      cancel_url: cancelUrl || `${process.env.NEXT_PUBLIC_APP_URL}/billing?canceled=true`,
      metadata: {
        userId,
        type: 'wallet_top_up',
      },
    });

    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
    });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
