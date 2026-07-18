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

---

## Review — Conversational AI fully functional (2026-07-17 evening)

Investigated + fixed the four gaps keeping the /api/v2 conversational AI from full function:

- [x] **Agent service (:3008) running** — was complete code, simply never started. Now up via
  `npm run dev` (start.sh already covers it). `/api/agent/*` proxy 503s → gone; brief/smart-lists/
  timeline/queue live. Internal keys verified matching between backend/.env and agent-service/.env.
- [x] **Conversation memory** — new `chat_messages` table (migration `20260717_chat_mem`, with
  downgrade, round-trip tested). User + final assistant turns persisted per thread_id; last 30
  replayed into the Claude call. CommandPalette already reuses thread_id — no frontend change.
  Live 2-turn smoke: turn 2 correctly recalled turn 1's question.
- [x] **Real send_email** — `_exec_send_email` (conv_ai.py) now resolves the contact and POSTs to
  agent-service `POST /api/email/send` (new alias for test-send: full Resend path w/ suppression
  check, CAN-SPAM footer, record-send to backend). Still confirm-gated ('send'). queue_email
  remains a stub (needs a dispatch worker — v2).
- [x] **BYOK + async** — conv_ai now uses `get_anthropic_client()` (org key first, global fallback)
  and awaits AsyncAnthropic; no more blocking sync client in the SSE stream.
- [x] **sentence_transformers 5.6.0 installed** — local embeddings live (384-dim); activates both
  /api/query local RAG and Unified Inbox sent-exemplar retrieval.
- [x] **Legacy /api/chat marked deprecated** (docstring + OpenAPI `deprecated=True`); kept for the
  Mautic plugin.

Tests: 212 passed (3 new: thread memory e2e, send_email executor, unknown-contact error).
Not done: queue_email dispatch worker; UI Playwright pass (needs Mike's login; API-level e2e done
instead); retire legacy /api/chat + frontend lib/api/chat.ts fully.

---

# CI Green Sprint — 2026-07-17

CI on main is red (3 of 4 jobs) after PR #5 (Unified Inbox) merged with failing checks.
Branch: `fix/ci-green`. Goal: all 4 CI jobs green on a PR to main.

## Todos
- [ ] Create branch `fix/ci-green` from main
- [ ] Docker Build: name frontend Dockerfile stage `production` (CI targets it; stage was unnamed)
- [ ] Frontend lint: `eslint --fix` pass, then hand-fix remaining `any` types, `@ts-ignore`→`@ts-expect-error`, unescaped entities, unused vars
- [ ] Frontend: `npx tsc --noEmit` clean (CI runs it after lint)
- [ ] Backend lint: `ruff check app/` clean (contextlib.suppress, asyncio.TimeoutError→TimeoutError)
- [ ] Push branch, open PR to main, confirm all 4 CI jobs green

## Constraints
- Docker bind-mount project: NO npm install/rebuild on host (existing node_modules is fine to use)
- Lint fixes only — no behavior changes

---

# AI Insights Dashboard Card — Rewire off Mautic (2026-07-17)

## Context
Dashboard's "AI Insights" card always shows "Connect your Mautic CRM to see personalized
insights" because `GET /insights/daily` (`backend/app/routers/insights.py`) is 100% Mautic-shaped
(requires `mautic_url` query param, `InsightsService(mautic_client)`) and no org has Mautic
connected — the real, working data source is the Unified Inbox's `email_messages` table (see
"Unified Inbox" review above). Mike confirmed: rebuild on email activity.

Also fixed same session: **AI Morning Brief** card was broken by a response-shape mismatch
(backend `res.json({brief})` nested + camelCase vs frontend snake_case) — done, verified via
`npx tsc --noEmit` clean. Not part of this plan.

## Research findings (general-purpose agent, 2026-07-17)
- `EmailMessage` model (`models/email_message.py`): `org_id`, `thread_id`, `direction`
  (inbound/outbound), `category`, `from_address`, `to_addresses`, `subject`, `body_preview`,
  `received_at`, `contact_id` (nullable, indexed, no FK constraint), `deal_id` (same pattern).
- `Contact` model uses `organization_id` (not `org_id` — same value, different column name).
  `Deal` uses `org_id`, has `contact_id`, `stage`, `pipeline`, `value`, `priority`.
- Conversation grouping pattern to reuse: `routers/conversations.py` lines 195–267 —
  `_thread_key()` (line 151) groups in-memory by `thread_id or provider_message_id`
  (explicit SQLite/Postgres portability note — don't use window functions).
- `insights_service.py` (265 lines) is entirely Mautic-shaped; `generate_ai_insights()`
  (line 159) calls Claude **directly** via `AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)`
  — bypasses org BYOK key. Must replace with `get_anthropic_client(db, org_id)` pattern instead
  (canonical call site: `routers/conv_ai.py` lines 640–701).
- `DailyInsightsResponse` (routers/insights.py lines 62–70) shape to preserve:
  `hot_leads`, `recent_contacts`, `stats`, `campaigns`, `ai_insights`, `generated_at`,
  `mautic_connected`. Frontend (`dashboard/page.tsx`) only actually renders `ai_insights` and
  `stats` today — `hot_leads`/`campaigns` feed the separate Hot Leads card via the same call.
- `organization_id` currently NOT reliable on this route (optional query param, no
  `get_current_user` dependency, plus a separate unauthenticated Space Agent header path).
  Should switch to `current_user: User = Depends(get_current_user)` like `conversations.py`.

## Plan
- [ ] Add `EmailInsightsService` (new file, `backend/app/services/email_insights_service.py`)
      replacing Mautic-based `InsightsService` for the daily-insights use case:
  - [ ] `get_recent_activity(org_id, db)` — query `email_messages` for the org, group by
        `contact_id` (fallback `from_address` when null) using the same in-memory thread-key
        pattern as `conversations.py`, compute per-contact: last inbound `received_at`, last
        outbound `received_at`, message count (last 14 days)
  - [ ] `get_hot_leads(org_id, db)` — contacts with most recent inbound activity + reply velocity
        (inbound followed by quick outbound = engaged); replaces Mautic "points" ranking
  - [ ] `get_recent_contacts(org_id, db)` — most recently active contacts by `received_at`
  - [ ] `get_summary_stats(org_id, db)` — total contacts, emails (last 30d), active threads,
        replaces Mautic campaign/segment counts (drop campaigns count or repoint at real
        `Campaign`/`Deal` models if that reads better — decide during implementation)
  - [ ] `generate_ai_insights(org_id, db)` — build prompt from the above (e.g. "contact X went
        quiet after Y days", "contact Z replied fast, follow up while hot"), call via
        `get_anthropic_client(db, org_id)` (org BYOK first) — NOT direct `AsyncAnthropic`,
        `claude-haiku-4-5-20251001` per existing email_classifier.py convention, max_tokens ~300
- [ ] Rewrite `GET /insights/daily` in `routers/insights.py`:
  - [ ] Drop `mautic_url` required param; switch to `current_user: User = Depends(get_current_user)`
  - [ ] Keep the Space Agent header auth branch if it's still live (confirm with Mike — unclear
        if Space Agent integration is still used per memory `project_leadspot_space_agent.md`)
  - [ ] Call `EmailInsightsService` instead of Mautic `InsightsService`; keep Redis cache logic
        (keyed by org_id + date) as-is
  - [ ] Rename/repurpose `mautic_connected` response field — likely drop it or repoint to
        whether the org has any Gmail/email connection at all (`oauth_connection` table),
        since that's now the real prerequisite for insights to have data
- [ ] Frontend: `lib/api/dashboard.ts` `fetchDailyInsights()` — confirm no query params needed
      anymore (drop any `mautic_url` param if present); dashboard page's `demoMode` flag should
      key off "no email connection" instead of "no mautic"
- [ ] Leave `/insights/hot-leads` (separate Mautic-only endpoint, line 231) alone unless it turns
      out to be dead code — check for any caller before touching it
- [ ] Tests: unit tests for `EmailInsightsService` methods (empty org, single contact, multi-thread
      grouping) mirroring the pattern in the CRE sprint's 11 unit tests for `deal_status_agent`
- [ ] Manual verify: seed/use an org with real synced email_messages (Mike's own Gmail connection
      per Unified Inbox review), reload /dashboard, confirm AI Insights shows real synthesized
      text instead of the Mautic fallback message

## Out of scope
- Campaigns/segments-based insights (no real campaign-sending activity exists yet to insight on)
- `/insights/hot-leads` endpoint rewrite (separate from the dashboard's daily insights call)
- Removing Mautic integration code entirely (leave `MauticClient`/`mautic.py` in place — other
  Mautic-dependent routes are out of scope for this change)

## Review

Shipped 2026-07-17. Also folded in Mike's decision: hid the unauthenticated Space Agent header
path from `/insights/daily` (it doesn't work right now).

- NEW `backend/app/services/email_insights_service.py` — `EmailInsightsService(db, org_id)`
  replaces `InsightsService(mautic_client)` for the daily-insights use case. Groups
  `email_messages` into threads in-memory (same `_thread_key` pattern as `conversations.py`),
  computes hot leads = threads whose latest message is unreplied inbound within 14 days, recent
  contacts = most recent activity of any direction, stats = contact/email/thread counts over 30
  days. `generate_ai_insights()` uses `get_anthropic_client(db, org_id)` (org BYOK key first) via
  `claude-haiku-4-5-20251001` — fixes the pre-existing bug where the Mautic version bypassed BYOK
  and called `AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)` directly.
- `backend/app/routers/insights.py` — `/insights/daily` now uses
  `current_user: User = Depends(get_current_user)` instead of required `mautic_url` query param
  + unauthenticated `X-Space-Agent-Key`/`X-Space-Org-Id` header path (removed per Mike — Space
  Agent isn't working right now). `/insights/hot-leads` and `/insights/stats` left untouched
  (Mautic-only, confirmed zero frontend callers — out of scope per plan).
- `frontend/lib/api/dashboard.ts` — `fetchDailyInsights()` no longer sends `mautic_url`/
  `organization_id` params (backend derives org from the session now). Removed `fetchHotLeads`/
  `fetchCRMStats` — dead exports, no callers anywhere in the frontend.
- NEW `backend/tests/test_email_insights_service.py` — 10 tests: empty-org, unreplied-inbound
  hot lead, already-replied thread excluded, stale (>14d) messages excluded, cross-org isolation,
  recent-contacts ordering, stats counting, and 3 AI-insights tests (no API key, no activity
  empty-state, Claude called correctly with mocked client).
- Verified: `npx tsc --noEmit` clean (frontend), `ruff check` clean, full backend suite
  242 passed / 4 pre-existing gmail-integration failures (confirmed identical via `git stash`,
  unrelated to this change — documented dead legacy code per project session learnings).
  Backend dev server (was running stale code, no `--reload`) restarted with Mike's OK; confirmed
  live: `GET /insights/daily` now 401s ("Could not validate credentials") instead of the old
  422 "mautic_url required" — auth-gated on the real session as intended.

### Not done / follow-up
- Manual end-to-end check with a real logged-in browser session + real synced email data
  wasn't done this session (would need Mike's live Gmail-connected org) — the AI Insights card
  should now show either real synthesized insights or the new "No recent email activity yet.
  Connect your inbox in Settings..." empty state, never the old Mautic message. Worth a quick
  look next time Mike's on `/dashboard`.
- `mautic_connected` field on the response is currently hardcoded `true` in the success path
  (kept for response-shape compatibility) — doesn't mean anything anymore now that Mautic isn't
  the gate; nothing in the frontend reads it today (`demoMode` is keyed off a different check),
  so left as-is rather than over-engineering an unused field.

---

# Voice AI Outbound Calling — Revive (queued, 2026-07-17)

## Context
Mike previously had a Claude Code agent build conversational AI outbound phone calling into
LeadSpot. Currently off/not showing. Goal (confirmed by Mike): get it working again as-is first
— NOT scoping monetization/billing yet, just functional for his own use.

## Surface findings (not yet deep-researched)
- Frontend: `/voice-agents` list/new/edit pages fully built, in nav
  (`frontend/app/(dashboard)/layout.tsx`), but hidden behind `NEXT_PUBLIC_VOICE_ENABLED`
  (currently unset — that's the immediate "why don't I see it" answer, but likely not the only gap).
- `voice-agent/` — separate Python/LiveKit service. Its README is STALE (describes old
  "Ploink CRM" naming + Mautic-only contact save) and doesn't match what `leadspot/CLAUDE.md`'s
  architecture table describes (Deepgram STT + GPT-4 + ElevenLabs TTS, Google Calendar booking,
  Twilio SMS). Need to read `voice-agent/src/agent.py` directly to find out which stack is
  actually implemented — the README cannot be trusted.
- `dashboard/` — separate Prisma+Stripe billing service for prepaid voice minutes
  ($0.10/min). Explicitly scoped OUT of the July 15 Render deploy ("not needed for personal-CRM
  use"). Per Mike's answer this session, billing/gating stays out for this pass too — but the
  webhook route work from "Voice AI Production Plan — Phase 1 & 2" (this file, ~line 103) lives
  in `dashboard/src/app/api/voice/calls/from-sip/route.ts` and may be load-bearing for the call
  flow itself (balance hold on call start), not just billing — needs verification before assuming
  it can stay disabled.
- `backend/app/routers/twilio_webhook.py` exists (signature validation, call status logging,
  empty TwiML response) — part of the call flow, backend-side.
- No env files checked yet for what's actually configured vs. stubbed (voice-agent/.env exists
  but unknown contents — do not read/print secrets, just check which keys are present vs blank).

## Next steps (start of next session on this)
- [ ] Read `voice-agent/src/agent.py` in full to determine actual STT/LLM/TTS stack in use
- [ ] Check `voice-agent/.env` for which provider keys are present (key names only, not values)
- [ ] Determine whether `dashboard/` (from-sip balance hold) is required for basic outbound
      calling to function, or whether it's purely a billing gate that can be bypassed for
      personal use
- [ ] Check LiveKit Cloud account / API keys status — `voice-agent/README.md` implies LiveKit
      Cloud deploy is required for `start` mode (not local-only)
- [ ] Trace `/voice-agents` frontend pages → what backend/agent-service endpoints they call,
      confirm those routes exist and work
- [ ] Once stack is understood, write a proper plan (this todo file) before making changes
- [ ] Flip `NEXT_PUBLIC_VOICE_ENABLED=true` locally only after the above is verified working,
      not before (avoid exposing a broken nav item)

## Out of scope (this pass, per Mike)
- Billing/Stripe wiring, prepaid minute balance UI, monetization/pricing as an "upgrade tier"
  — functional revival only for now
