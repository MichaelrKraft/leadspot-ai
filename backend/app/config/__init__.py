"""
LeadSpot.ai Configuration Module
"""

from app.config.settings import settings

from app.config.subscription_tiers import (
    SUBSCRIPTION_TIERS,
    get_tier_features,
    get_tier_price,
    can_access_feature,
    get_tier_limit,
    FEATURE_DESCRIPTIONS,
)

__all__ = [
    "settings",
    "SUBSCRIPTION_TIERS",
    "get_tier_features",
    "get_tier_price",
    "can_access_feature",
    "get_tier_limit",
    "FEATURE_DESCRIPTIONS",
]
