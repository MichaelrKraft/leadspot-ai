# LeadSpot Full Launch Plan
# Last updated: 2026-03-30
# Scope: All work required to go from current state → beta launch

---

## CURRENT STATE AUDIT

### ✅ Working
- Auth: register, login, JWT, token refresh, dev bypass
- Settings: PATCH /auth/me (profile updates live)
- Admin dashboard: useAdminStats + useRecentActivity hooks (real)
- Chat / Command Center: agent.ts + chat.ts → backend on port 8000
- Backend: auth, chat, insights, query (RAG), admin, documents, billing, health, agent_proxy all deployed

### ⚠️ Mocked / Incomplete
- Contacts page: hardcoded `demoContacts[]` array (contacts.py does NOT exist on backend)
- Calendar page: hardcoded `DEMO_EVENTS` object (calendar.py does NOT exist on backend)
- Deals page: PipelineKanban wrapper exists (deals.py does NOT exist on backend)
- Query page: demo mode via `?demo=bonds` URL param (backend /api/query exists but not wired)
- Inbox page: component exists (358 lines) — wire status unknown
- Settings: "Mautic" text still visible; billing/API keys sections not wired
- Smart Lists: agent.ts has stubs but agent-service (port 3008) wire status unknown

### Backend Gap Summary
Three backend routers need to be CREATED:
- `backend/app/routers/contacts.py` — wraps Mautic contacts API
- `backend/app/routers/deals.py` — SQLite-backed deal pipeline CRUD
- `backend/app/routers/calendar.py` — SQLite-backed calendar events + availability

---

## PHASE 1: Backend — Create Missing Routers
**Owner: sub-agent (backend)**
**Files to create/modify in /Users/michaelkraft/leadspot/backend/**

### 1.1 — contacts.py router
Create `backend/app/routers/contacts.py`:
- `GET  /api/contacts` — list contacts (proxy to Mautic GET /contacts, params: page, limit, search)
- `GET  /api/contacts/:id` — get single contact
- `POST /api/contacts` — create contact (proxy to Mautic POST /contacts)
- `PATCH /api/contacts/:id` — update contact fields
- `DELETE /api/contacts/:id` — delete contact

Response shape per contact:
```json
{
  "id": "string",
  "name": "string",
  "email": "string",
  "company": "string",
  "status": "lead|prospect|customer|churned",
  "score": 0,
  "lastActivity": "ISO date string",
  "tags": ["string"],
  "phone": "string"
}
```
Register in `backend/app/main.py` → `app.include_router(contacts_router, prefix="/api")`

### 1.2 — deals.py router
Create `backend/app/routers/deals.py` using SQLite (same DB as auth):
- `GET  /api/deals` — list all deals for org (filtered by org_id from JWT)
- `GET  /api/deals/stages` — return stage definitions
- `POST /api/deals` — create deal
- `PATCH /api/deals/:id` — update deal (including stage change for drag-drop)
- `DELETE /api/deals/:id` — delete deal

Deal model fields: id, title, contact_id, contact_name, value (float), stage (enum), priority (low/medium/high), days_in_stage (computed), created_at, updated_at, org_id

Stages enum: `lead` → `qualified` → `proposal` → `negotiation` → `won` → `lost`

Create `backend/app/models/deal.py` with SQLAlchemy model.
Register in `backend/app/main.py`.

### 1.3 — calendar.py router
Create `backend/app/routers/calendar.py` using SQLite:
- `GET  /api/calendar/events` — list events (params: start, end date range)
- `POST /api/calendar/events` — create event
- `PATCH /api/calendar/events/:id` — update event
- `DELETE /api/calendar/events/:id` — delete event
- `GET  /api/calendar/availability` — get availability windows for an agent
- `POST /api/calendar/availability` — save availability settings
- `POST /api/calendar/book` — public booking endpoint (no auth required, creates event + sends confirmation)

Event model fields: id, title, start (datetime), end (datetime), type (call/meeting/demo/task), contact_id, contact_name, agent_id, notes, org_id

Register in `backend/app/main.py`.

---

## PHASE 2: Frontend — Wire Contacts Page
**Owner: sub-agent (frontend)**
**File: /Users/michaelkraft/leadspot/frontend/app/(dashboard)/contacts/page.tsx**

Current state: Uses hardcoded `demoContacts[]` (349 lines). Has search, add modal, table view.

Changes needed:
1. Create `frontend/lib/api/contacts.ts`:
   - `listContacts(page, limit, search)` → GET /api/contacts
   - `createContact(data)` → POST /api/contacts
   - `updateContact(id, data)` → PATCH /api/contacts/:id
   - `deleteContact(id)` → DELETE /api/contacts/:id
   - Use auth token from `useAuthStore.getState().token`

2. In `contacts/page.tsx`:
   - Replace `demoContacts` state with `useState<Contact[]>([])`
   - Add `useEffect` that calls `listContacts()` on mount
   - Add loading state + loading skeleton (table rows with pulse animation)
   - Add empty state: "No contacts yet. Add your first contact to get started."
   - Wire search input to re-fetch with search param (debounce 300ms)
   - Wire "Add Contact" modal submit to `createContact()`
   - Wire delete action to `deleteContact()`
   - Handle API errors with toast/alert

---

## PHASE 3: Frontend — Wire Dashboard Stats
**Owner: sub-agent (frontend)**
**File: /Users/michaelkraft/leadspot/frontend/app/(dashboard)/dashboard/page.tsx**

Current state: 412 lines. Has hot leads, CRM stats cards, AI insights, approval queue, activity feed.
Backend: `GET /insights/daily` and `GET /insights/stats` exist in insights.py.

Check `frontend/lib/api/dashboard.ts` — already has `getHotLeads()` and `getDashboardStats()`.

Changes needed:
1. Audit dashboard/page.tsx for any hardcoded mock data
2. Ensure `useEffect` calls real API on mount
3. Wire approval queue to `/api/agent/approval-queue` (agent.ts already has this)
4. Add loading skeletons for stat cards
5. Add error state if backend is offline

---

## PHASE 4: Frontend — Wire Query Page to Real RAG
**Owner: sub-agent (frontend)**
**File: /Users/michaelkraft/leadspot/frontend/app/(dashboard)/query/page.tsx**

Current state: Has demo mode via `?demo=bonds` URL param, `EXAMPLE_QUERIES` fallback.
Backend: `/api/query` endpoint exists in query_local.py / query.py.

Changes needed:
1. Remove demo mode — always call real `/api/query` endpoint
2. Keep `EXAMPLE_QUERIES` as placeholder suggestions in the input (not as fake results)
3. POST to `/api/query` with `{ query: string, org_id: string }`
4. Display real `answer`, `citations[]`, `sources[]` from response
5. Wire query history page to show past queries (if backend has `/api/query/history`)

---

## PHASE 5: Frontend — Wire Pipeline/Kanban
**Owner: sub-agent (frontend)**
**Files:**
- `/Users/michaelkraft/leadspot/frontend/app/(dashboard)/deals/page.tsx`
- `/Users/michaelkraft/leadspot/frontend/components/deals/PipelineKanban.tsx`

Current state: deals/page.tsx is 53 lines (wrapper), PipelineKanban component exists.

Changes needed:
1. Create `frontend/lib/api/deals.ts`:
   - `listDeals()` → GET /api/deals
   - `createDeal(data)` → POST /api/deals
   - `updateDeal(id, data)` → PATCH /api/deals/:id (includes stage change)
   - `deleteDeal(id)` → DELETE /api/deals/:id

2. In `PipelineKanban.tsx`:
   - Replace hardcoded demo deals with `useEffect` → `listDeals()`
   - On drag-drop: call `updateDeal(id, { stage: newStage })`
   - Add "New Deal" button/modal → calls `createDeal()`
   - Loading state: skeleton columns
   - Empty state per column: "+ Add deal"

3. In `deals/page.tsx`:
   - Pass data down to PipelineKanban or let it manage its own state

---

## PHASE 6: Frontend — Wire Calendar
**Owner: sub-agent (frontend)**
**Files:**
- `/Users/michaelkraft/leadspot/frontend/app/(dashboard)/calendar/page.tsx`
- `/Users/michaelkraft/leadspot/frontend/components/calendar/CalendarGrid.tsx`
- `/Users/michaelkraft/leadspot/frontend/components/calendar/EventModal.tsx`

Current state: calendar/page.tsx has hardcoded `DEMO_EVENTS` (290 lines).

Changes needed:
1. Create `frontend/lib/api/calendar.ts`:
   - `listEvents(start, end)` → GET /api/calendar/events
   - `createEvent(data)` → POST /api/calendar/events
   - `updateEvent(id, data)` → PATCH /api/calendar/events/:id
   - `deleteEvent(id)` → DELETE /api/calendar/events/:id

2. In `calendar/page.tsx`:
   - Replace `DEMO_EVENTS` with `useState<CalendarEvent[]>([])`
   - `useEffect` on month change → fetch events for visible date range
   - Wire EventModal "save" → createEvent / updateEvent
   - Wire delete button → deleteEvent

3. Build public booking page:
   - Create `frontend/app/(public)/book/[agentId]/page.tsx`
   - Show agent name + available time slots (GET /api/calendar/availability)
   - Form: name, email, phone, reason
   - Submit → POST /api/calendar/book
   - Success: confirmation screen with calendar invite link
   - No auth required (public page)

---

## PHASE 7: Settings Cleanup
**Owner: sub-agent (frontend)**
**File: /Users/michaelkraft/leadspot/frontend/app/(dashboard)/settings/page.tsx**

Changes needed:
1. Search entire settings page for "Mautic" — replace with "CRM Connection"
   - Also check: `components/settings/` directory for any sub-components
2. Wire API Keys section to backend `/api/settings/api-keys` endpoints (these exist in settings.py):
   - `GET /api/settings/api-keys` → list keys
   - `POST /api/settings/api-keys` → generate key
   - `DELETE /api/settings/api-keys/:key_id` → revoke key
3. Wire CRM Connection section to `/api/settings/mautic` endpoints
4. Wire Billing section to `/api/billing` endpoints:
   - Show wallet balance
   - Top-up button → Stripe checkout
   - Usage history table

---

## PHASE 8: Wire Inbox
**Owner: sub-agent (frontend)**
**File: /Users/michaelkraft/leadspot/frontend/app/(dashboard)/inbox/page.tsx**

Current state: 358 lines, has email/SMS conversations, drag-resize columns, compose modal.
Need to verify if it's wired or mocked.

Steps:
1. Read the current inbox/page.tsx in full to determine mock vs real
2. If mocked: create `frontend/lib/api/inbox.ts` with:
   - `listThreads(type: 'email'|'sms'|'all')` → GET /api/inbox/threads
   - `getThread(id)` → GET /api/inbox/threads/:id
   - `sendReply(threadId, message)` → POST /api/inbox/threads/:id/reply
3. Wire thread list to real API
4. Wire compose modal to send real email via backend

---

## PHASE 9: Smart Lists & Voice Agents
**Owner: sub-agent (frontend)**
**Files:**
- `/Users/michaelkraft/leadspot/frontend/app/(dashboard)/smart-lists/page.tsx`
- `/Users/michaelkraft/leadspot/frontend/app/(dashboard)/voice-agents/page.tsx`

Changes needed:
1. Smart Lists — wire to agent-service via agent.ts:
   - `evaluateSmartList(criteria)` already in agent.ts → connect to UI
   - Show matching contact count + sample contacts
2. Voice Agents — wire to `/api/agent/voice-agents` or direct backend:
   - List agents (GET)
   - Create/configure agent (POST)
   - View call history (GET /api/agent/calls)
   - Show usage stats (minutes used, balance)

---

## PHASE 10: Remaining Pages (can be post-MVP if needed)
**Owner: sub-agent (frontend)**

- **Documents page** (`/documents`) → wire to `/api/documents` (upload, list, delete — backend exists)
- **Health page** (`/health`) → wire to `/api/health` and `/api/internal/health/{service}`
- **Campaigns page** → wire to Mautic campaigns via backend proxy
- **Emails page** → wire to Mautic emails/broadcasts via backend proxy
- **Segments page** → wire to Mautic segments via backend proxy
- **Reports page** → wire to analytics data from admin endpoints
- **Community page** → either wire to real DB or show "Coming Soon" placeholder

---

## PHASE 11: Pre-Launch Polish
**Owner: sub-agent (frontend)**

- [ ] Add error boundaries to all dashboard pages (catch API failures gracefully)
- [ ] Add consistent loading skeleton pattern to all list pages
- [ ] Add empty states to all list pages with helpful CTAs
- [ ] Fix `backend/.env` FRONTEND_URL to match actual running port (3002)
- [ ] Verify CORS in `backend/app/config.py` includes production domain
- [ ] Smoke test: register → login → add contact → create deal → create event → query
- [ ] Mobile responsiveness pass on contacts, deals, calendar

---

## EXECUTION ORDER FOR SUB-AGENTS

### Batch 1 (parallel — no dependencies between them):
- Sub-agent A: Phase 1.1 (contacts.py backend) + Phase 2 (wire contacts page)
- Sub-agent B: Phase 1.2 (deals.py backend) + Phase 5 (wire kanban)
- Sub-agent C: Phase 1.3 (calendar.py backend) + Phase 6 (wire calendar)

### Batch 2 (after Batch 1 completes):
- Sub-agent D: Phase 3 (dashboard stats) + Phase 4 (query page)
- Sub-agent E: Phase 7 (settings cleanup) + Phase 8 (inbox)

### Batch 3:
- Sub-agent F: Phase 9 (smart lists + voice agents) + Phase 10 (remaining pages)
- Sub-agent G: Phase 11 (polish — runs last)

---

## KEY CONSTANTS

- Frontend runs on: http://localhost:3002
- Backend runs on: http://localhost:8000
- Agent-service runs on: http://localhost:3008
- Backend DB: `backend/leadspot.db` (SQLite)
- Auth token: `useAuthStore.getState().token` (Zustand, persisted to localStorage)
- Org ID: `useAuthStore.getState().user?.organizationId ?? 'demo-org'`
- All frontend API calls use: `process.env.NEXT_PUBLIC_API_URL` (= http://localhost:8000)
- Auth header pattern: `Authorization: Bearer ${token}`

---

## Review
_To be filled in as work completes._
