"""
Stripe Billing Router

Handles subscription management via Stripe Checkout:
- GET  /api/billing/status       - current plan info
- POST /api/billing/checkout     - create Stripe Checkout session
- POST /api/billing/webhook      - Stripe webhook (no auth, sig-verified)
"""

import logging

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.config.subscription_tiers import SUBSCRIPTION_TIERS
from app.database import get_db
from app.models.organization import Organization
from app.models.user import User
from app.services.auth_service import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/billing", tags=["billing"])

# ---------------------------------------------------------------------------
# Tier definitions (task requirement: Free / Pro / Business)
# ---------------------------------------------------------------------------

TIER_PLAN_MAP = {
    settings.STRIPE_PRICE_ID_PRO: "pro",
    settings.STRIPE_PRICE_ID_BUSINESS: "business",
}

PLAN_DISPLAY = {
    "free": {
        "name": "Free",
        "price": 0,
        "contacts": 100,
        "description": "Get started with AI-powered CRM",
    },
    "pro": {
        "name": "Pro",
        "price": 39,
        "contacts": 5000,
        "description": "For growing teams with advanced CRM needs",
    },
    "business": {
        "name": "Business",
        "price": 79,
        "contacts": 25000,
        "description": "For scaling businesses with full AI power",
    },
}


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class CheckoutRequest(BaseModel):
    plan: str  # "pro" or "business"


# ---------------------------------------------------------------------------
# Helper: get or create Stripe customer for an org
# ---------------------------------------------------------------------------

async def _get_or_create_stripe_customer(
    org: Organization,
    user: User,
    session: AsyncSession,
) -> str:
    if org.stripe_customer_id:
        return org.stripe_customer_id

    customer = stripe.Customer.create(
        email=user.email,
        name=org.name,
        metadata={"organization_id": org.organization_id},
    )
    org.stripe_customer_id = customer["id"]
    await session.commit()
    return customer["id"]


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/status")
async def get_billing_status(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Return current subscription plan and limits."""
    result = await session.execute(
        select(Organization).where(
            Organization.organization_id == current_user.organization_id
        )
    )
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    tier = org.subscription_tier or "free"
    plan_info = PLAN_DISPLAY.get(tier, PLAN_DISPLAY["free"])
    tier_config = SUBSCRIPTION_TIERS.get(tier, SUBSCRIPTION_TIERS.get("free", {}))

    return {
        "plan": tier,
        "plan_name": plan_info["name"],
        "price_monthly": plan_info["price"],
        "contacts_limit": plan_info["contacts"],
        "description": plan_info["description"],
        "subscription_status": org.subscription_status,
        "stripe_subscription_id": org.stripe_subscription_id,
        "available_plans": [
            {
                "id": "free",
                **PLAN_DISPLAY["free"],
                "stripe_price_id": None,
            },
            {
                "id": "pro",
                **PLAN_DISPLAY["pro"],
                "stripe_price_id": settings.STRIPE_PRICE_ID_PRO,
            },
            {
                "id": "business",
                **PLAN_DISPLAY["business"],
                "stripe_price_id": settings.STRIPE_PRICE_ID_BUSINESS,
            },
        ],
    }


@router.post("/checkout")
async def create_checkout_session(
    body: CheckoutRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Create a Stripe Checkout session for plan upgrade."""
    if not settings.STRIPE_SECRET_KEY:
        raise HTTPException(
            status_code=503,
            detail="Stripe is not configured. Contact support.",
        )

    if body.plan not in ("pro", "business"):
        raise HTTPException(status_code=400, detail="Invalid plan. Choose 'pro' or 'business'.")

    price_id = (
        settings.STRIPE_PRICE_ID_PRO
        if body.plan == "pro"
        else settings.STRIPE_PRICE_ID_BUSINESS
    )
    if not price_id:
        raise HTTPException(
            status_code=503,
            detail="Stripe price not configured for this plan. Contact support.",
        )

    stripe.api_key = settings.STRIPE_SECRET_KEY

    result = await session.execute(
        select(Organization).where(
            Organization.organization_id == current_user.organization_id
        )
    )
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    customer_id = await _get_or_create_stripe_customer(org, current_user, session)

    checkout_session = stripe.checkout.Session.create(
        customer=customer_id,
        payment_method_types=["card"],
        line_items=[{"price": price_id, "quantity": 1}],
        mode="subscription",
        success_url=f"{settings.FRONTEND_URL}/settings/billing?success=true",
        cancel_url=f"{settings.FRONTEND_URL}/settings/billing?canceled=true",
        metadata={"organization_id": org.organization_id, "plan": body.plan},
    )

    logger.info(
        f"Created Stripe checkout session {checkout_session['id']} "
        f"for org {org.organization_id} plan={body.plan}"
    )
    return {"checkout_url": checkout_session["url"]}


@router.post("/portal")
async def create_customer_portal(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Create a Stripe Customer Portal session for managing subscription."""
    if not settings.STRIPE_SECRET_KEY:
        raise HTTPException(status_code=503, detail="Stripe is not configured.")

    stripe.api_key = settings.STRIPE_SECRET_KEY

    result = await session.execute(
        select(Organization).where(
            Organization.organization_id == current_user.organization_id
        )
    )
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    if not org.stripe_customer_id:
        raise HTTPException(
            status_code=400,
            detail="No Stripe customer found. Subscribe to a plan first.",
        )

    portal_session = stripe.billing_portal.Session.create(
        customer=org.stripe_customer_id,
        return_url=f"{settings.FRONTEND_URL}/settings/billing",
    )

    return {"portal_url": portal_session["url"]}


@router.post("/webhook")
async def stripe_webhook(request: Request, session: AsyncSession = Depends(get_db)):
    """
    Stripe webhook endpoint.

    Handles:
      - customer.subscription.created
      - customer.subscription.updated
      - customer.subscription.deleted
    """
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    if not settings.STRIPE_WEBHOOK_SECRET:
        logger.warning("STRIPE_WEBHOOK_SECRET not set — skipping signature verification")
        try:
            import json
            event = {"type": "unknown", "data": {"object": {}}}
            event = json.loads(payload)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid payload")
    else:
        stripe.api_key = settings.STRIPE_SECRET_KEY
        try:
            event = stripe.Webhook.construct_event(
                payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
            )
        except stripe.error.SignatureVerificationError:
            logger.warning("Stripe webhook signature verification failed")
            raise HTTPException(status_code=400, detail="Invalid signature")
        except Exception as exc:
            logger.error(f"Stripe webhook error: {exc}")
            raise HTTPException(status_code=400, detail="Webhook error")

    event_type = event["type"]
    subscription = event["data"]["object"]

    if event_type in (
        "customer.subscription.created",
        "customer.subscription.updated",
        "customer.subscription.deleted",
    ):
        await _handle_subscription_event(event_type, subscription, session)

    return JSONResponse({"received": True})


async def _handle_subscription_event(
    event_type: str,
    subscription: dict,
    session: AsyncSession,
) -> None:
    """Update org subscription status based on Stripe event."""
    stripe_customer_id = subscription.get("customer")
    stripe_subscription_id = subscription.get("id")
    status = subscription.get("status", "canceled")

    if not stripe_customer_id:
        logger.warning("Webhook event missing customer ID — skipping")
        return

    result = await session.execute(
        select(Organization).where(
            Organization.stripe_customer_id == stripe_customer_id
        )
    )
    org = result.scalar_one_or_none()

    if not org:
        logger.warning(f"No org found for stripe_customer_id={stripe_customer_id}")
        return

    if event_type == "customer.subscription.deleted":
        org.subscription_tier = "free"
        org.subscription_status = "canceled"
        org.stripe_subscription_id = None
        org.stripe_price_id = None
    else:
        # Get price_id from subscription items
        items = subscription.get("items", {}).get("data", [])
        price_id = items[0]["price"]["id"] if items else None

        org.stripe_subscription_id = stripe_subscription_id
        org.stripe_price_id = price_id
        org.subscription_status = status

        # Map price_id → tier name
        if price_id:
            tier = TIER_PLAN_MAP.get(price_id)
            if tier:
                org.subscription_tier = tier
            else:
                logger.warning(f"Unknown price_id={price_id} in webhook")

    await session.commit()
    logger.info(
        f"[{event_type}] org={org.organization_id} tier={org.subscription_tier} "
        f"status={org.subscription_status}"
    )
