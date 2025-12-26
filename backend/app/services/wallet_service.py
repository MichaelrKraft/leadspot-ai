"""
LeadSpot Wallet & Rebilling Service

GoHighLevel-style wallet system for usage-based billing:
- Wallet holds credits for AI token consumption
- Auto-recharge when balance drops below threshold
- Agencies can rebill clients with markup (1-10x)
"""

import logging
from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.organization import Organization

logger = logging.getLogger(__name__)


# Cost per AI operation (in USD)
AI_COSTS = {
    "chat_message": Decimal("0.01"),      # ~1000 tokens
    "lead_scoring": Decimal("0.005"),     # Quick analysis
    "daily_insights": Decimal("0.02"),    # Dashboard generation
    "signature_extraction": Decimal("0.01"),
    "duplicate_detection": Decimal("0.005"),
}


class WalletTransaction(BaseModel):
    """Wallet transaction record"""
    org_id: str
    amount: Decimal
    balance_after: Decimal
    description: str
    transaction_type: str  # debit, credit, recharge
    created_at: datetime


class WalletSummary(BaseModel):
    """Wallet status summary"""
    balance: Decimal
    auto_recharge_enabled: bool
    recharge_amount: Decimal
    recharge_threshold: Decimal
    stripe_connected: bool


class WalletService:
    """
    GoHighLevel-style wallet system for usage-based billing.

    Used for AI token consumption (Claude API costs).
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_organization(self, org_id: str) -> Optional[Organization]:
        """Get organization by ID."""
        result = await self.db.execute(
            select(Organization).where(Organization.organization_id == org_id)
        )
        return result.scalar_one_or_none()

    async def get_balance(self, org_id: str) -> Decimal:
        """Get current wallet balance."""
        org = await self.get_organization(org_id)
        if not org:
            raise ValueError(f"Organization not found: {org_id}")
        return org.wallet_balance

    async def get_wallet_summary(self, org_id: str) -> WalletSummary:
        """Get wallet status summary."""
        org = await self.get_organization(org_id)
        if not org:
            raise ValueError(f"Organization not found: {org_id}")

        return WalletSummary(
            balance=org.wallet_balance,
            auto_recharge_enabled=org.wallet_auto_recharge,
            recharge_amount=org.wallet_recharge_amount,
            recharge_threshold=org.wallet_recharge_threshold,
            stripe_connected=bool(org.stripe_customer_id),
        )

    async def deduct(
        self,
        org_id: str,
        amount: Decimal,
        description: str,
        operation_type: str = "ai_operation"
    ) -> bool:
        """
        Deduct from wallet. Returns False if insufficient funds.

        Args:
            org_id: Organization ID
            amount: Amount to deduct
            description: Transaction description
            operation_type: Type of AI operation

        Returns:
            True if deduction successful, False if insufficient funds
        """
        org = await self.get_organization(org_id)
        if not org:
            raise ValueError(f"Organization not found: {org_id}")

        # Check if sufficient balance
        if org.wallet_balance < amount:
            # Try auto-recharge if enabled
            if org.wallet_auto_recharge and org.stripe_customer_id:
                recharged = await self._trigger_recharge(org)
                if not recharged:
                    logger.warning(f"Auto-recharge failed for org {org_id}")
                    return False
            else:
                logger.info(f"Insufficient balance for org {org_id}: {org.wallet_balance} < {amount}")
                return False

        # Deduct amount
        org.wallet_balance -= amount
        await self.db.commit()

        logger.info(f"Deducted {amount} from org {org_id}: {description}")

        # Check if we should trigger auto-recharge after deduction
        if (org.wallet_auto_recharge and
            org.stripe_customer_id and
            org.wallet_balance <= org.wallet_recharge_threshold):
            await self._trigger_recharge(org)

        return True

    async def add_credits(
        self,
        org_id: str,
        amount: Decimal,
        description: str,
        transaction_type: str = "credit"
    ) -> Decimal:
        """
        Add credits to wallet (recharge, bonus, or refund).

        Args:
            org_id: Organization ID
            amount: Amount to add
            description: Transaction description
            transaction_type: Type of transaction

        Returns:
            New balance after adding credits
        """
        org = await self.get_organization(org_id)
        if not org:
            raise ValueError(f"Organization not found: {org_id}")

        org.wallet_balance += amount
        await self.db.commit()
        await self.db.refresh(org)

        logger.info(f"Added {amount} credits to org {org_id}: {description}")
        return org.wallet_balance

    async def _trigger_recharge(self, org: Organization) -> bool:
        """
        Trigger auto-recharge via Stripe.

        In production, this would:
        1. Create a PaymentIntent via Stripe
        2. Charge the customer's saved payment method
        3. Add credits on successful charge

        For now, this is a placeholder that simulates the recharge.
        """
        if not org.stripe_customer_id:
            logger.warning(f"Cannot recharge org {org.organization_id}: No Stripe customer")
            return False

        if org.wallet_balance > org.wallet_recharge_threshold:
            logger.debug(f"Org {org.organization_id} above threshold, skipping recharge")
            return True

        # TODO: Integrate with Stripe PaymentIntent
        # In production:
        # charge = await stripe.PaymentIntent.create(
        #     amount=int(org.wallet_recharge_amount * 100),
        #     currency="usd",
        #     customer=org.stripe_customer_id,
        #     off_session=True,
        #     confirm=True,
        # )
        #
        # if charge.status == "succeeded":
        #     org.wallet_balance += org.wallet_recharge_amount

        # For now, simulate successful recharge
        logger.info(
            f"Auto-recharge triggered for org {org.organization_id}: "
            f"${org.wallet_recharge_amount}"
        )
        org.wallet_balance += org.wallet_recharge_amount
        await self.db.commit()

        return True

    async def configure_auto_recharge(
        self,
        org_id: str,
        enabled: bool,
        recharge_amount: Optional[Decimal] = None,
        recharge_threshold: Optional[Decimal] = None
    ) -> WalletSummary:
        """
        Configure auto-recharge settings.

        Args:
            org_id: Organization ID
            enabled: Whether auto-recharge is enabled
            recharge_amount: Amount to add on recharge (default $50)
            recharge_threshold: Balance threshold to trigger recharge (default $10)

        Returns:
            Updated wallet summary
        """
        org = await self.get_organization(org_id)
        if not org:
            raise ValueError(f"Organization not found: {org_id}")

        org.wallet_auto_recharge = enabled

        if recharge_amount is not None:
            if recharge_amount < Decimal("10"):
                raise ValueError("Minimum recharge amount is $10")
            org.wallet_recharge_amount = recharge_amount

        if recharge_threshold is not None:
            if recharge_threshold < Decimal("5"):
                raise ValueError("Minimum threshold is $5")
            org.wallet_recharge_threshold = recharge_threshold

        await self.db.commit()
        await self.db.refresh(org)

        logger.info(f"Updated auto-recharge settings for org {org_id}")
        return await self.get_wallet_summary(org_id)

    async def deduct_for_operation(
        self,
        org_id: str,
        operation: str,
        multiplier: float = 1.0
    ) -> bool:
        """
        Convenience method to deduct for a standard AI operation.

        Args:
            org_id: Organization ID
            operation: Operation type (from AI_COSTS)
            multiplier: Cost multiplier (for larger operations)

        Returns:
            True if deduction successful
        """
        if operation not in AI_COSTS:
            logger.warning(f"Unknown operation type: {operation}")
            base_cost = Decimal("0.01")  # Default cost
        else:
            base_cost = AI_COSTS[operation]

        amount = base_cost * Decimal(str(multiplier))
        return await self.deduct(org_id, amount, f"AI: {operation}")


class RebillingService:
    """
    Allow agencies to mark up AI costs to their clients.

    GoHighLevel-style rebilling:
    - Agency pays LeadSpot base cost
    - Agency charges client base_cost * markup
    - Agency keeps the difference as profit
    """

    def __init__(self, db: AsyncSession, wallet_service: WalletService):
        self.db = db
        self.wallet_service = wallet_service

    async def get_organization(self, org_id: str) -> Optional[Organization]:
        """Get organization by ID."""
        result = await self.db.execute(
            select(Organization).where(Organization.organization_id == org_id)
        )
        return result.scalar_one_or_none()

    async def calculate_client_cost(
        self,
        client_id: str,
        base_cost: Decimal
    ) -> Decimal:
        """
        Calculate what to charge client based on agency markup.

        Args:
            client_id: Client organization ID
            base_cost: Base cost from LeadSpot

        Returns:
            Cost to charge client (with agency markup applied)
        """
        client = await self.get_organization(client_id)
        if not client:
            return base_cost

        # Check if client has parent agency
        if not client.parent_organization_id:
            return base_cost  # Direct client, no markup

        agency = await self.get_organization(client.parent_organization_id)
        if not agency:
            return base_cost

        # Check if agency has rebilling enabled
        features = agency.features or {}
        if not features.get("rebilling_enabled"):
            return base_cost

        # Get markup (default 1.0 = no markup)
        markup = features.get("rebilling_markup", 1.0)
        max_markup = features.get("rebilling_max_markup", 10)

        # Clamp markup to allowed range
        markup = min(max(1.0, markup), max_markup)

        client_cost = base_cost * Decimal(str(markup))
        return client_cost

    async def process_rebilled_operation(
        self,
        client_id: str,
        operation: str,
        multiplier: float = 1.0
    ) -> dict:
        """
        Process an AI operation with rebilling.

        1. Deduct base cost from agency wallet
        2. Deduct marked-up cost from client wallet
        3. Agency keeps the difference

        Returns dict with costs and success status.
        """
        client = await self.get_organization(client_id)
        if not client:
            raise ValueError(f"Client not found: {client_id}")

        # Get base cost
        if operation not in AI_COSTS:
            base_cost = Decimal("0.01")
        else:
            base_cost = AI_COSTS[operation] * Decimal(str(multiplier))

        result = {
            "operation": operation,
            "base_cost": base_cost,
            "client_cost": base_cost,
            "agency_profit": Decimal("0"),
            "success": False,
        }

        # If client has no parent, charge directly
        if not client.parent_organization_id:
            success = await self.wallet_service.deduct(
                client_id, base_cost, f"AI: {operation}"
            )
            result["success"] = success
            return result

        # Calculate client cost with markup
        client_cost = await self.calculate_client_cost(client_id, base_cost)
        result["client_cost"] = client_cost
        result["agency_profit"] = client_cost - base_cost

        # Deduct from client wallet first
        client_success = await self.wallet_service.deduct(
            client_id, client_cost, f"AI: {operation}"
        )
        if not client_success:
            return result

        # Deduct base cost from agency wallet
        agency_success = await self.wallet_service.deduct(
            client.parent_organization_id,
            base_cost,
            f"AI (rebilled from {client.name}): {operation}"
        )

        if not agency_success:
            # Refund client if agency deduction fails
            await self.wallet_service.add_credits(
                client_id, client_cost, f"Refund: {operation}", "refund"
            )
            return result

        result["success"] = True
        logger.info(
            f"Rebilled operation {operation}: client charged ${client_cost}, "
            f"agency profit ${result['agency_profit']}"
        )
        return result

    async def configure_markup(
        self,
        agency_id: str,
        markup: float
    ) -> dict:
        """
        Configure rebilling markup for an agency.

        Args:
            agency_id: Agency organization ID
            markup: Markup multiplier (1.0 to 10.0)

        Returns:
            Updated rebilling configuration
        """
        agency = await self.get_organization(agency_id)
        if not agency:
            raise ValueError(f"Agency not found: {agency_id}")

        # Validate agency type
        if agency.organization_type != "agency":
            raise ValueError("Only agencies can configure rebilling")

        # Validate markup range
        features = agency.features or {}
        max_markup = features.get("rebilling_max_markup", 10)

        if markup < 1.0:
            raise ValueError("Minimum markup is 1.0x")
        if markup > max_markup:
            raise ValueError(f"Maximum markup is {max_markup}x")

        # Update features
        features["rebilling_markup"] = markup
        agency.features = features

        await self.db.commit()
        await self.db.refresh(agency)

        logger.info(f"Updated markup for agency {agency_id}: {markup}x")
        return {
            "agency_id": agency_id,
            "markup": markup,
            "max_markup": max_markup,
            "rebilling_enabled": features.get("rebilling_enabled", False),
        }
