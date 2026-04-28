# LeadSpot.ai — Agent Handoff: Workflow Automation

## What Is LeadSpot

LeadSpot.ai is Mike's CRM (real estate focused, beta stage). It runs as 3 local services:

| Service | Port | Directory | Start Command |
|---------|------|-----------|---------------|
| FastAPI backend | 8000 | `/Users/michaelkraft/leadspot/backend/` | `source .venv/bin/activate && uvicorn app.main:app --reload --port 8000` |
| Next.js frontend | 3006 | `/Users/michaelkraft/leadspot/frontend/` | `npm run dev -- --port 3006` |
| TypeScript agent-service | 3008 | `/Users/michaelkraft/leadspot/agent-service/` | `node --env-file=.env ./node_modules/.bin/tsx watch src/server.ts` |

**Login**: `http://localhost:3006` — email: `poolkraftllc@gmail.com` / password: `Leadspot2026!`

Database: SQLite at `/Users/michaelkraft/leadspot/backend/leadspot.db`

Python venv: `/Users/michaelkraft/leadspot/backend/.venv/bin/python`

---

## What Was Fixed This Session

All of these are committed and working. Do NOT re-investigate these.

### 1. Auth Token Expiry (FIXED)
- **Problem**: 1-hour JWT TTL caused "Failed to load" on all pages every hour
- **Fix**: `backend/app/services/auth_service.py` line 31 — changed to `60 * 24 * 7` (7 days)
- **How auth works**: JWT payload requires `sub`, `email`, `organization_id`, `role`, `type: "access"`. JWT secret: `GWw2emtkfo1ckfPNl0hMhdQB0HrksYtVC9xOJsGqQsM_7zx-1rEdq50yzk8QbTYp`

### 2. Emails & Inbox Pages "Failed to Load" (FIXED)
- **Root cause**: Expired token in browser localStorage, not a backend bug
- **Backend confirmed working**: Both `/api/emails` and `/api/conversations` return 200 with correct JWT
- **DB tables**: All exist — `emails`, `conversations`, `conversation_messages`, `contacts`, `campaigns`, `segments`

### 3. Campaign Create Error (FIXED)
- **Problem**: Frontend sent `status: 'draft'` but backend requires `status: 'Draft'`
- **Fix**: `frontend/app/(dashboard)/campaigns/page.tsx` line 71

### 4. Campaign Test Send — "Campaign not found" (FIXED)
- **Problem**: Frontend called `/api/campaigns/test-send` which didn't exist
- **Fix**: Added `POST /api/agent/campaigns/test-send` to `agent-service/src/server.ts`
- **Fix**: Updated frontend to call `/api/agent/campaigns/test-send` with `{campaignId, campaignName, email}`
- **Resend delivery**: Working. Sends from `hello@mail.leadspot.ai` (verified domain)

### 5. Agent-Service .env Loading (FIXED)
- **Problem**: `RESEND_API_KEY` not loaded when starting agent-service
- **Fix**: `agent-service/package.json` dev script now uses `node --env-file=.env` flag
- **Fix**: Agent-service must always be started from `/Users/michaelkraft/leadspot/agent-service/` directory

---

## Current Architecture — What Works

### Frontend Routing (Next.js rewrites in `frontend/next.config.js`)
```
/api/agent/* → localhost:3008/api/agent/*   (agent-service)
/api/*       → localhost:8000/api/*          (FastAPI backend)
/auth/*      → localhost:8000/auth/*         (FastAPI backend)
```

### Auth Flow
- `frontend/lib/api.ts` — `apiClient` (Axios) reads JWT from Zustand `useAuthStore.getState().token`
- Backend validates JWT, requires `email` and `organization_id` fields in payload
- User model PK is `user_id` (not `id`) — critical, fixed in all routers

### Key Files
- `frontend/lib/api.ts` — Axios client with Bearer token interceptor
- `frontend/lib/api/emails.ts` — emails API
- `frontend/lib/api/conversations.ts` — inbox API
- `frontend/lib/api/contacts.ts` — contacts API
- `frontend/lib/api/campaigns.ts` — campaigns API
- `backend/app/routers/campaigns.py` — campaign CRUD (uses `current_user.user_id`)
- `backend/app/routers/emails.py` — email CRUD
- `backend/app/routers/contacts.py` — contacts (local SQLite, Mautic removed)
- `agent-service/src/server.ts` — all agent-service HTTP routes
- `agent-service/src/services/email.ts` — Resend delivery, CAN-SPAM, unsubscribe

---

## What Needs to Be Built: Workflow Automation

### Background — What Already Exists in agent-service

There is a **full Action Plans engine** at `agent-service/src/action-plans/index.ts` (multi-step email sequences with delays). There is also a **CronService** at `agent-service/src/cron/index.ts` (SQLite-backed scheduler).

**The gap**: No API endpoints expose these to the frontend. No UI exists.

### Goal

Build a minimum viable "Workflows" feature:
1. User creates a sequence (e.g., "Open House Follow-Up" — email on day 0, email on day 3, email on day 7)
2. User enrolls contacts (manually or from a segment)
3. Contacts automatically receive emails at the scheduled intervals

### Implementation Plan

#### Step 1 — Read the existing Action Plans code first

Before writing any code, read these files:
- `agent-service/src/action-plans/index.ts` — understand the ActionPlan and Enrollment types
- `agent-service/src/cron/index.ts` — understand how jobs are scheduled

#### Step 2 — Add Workflow API endpoints to agent-service

Add to `agent-service/src/server.ts` under `/api/agent/workflows/`:

```
GET  /api/agent/workflows              — list all workflows
POST /api/agent/workflows              — create workflow {name, steps: [{delayDays, subject, body}]}
GET  /api/agent/workflows/:id          — get single workflow with steps
DELETE /api/agent/workflows/:id        — delete workflow

POST /api/agent/workflows/:id/enroll   — enroll contacts {contactIds: string[]}
POST /api/agent/workflows/:id/enroll-segment — enroll segment {segmentId: string}
GET  /api/agent/workflows/:id/enrollments — list enrollments with status
```

Workflow data should be stored in SQLite (add to `agent-service/src/db/` or use the existing DB setup). Each workflow has:
- id, name, org_id, created_at
- steps: [{id, workflow_id, delay_days, subject, body, step_order}]

Enrollment tracks:
- id, workflow_id, contact_id, contact_email, current_step, status, enrolled_at, next_send_at

#### Step 3 — Wire execution to CronService

When a contact is enrolled:
1. Schedule a cron job (via CronService) for `next_send_at = now + step[0].delay_days`
2. When job fires: send email via `sendEmail()`, advance `current_step`, schedule next job
3. Mark enrollment `completed` when all steps are sent

#### Step 4 — Add Frontend Workflows Page

New file: `frontend/app/(dashboard)/workflows/page.tsx`

UI:
- List of workflows with contact count and status
- "New Workflow" button → modal to create sequence
  - Add steps: delay (days), subject, body
- Each workflow row: "Enroll Contacts" button → pick contacts or segment
- Enrollment list showing each contact and their current step

#### Step 5 — Add to sidebar nav

`frontend/components/layout/Sidebar.tsx` (or wherever nav items live) — add "Workflows" link between Campaigns and Calendar.

### Important Constraints

1. **Agent-service routes must use `/api/agent/` prefix** — this is what the Next.js proxy maps to port 3008
2. **Frontend API calls must use `apiClient` from `@/lib/api`** (not plain `fetch`) to include Bearer token
3. **No auth on agent-service endpoints** — agent-service doesn't validate JWTs (relies on internal network trust). The frontend sends the token but agent-service ignores it.
4. **To get contacts for segment enrollment**: call `http://localhost:8000/api/contacts?segment_id=X` from agent-service internally (passing the auth token from the frontend request)
5. **Keep it simple**: No drag-and-drop builder. A simple form with "Add Step" is sufficient for beta.

### Segment enrollment flow
When enrolling a segment, the agent-service needs contact emails. The segment contacts are in the backend. Call the backend:
```typescript
const contacts = await fetch(`${process.env.LEADSPOT_API_URL}/api/contacts?segment_id=${segmentId}`, {
  headers: { Authorization: req.headers.authorization ?? '' }
}).then(r => r.json());
```

### Data persistence for workflows

Agent-service uses SQLite too. Check `agent-service/src/db/` for existing setup. Add tables:
```sql
CREATE TABLE IF NOT EXISTS workflows (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS workflow_steps (
  id TEXT PRIMARY KEY,
  workflow_id TEXT REFERENCES workflows(id),
  step_order INTEGER NOT NULL,
  delay_days INTEGER NOT NULL DEFAULT 0,
  subject TEXT NOT NULL,
  body TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workflow_enrollments (
  id TEXT PRIMARY KEY,
  workflow_id TEXT REFERENCES workflows(id),
  contact_id TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  current_step INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',  -- active, completed, paused, cancelled
  enrolled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  next_send_at DATETIME
);
```

---

## Files You Should Read Before Starting

1. `agent-service/src/action-plans/index.ts` — existing sequence engine
2. `agent-service/src/cron/index.ts` — scheduler
3. `agent-service/src/server.ts` — where to add new routes (see existing `/api/agent/` routes for pattern)
4. `agent-service/src/services/email.ts` — how to call `sendEmail()`
5. `agent-service/src/db/` — check what DB utilities exist
6. `frontend/app/(dashboard)/campaigns/page.tsx` — use as UI pattern for the workflows page
7. `frontend/lib/api/campaigns.ts` — use as pattern for the workflows API client

---

## Do NOT Break These (Currently Working)

- All pages load without errors: contacts, campaigns, emails, inbox, segments, voice agents
- Campaign create (status must be `'Draft'` capitalized)
- Campaign test send → `/api/agent/campaigns/test-send` → Resend delivery
- Token auth: JWT requires `sub`, `email`, `organization_id`, `role`, `type: "access"` fields
- Agent-service must start with `node --env-file=.env ...` to load RESEND_API_KEY

---

## Quick Health Check (run to verify all services are up)

```bash
# Backend
curl -s http://localhost:8000/ | python3 -m json.tool

# Agent service  
curl -s http://localhost:3008/health 2>/dev/null || echo "check /api/agent/voice-agents"

# Generate test JWT
cd /Users/michaelkraft/leadspot/backend && .venv/bin/python -c "
from jose import jwt; import datetime
token = jwt.encode({'sub':'0c48f2fc-7061-4586-8677-443d5cff2a08','email':'poolkraftllc@gmail.com','organization_id':'9c36c991-8b84-4e76-b092-8c2a1f20b536','role':'user','exp':datetime.datetime.utcnow()+datetime.timedelta(hours=1),'type':'access'}, 'GWw2emtkfo1ckfPNl0hMhdQB0HrksYtVC9xOJsGqQsM_7zx-1rEdq50yzk8QbTYp', algorithm='HS256')
print(token)
" 2>/dev/null
```
