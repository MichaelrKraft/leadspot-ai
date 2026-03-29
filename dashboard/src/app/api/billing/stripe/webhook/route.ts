import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import Stripe from 'stripe';
import { checkBalanceAndReactivateIfNeeded } from '@/lib/billing/balance-check';

// Initialize Stripe - will be undefined if no key configured
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2025-12-15.clover' })
  : null;

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

// POST /api/billing/stripe/webhook - Handle Stripe webhook events
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    // If Stripe is not configured, return error
    if (!stripe) {
      console.error('Stripe is not configured');
      return NextResponse.json(
        { error: 'Stripe is not configured' },
        { status: 500 }
      );
    }

    let event: Stripe.Event;

    // Verify webhook signature if secret is configured
    if (webhookSecret && signature) {
      try {
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
      } catch (err: any) {
        console.error('Webhook signature verification failed:', err.message);
        return NextResponse.json(
          { error: 'Webhook signature verification failed' },
          { status: 400 }
        );
      }
    } else {
      // For development/testing without webhook secret
      event = JSON.parse(body) as Stripe.Event;
    }

    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutComplete(session);
        break;
      }

      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentSuccess(paymentIntent);
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.error('Payment failed:', paymentIntent.id);
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        await handleRefund(charge);
        break;
      }

      case 'radar.early_fraud_warning.created': {
        const warning = event.data.object as Stripe.Radar.EarlyFraudWarning;
        console.error('[Fraud] Early fraud warning received:', warning.id, warning.fraud_type);
        // TODO: Suspend tenant and notify owner via email (Phase 4.3 email service)
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

// Handle completed checkout session
async function handleCheckoutComplete(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  const amount = session.amount_total ? session.amount_total / 100 : 0;
  const paymentIntentId = session.payment_intent as string;

  if (!userId || amount <= 0) {
    console.error('Invalid checkout session:', { userId, amount });
    return;
  }

  // Idempotency check — prevent double-credit on webhook retry
  if (paymentIntentId) {
    const existing = await prisma.billingTransaction.findFirst({
      where: { stripePaymentId: paymentIntentId },
    });
    if (existing) {
      console.log('[Billing] Checkout already processed:', paymentIntentId);
      return;
    }
  }

  await addCreditsToWallet(userId, amount, paymentIntentId, 'Wallet top-up via Stripe');
}

// Handle successful payment intent
async function handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent) {
  const userId = paymentIntent.metadata?.userId;
  const amount = paymentIntent.amount / 100; // Convert cents to dollars

  if (!userId || amount <= 0) {
    console.error('Invalid payment intent:', { userId, amount });
    return;
  }

  // Check if already processed (idempotency)
  const existing = await prisma.billingTransaction.findFirst({
    where: { stripePaymentId: paymentIntent.id },
  });

  if (existing) {
    console.log('Payment already processed:', paymentIntent.id);
    return;
  }

  await addCreditsToWallet(userId, amount, paymentIntent.id, 'Wallet top-up via Stripe');
}

// Add credits to wallet (shared logic)
async function addCreditsToWallet(
  userId: string,
  amount: number,
  stripePaymentId: string,
  description: string
) {
  // Look up tenantId for this user
  const tenantMember = await prisma.tenantMember.findFirst({
    where: { userId },
    select: { tenantId: true },
  });
  const tenantId = tenantMember?.tenantId ?? '';

  // Get or create wallet
  let wallet = await prisma.wallet.findUnique({
    where: { userId },
  });

  if (!wallet) {
    wallet = await prisma.wallet.create({
      data: { userId, tenantId, balance: 0 },
    });
  }

  const newBalance = Number(wallet.balance) + amount;

  // Update wallet and create transaction
  await prisma.wallet.update({
    where: { userId },
    data: {
      balance: newBalance,
      transactions: {
        create: {
          type: 'top_up',
          amount,
          balanceAfter: newBalance,
          description,
          stripePaymentId,
          tenantId,
        },
      },
    },
  });

  console.log(`Added ${amount} to wallet for user ${userId}. New balance: ${newBalance}`);

  // Reactivate any agents that were paused due to zero balance
  await checkBalanceAndReactivateIfNeeded(userId);
}

// Handle Stripe refund
async function handleRefund(charge: Stripe.Charge) {
  const userId = charge.metadata?.userId;
  const refundedAmount = (charge.amount_refunded ?? 0) / 100;

  if (!userId || refundedAmount <= 0) {
    console.warn('[Billing] Refund missing userId or amount:', charge.id);
    return;
  }

  // Check if we already credited this refund (idempotency)
  const existing = await prisma.billingTransaction.findFirst({
    where: { stripePaymentId: `refund_${charge.id}` },
  });
  if (existing) {
    console.log('[Billing] Refund already processed:', charge.id);
    return;
  }

  await addCreditsToWallet(userId, refundedAmount, `refund_${charge.id}`, `Refund from Stripe: ${charge.id}`);
  console.log(`[Billing] Processed refund of ${refundedAmount} for user ${userId}`);
}
