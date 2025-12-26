"""
LeadSpot.ai Subscription Tiers Configuration

GoHighLevel-inspired pricing tiers with feature gating.
"""

from decimal import Decimal


# Subscription tier configuration
SUBSCRIPTION_TIERS = {
    "pilot": {
        "name": "Pilot",
        "description": "Perfect for getting started with AI-powered CRM",
        "price_monthly": Decimal("49.00"),
        "price_annual": Decimal("490.00"),  # ~17% discount
        "stripe_price_id_monthly": None,  # Set in production
        "stripe_price_id_annual": None,
        "features": {
            # Usage limits
            "max_mautic_instances": 1,
            "max_contacts": 10000,
            "max_users": 3,
            "max_sub_organizations": 0,

            # Feature flags
            "ai_insights_enabled": True,
            "lead_scoring_enabled": True,
            "voice_input_enabled": False,
            "white_label_enabled": False,
            "rebilling_enabled": False,

            # AI tokens (monthly allocation)
            "monthly_ai_credits": Decimal("10.00"),
        },
    },

    "pro": {
        "name": "Pro",
        "description": "For growing teams with advanced needs",
        "price_monthly": Decimal("149.00"),
        "price_annual": Decimal("1490.00"),
        "stripe_price_id_monthly": None,
        "stripe_price_id_annual": None,
        "features": {
            # Usage limits
            "max_mautic_instances": -1,  # Unlimited
            "max_contacts": 50000,
            "max_users": 10,
            "max_sub_organizations": 0,

            # Feature flags
            "ai_insights_enabled": True,
            "lead_scoring_enabled": True,
            "voice_input_enabled": True,
            "white_label_enabled": True,
            "rebilling_enabled": False,

            # AI tokens (monthly allocation)
            "monthly_ai_credits": Decimal("50.00"),
        },
    },

    "agency": {
        "name": "Agency",
        "description": "Full white-label SaaS with client management",
        "price_monthly": Decimal("297.00"),
        "price_annual": Decimal("2970.00"),
        "stripe_price_id_monthly": None,
        "stripe_price_id_annual": None,
        "features": {
            # Usage limits
            "max_mautic_instances": -1,  # Unlimited
            "max_contacts": -1,  # Unlimited
            "max_users": -1,  # Unlimited
            "max_sub_organizations": -1,  # Unlimited

            # Feature flags
            "ai_insights_enabled": True,
            "lead_scoring_enabled": True,
            "voice_input_enabled": True,
            "white_label_enabled": True,
            "rebilling_enabled": True,
            "rebilling_max_markup": 10,  # Up to 10x

            # AI tokens (monthly allocation)
            "monthly_ai_credits": Decimal("200.00"),
        },
    },
}


def get_tier_features(tier_name: str) -> dict:
    """Get features for a subscription tier."""
    tier = SUBSCRIPTION_TIERS.get(tier_name)
    if not tier:
        # Default to pilot tier
        return SUBSCRIPTION_TIERS["pilot"]["features"]
    return tier["features"]


def get_tier_price(tier_name: str, annual: bool = False) -> Decimal:
    """Get price for a subscription tier."""
    tier = SUBSCRIPTION_TIERS.get(tier_name)
    if not tier:
        return Decimal("0")

    if annual:
        return tier["price_annual"]
    return tier["price_monthly"]


def can_access_feature(tier_name: str, feature_name: str) -> bool:
    """Check if a tier has access to a feature."""
    features = get_tier_features(tier_name)
    value = features.get(feature_name)

    # Handle boolean features
    if isinstance(value, bool):
        return value

    # Handle numeric limits (-1 = unlimited, 0 = disabled)
    if isinstance(value, int):
        return value != 0

    return bool(value)


def get_tier_limit(tier_name: str, limit_name: str) -> int:
    """Get a numeric limit for a tier."""
    features = get_tier_features(tier_name)
    value = features.get(limit_name, 0)

    if not isinstance(value, int):
        return 0
    return value


# Feature descriptions for UI
FEATURE_DESCRIPTIONS = {
    "max_mautic_instances": "Number of Mautic CRM instances you can connect",
    "max_contacts": "Maximum contacts across all connected Mautic instances",
    "max_users": "Team members who can access the platform",
    "max_sub_organizations": "Client sub-accounts you can manage",
    "ai_insights_enabled": "Daily AI-powered dashboard with actionable insights",
    "lead_scoring_enabled": "Automatic lead scoring based on engagement",
    "voice_input_enabled": "Voice commands for hands-free CRM interaction",
    "white_label_enabled": "Custom branding with your logo and colors",
    "rebilling_enabled": "Charge clients with markup on AI usage",
    "monthly_ai_credits": "Monthly AI credit allocation for operations",
}
