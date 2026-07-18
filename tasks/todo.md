# LeadSpot Production Deploy — 2026-07-15

## Context (revised — services already existed on Render)
Original assumption was wrong: this was NOT a from-scratch deploy. All 3 services already exist
on Render, manually suspended ~6 months ago, fully configured with real secrets (Postgres via
`DATABASE_URL`/`DIRECT_DATABASE_URL`, Stripe, LiveKit, Neo4j, Mautic OAuth, Resend). Mike is not
sure they were ever fully verified end-to-end before suspension — treat as "configured, unverified,"
not "known working."

**Services (all deploy from `main`, all Free tier, Oregon):**
- `leadspot-api` — root dir `backend`, https://leadspot-api.onrender.com (or similar)
- `leadspot-frontend` — root dir `frontend`, https://leadspot-frontend.onrender.com
- `leadspot-agent-service` (Render name shows as `leadspot` in list) — root dir `agent-service`

**What happened this session:**
1. Merged `origin/main`'s prior Render deploy fixes (port binding, OAuth middleware matcher,
   Docker build args, CORS pydantic parsing, query-history stub) into `fable5/hardening` — that
   branch had 6 months of security/stability hardening (AUDIT.md Pass 1 + Pass 2) that had never
   been deployed. Resolved 2 conflicts (`frontend/next.config.js`, `frontend/Dockerfile`) keeping
   HEAD's `/api/agent/*` routing-through-backend-proxy (security correct) + main's real deploy fixes.
2. Merged `fable5/hardening` → `main` (clean, 49 ahead / 0 behind after the above) and pushed.
3. Scope trimmed: `dashboard/` (Prisma, Stripe billing UI, voice-agent balance) explicitly OUT —
   not needed for personal-CRM use, revisit later if voice/billing wanted.

## Known-missing / needs verification (from Pass 1 + Pass 2 hardening requirements)
- `INTERNAL_API_KEY` on `leadspot-api` — NOT seen in its env var list (screenshot showed
  ANTHROPIC_API_KEY, CORS_ORIGINS, DATABASE_URL, ENCRYPTION_KEY, ENVIRONMENT, FROM_EMAIL,
  FRONTEND_URL, JWT_SECRET, LIVEKIT_*, NEO4J_PASSWORD, OPENAI_API_KEY, PYTHONUNBUFFERED,
  STRIPE_SECRET_KEY — no INTERNAL_API_KEY visible). This gates drip emails + agent UI closed
  per Pass 1 fix #2/#3 until set.
- `LEADSPOT_INTERNAL_API_KEY` on `leadspot-agent-service` — need to confirm it's set and matches
  whatever gets generated for `INTERNAL_API_KEY` above (screenshot was cut off by "Show more").
- Redis — no Redis-related env var seen on any of the 3 services yet; Pass 2 #13 (OAuth state)
  and #16/#17 (drip engine boot-scan + enrollment claim) need it. Must provision + wire before
  OAuth login or drips will work correctly on the new code.
- `RESEND_WEBHOOK_SECRET` — confirm set on agent-service for bounce/complaint handling.

## Todo
- [x] Merge main's deploy fixes into fable5/hardening (resolved 2 conflicts)
- [x] Merge fable5/hardening into main, push (d64317b..719cf0f)
- [ ] Mike: click "Resume service" on all 3 suspended Render services
- [ ] Confirm each service redeploys the new `main` commit (719cf0f) — may need manual "Deploy latest commit" after resuming
- [ ] Add `INTERNAL_API_KEY` to leadspot-api + matching `LEADSPOT_INTERNAL_API_KEY` to leadspot-agent-service (generate fresh, don't reuse any dev value)
- [ ] Provision Redis (Render Redis or Upstash) and wire `REDIS_URL` into leadspot-api
- [ ] Verify `noreply@mail.leadspot.ai` SPF/DKIM/DMARC actually verified in Resend dashboard
- [ ] Smoke test prod: signup → contact → sequence → send → confirm arrival in inbox
- [ ] Confirm OAuth login works against Redis-backed state store (Pass 2 #13) now that Redis exists
- [ ] Check Supabase project behind DATABASE_URL is still active/reachable (screenshot didn't reveal which Supabase project)
- [ ] Document a short runbook: URLs, daily-use flow, where to check bounces/opens

## Review
(To be filled after deploy completes)

---

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

---

# CRE "Central Brain" Sprint — Kane Company Prototype (2-day Fable 5 sprint, 2026-07-16)

## Context
Kelsey Kraus (COO, The Kane Company — 28-person commercial RE firm, Microsoft 365 shop, 600+ units under construction) wants a "central workstation": leasing-pipeline visibility (LOI → construction pricing → lease draft → negotiation → signed) with status **inferred from email + SharePoint**, not manually updated. Follow-up call Tuesday 7/21, 1pm ET. This sprint turns LeadSpot into that prototype.

## Verified starting assets (fresh audit 2026-07-16)
- **Deals**: `backend/app/models/deal.py` + `routers/deals.py` — full CRUD, stage validation, org-scoped; Kanban UI wired (`frontend/app/(dashboard)/deals/page.tsx`, `PipelineKanban`, `NewDealModal`). Generic sales stages only.
- **Microsoft OAuth**: `services/oauth/microsoft.py` — SharePoint scopes (`Sites.Read.All`, `Files.Read.All`, `User.Read`, `offline_access`); **no `Mail.Read`**. Encrypted token storage + refresh in `models/oauth_connection.py`. Callback flow live in `routers/oauth.py`.
- **Sync patterns to mirror**: `services/sync/gmail_sync.py`, `google_drive_sync.py`, `salesforce_sync.py`.
- **Extraction**: `services/ingestion/extractor.py` — PDF/DOCX/XLSX/HTML/text, working.
- **Heavy pipeline exists but NOT needed for v1**: chunker/embedder/Pinecone/Neo4j (`ingestion/pipeline.py`) — skip for this sprint.
- **`ANTHROPIC_API_KEY`** already in `config/settings.py` (and on Render).
- **`models/document.py`** exists — verify shape before adding a synced-docs table.

## Architecture decisions
1. **`pipeline` column on deals** (`'sales' | 'leasing'`), leasing stages: `inquiry → loi_negotiation → construction_pricing → lease_drafting → lease_negotiation → signed → lost`. Sales pipeline untouched (Mike dogfoods it).
2. **Light inference path**: extract text → Claude classify → suggestion. No embeddings/graph in v1.
3. **Suggestion queue, never auto-apply**: AI proposes stage changes with confidence + evidence quote; human accepts/rejects in UI. (Matches ORBIT "Exception Condition" philosophy — also the demo money-shot for Kelsey.)
4. **New lightweight tables** (`email_messages`, `deal_suggestions`, `deal_activity`) — do NOT reuse Ghostlog `signals` (CHECK constraints pin it to ambient_screen/dockable sources).

## Phase 1 — Leasing pipeline (Day 1 AM)
- [ ] `models/deal.py`: add `pipeline` (default `'sales'`), `property_name`, `stage_changed_at`, `source_meta` JSON
- [ ] Alembic migration (with `downgrade()`)
- [ ] `routers/deals.py`: per-pipeline stage definitions; `GET /deals?pipeline=`; validate stage against its pipeline's set
- [ ] `frontend/types/deals.ts` + Deals page: pipeline tabs (Sales | Leasing); Kanban renders correct stage set; NewDealModal gets pipeline + property fields
- [ ] Reconcile frontend `Deal` type mismatch (contactName/email/company vs backend contact_id/contact_name) while in there

## Phase 2 — Outlook mail ingestion (Day 1 PM)
- [ ] `oauth/microsoft.py`: add `Mail.Read` scope (existing connections must re-consent — surface in Settings UI)
- [ ] **MIKE ACTION (do first, consent propagates while I build)**: Azure app registration → add delegated `Mail.Read` permission
- [ ] NEW `services/sync/outlook_sync.py` (mirror `gmail_sync.py`): Graph `/me/messages` delta query since `last_sync_at`
- [ ] NEW `models/email_message.py`: org_id, graph_message_id (unique), from/to, subject, body_preview, received_at, matched contact_id / deal_id (nullable)
- [ ] Matching pass: sender/recipient ↔ contacts ↔ open leasing deals
- [ ] Wire into the existing sync endpoint in `routers/oauth.py` (mirror the gmail branch ~line 386)

## Phase 3 — SharePoint document watch (Day 2 AM)
- [ ] NEW `services/sync/sharepoint_sync.py` (mirror `google_drive_sync.py`): reuse `list_sites/list_site_drives/list_drive_items` + Graph delta; download new/changed files
- [ ] Run `ContentExtractor` (extract-only) on each new file
- [ ] Verify `models/document.py` shape — reuse if fits, else add `synced_documents` (drive_item_id unique)
- [ ] Watched site/drive selection stored in `oauth_connection.provider_metadata` (v1)

## Phase 4 — Status-inference agent (Day 2 PM) — the differentiator
- [ ] NEW `services/inference/deal_status_agent.py`: input = new email/doc text + open leasing deals (title, property, stage, parties); Claude (`claude-sonnet-5`, structured output) → match deal, propose stage or no-op, confidence 0-100, evidence quote
- [ ] NEW `models/deal_suggestion.py` + migration: deal_id, suggested_stage, current_stage, confidence, evidence, source_type/source_id, status (pending/accepted/rejected), resolved_by/at
- [ ] Router: list pending / accept (PATCH deal + activity row) / reject
- [ ] Trigger at end of each sync run on new items only
- [ ] Frontend: suggestion badge on Deals page + review drawer (Accept / Reject with evidence shown)

## Phase 5 — Verification (Day 2 end)
- [ ] Unit: per-pipeline stage validation; suggestion accept updates deal + writes activity; regression on sales pipeline
- [ ] Playwright: login → create leasing deal → drag between stages → suggestion review flow
- [ ] Sync smoke against Mike's own M365 (or mocked Graph fixtures if consent lags)

## Demo prep for Tuesday (~1h, after Phase 5)
- [ ] Seed script: Kane-flavored demo org — 6 leasing deals across stages, 3 pending AI suggestions with realistic evidence ("Re: Portsmouth LOI — redlines attached")

## Out of scope (this sprint)
Multi-tenancy hardening, Teams/calendar ingestion, auto-apply default-on, Pinecone/Neo4j enrichment, voice/billing dashboard.

## Risks
- Azure scope consent needs Mike's tenant — kick off first thing Day 1
- Graph throttling → delta queries, modest page sizes
- SQLite dev vs Postgres prod: migrations must apply cleanly to both

## Review — CRE Central Brain Sprint (2026-07-16, Fable 5)

Branch: `feature/cre-central-brain` (4 commits, NOT pushed)

### Shipped & verified
- **Phase 1 — Leasing pipeline**: Deal.pipeline/property_name/stage_changed_at/source_meta; per-pipeline stages + validation; ?pipeline= filtering; Sales|Leasing tabs; Kanban fetches stages from API; honest field mapping (real title/property/days-in-stage). Migrations 20260716_cre1 applied+verified on dev SQLite.
- **Phase 2 — AI inference + suggestion queue**: deal_status_agent (Claude structured output), email_messages + deal_suggestions tables (cre2), list/accept/reject endpoints, AI Suggestions badge + review drawer (evidence quote, confidence pill, source email). 11 unit tests, mocked Anthropic.
- **Phase 3 — Kane demo seed**: 6 Seacoast leasing deals ($12.7M), 5 emails, 3 pending suggestions; idempotent re-run. Playwright-verified: login → Leasing tab → suggestions drawer → accept → card moves. Screenshots delivered.
- **Phase 4 — Outlook sync**: OutlookSyncService w/ refresh-on-expiry + 401 retry, contact/deal matching, inference on new messages; Mail.Read scope added; wired into /oauth/microsoft/sync. 6 tests. Fixed pre-existing broken sync package import (gmail connectors module missing).

### Remaining
- Phase 5 (stretch): SharePoint document watch — needs microsoft.py recursion/delta/download first
- MIKE: check Azure app registration control for MICROSOFT_CLIENT_ID → add delegated Mail.Read → re-consent connection
- Pre-existing (not mine): 4 gmail-integration test failures, /space route tsc error

### Demo runbook (Tuesday)
1. `bash start.sh` (all 3 services)
2. `cd backend && .venv/bin/python -m scripts.seed_kane_demo --email <your-login-email>` (re-run anytime to reset)
3. localhost:3006 → Deals → Leasing tab → AI Suggestions

## Review — 2026-07-17: Unified Inbox (Fyxer-clone integration)

Ported the logic of ~/inbox-concierge (standalone Fyxer clone) into LeadSpot as the
Unified Inbox. Plan: ~/.claude/plans/is-this-something-that-humble-bee.md (includes the
adversarial-review corrections: GmailConnector never existed, outlook_sync was the real
template, conversations router already existed).

**Phase A — Gmail ingestion**
- `services/connectors/gmail.py` — real Gmail REST client (getProfile bootstrap cursor,
  history.list incremental sync w/ stale-404 resync, full message parse; INBOX + SENT).
- `services/sync/gmail_inbox_sync.py` — refresh-on-expiry tokens (outlook pattern), cursor
  in provider_metadata JSON, alias-hash contact matching (email_normalize + email_aliases,
  case-insensitive fallback, ambiguity logged), dedupe on (org_id, provider_message_id),
  calls existing analyze_source_for_deal_status per inbound email.
- `email_events` table + TERMINAL_ACTIONS state machine: a message is only skip-on-retry
  after a terminal event (drafted/skipped/no-draft-needed) — crash between ingest and
  draft is retried, never silently dropped. Doubles as activity feed.
- `workers/inbox_poller.py` — 90s asyncio loop in lifespan (ungated by embedding keys),
  5-consecutive-failure circuit breaker → connection status ERROR.
- `POST /oauth/gmail/backfill` (7d inbound + 90d SENT for voice layer); fixed
  /oauth/gmail/sync which pointed at dead GmailSyncService.
- SENT mail flow: outbound → thread "Awaiting Reply"; inbound reply → "Actioned".

**Phase B — Triage** — `email_categories` + `sender_rules` (8 Fyxer defaults seeded per
org on first use), `services/inference/email_classifier.py` (Haiku, forced tool choice,
sender rules short-circuit), `services/inference/llm_client.py` (org BYOK key w/ global
fallback — first thing to actually wire org.anthropic_api_key into inference).

**Phase C — Drafting** — `style_profiles` + `services/inference/reply_drafter.py`:
style profile distilled from SENT mail at backfill, exemplar retrieval via
local_vector_store (type=sent_exemplar), Sonnet drafts saved to emails table
(status=Draft, NEVER sent), daily cap (40) + never-draft sender rules (sentinel
category __no_draft__).

**Phase D — UI** — conversations router now derives email threads from email_messages
(id prefix "em:", response shape preserved for lib/api/conversations.ts); legacy
conversations table still backs SMS/manual compose. Inbox page: category filter chips,
per-row category badge, category-correction dropdown w/ "always for this sender" →
sender rule, deal-suggestion accept/reject banner, Gmail-broken reconnect banner,
empty state → Settings → Integrations. New endpoints: GET /api/conversations/meta/
categories, PATCH /api/conversations/{id}/category.

**Verified**: 209 backend tests pass (21 new across 3 files); alembic up/down/up
round-trips on all 3 migrations (SQLite); frontend tsc clean; uvicorn boots with poller;
all new routes in OpenAPI and 401 without auth. Pre-existing failures in
test_gmail_integration.py (dead legacy GmailConnector) unchanged — confirmed failing
before this work via stash test.

**Not yet done**: live E2E needs a real Gmail connection (GOOGLE_CLIENT_ID/SECRET +
ENCRYPTION_KEY in backend/.env, then Settings → Integrations → connect, then backfill).
PostgreSQL migration parity check before prod deploy. Playwright pass on /inbox once
creds exist. Outlook parity + native Gmail labels/drafts (needs gmail.modify) = v2.
