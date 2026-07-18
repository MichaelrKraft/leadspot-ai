"""
LeadSpot.ai Configuration Module
"""

from app.config.settings import settings
from app.config.subscription_tiers import (
    FEATURE_DESCRIPTIONS,
    SUBSCRIPTION_TIERS,
    can_access_feature,
    get_tier_features,
    get_tier_limit,
    get_tier_price,
)

__all__ = [
    "FEATURE_DESCRIPTIONS",
    "SUBSCRIPTION_TIERS",
    "can_access_feature",
    "get_tier_features",
    "get_tier_limit",
    "get_tier_price",
    "settings",
]
