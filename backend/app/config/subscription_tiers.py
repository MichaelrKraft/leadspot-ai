"""
LeadSpot.ai Subscription Tiers Configuration

Three tiers: Free, Pro ($39/mo, 5k contacts), Business ($79/mo, 25k contacts)
"""

from decimal import Decimal


# Subscription tier configuration
SUBSCRIPTION_TIERS = {
    "free": {
        "name": "Free",
        "description": "Get started with AI-powered CRM",
        "price_monthly": Decimal("0.00"),
        "stripe_price_id_monthly": None,
        "features": {
            "max_contacts": 100,
            "max_users": 1,
            "max_sub_organizations": 0,
            "ai_insights_enabled": False,
            "lead_scoring_enabled": False,
            "voice_input_enabled": False,
            "white_label_enabled": False,
        },
    },

    "pro": {
        "name": "Pro",
        "description": "For growing teams with advanced AI features",
        "price_monthly": Decimal("39.00"),
        "stripe_price_id_monthly": None,  # Set via STRIPE_PRICE_ID_PRO env var
        "features": {
            "max_contacts": 5000,
            "max_users": 5,
            "max_sub_organizations": 0,
            "ai_insights_enabled": True,
            "lead_scoring_enabled": True,
            "voice_input_enabled": False,
            "white_label_enabled": False,
        },
    },

    "business": {
        "name": "Business",
        "description": "For scaling businesses with full AI power",
        "price_monthly": Decimal("79.00"),
        "stripe_price_id_monthly": None,  # Set via STRIPE_PRICE_ID_BUSINESS env var
        "features": {
            "max_contacts": 25000,
            "max_users": 25,
            "max_sub_organizations": 5,
            "ai_insights_enabled": True,
            "lead_scoring_enabled": True,
            "voice_input_enabled": True,
            "white_label_enabled": True,
        },
    },

    # Legacy tiers kept for backward compatibility
    "pilot": {
        "name": "Pilot",
        "description": "Legacy pilot tier",
        "price_monthly": Decimal("49.00"),
        "stripe_price_id_monthly": None,
        "features": {
            "max_contacts": 10000,
            "max_users": 3,
            "max_sub_organizations": 0,
            "ai_insights_enabled": True,
            "lead_scoring_enabled": True,
            "voice_input_enabled": False,
            "white_label_enabled": False,
        },
    },

    "agency": {
        "name": "Agency",
        "description": "Full white-label SaaS with client management",
        "price_monthly": Decimal("297.00"),
        "stripe_price_id_monthly": None,
        "features": {
            "max_contacts": -1,  # Unlimited
            "max_users": -1,     # Unlimited
            "max_sub_organizations": -1,
            "ai_insights_enabled": True,
            "lead_scoring_enabled": True,
            "voice_input_enabled": True,
            "white_label_enabled": True,
        },
    },
}


def get_tier_features(tier_name: str) -> dict:
    """Get features for a subscription tier."""
    tier = SUBSCRIPTION_TIERS.get(tier_name)
    if not tier:
        return SUBSCRIPTION_TIERS["free"]["features"]
    return tier["features"]


def get_tier_price(tier_name: str, annual: bool = False) -> Decimal:
    """Get price for a subscription tier."""
    tier = SUBSCRIPTION_TIERS.get(tier_name)
    if not tier:
        return Decimal("0")
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
