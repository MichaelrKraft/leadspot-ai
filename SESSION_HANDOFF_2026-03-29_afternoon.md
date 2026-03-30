# LeadSpot AI — Session Handoff (Afternoon)
**Date**: 2026-03-29 (afternoon session)
**Agent**: Claude Opus 4.6 (1M context)
**Previous session handoff**: `/Users/michaelkraft/leadspot/SESSION_HANDOFF_2026-03-29.md`

---

## What Was Done This Session (6 commits)

### Commit 1: `ea8f810` — Preserve overnight agent-service build (+11,096 lines)
- Committed 35 files of the overnight agent-service build that was uncommitted
- 23 TypeScript source files, 0 type errors, 55+ API routes

### Commit 2: `27142ab` — Wire orchestrator to SQLite persistence (+245/-71)
- Added 5 CRUD functions to `db/index.ts` (insertSuggestion, getSuggestions, updateSuggestionStatus, insertBrief, getLatestBrief)
- Replaced in-memory Maps in orchestrator with SQLite persistence
- Wired CronService initialization with orchestrator as job handler
- Connected 4 cron actions to existing module functions
- Fixed table name mismatches in context-builder (agent_suggestions→suggestions, contact_interactions→timeline_events)
- Added graceful shutdown (resetCronService + closeAll)

### Commit 3: `54de1b8` — Unify AI Command Center with agent memory (+128/-3)
- Added `GET /api/agent/context` endpoint to agent-service (org-level and contact-level context)
- Modified FastAPI `chat.py` to fetch agent context before calling Claude
- Injected agent memory into system prompt as "Agent Intelligence" section

### Commit 4: `30a08b3` — UI polish, community page, voice agent builder (+3,731/-157)
- Smart Lists: light theme (white cards on `#f8fafc` background)
- Command Center/Dashboard/Timeline: replaced all emojis with Lucide icons
- Contacts: added "Add Contact" button with modal form
- Campaigns: wired "New Campaign" button with modal form
- Community: replaced "Coming Soon" with full community page (8 posts, reactions, comments, sidebar)
- Voice Agents: fixed create bug, added multi-tab builder at `/voice-agents/new` with 3 RE templates

### Commit 5: `d365009` — Dark mode, inbox compose, voice agent configure (+433/-98)
- Added dark mode variants to Smart Lists + Community pages (6 files)
- Added Compose FAB to Inbox with email/SMS modal
- Voice Agent Configure button now opens full multi-tab editor at `/voice-agents/edit/[id]`

### Commit 6: `d5f07d9` — Backend fixes, model update, Mautic removal (+115/-21)
- Updated SYNTHESIS_MODEL from `claude-3-5-sonnet-20241022` to `claude-sonnet-4-6` (old model was deprecated, returned 404)
- Added ports 3003/3006 to CORS allowed origins
- Replaced JSONB with JSON in organization model for SQLite compatibility
- Added `from __future__ import annotations` to query.py for Python 3.14
- Removed all user-facing Mautic references from frontend and system prompt
- Wired "New Email" button with compose modal
- Added Compose button to Inbox page

---

## Current State of Each System

### Agent Service (port 3008) — NEEDS RESTART
- **Last working state**: Compiles clean, SQLite persistence working, context endpoint tested
- **Not currently running** (process exited during session)
- **Start**: `cd /Users/michaelkraft/leadspot/agent-service && ANTHROPIC_API_KEY=<key> npx tsx src/server.ts`

### FastAPI Backend (port 8000) — RUNNING (PID 87874)
- **Status**: Running with `claude-sonnet-4-6`, CORS fixed for port 3003/3006
- **DB**: SQLite tables created via async create_all (not alembic)
- **Dependencies installed to**: Python 3.14 at `/opt/homebrew/bin/python3` (NOT the system pip)
- **Critical**: Must use `python3 -m pip install --break-system-packages` for deps, NOT `pip install`
- **Start**: `cd /Users/michaelkraft/leadspot/backend && ANTHROPIC_API_KEY=<key> python3 -m uvicorn app.main:app --port 8000`

### Frontend (port 3003) — RUNNING
- **Status**: All pages functional, dev auth bypass active
- **Start**: `cd /Users/michaelkraft/leadspot/frontend && npm run dev`

---

## Known Issues the Next Agent Must Address

### 1. Settings page doesn't render
The `/settings` page imports `useAuthStore` and `useConnections` hook which likely fail because there's no real auth session in dev mode. The page needs either:
- A dev mode fallback (like AuthGuard has)
- Or the auth store needs to provide mock data in dev mode

**Files**: `frontend/app/(dashboard)/settings/page.tsx`, `frontend/stores/useAuthStore.ts`, `frontend/hooks/useIntegrations.ts`

### 2. All pages use demo data — not connected to real APIs
Every page (Dashboard, Contacts, Deals, Calendar, Inbox, Emails, Campaigns, Segments, Reports) uses hardcoded demo data. For beta:
- Contacts should sync from Mautic via the backend
- Dashboard stats should come from real CRM data
- Smart Lists should evaluate against real contacts (agent-service is ready for this)

### 3. Agent-service orchestrator TODOs still exist
The orchestrator has 5 stubbed cron actions: `follow_up_check`, `lead_score_decay`, `stalled_deal_alert`, `nurture_drip`, `weekly_report`. These need real Mautic contact data to implement.

### 4. Voice commands, action plan execution, lead routing are stubbed
These modules in the agent-service have the data model and API routes but their core functions (`executeVoiceCommand`, `processNextStep` for action plans) stub the actual CRM operations.

### 5. "demo-org" hardcoded in frontend
`frontend/lib/api/agent.ts` line 8: `const ORG_ID = 'demo-org'`. Must pull from auth context for multi-tenant.

### 6. No real authentication flow
The dev auth bypass skips everything. For beta, need:
- Real login/register flow connected to the FastAPI auth endpoints
- JWT token management
- Organization context from login

### 7. Frontend Mautic references remain in settings pages
The settings/integrations page and settings main page still reference "Mautic" extensively (admin-facing, not user-facing). Could be renamed to "CRM Connection" for consistency.

---

## Architecture (unchanged from previous handoff)

```
Frontend (Next.js, port 3003) → FastAPI Backend (port 8000) → Mautic CRM APIs
                                       ↓
                              Agent Service (port 3008) → SQLite per-org
                              (TypeScript sidecar, Claude Haiku for AI)
```

- Frontend talks to FastAPI for chat, auth, billing
- Frontend talks to agent-service directly for Smart Lists, briefs, queue, timeline
- FastAPI chat endpoint now fetches agent context from port 3008 before calling Claude
- Agent-service stores briefs, suggestions, facts in per-org SQLite

---

## How to Start Everything

```bash
# Terminal 1: Agent Service
cd /Users/michaelkraft/leadspot/agent-service
ANTHROPIC_API_KEY=<key> npx tsx src/server.ts
# Runs on port 3008

# Terminal 2: FastAPI Backend
cd /Users/michaelkraft/leadspot/backend
ANTHROPIC_API_KEY=<key> python3 -m uvicorn app.main:app --port 8000
# Note: use python3 -m uvicorn, NOT uvicorn directly

# Terminal 3: Frontend
cd /Users/michaelkraft/leadspot/frontend
npm run dev
# Usually port 3003 (check terminal output)

# Initialize demo data (if agent-service DB is fresh):
python3 -c "
import urllib.request, json
data = json.dumps({'organizationId': 'demo-org'}).encode()
for path in ['/api/agent/smart-lists/defaults', '/api/agent/action-plans/defaults', '/api/agent/ponds/defaults']:
    req = urllib.request.Request(f'http://localhost:3008{path}', data=data, headers={'Content-Type': 'application/json'})
    urllib.request.urlopen(req, timeout=5)
    print(f'OK: {path}')
"
```

---

## Key Files to Read First

1. `/Users/michaelkraft/leadspot/SESSION_HANDOFF_2026-03-29.md` — Original overnight handoff (architecture, gotchas)
2. This file — what changed in the afternoon session
3. `/Users/michaelkraft/leadspot/agent-service/src/orchestrator/index.ts` — Central brain (now with SQLite)
4. `/Users/michaelkraft/leadspot/backend/app/routers/chat.py` — Chat endpoint (now with agent context)
5. `/Users/michaelkraft/leadspot/frontend/app/(dashboard)/community/page.tsx` — New community page
6. `/Users/michaelkraft/leadspot/frontend/app/(dashboard)/voice-agents/new/page.tsx` — Voice agent builder

---

## Design Decisions Made This Session

1. **Unified chat + agent memory**: The chat endpoint fetches context from agent-service before calling Claude. Silent fallback if agent-service is down.
2. **Community with demo data**: Ported UI from dashboard app, using local state instead of Prisma DB. Ready for real DB later.
3. **Voice agent builder with templates**: Multi-tab builder with 3 RE templates (Buyer Qualifier, Listing Caller, Follow-up Agent). Config saved to localStorage.
4. **Light theme for Smart Lists + Community**: White cards on `#f8fafc` background with dark mode variants.
5. **Lucide icons everywhere**: Replaced all emojis across Dashboard, Timeline, Command Center with professional Lucide icons.
6. **No Mautic in UI**: System prompt and all user-facing text scrubbed of Mautic references.

---

## What's Needed for Beta (Priority Order)

### P0 — Must have
1. Fix Settings page (dev mode fallback for auth store)
2. Real authentication flow (login/register/JWT)
3. Connect contacts to real Mautic API (the backend has 14 tools ready)
4. Replace "demo-org" with real org from auth context

### P1 — Should have
5. Wire Dashboard stats to real data (via agent-service brief)
6. Wire Smart Lists to evaluate real contacts
7. Deploy to production (Render/Vercel/AWS)
8. Stripe billing integration (backend has it, frontend has settings page)

### P2 — Nice to have
9. Wire voice agent builder to actual voice-agent backend (Deepgram/ElevenLabs)
10. Community with real database (Prisma migration)
11. Inbox connected to real email/SMS APIs
12. Mobile-responsive polish

---

## Critical Gotchas the Next Agent MUST Know

### 1. Python pip installs to the WRONG Python
`which pip` → Python 3.9, but `which python3` → Python 3.14. All pip installs MUST use:
```bash
python3 -m pip install --break-system-packages <package>
```
NOT `pip install`. This burned 20 minutes in this session.

### 2. The backend SQLite DB is ephemeral
Tables were created via `python3 -c "... Base.metadata.create_all ..."` — NOT alembic migrations. If the DB file is deleted, you must re-run:
```bash
cd /Users/michaelkraft/leadspot/backend
python3 -c "
import asyncio
from app.database import engine, Base
from app.models import *
async def create():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print('Tables created')
asyncio.run(create())
"
```

### 3. The backend uses Python 3.14 — some packages have compatibility issues
- `JSONB` from `sqlalchemy.dialects.postgresql` doesn't work with SQLite → already fixed to use `JSON`
- `email-validator` needed explicit install with `--break-system-packages`
- `greenlet` needed explicit install for SQLAlchemy async
- Some schema files may need `from __future__ import annotations` if Pydantic fails on `str | None` syntax

### 4. CORS origins must include the frontend's actual port
Frontend often lands on port 3003 (not 3006) due to port conflicts. CORS is configured in TWO files:
- `backend/app/config/settings.py` line 38
- `backend/app/config.py` line 38
Both must match. Currently allows: 3000, 3001, 3002, 3003, 3006.

### 5. The git branch is `nightagent/2026-03-29` (not main)
All 7 commits are on this branch. The previous overnight session's handoff said `nightagent/2026-03-28` — that was wrong, it's `2026-03-29`. No PR has been created to merge into main.

### 6. Voice agent builder saves to localStorage, not backend
The multi-tab voice agent builder at `/voice-agents/new` saves configs to `localStorage` keys:
- `leadspot-voice-agents` — agent list for the listing page
- `leadspot-voice-agent-configs` — full configs for the edit page
These are NOT persisted to any database. For production, need to save to the voice-agent backend API.

### 7. Community page uses local state, not database
All posts, comments, and reactions are in-memory React state initialized from `frontend/lib/community-demo-data.ts`. New posts created by the user vanish on page refresh. For production, need API routes backed by a database.

### 8. The FastAPI backend's chat endpoint needs the DB running
The chat endpoint at `/api/chat` depends on SQLAlchemy sessions (for org lookup, Mautic client). If the SQLite DB tables don't exist, it returns a 500 that the frontend shows as "I encountered an issue processing your request."

### 9. The agent-service ANTHROPIC_API_KEY is separate from Claude Code
The agent-service and FastAPI backend both use the `ANTHROPIC_API_KEY` env var to call the Claude API directly. This is a pay-per-use API key from console.anthropic.com — completely separate from Mike's Claude Code Max plan subscription. Mike has a spending limit configured on his API key.

### 10. Multiple `config.py` files exist
The backend has BOTH `app/config.py` AND `app/config/settings.py`. Changes to settings (like CORS, model name) must be made in BOTH files. It's unclear which one takes precedence at runtime — check `app/main.py` imports to verify.

---

## Mike's Preferences (confirmed this session)

- No Mautic anywhere in the UI — "LeadSpot IS the product"
- Professional Lucide icons, not emojis
- Light theme with white cards on subtle background
- Dark mode must work everywhere
- Every "Create/New" button must have a working modal (no dead buttons)
- Prefers parallel sub-agent execution for speed
- Wants to see live results immediately
- Target market: real estate agents
