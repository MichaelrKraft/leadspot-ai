# LeadSpot.ai - Session Handoff Document

**Date:** December 24, 2025
**Purpose:** Comprehensive handoff for next Claude Code agent
**Project:** LeadSpot.ai - AI Agent Command Center for Mautic CRM

---

## 1. PROJECT OVERVIEW

**LeadSpot.ai** is an autonomous AI agent platform embedded in Mautic CRM. Users interact via natural language to execute marketing tasks - not just chat, but actual CRM operations.

**Two AI Systems:**
1. **Chat Command Center** - Natural language CRM control (Mautic plugin) ✅ BUILT
2. **Voice AI Agents** - Phone-based lead qualification (separate agent building)

**Architecture:** The AI plugin lives INSIDE Mautic. Users never leave their CRM.

---

## 2. CURRENT STATE (What's Done)

### Backend (FastAPI) - COMPLETE ✅
**Location:** `/Users/michaelkraft/leadspot-ai/backend/`

| Component | File | Status |
|-----------|------|--------|
| Chat endpoint | `app/routers/chat.py` | ✅ Working |
| Claude tool calling | `app/routers/chat.py` | ✅ 14 tools |
| Mautic OAuth | `app/routers/settings.py` | ✅ Full flow |
| MauticClient | `app/services/mautic_client.py` | ✅ Token refresh |
| Mautic tools | `app/services/mautic_tools.py` | ✅ Read + Write |

**Backend is deployed and running on production server.**

### Mautic Tools Implemented (14 total):
**Read tools:**
- `get_contacts` - List/search contacts
- `get_contact` - Get single contact details
- `get_emails` - List email templates
- `get_campaigns` - List campaigns
- `get_segments` - List segments
- `get_summary_stats` - CRM overview stats

**Write tools:**
- `create_contact` - Create new contact
- `update_contact` - Update contact fields
- `add_tag` - Add tag to contact
- `remove_tag` - Remove tag from contact
- `add_note` - Add note to contact timeline
- `create_email` - Create email template
- `send_email` - Send email to contact
- `add_to_segment` - Add contact to segment
- `add_to_campaign` - Add contact to campaign

### Plugin UI - COMPLETE ✅
**Location:** `/Users/michaelkraft/leadspot-ai/mautic-plugin/preview.html`

**Design:**
- Modern pastel periwinkle/lavender color scheme
- CSS variables for theming:
  - `--ls-primary: #818cf8` (periwinkle)
  - `--ls-secondary: #a5b4fc` (lighter lavender)
  - `--ls-accent: #c7d2fe` (lightest)
- Light/dark theme toggle
- Sidebar with navigation (Dashboard, Contacts, Campaigns, Emails, Analytics)
- Chat interface with:
  - Welcome message and suggestion buttons
  - User/agent message bubbles
  - Input field with send button
  - Setup CTA for non-connected state

**Note:** `preview.html` is the LOCAL preview file. Production uses `index.html.twig` (Twig template).

### Mautic OAuth - WORKING ✅
**Flow:**
1. Plugin sends credentials to `/api/settings/plugin/mautic/setup`
2. Backend stores credentials, returns authorization URL
3. User authorizes in Mautic
4. Callback at `/api/settings/mautic/callback` exchanges code for tokens
5. Tokens stored in organization, redirects to plugin with `?connected=true`

---

## 3. PENDING TASKS (What Needs to Be Done)

### Immediate (Alpha Launch)
1. **Sync preview.html to index.html.twig**
   - Copy the design/styles from preview.html
   - Convert to Twig template syntax
   - Keep PHP/Twig variables for dynamic content

2. **Deploy plugin to production Mautic**
   - Location: reddride.ploink.site
   - Clear Mautic cache after deployment

3. **End-to-end testing**
   - OAuth flow completes
   - Chat sends messages to backend
   - Claude uses tools correctly
   - Results display in UI

### Nice-to-Have for Alpha
- Loading states for chat responses
- Error handling and display
- Conversation history persistence (currently stateless)

---

## 4. WHITE-LABEL ARCHITECTURE (Planned)

### Multi-Tier Structure
```
LeadSpot.ai (Platform Owner)
    │
    ├── Agency A ($199/mo)
    │   ├── White-labels as "AgencyAI"
    │   ├── Custom domain: crm.agencya.com
    │   ├── Custom branding (logo, colors)
    │   │
    │   ├── SMB Client 1 (Agency's customer)
    │   ├── SMB Client 2
    │   └── SMB Client 3
    │
    ├── Agency B
    │   └── White-labels as "LeadBot Pro"
    │
    └── Direct SMB (Uses LeadSpot branding)
```

### Database Schema Changes Needed
```sql
-- Extend organizations table
ALTER TABLE organizations ADD COLUMN parent_organization_id UUID REFERENCES organizations(organization_id);
ALTER TABLE organizations ADD COLUMN organization_type VARCHAR(50); -- 'platform', 'agency', 'client'
ALTER TABLE organizations ADD COLUMN custom_domain VARCHAR(255);
ALTER TABLE organizations ADD COLUMN branding JSONB DEFAULT '{
    "app_name": "LeadSpot.ai",
    "logo_url": null,
    "primary_color": "#818cf8",
    "secondary_color": "#a5b4fc",
    "accent_color": "#c7d2fe"
}';
ALTER TABLE organizations ADD COLUMN features JSONB DEFAULT '{
    "white_label_enabled": false,
    "voice_agents_enabled": false,
    "max_sub_organizations": 0,
    "max_contacts": 10000
}';
ALTER TABLE organizations ADD COLUMN wallet_balance DECIMAL(10,2) DEFAULT 0;

-- Voice agents table
CREATE TABLE voice_agents (
    agent_id UUID PRIMARY KEY,
    organization_id UUID REFERENCES organizations(organization_id),
    name VARCHAR(255) NOT NULL,
    phone_number VARCHAR(20),
    voice_id VARCHAR(100),
    system_prompt TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Call history for billing
CREATE TABLE call_history (
    call_id UUID PRIMARY KEY,
    agent_id UUID REFERENCES voice_agents(agent_id),
    organization_id UUID REFERENCES organizations(organization_id),
    caller_phone VARCHAR(20),
    duration_seconds INTEGER,
    transcript TEXT,
    lead_qualified BOOLEAN,
    mautic_contact_id INTEGER,
    cost_cents INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### Subscription Tiers
| Tier | Price | White-Label | Sub-Orgs | Voice Agents | Contacts |
|------|-------|-------------|----------|--------------|----------|
| Starter | $29/mo | ❌ | 0 | 0 | 5,000 |
| Pro | $79/mo | ❌ | 0 | 2 | 25,000 |
| Agency | $199/mo | ✅ Custom branding | 10 | 5 | 100,000 |
| Enterprise | $499+/mo | ✅ Full + domain | Unlimited | 25 | Unlimited |

### Implementation Components

**BrandingService** (`backend/app/services/branding_service.py`):
```python
class BrandingService:
    async def get_branding(self, org_id: str) -> BrandingConfig:
        org = await self.get_org(org_id)

        # Use org's branding if set
        if org.branding.get("logo_url"):
            return BrandingConfig(**org.branding)

        # Inherit from parent (agency)
        if org.parent_organization_id:
            parent = await self.get_org(org.parent_organization_id)
            return BrandingConfig(**parent.branding)

        # Default LeadSpot branding
        return BrandingConfig.default()
```

**Plugin Branding Injection** (in Twig):
```twig
<style>
:root {
    --ls-primary: {{ branding.primary_color }};
    --ls-secondary: {{ branding.secondary_color }};
    --ls-accent: {{ branding.accent_color }};
}
</style>

{% if branding.logo_url %}
    <img src="{{ branding.logo_url }}" class="ls-logo">
{% else %}
    <span class="ls-brand">{{ branding.app_name }}</span>
{% endif %}
```

---

## 5. BREAKCOLD-INSPIRED FEATURES (Core Features, Not Post-MVP)

User explicitly requested these be core features, inspired by Breakcold CRM.

### Priority 1: Daily AI Dashboard
**"Here's what needs attention today"**

```
┌────────────────────────────────────────────────────────────┐
│  Good morning! Here's your daily briefing:                 │
├────────────────────────────────────────────────────────────┤
│  🔥 HOT LEADS (3)                                          │
│  • Sarah Johnson visited pricing 4x this week              │
│  • Mike Chen opened your proposal 3 times                  │
│                                                            │
│  📧 FOLLOW-UPS DUE (5)                                     │
│  • 2 proposals sent 3 days ago - no response               │
│                                                            │
│  📊 CAMPAIGN INSIGHTS                                      │
│  • "Holiday Sale" email: 34% open rate (↑12%)              │
│                                                            │
│  [Take Action] [View All]                                  │
└────────────────────────────────────────────────────────────┘
```

**Implementation:** `backend/app/services/daily_insights.py`
- Fetch hot leads (3+ page visits, multiple email opens, pricing page visits)
- Find overdue follow-ups (proposals with no response)
- Analyze campaign performance
- Use Claude to synthesize human-readable insights

### Priority 2: Auto-Lead Scoring
**AI automatically scores and tags leads based on behavior**

```python
SCORING_SIGNALS = {
    "pricing_page_visit": 15,
    "demo_page_visit": 20,
    "email_open": 2,
    "email_click": 5,
    "form_submission": 25,
    "return_visit": 8,
}

# Auto-tag based on score
if score >= 50: add_tag("hot-lead")
elif score >= 25: add_tag("warm-lead")
else: add_tag("cold-lead")
```

### Priority 3: Contact Enrichment
- Auto-deduplicate contacts on import/sync
- Extract info from email signatures (name, title, company, phone)
- Smart merge suggestions for duplicates
- Data validation and cleanup

### Priority 4: Voice Input for Commands
Add microphone button to chat interface using Web Speech API:
```typescript
const recognition = new webkitSpeechRecognition();
recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    sendMessage(transcript);
};
```

---

## 6. VOICE AI AGENTS (Separate Agent Building)

**Purpose:** AI phone agents for lead qualification, appointment booking, Mautic sync, SMS follow-up

### Architecture
```
Caller → Twilio Phone → SIP Trunk → LiveKit Cloud → Python Agent
                                          ↓
                             Deepgram STT → GPT-4 → ElevenLabs TTS
                                          ↓
                             Actions: Book appointment, Save to Mautic, Send SMS
```

### Tech Stack
| Layer | Technology |
|-------|------------|
| Phone Numbers | Twilio |
| Voice Infrastructure | LiveKit Cloud |
| Speech-to-Text | Deepgram (nova-2) |
| Brain/LLM | OpenAI GPT-4 |
| Text-to-Speech | ElevenLabs |
| Agent Runtime | Python (LiveKit Agents SDK) |

### Billing Model
- Cost to run: ~$0.08-0.12/minute
- Price to customer: $0.15-0.20/minute
- Wallet-based: Users pre-load balance, calls deduct

### Integration with Chat
- Voice agent qualifies lead → saves to Mautic with tags
- Chat can query: "Show me leads qualified by voice agent today"
- Both use same organization credentials

**Status:** Another agent is debugging Twilio → LiveKit SIP connection (404 error)

---

## 7. KEY FILES & LOCATIONS

### Backend
```
/Users/michaelkraft/leadspot-ai/backend/
├── app/
│   ├── routers/
│   │   ├── chat.py              # Main chat endpoint with Claude tool calling
│   │   └── settings.py          # Mautic OAuth endpoints
│   ├── services/
│   │   ├── mautic_client.py     # MauticClient with token management
│   │   └── mautic_tools.py      # 14 Mautic tools definitions
│   ├── models/
│   │   └── organization.py      # Organization model (needs white-label fields)
│   └── config.py                # Settings (API_BASE_URL, etc.)
```

### Mautic Plugin
```
/Users/michaelkraft/leadspot-ai/mautic-plugin/
├── preview.html                  # Local preview (CURRENT DESIGN)
├── index.html.twig              # Production Twig template (NEEDS UPDATE)
└── LeadSpotBundle/              # PHP plugin structure
    ├── LeadSpotBundle.php
    ├── Config/config.php
    ├── Controller/CommandCenterController.php
    └── Views/CommandCenter/index.html.twig
```

### Plan File
```
/Users/michaelkraft/.claude/plans/imperative-forging-quill.md
```

---

## 8. UI COLOR SCHEME

The UI was redesigned from teal to pastel periwinkle/lavender per user request.

### CSS Variables (in preview.html)
```css
:root, [data-theme="light"] {
    --ls-primary: #818cf8;           /* Periwinkle */
    --ls-primary-hover: #a5b4fc;     /* Lighter periwinkle */
    --ls-gradient: linear-gradient(135deg, #818cf8 0%, #a5b4fc 50%, #c7d2fe 100%);
    --ls-accent: #a5b4fc;
    --ls-bg: #fafafa;
    --ls-surface: #ffffff;
    --ls-text: #1f2937;
    --ls-text-secondary: #6b7280;
    --ls-border: #e5e7eb;
}

[data-theme="dark"] {
    --ls-primary: #a5b4fc;
    --ls-primary-hover: #c7d2fe;
    --ls-accent: #c7d2fe;
    --ls-bg: #111827;
    --ls-surface: #1f2937;
    --ls-text: #f9fafb;
    --ls-text-secondary: #9ca3af;
    --ls-border: #374151;
}
```

### Key UI Elements Using Colors
- Welcome badge: `background: var(--ls-gradient)`
- Suggestion buttons hover: `color: #6366f1; border-color: #818cf8`
- Input focus: `border-color: #818cf8; box-shadow with #818cf8`
- Send button hover: `background: #6366f1`
- Agent bubble border: `border: 1px solid var(--ls-accent)`
- Sidebar active item: `color: #6366f1; border-left: 3px solid #818cf8`

---

## 9. IMPLEMENTATION ROADMAP

### Phase 1: Alpha Launch (Immediate)
- [ ] Sync preview.html → index.html.twig
- [ ] Deploy to production Mautic
- [ ] End-to-end testing
- [ ] Basic documentation

### Phase 2: Core Features (Next 2 Weeks)
- [ ] Daily AI Dashboard
- [ ] Auto-Lead Scoring
- [ ] Conversation history persistence
- [ ] Voice input for commands

### Phase 3: White-Label (Following 2 Weeks)
- [ ] Database schema updates
- [ ] BrandingService implementation
- [ ] Multi-tenant middleware
- [ ] Subscription tier enforcement
- [ ] Admin panel for agencies

### Phase 4: Advanced Features
- [ ] Contact Enrichment
- [ ] Voice AI Agent integration
- [ ] Scheduled AI tasks
- [ ] Stripe billing integration

---

## 10. IMPORTANT CONTEXT FOR NEXT AGENT

1. **preview.html is the source of truth for UI design** - It has the latest pastel periwinkle colors and all UI elements working

2. **index.html.twig needs to be updated** - It's the production Twig template that Mautic serves. Must sync from preview.html

3. **Backend is working and deployed** - Don't rebuild it. Focus on plugin deployment and new features

4. **White-label and Breakcold features are CORE features** - Not post-MVP. User explicitly requested they be prioritized

5. **Voice AI is handled by separate agent** - Don't work on Twilio/LiveKit unless asked. Focus on chat/white-label

6. **BYOK model** - Users bring their own Anthropic API key. Platform doesn't pay for API calls

7. **User wants simplicity** - Small, focused changes. No massive rewrites.

---

## 11. SESSION HISTORY SUMMARY

This session continued from a previous context. Key activities:

1. **UI Color Redesign** - Changed from teal to pastel periwinkle (#818cf8, #a5b4fc, #c7d2fe)

2. **Alpha Launch Discussion** - User asked what's needed for launch. Identified: sync preview→twig, deploy, test

3. **Voice AI Context** - User informed about Voice AI agents being built separately (Twilio → LiveKit → Python)

4. **White-Label Architecture** - User asked if plan existed. I drafted full multi-tier architecture with database schema, subscription tiers, branding service

5. **Breakcold Features** - User asked if implemented. Confirmed NOT implemented. User requested they be included as CORE features (Daily Dashboard, Auto-Lead Scoring, Contact Enrichment, Voice Input)

6. **Plan File Rewrite** - Created fresh, focused plan at `/Users/michaelkraft/.claude/plans/imperative-forging-quill.md`

---

---

## 12. CRITICAL MISSING DETAILS

### Environment Configuration

**Production Mautic URL:** `https://reddride.ploink.site`

**Backend .env file exists at:** `/Users/michaelkraft/leadspot-ai/backend/.env`

**Key environment variables:**
```
DATABASE_URL=sqlite+aiosqlite:///./leadspot.db  # SQLite for local dev
SYNTHESIS_MODEL=claude-sonnet-4-20250514        # Claude model for chat
API_BASE_URL=http://localhost:8000              # Backend URL
MAUTIC_URL=https://reddride.ploink.site         # Production Mautic
CORS_ORIGINS includes reddride.ploink.site      # CORS configured for production
```

**API Keys are set** - Anthropic, OpenAI, Google OAuth, JWT_SECRET all configured in .env

### API Endpoints

**Chat endpoints:**
- `POST /api/chat` - Main chat endpoint with Claude tool calling
- `GET /api/chat/status` - Check if AI is configured
- `GET /api/chat/tools` - List available Mautic tools

**Settings/OAuth endpoints:**
- `GET /api/settings/api-keys` - Get API key status
- `POST /api/settings/api-keys` - Update Anthropic API key
- `GET /api/settings/mautic` - Get Mautic connection status
- `POST /api/settings/plugin/mautic/setup` - Start OAuth from plugin (no auth required)
- `GET /api/settings/mautic/callback` - OAuth callback handler
- `GET /api/settings/plugin/mautic/status` - Check connection status by URL

### Claude System Prompt (Verbatim)

The system prompt tells Claude it's "LeadSpot AI, an autonomous marketing agent embedded in Mautic CRM." Key instructions:

1. **Use tools proactively** - When users ask about contacts/emails/campaigns, use the appropriate tool
2. **Be helpful and concise** - Summarize data clearly, don't dump raw JSON
3. **Confirm before destructive actions** - Before sending emails or bulk changes
4. **Handle errors gracefully** - Explain what happened and suggest alternatives
5. **Use emojis sparingly** - ✅ success, ❌ errors, 📧 emails, 👥 contacts

Example mappings:
- "Show me my top contacts" → `get_contacts` with `order_by="points"`
- "Find contacts from Acme Corp" → `get_contacts` with `search="company:Acme Corp"`
- "Tag John Smith as a hot lead" → First search, then `add_tag`
- "What's my CRM overview?" → `get_summary_stats`

### How to Run Locally

**Backend:**
```bash
cd /Users/michaelkraft/leadspot-ai/backend
source venv/bin/activate  # if using virtualenv
uvicorn app.main:app --reload --port 8000
```

**Preview Plugin UI:**
```bash
# Just open in browser:
open /Users/michaelkraft/leadspot-ai/mautic-plugin/preview.html
```

### How to Create Mautic API Credentials

1. Go to Mautic → Settings → API Credentials
2. Click "New" to create OAuth2 credentials
3. Set redirect URI to: `{API_BASE_URL}/api/settings/mautic/callback`
4. Copy Client ID and Client Secret
5. Enter in plugin setup form

### Database Schema (Current)

Using SQLite locally. The `organizations` table has these Mautic-related fields:
- `mautic_url` - The Mautic instance URL
- `mautic_client_id` - OAuth client ID
- `mautic_client_secret` - OAuth client secret
- `mautic_access_token` - Current access token
- `mautic_refresh_token` - Refresh token
- `mautic_token_expires_at` - Token expiration timestamp

### Plugin JavaScript (How It Talks to Backend)

In preview.html, the chat form calls:
```javascript
const response = await fetch(`${API_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        message: userMessage,
        mautic_url: mauticUrl,
        organization_id: organizationId,
        enable_tools: true
    })
});
```

The response includes:
- `response` - Claude's text response
- `tools_used` - Array of tool names that were called
- `tool_results` - Array of tool execution results
- `status` - "success" or "error"

### Tool Loop Architecture

The chat endpoint uses an iterative tool loop (max 10 iterations):
1. Send user message + tools to Claude
2. If Claude returns `tool_use`, execute each tool
3. Send tool results back to Claude
4. Repeat until Claude returns `end_turn` with final response
5. Return response with list of tools used

---

## 13. THINGS TO WATCH OUT FOR

1. **OAuth callback URL must match** - The redirect URI in Mautic API credentials must exactly match `{API_BASE_URL}/api/settings/mautic/callback`

2. **Token refresh** - MauticClient automatically refreshes tokens, but check `mautic_token_expires_at` if calls start failing

3. **CORS** - If plugin can't reach backend, check CORS_ORIGINS in .env includes the Mautic domain

4. **preview.html vs index.html.twig** - preview.html is standalone HTML. index.html.twig uses Twig syntax (`{{ variable }}`) and gets data from PHP controller

5. **SQLite database** - Local dev uses `leadspot.db` in backend folder. For production, need PostgreSQL

6. **API keys in .env** - Real keys are stored there. Don't commit to git. Production should use environment variables

---

*End of handoff document*
*Created: December 24, 2025*
