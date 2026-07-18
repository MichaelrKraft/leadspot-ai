# LeadSpot.ai - AI Agent Command Center for CRM

## ⚠️ CRITICAL: Agent Orientation (Read First)

**This is LeadSpot CRM** — GitHub: `MichaelrKraft/leadspot-ai.git`
**Local path**: `/Users/michaelkraft/leadspot/`

### Directory Confusion Warning
`/Users/michaelkraft/leadspot-ai/` has been renamed to `coder1-ide-clone-stale/`.
That directory is the **Coder1 IDE**, NOT LeadSpot. Do not confuse them.
The only correct LeadSpot directory is `/Users/michaelkraft/leadspot/`.

### Architecture: 3 Independent Services
| Service | Directory | Port | Database |
|---------|-----------|------|----------|
| Backend | `backend/` | 8000 | SQLite (dev) → PostgreSQL (prod) |
| Frontend | `frontend/` | 3006 | — |
| Agent-service | `agent-service/` | 3008 | Per-org SQLite at `data/orgs/{orgId}/agent.db` |

### The One Critical Code Gap
Email sending is stubbed at: `agent-service/src/action-plans/index.ts` ~line 366
```typescript
// TODO: Send email via email service (Mailgun, SendGrid, etc.)
```
This is the primary blocker for beta launch. All other email infrastructure exists.

### Production Database Requirements
Local dev uses SQLite. Production MUST use PostgreSQL. Before any migration work:
```bash
# Change in backend/.env:
DATABASE_URL=postgresql+asyncpg://user:pass@host/leadspot
# Then run:
cd backend && alembic upgrade head
```

### Internal API Bridge (Agent-service → Backend)
Agent-service (TypeScript) and backend (Python) have separate databases.
After sending an email, agent-service must POST to backend to record it:
`POST http://localhost:8000/api/emails/record-send`

### Suppression List
Table: `email_suppressions` in PostgreSQL
Check before every send: `GET /api/suppressions/{email}`

### Alembic Migration Safety
Every migration MUST have a `downgrade()` function. To rollback:
```bash
cd backend && alembic downgrade -1
```

### SQLite Backup
Per-org agent.db files at `agent-service/data/orgs/{orgId}/agent.db` must be backed up nightly.

### Sending Domain
[Fill in after DNS setup — SPF/DKIM/DMARC required before any bulk send]

---

## Project Overview

LeadSpot is an AI-first CRM that combines Mautic's marketing automation with autonomous AI agents. Unlike traditional CRMs that require manual input, LeadSpot's AI agents proactively manage leads, make calls, send follow-ups, and book appointments.

**Target Market:** Small businesses, agencies, solopreneurs, developers, vibe coders

**Monetization:** Freemium with prepaid voice minutes ($0.10/min)

## Architecture

```
~/leadspot/
├── backend/           # FastAPI + 14 Mautic tools + Claude integration
├── frontend/          # Next.js 14 dashboard (port 3006)
├── dashboard/         # Voice AI billing dashboard
├── mautic-plugin/     # Chat command center embedded in Mautic
├── voice-agent/       # Autonomous voice AI (Deepgram/GPT-4/ElevenLabs)
├── database/          # PostgreSQL schemas
├── scripts/           # Server provisioning
└── docs/              # Documentation
```

## Component Details

### Backend (FastAPI) - COMPLETE
- **14 Mautic Tools:** CRUD for contacts, emails, campaigns, segments
- **Chat Endpoint:** `/api/chat` with Claude integration
- **OAuth Flow:** Token refresh working
- **Production:** Deployed and running

### Voice AI Agent - COMPLETE
- **STT:** Deepgram nova-2
- **LLM:** GPT-4
- **TTS:** ElevenLabs (8 voices)
- **Actions:** book_appointment, qualify_lead, save_contact, send_sms
- **Calendar:** Google Calendar integration for booking

### Frontend Dashboard - IN PROGRESS
- **Framework:** Next.js 14 with App Router
- **Auth:** Email/password + OAuth (Google, Microsoft)
- **Pages:** Dashboard, Command Center, Contacts, Query, Documents, Settings, Admin
- **Missing:** Pipeline/Kanban, Calendar UI, Unified Inbox

### Mautic Plugin - COMPLETE
- **Chat UI:** Pastel periwinkle theme
- **Dark/Light Toggle:** CSS variables
- **Sidebar Nav:** Dashboard, Contacts, Campaigns, Emails, Analytics

### Billing System - COMPLETE
- **Model:** Prepaid wallet
- **Rate:** $0.10/min for voice
- **Stripe:** Integration working
- **Auto-pause:** Pauses on zero balance

## Development Commands

```bash
# Frontend (main dashboard)
cd frontend && npm run dev  # Port 3006

# Backend
cd backend && uvicorn main:app --reload  # Port 8000

# Voice Agent
cd voice-agent && npm run dev
```

## API Endpoints

### Backend
- `POST /api/chat` - Claude chat with Mautic tools
- `GET /api/contacts` - List contacts
- `POST /api/contacts` - Create contact
- `GET /api/campaigns` - List campaigns
- `POST /api/emails/send` - Send email

### Voice Agent
- `POST /api/agents` - Create voice agent
- `GET /api/calls` - List calls
- `POST /api/calls/initiate` - Start outbound call
- `GET /api/usage` - Get usage stats

## Environment Variables

```bash
# Backend
MAUTIC_BASE_URL=
MAUTIC_CLIENT_ID=
MAUTIC_CLIENT_SECRET=
ANTHROPIC_API_KEY=

# Voice Agent
DEEPGRAM_API_KEY=
OPENAI_API_KEY=
ELEVENLABS_API_KEY=
GOOGLE_CALENDAR_CREDENTIALS=

# Billing
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
```

## Current Sprint (Beta Blockers)

### P0 - Pipeline/Kanban View
- `frontend/app/(dashboard)/deals/page.tsx` - Kanban board
- `frontend/components/deals/PipelineKanban.tsx` - Drag-drop stages
- API routes for deal stages

### P0 - Calendar UI
- `frontend/app/(dashboard)/calendar/page.tsx` - Calendar view
- `frontend/components/calendar/AvailabilityEditor.tsx`
- Public booking page
- Connect to existing Google Calendar integration

### P1 - MCP Tools for CLI
- Set up MCP server in `/mcp/`
- Wrap 14 Mautic tools as MCP tools
- Add voice agent control tools
- Test with Claude Code CLI

### P1 - Unified Inbox
- Email conversations view
- SMS conversations view
- Chat history

## Code Style

- TypeScript strict mode
- Tailwind CSS for styling
- Dark mode support via CSS variables
- Component co-location with pages



## Session Learnings

- `services/sync/gmail_sync.py` (GmailSyncService/GmailConnector) was ALWAYS dead code — its import fails and is swallowed in `services/sync/__init__.py`; `tests/test_gmail_integration.py` fails for this reason, pre-existing. The working Gmail stack (2026-07-17) is `services/connectors/gmail.py` (GmailClient) + `services/sync/gmail_inbox_sync.py`; `outlook_sync.py` is the structural template for any new mailbox sync (it's the one with token refresh-on-expiry).
- Unified Inbox: email conversations are DERIVED from `email_messages` grouped by thread (conversation ids prefixed `em:` in `routers/conversations.py`); the `conversations`/`conversation_messages` tables only back SMS/manual compose. Don't add a second email store.
- Org BYOK Anthropic keys (`organization.anthropic_api_key`) are only wired into inference via `services/inference/llm_client.py` — anything calling Claude directly with `_get_api_key()` silently ignores the org's own key.

<!-- coder1-mem:start -->
<!-- Auto-updated by coder1-mem on 2026-07-17 — do not edit this block manually -->
## Recent Session Context

**Project:** leadspot | **Sessions:** 105 | **Last active:** 2min ago

Session topic: ...

<!-- coder1-mem:end -->
