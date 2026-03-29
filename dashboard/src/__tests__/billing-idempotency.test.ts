/**
 * Tests for Stripe webhook idempotency guards in
 * src/app/api/billing/stripe/webhook/route.ts.
 *
 * The idempotency logic lives inside module-private async functions
 * (handleCheckoutComplete, handlePaymentSuccess, handleRefund).  We exercise
 * them by importing the exported POST handler and calling it with mock
 * NextRequest objects that carry the appropriate Stripe event payloads.
 *
 * Stripe itself is mocked so we never need a real API key.
 * prisma is mocked globally via setup.ts.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

// -----------------------------------------------------------------------
// Mock Stripe — the webhook handler calls `new Stripe(key, opts)` at module
// load time and then uses stripe.webhooks.constructEvent inside the handler.
// We mock the Stripe class so that the constructor returns a stub object.
// vitest hoists vi.mock() calls, so this mock is in place before any imports.
// -----------------------------------------------------------------------
vi.mock('stripe', () => {
  // Shared stub instance returned by every `new Stripe(...)` call.
  const stripeInstance = {
    webhooks: {
      constructEvent: vi.fn(),
    },
  };

  // MockStripe must be a proper constructor function (not an arrow function)
  // so that `new Stripe(...)` works without throwing.
  function MockStripe() {
    return stripeInstance;
  }

  return { default: MockStripe };
});

// Mock the balance-reactivation helper — not under test here.
vi.mock('@/lib/billing/balance-check', () => ({
  checkBalanceAndReactivateIfNeeded: vi.fn().mockResolvedValue(undefined),
  checkBalanceAndPauseIfNeeded: vi.fn().mockResolvedValue(undefined),
}));

// Provide env vars before importing the route module.
process.env.STRIPE_SECRET_KEY = 'sk_test_fake_key';
// Leave STRIPE_WEBHOOK_SECRET unset so the route falls through to JSON.parse
// (development / testing without signature verification).

// Import after env + mocks are set up.
import { POST } from '@/app/api/billing/stripe/webhook/route';

const mockPrisma = prisma as unknown as {
  billingTransaction: {
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  wallet: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  tenantMember: {
    findFirst: ReturnType<typeof vi.fn>;
  };
};

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------
function makeRequest(event: object): NextRequest {
  const body = JSON.stringify(event);
  return new NextRequest('http://localhost/api/billing/stripe/webhook', {
    method: 'POST',
    body,
    headers: { 'content-type': 'application/json' },
  });
}

const userId = 'user-stripe-test-01';

// -----------------------------------------------------------------------
// Test data factories
// -----------------------------------------------------------------------
function checkoutEvent(paymentIntentId: string, amountTotal: number = 5000) {
  return {
    type: 'checkout.session.completed',
    data: {
      object: {
        metadata: { userId },
        amount_total: amountTotal,
        payment_intent: paymentIntentId,
      },
    },
  };
}

function paymentIntentEvent(id: string, amount: number = 5000) {
  return {
    type: 'payment_intent.succeeded',
    data: {
      object: {
        id,
        metadata: { userId },
        amount,
      },
    },
  };
}

function refundEvent(chargeId: string, amountRefunded: number = 5000) {
  return {
    type: 'charge.refunded',
    data: {
      object: {
        id: chargeId,
        metadata: { userId },
        amount_refunded: amountRefunded,
      },
    },
  };
}

// -----------------------------------------------------------------------
// Common wallet mock: $50 balance
// -----------------------------------------------------------------------
const walletStub = {
  userId,
  balance: 50,
  lowBalanceAt: 5,
  transactions: [],
};

describe('Stripe webhook idempotency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // tenantMember lookup inside addCreditsToWallet — return a tenantId.
    mockPrisma.tenantMember.findFirst.mockResolvedValue({ tenantId: 'tenant-test-01' });
    // Default wallet response (found).
    mockPrisma.wallet.findUnique.mockResolvedValue(walletStub);
    mockPrisma.wallet.create.mockResolvedValue({ ...walletStub, balance: 0 });
    mockPrisma.wallet.update.mockResolvedValue({ ...walletStub, balance: 100 });
  });

  // -----------------------------------------------------------------------
  // handleCheckoutComplete
  // -----------------------------------------------------------------------
  describe('handleCheckoutComplete — checkout.session.completed', () => {
    it('should credit the wallet once on first event', async () => {
      const paymentIntentId = 'pi_checkout_first_001';

      // No existing transaction — first time processing.
      mockPrisma.billingTransaction.findFirst.mockResolvedValue(null);

      const response = await POST(makeRequest(checkoutEvent(paymentIntentId)));
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.received).toBe(true);
      expect(mockPrisma.wallet.update).toHaveBeenCalledOnce();
    });

    it('should not credit the wallet a second time (duplicate event)', async () => {
      const paymentIntentId = 'pi_checkout_dup_002';

      // Simulate the transaction already existing.
      const existingTx = { id: 'tx-existing', stripePaymentId: paymentIntentId };
      mockPrisma.billingTransaction.findFirst.mockResolvedValue(existingTx);

      // First call.
      await POST(makeRequest(checkoutEvent(paymentIntentId)));
      // Second call with identical payload.
      const response = await POST(makeRequest(checkoutEvent(paymentIntentId)));

      expect(response.status).toBe(200);
      // wallet.update should never be called because both calls see the existing tx.
      expect(mockPrisma.wallet.update).not.toHaveBeenCalled();
    });

    it('should use paymentIntentId as the idempotency key', async () => {
      const paymentIntentId = 'pi_idempotency_key_check';
      mockPrisma.billingTransaction.findFirst.mockResolvedValue(null);

      await POST(makeRequest(checkoutEvent(paymentIntentId)));

      expect(mockPrisma.billingTransaction.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { stripePaymentId: paymentIntentId },
        }),
      );
    });

    it('should skip processing when userId is missing from metadata', async () => {
      const event = {
        type: 'checkout.session.completed',
        data: {
          object: {
            metadata: {}, // no userId
            amount_total: 5000,
            payment_intent: 'pi_no_user',
          },
        },
      };
      const response = await POST(makeRequest(event));

      expect(response.status).toBe(200);
      expect(mockPrisma.wallet.update).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // handlePaymentSuccess
  // -----------------------------------------------------------------------
  describe('handlePaymentSuccess — payment_intent.succeeded', () => {
    it('should credit the wallet once on first event', async () => {
      const piId = 'pi_success_first_001';
      mockPrisma.billingTransaction.findFirst.mockResolvedValue(null);

      const response = await POST(makeRequest(paymentIntentEvent(piId)));

      expect(response.status).toBe(200);
      expect(mockPrisma.wallet.update).toHaveBeenCalledOnce();
    });

    it('should not credit the wallet a second time (duplicate event)', async () => {
      const piId = 'pi_success_dup_002';
      const existingTx = { id: 'tx-pi-existing', stripePaymentId: piId };
      mockPrisma.billingTransaction.findFirst.mockResolvedValue(existingTx);

      await POST(makeRequest(paymentIntentEvent(piId)));
      const response = await POST(makeRequest(paymentIntentEvent(piId)));

      expect(response.status).toBe(200);
      expect(mockPrisma.wallet.update).not.toHaveBeenCalled();
    });

    it('should use paymentIntent.id as the idempotency key', async () => {
      const piId = 'pi_key_check_003';
      mockPrisma.billingTransaction.findFirst.mockResolvedValue(null);

      await POST(makeRequest(paymentIntentEvent(piId)));

      expect(mockPrisma.billingTransaction.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { stripePaymentId: piId },
        }),
      );
    });

    it('should skip when userId is absent from metadata', async () => {
      const event = {
        type: 'payment_intent.succeeded',
        data: {
          object: { id: 'pi_noid', metadata: {}, amount: 5000 },
        },
      };

      const response = await POST(makeRequest(event));

      expect(response.status).toBe(200);
      expect(mockPrisma.wallet.update).not.toHaveBeenCalled();
    });

    it('should correctly convert cents to dollars (5000 cents → $50)', async () => {
      const piId = 'pi_cents_conversion';
      mockPrisma.billingTransaction.findFirst.mockResolvedValue(null);

      await POST(makeRequest(paymentIntentEvent(piId, 5000)));

      // wallet.update should have been called with +50 in balance.
      expect(mockPrisma.wallet.update).toHaveBeenCalledOnce();
      const callArg = mockPrisma.wallet.update.mock.calls[0][0] as {
        data: { balance: number; transactions: { create: { amount: number } } };
      };
      expect(callArg.data.balance).toBe(100); // 50 existing + 50 new
      expect(callArg.data.transactions.create.amount).toBe(50);
    });
  });

  // -----------------------------------------------------------------------
  // handleRefund
  // -----------------------------------------------------------------------
  describe('handleRefund — charge.refunded', () => {
    it('should credit the wallet once on first refund event', async () => {
      const chargeId = 'ch_refund_first_001';
      mockPrisma.billingTransaction.findFirst.mockResolvedValue(null);

      const response = await POST(makeRequest(refundEvent(chargeId)));

      expect(response.status).toBe(200);
      expect(mockPrisma.wallet.update).toHaveBeenCalledOnce();
    });

    it('should not credit the wallet a second time (duplicate refund event)', async () => {
      const chargeId = 'ch_refund_dup_002';
      const existingTx = { id: 'tx-refund-existing', stripePaymentId: `refund_${chargeId}` };
      mockPrisma.billingTransaction.findFirst.mockResolvedValue(existingTx);

      await POST(makeRequest(refundEvent(chargeId)));
      const response = await POST(makeRequest(refundEvent(chargeId)));

      expect(response.status).toBe(200);
      expect(mockPrisma.wallet.update).not.toHaveBeenCalled();
    });

    it('should use refund_<chargeId> as the idempotency key', async () => {
      const chargeId = 'ch_key_check_003';
      mockPrisma.billingTransaction.findFirst.mockResolvedValue(null);

      await POST(makeRequest(refundEvent(chargeId)));

      expect(mockPrisma.billingTransaction.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { stripePaymentId: `refund_${chargeId}` },
        }),
      );
    });

    it('should skip when userId is absent from charge metadata', async () => {
      const event = {
        type: 'charge.refunded',
        data: {
          object: { id: 'ch_noid', metadata: {}, amount_refunded: 5000 },
        },
      };

      const response = await POST(makeRequest(event));

      expect(response.status).toBe(200);
      expect(mockPrisma.wallet.update).not.toHaveBeenCalled();
    });

    it('should skip when amount_refunded is zero', async () => {
      const event = refundEvent('ch_zero_refund', 0);

      const response = await POST(makeRequest(event));

      expect(response.status).toBe(200);
      expect(mockPrisma.wallet.update).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Wallet auto-creation
  // -----------------------------------------------------------------------
  describe('wallet auto-creation', () => {
    it('should create a wallet if one does not exist before crediting', async () => {
      mockPrisma.billingTransaction.findFirst.mockResolvedValue(null);
      // Simulate wallet not yet existing.
      mockPrisma.wallet.findUnique.mockResolvedValue(null);
      const newWallet = { userId, balance: 0, tenantId: 'tenant-test-01' };
      mockPrisma.wallet.create.mockResolvedValue(newWallet);

      await POST(makeRequest(paymentIntentEvent('pi_create_wallet')));

      // Wallet should be created with userId and zero balance (tenantId is also present).
      expect(mockPrisma.wallet.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId, balance: 0 }),
        }),
      );
      expect(mockPrisma.wallet.update).toHaveBeenCalledOnce();
    });
  });

  // -----------------------------------------------------------------------
  // Unhandled / unknown event type
  // -----------------------------------------------------------------------
  describe('unhandled event types', () => {
    it('should return 200 and not touch the wallet for unknown event types', async () => {
      const event = {
        type: 'customer.subscription.created',
        data: { object: {} },
      };

      const response = await POST(makeRequest(event));

      expect(response.status).toBe(200);
      expect(mockPrisma.wallet.update).not.toHaveBeenCalled();
    });
  });
});
