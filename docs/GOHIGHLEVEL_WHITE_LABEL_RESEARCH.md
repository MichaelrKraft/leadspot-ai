# GoHighLevel White-Label Model Research

**Research Date:** December 24, 2025
**Purpose:** Inform LeadSpot.ai white-label architecture

---

## Executive Summary

GoHighLevel's white-label model is built around a **two-level hierarchy** (Agency → Sub-Accounts) with three key components:

1. **SaaS Configurator** - Create custom subscription tiers with feature toggles
2. **Wallet/Rebilling System** - Usage-based billing with markup capabilities
3. **Complete Branding Control** - Logo, colors, domains, mobile apps

---

## 1. Account Hierarchy Structure

### Two-Level Model (Not Multi-Level)
```
Agency Account (Owner)
├── Sub-Account 1 (Client)
├── Sub-Account 2 (Client)
├── Sub-Account 3 (Client)
└── Snapshot Account (Template)
```

**Key Insight:** Sub-accounts CANNOT create their own sub-accounts. The hierarchy is flat - one agency manages many clients. This simplifies billing and permissions significantly.

### Sub-Account Types
| Type | Purpose |
|------|---------|
| Agency | Agency's own business operations |
| Client | Client's business (most common) |
| Snapshot | Reusable templates for new accounts |
| Test | Testing configurations |

---

## 2. Pricing Plans & Feature Gating

### GoHighLevel's Three Tiers

| Plan | Price | Sub-Accounts | White-Label | SaaS Mode |
|------|-------|--------------|-------------|-----------|
| Starter | $97/mo | 3 | Desktop only | No |
| Unlimited | $297/mo | Unlimited | Desktop + API | No |
| SaaS Pro | $497/mo | Unlimited | Full + Mobile | Yes |

### What Each Plan Unlocks
- **$97**: Basic CRM, funnels, calendars, 3 sub-accounts
- **$297**: Unlimited sub-accounts, white-label desktop, API access
- **$497**: SaaS Mode, rebilling with markup, white-label mobile app

### LeadSpot.ai Equivalent

| LeadSpot Tier | Price | Features |
|---------------|-------|----------|
| Pilot | $49/mo | 1 Mautic instance, basic AI chat |
| Pro | $149/mo | Unlimited Mautic, white-label branding |
| Agency | $297/mo | Sub-accounts, SaaS mode, rebilling |

---

## 3. SaaS Configurator

The SaaS Configurator is the core of GoHighLevel's reselling model. It allows agencies to:

### Create Custom Plans
1. Define plan name and description
2. Set monthly/annual pricing
3. Toggle features on/off per plan
4. Set usage limits (contacts, users, etc.)
5. Link to Stripe product for billing

### Feature Toggles
Each plan can enable/disable:
- Funnels/Websites
- Calendars
- Workflows/Automation
- Email marketing
- SMS marketing
- Reputation management
- AI features
- Reporting

### Automatic Provisioning
When a client signs up:
1. Stripe charges their card
2. Sub-account is auto-created
3. Features are enabled based on plan
4. Snapshot (template) is applied
5. User receives login credentials

---

## 4. Wallet & Rebilling System

### Agency Wallet
- Holds credits for usage-based services
- Auto-recharge when balance drops below threshold
- Smart adjustment increases recharge amount based on usage patterns

### How Rebilling Works
```
Client sends SMS →
  Twilio charges Agency Wallet $0.01 →
    Agency charges Client Wallet $0.05 (5x markup) →
      Agency keeps $0.04 profit
```

### Markup Slider
- 1x to 10x markup on services
- Only available on $497 plan
- Services eligible: SMS, calls, email, AI, domains

### Auto-Recharge Settings
| Setting | Description |
|---------|-------------|
| Recharge Amount | How much to add ($25, $50, $100, etc.) |
| Threshold | When to trigger (balance falls below $X) |
| Smart Adjustment | Auto-increase based on usage patterns |
| Retry Attempts | 7 days max for failed payments |

---

## 5. Branding Customization

### Desktop App Branding
- Company logo
- Primary/secondary/accent colors
- Light and dark theme
- Custom favicon
- Custom domain (app.yourbrand.com)

### Mobile App Branding
- App icon and splash screen
- Custom colors and fonts (5 font choices)
- Module visibility toggles
- Module ordering (drag-and-drop)
- Published under agency's name in App Store/Play Store

### What's Customizable
| Element | Desktop | Mobile |
|---------|---------|--------|
| Logo | ✅ | ✅ |
| Colors | ✅ | ✅ |
| Fonts | Limited | 5 options |
| Custom Domain | ✅ | N/A |
| Module Toggle | Via permissions | ✅ |
| App Store Listing | N/A | ✅ |

---

## 6. Snapshots (Account Templates)

### What's Included
- Funnels and landing pages
- Forms and surveys
- Workflows/automations
- Calendars
- Custom values
- Message templates
- Settings

### What's NOT Included
- Contacts and conversations
- Appointment history
- Reputation management data
- External API keys (Stripe, Twilio, etc.)
- Facebook/Google integrations

### Usage
- Unlimited uses per snapshot
- Can apply one snapshot on account creation
- Can add more snapshots to existing accounts
- Only Agency Admins can create/apply snapshots

---

## 7. Permissions Model

### Two Permission Levels

1. **Sub-Account Level** (set by SaaS plan)
   - Determines what features the account CAN access
   - Set in SaaS Configurator

2. **User Level** (set by account admin)
   - Determines what the specific user CAN access
   - Cannot exceed sub-account level permissions

### Permission Rule
```
User Permission ≤ Sub-Account Permission
```

### User Roles
| Role | Access |
|------|--------|
| Admin | Full access to all enabled features |
| User | Limited access based on granular toggles |

---

## 8. Implementation Recommendations for LeadSpot.ai

### Adopt from GoHighLevel
1. **Two-level hierarchy** - Keep it simple (Agency → Clients)
2. **Feature toggles per tier** - Enable/disable features by subscription
3. **Wallet system** - Usage-based billing for AI tokens
4. **Auto-recharge** - Keep service running smoothly
5. **Branding inheritance** - Client inherits agency branding if not customized
6. **Snapshots** - Save Mautic configurations as reusable templates

### Customize for LeadSpot.ai
1. **AI Token Wallet** instead of SMS credits
2. **Mautic Instance Templates** instead of funnel snapshots
3. **Claude Tool Permissions** per plan tier
4. **No mobile app** initially (focus on plugin)

### Proposed LeadSpot.ai Hierarchy
```
Platform (LeadSpot.ai)
├── Agency 1 (White-label partner)
│   ├── Client 1A (Agency's customer)
│   ├── Client 1B
│   └── Client 1C
├── Agency 2
│   └── Client 2A
└── Direct Client (No agency)
```

---

## 9. Database Schema Updates

Based on this research, the Organization model should include:

```python
# Hierarchy
parent_organization_id: FK to parent org (null for platform/direct)
organization_type: 'platform' | 'agency' | 'client'

# Branding (inherited from parent if not set)
branding: JSON {
    app_name, logo_url, favicon_url,
    primary_color, secondary_color, accent_color,
    custom_domain
}

# Feature Flags (controlled by subscription tier)
features: JSON {
    ai_insights_enabled, lead_scoring_enabled,
    voice_input_enabled, max_contacts, max_users,
    white_label_enabled, max_sub_organizations
}

# Wallet/Billing
wallet_balance: Decimal
stripe_customer_id: String
subscription_tier: 'pilot' | 'pro' | 'agency'
subscription_status: 'active' | 'past_due' | 'canceled'

# Auto-recharge settings
wallet_auto_recharge: Boolean
wallet_recharge_amount: Decimal
wallet_recharge_threshold: Decimal
```

---

## Sources

- [SaaS Mode - Full Setup Guide](https://help.gohighlevel.com/support/solutions/articles/48001184920-saas-mode-full-setup-guide-faq)
- [HighLevel Pricing Guide](https://help.gohighlevel.com/support/solutions/articles/155000001156-highlevel-pricing-guide)
- [Rebilling, Reselling, and Wallets Explained](https://help.gohighlevel.com/support/solutions/articles/155000002095-rebilling-reselling-and-wallets-explained)
- [SaaS Wallet Credit Management](https://help.gohighlevel.com/support/solutions/articles/48001207115-saas-wallet-credit-management)
- [Snapshots Overview](https://help.gohighlevel.com/support/solutions/articles/48000982511-snapshots-overview)
- [Sub-Account User Roles & Permissions](https://help.gohighlevel.com/support/solutions/articles/155000002544-sub-account-managing-user-roles-permissions)
- [GoHighLevel White Label Mobile App](https://www.gohighlevel.com/white-label-mobile-app)
- [GoHighLevel SaaS Mode 2025 Guide](https://ghl-services-playbooks-automation-crm-marketing.ghost.io/gohighlevel-saas-mode-white-label-growth-the-complete-agency-pillar-guide/)

---

*Research compiled for LeadSpot.ai white-label implementation*
