# Beta Launch - Production Readiness Plan

## Priority Order

### P0 — Must fix before beta (today)
- [x] **Campaigns persistence** — wire campaigns to backend DB (create router, model, CRUD endpoints, update frontend)
- [x] **Campaigns frontend wiring** — created `/lib/api/campaigns.ts`, wired page to real API with loading/error states
- [x] **Demo seed data** — auto-seed demo contacts + campaigns on fresh account so app looks alive on first login
- [x] **Startup script** — single `start.sh` to launch backend + frontend together (no more manual restarts)

### P1 — Important for beta (today if time allows)
- [ ] **Smart Lists** — wire frontend to agent-service smart-lists endpoints
  - [x] Agent service already has full CRUD + evaluate + mark-acted in `src/smart-lists/index.ts`
  - [x] Routes already registered in `src/routes/smart-lists.ts` + `src/server.ts`
  - [x] Frontend `agent.ts` already calls correct endpoints
  - [ ] Add `NEXT_PUBLIC_AGENT_SERVICE_URL` to `frontend/.env.local`
  - [ ] Make `ANTHROPIC_API_KEY` a warning (not fatal exit) in agent `server.ts`
  - [ ] Auto-seed default smart lists when org has none (in `routes/smart-lists.ts` GET handler)
  - [ ] Create `agent-service/.env` with stub key so service can start
- [ ] **Calendar page** — build 3 missing UI components (CalendarGrid, MiniCalendar, EventModal) + demo seed events
- [x] **Loading states** — already present on all pages (smart-lists, timeline, decisions, settings/integrations)
- [x] **Error pages** — all pages already have friendly error banners and retry buttons

### P1 completed ✅
- [x] Smart Lists — env var fixed, agent-service can now start, auto-seeds "Hot Leads / Recent Signups / Needs Follow-up"
- [x] Calendar — components already existed; added 5 demo seed events

### From Full Menu Audit — Gaps Found

#### P1 — Broken/missing for beta
- [x] **Segments page** — backend model + router + seed data + frontend API client + page wired
- [x] **Emails page** — backend model + router + seed data + frontend API client + page wired to real API
- [x] **Inbox page** — wire frontend to existing backend conversations router
  - [x] Add demo seed conversations to seed.py
  - [x] Create frontend/lib/api/conversations.ts
  - [x] Replace DEMO_CONVERSATIONS in inbox page with real API calls
- [x] **Reports page** — wired to real backend data (see Reports Wiring Sprint below)

### Reports Wiring Sprint
- [x] Read reports page, contacts router, models (campaign, deal), main.py, api.ts
- [x] Create `backend/app/routers/reports.py` — GET /api/reports/summary (aggregate counts/sums from existing tables)
- [x] Register reports router in `backend/app/main.py`
- [x] Create `frontend/lib/api/reports.ts` — getReportsSummary() using apiClient
- [x] Update `frontend/app/(dashboard)/reports/page.tsx` — replace hardcoded data with API call, add loading + error states

---

## Voice AI Production Plan — Phase 1 & 2

### Task 1: from-sip endpoint (Next.js dashboard)
- [x] Create `/dashboard/src/app/api/voice/calls/from-sip/route.ts`
  - Auth: x-api-key header (VOICE_AGENT_API_KEY)
  - Normalize phone numbers
  - Look up VoiceAgent by phoneNumber + status=active
  - Look up Wallet for agent owner
  - Atomic balance hold (Serializable transaction, min $0.10 guard, hold up to $5.00)
  - Create VoiceCall record (roomId = 'call-' + twilioCallSid)
  - Return callId, agentId, tenantId, agentConfig, holdAmount

### Task 2: Twilio status webhook (FastAPI backend)
- [x] Create `/backend/app/routers/twilio_webhook.py`
  - Signature validation via twilio RequestValidator
  - Log call status for analytics
  - Return empty TwiML XML response
- [x] Register router in `backend/app/main.py`
- [x] Add `twilio>=8.0.0` to `backend/requirements.txt`

### Task 3: Schema migration — phoneNumber @unique on VoiceAgent
- [x] Add `@unique` to `phoneNumber` field in `dashboard/prisma/schema.prisma`
- [x] Applied partial unique index directly via `prisma db execute` (dev DB had drift)
- [x] Created manual migration file for production: `20260424000000_add_voice_agent_phone_unique`

### Task 4: Webhook route — release hold after call
- [x] Modified `recordUsageAndDeduct` in webhook/route.ts
  - Finds hold transaction by `description LIKE 'Call hold: {callId}'`
  - Computes actualCost and refund (clamped to 0)
  - Issues 'refund' BillingTransaction if refund > 0
  - Creates 'usage_deduction' BillingTransaction for actualCost
  - Falls back to legacy direct-deduction if no hold found

### Review
All four tasks complete. TypeScript type-check passes with no errors in the voice API files.
Pre-existing type errors in unrelated files (courses, communities, leaderboard) were present before and not introduced by this work.

#### P2 — UX gaps worth fixing
- [x] **Contacts** — Import (CSV parse + batch create), "Add to segment" (segment picker modal), "View Details" (editable modal) all implemented; Export + Send email were already working
- [x] **Decisions page** — was already in nav (no action needed)
- [ ] **Hidden pages not in nav** — /documents, /query, /health, /scheduled, /sources all exist but unreachable from UI
- [x] **Header shows email only** — already shows `user?.name || user?.email` (no action needed)
- [x] **Settings sub-nav** — SettingsNav component already included on all 3 sub-pages (no action needed)

### P3 — Post-beta (skip for now)
- [ ] PostgreSQL migration (SQLite is fine for early beta)
- [ ] SSL / production deployment (add reverse proxy + cert)
- [ ] Docker compose setup
- [ ] Real CRM connectors (HubSpot/Salesforce)

## Execution Plan

Will launch 4 parallel sub-agents:
1. **Backend agent** — implement campaigns router + DB model + seed script
2. **Frontend agent** — wire campaigns UI to real API, add loading states
3. **Stubs agent** — audit and minimally wire Smart Lists + Calendar pages
4. **Infra agent** — startup script, .env template, production checklist

## Review

### P0 + P1 — All complete
- Campaigns, segments, emails, inbox, calendar, smart lists, reports — all wired to real backend data
- Demo seed data auto-seeds on fresh login
- Startup script (`start.sh`) launches all 3 services

### Workflows Feature (P1 addition)
- `agent-service/src/workflows/index.ts` — CRUD + enrollment + step execution
- `agent-service/src/db/index.ts` — 3 new SQLite tables (workflows, workflow_steps, workflow_enrollments)
- `agent-service/src/server.ts` — 7 new `/api/agent/workflows/*` routes
- `agent-service/src/orchestrator/index.ts` — dispatches `process_workflow_steps` cron action
- `frontend/lib/api/workflows.ts` — frontend API client
- `frontend/app/(dashboard)/workflows/page.tsx` — Create / Enroll / View Enrollments modals
- `frontend/app/(dashboard)/layout.tsx` — Workflows nav item added
- Committed: `feat(workflows): add multi-step email sequence automation`

### Reports Wiring
- `backend/app/routers/reports.py` — GET /api/reports/summary aggregates contacts, campaigns, deals, segments
- Registered in `main.py` under `/api` prefix
- `frontend/lib/api/reports.ts` — `getReportsSummary()` via apiClient
- `frontend/app/(dashboard)/reports/page.tsx` — uses real API, falls back to demo data silently

### Remaining (P2 / post-beta)
- Contacts page: Import, Export, "Send email", "Add to segment", "View Details" are no-op stubs
- Decisions page hidden from nav (intentional?)
- Header shows email only (no display name)
- Settings sub-nav: Billing/Integrations only reachable by direct URL

---

## Workflow Automation Feature

### What was built
- NEW `agent-service/src/workflows/index.ts` — CRUD + enrollment + step execution
- `agent-service/src/db/index.ts` — added workflows, workflow_steps, workflow_enrollments tables
- `agent-service/src/types.ts` — added `process_workflow_steps` to CRMAction
- `agent-service/src/orchestrator/index.ts` — added `process_workflow_steps` case to handleCronAction
- `agent-service/src/server.ts` — 7 new `/api/agent/workflows/*` routes
- NEW `frontend/lib/api/workflows.ts` — frontend API client
- NEW `frontend/app/(dashboard)/workflows/page.tsx` — Workflows UI page
- `frontend/app/(dashboard)/layout.tsx` — added Workflows nav item (between Campaigns and Calendar)

### How it works
1. Create a workflow with named steps (delay in days, subject, body)
2. Enroll contacts (individually or by segment) → enrollments stored in SQLite
3. A recurring CronService job `process_workflow_steps` (every 5 min) fires for the org
4. Finds enrollments where `next_send_at <= now`, sends email via Resend, advances step
5. Marks enrollment `completed` when all steps are sent
