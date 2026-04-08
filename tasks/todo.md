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
- [ ] Create `backend/app/routers/reports.py` — GET /api/reports/summary (aggregate counts/sums from existing tables)
- [ ] Register reports router in `backend/app/main.py`
- [ ] Create `frontend/lib/api/reports.ts` — getReportsSummary() using apiClient
- [ ] Update `frontend/app/(dashboard)/reports/page.tsx` — replace hardcoded data with API call, add loading + error states

#### P2 — UX gaps worth fixing
- [ ] **Contacts** — Import, Export, "Send email", "Add to segment", "View Details" are all no-op stubs
- [ ] **Decisions page** — fully built + wired but hidden from nav (intentional?)
- [ ] **Hidden pages not in nav** — /documents, /query, /health, /scheduled, /sources all exist but unreachable from UI
- [ ] **Header shows email only** — no user display name
- [ ] **Settings sub-nav** — Billing/Integrations only reachable by direct URL

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
_To be filled after completion_
