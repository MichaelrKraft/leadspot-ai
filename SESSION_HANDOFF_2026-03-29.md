# LeadSpot AI Agent Service — Session Handoff
**Date**: 2026-03-29
**Session Duration**: ~4 hours (overnight build)
**Agent**: Claude Opus 4.6 (1M context)

---

## What Was Built

In a single session, we designed and implemented the complete AI agent backend for LeadSpot.ai — an AI-first CRM for real estate agents competing with Follow Up Boss (FUB). The system combines Mike's existing LeadSpot CRM (FastAPI + Mautic + Next.js) with autonomous agent technology extracted from his Johnny5 project.

### Project Structure

```
/Users/michaelkraft/leadspot/
├── agent-service/          <-- NEW (built this session)
│   ├── package.json        # Node.js TypeScript project
│   ├── tsconfig.json       # Strict mode
│   ├── node_modules/       # Installed
│   └── src/                # 23 files, 9,433 lines, 0 type errors
│       ├── types.ts                    (202 lines)  Shared type definitions
│       ├── server.ts                   (338 lines)  Express server, port 3008
│       ├── db/index.ts                 (209 lines)  Per-org SQLite, WAL mode
│       ├── cron/index.ts               (818 lines)  Scheduled CRM jobs
│       ├── memory/
│       │   ├── fact-extraction.ts      (509 lines)  Contact fact extraction via Claude Haiku
│       │   └── context-builder.ts      (331 lines)  AI prompt context assembly
│       ├── router/index.ts             (310 lines)  5 RE crew members, keyword + AI classification
│       ├── orchestrator/index.ts       (525 lines)  Central brain, brief generation, suggestions
│       ├── smart-lists/index.ts        (592 lines)  FUB Smart Lists + Smart List Zero
│       ├── action-plans/
│       │   ├── index.ts                (605 lines)  Drip sequences, 3 defaults
│       │   └── auto-pause.ts           (375 lines)  Response detection, auto-pause
│       ├── voice-commands/index.ts     (465 lines)  Hands-free mobile CRM
│       ├── timeline/index.ts           (473 lines)  Omnichannel feed, speed-to-lead
│       ├── lead-routing/index.ts       (599 lines)  4 strategies, team agents, rules
│       ├── lead-ponds/index.ts         (390 lines)  Shared lead pools
│       ├── reporting/index.ts          (908 lines)  6 BI report types + caching
│       └── routes/                     (7 files)    Express route modules
│           ├── smart-lists.ts
│           ├── action-plans.ts
│           ├── lead-routing.ts
│           ├── lead-ponds.ts
│           ├── timeline.ts
│           ├── voice-commands.ts
│           └── reporting.ts
├── backend/                <-- EXISTING (minor changes)
│   ├── app/routers/agent_proxy.py     <-- NEW: proxies /api/agent/* to port 3008
│   └── app/main.py                    <-- MODIFIED: added agent_proxy router
├── frontend/               <-- EXISTING (additions)
│   ├── lib/api/agent.ts               <-- NEW: API client for agent-service
│   ├── lib/dashboard-demo-data.ts     <-- NEW: shared types/demo data
│   ├── app/(dashboard)/
│   │   ├── smart-lists/page.tsx       <-- NEW: Smart Lists page
│   │   ├── timeline/page.tsx          <-- NEW: Timeline page
│   │   └── dashboard/page.tsx         <-- MODIFIED: added AI brief, queue, activity
│   └── components/auth/AuthGuard.tsx  <-- MODIFIED: dev mode bypass
└── SESSION_HANDOFF_2026-03-29.md      <-- THIS FILE
```

---

## Current State of Each System

### Agent Service (port 3008) — WORKING
- **Status**: Compiles clean (0 TypeScript errors), runs successfully
- **Server**: Express on port 3008 with 55+ routes
- **Database**: SQLite per-organization, auto-created on first request
- **AI Model**: All modules use `claude-haiku-4-5-20251001` for cost efficiency
- **Demo data**: Default Smart Lists (5), Action Plans (3), Lead Ponds (2) initialized for `demo-org`
- **Tested endpoints**: 11/11 passing (health, smart-lists, action-plans, ponds, routing, timeline, voice, queue, cron)
- **Known issue**: Pipeline brief returns empty data because LeadSpot backend (port 8000) is not running — this is expected; the orchestrator gracefully falls back to empty arrays

### LeadSpot Backend (port 8000) — NOT RUNNING
- **Status**: Python dependencies not installed (`pip install -r requirements.txt` needed)
- **What it does**: FastAPI server with 14 Mautic CRM tools, Claude chat endpoint, OAuth, billing
- **Agent proxy**: `agent_proxy.py` created to forward `/api/agent/*` to port 3008
- **Critical**: The AI Command Center chat (`/api/chat`) requires this to be running

### LeadSpot Frontend (port 3003 currently) — RUNNING
- **Status**: Running on port 3003 (fell to this port because 3000-3002 were in use)
- **Normal port**: 3006 (set in the project config)
- **Auth bypass**: Dev mode bypass added to `AuthGuard.tsx` — when `NEXT_PUBLIC_APP_ENV=development`, auth is skipped entirely
- **New pages**: Smart Lists (`/smart-lists`), Timeline (`/timeline`), enhanced Dashboard
- **API client**: `lib/api/agent.ts` points to `http://localhost:3008` directly (bypasses FastAPI since it's not running)
- **Known issues**:
  - Card backgrounds were dark (`#1e2639`), changed to lighter `#283347` — may still need design iteration
  - Dashboard and Timeline pages import from `@/lib/api/agent` and fall back to demo data on fetch failure

---

## Architecture Decisions Made

1. **TypeScript sidecar, not Python merge**: The agent-service runs as a separate Node.js process. LeadSpot's FastAPI proxies to it. This avoids mixing Python and TypeScript in one process while keeping a single API surface for the frontend.

2. **Mautic is invisible**: Users never see "Mautic" anywhere. LeadSpot IS the product. Mautic is the open-source CRM engine under the hood, accessed only via abstracted APIs.

3. **Per-org SQLite**: Each organization gets its own SQLite database (WAL mode) at `{dataDir}/orgs/{orgId}/agent.db`. This scales to ~100 orgs before needing PostgreSQL migration.

4. **Claude Haiku everywhere**: All AI features use `claude-haiku-4-5-20251001` for cost efficiency (~$0.001 per call). The orchestrator uses Haiku for brief synthesis, the router uses it for task classification, voice commands for parsing, timeline for summaries.

5. **Smart Lists evaluate mock data**: The `evaluateSmartList` function currently uses 7 hardcoded mock contacts for development. In production, it needs to call LeadSpot's Mautic API to get real contacts.

6. **Target market**: Real estate agents (not home services, which was LeadSpot's original landing page target).

---

## What Needs to Be Done Next (Priority Order)

### Priority 1: Get the FastAPI Backend Running
```bash
cd /Users/michaelkraft/leadspot/backend
pip install -r requirements.txt
# Set env vars (ANTHROPIC_API_KEY, MAUTIC_BASE_URL, etc.)
uvicorn app.main:app --reload --port 8000
```
Then change `frontend/lib/api/agent.ts` API_URL back to `http://localhost:8000` so all requests go through the FastAPI proxy.

### Priority 2: Replace Mock Data with Real Mautic API Calls
Files with TODO stubs that need real API integration:
- `agent-service/src/orchestrator/index.ts` — `fetchPipelineData()` and `fetchContact()` have been partially wired to call `/api/insights/daily` but need the backend running
- `agent-service/src/smart-lists/index.ts` — `evaluateSmartList()` uses 7 mock contacts; needs to call LeadSpot's `/api/contacts` endpoint
- `agent-service/src/action-plans/index.ts` — `processNextStep()` stubs email/SMS/tag sends; needs to call Mautic tools
- `agent-service/src/lead-routing/index.ts` — `routeLead()` works but needs real contact data from Mautic
- `agent-service/src/voice-commands/index.ts` — `executeVoiceCommand()` stubs all CRM operations
- `agent-service/src/timeline/index.ts` — `getTimelineSummary()` works with Claude but needs real timeline data
- `agent-service/src/lead-ponds/index.ts` — `evaluateAutoPondRules()` is fully stubbed

### Priority 3: Frontend Polish
- Smart Lists card styling may need further iteration (currently `bg-[#283347]`)
- Dashboard AI sections (Morning Brief, Approval Queue, Activity Feed) use demo fallback data
- Timeline page needs testing with real data
- All new pages need to match the existing LeadSpot design language exactly

### Priority 4: Wire Cron Jobs to Orchestrator
The cron service creates default jobs but the orchestrator's `handleCronAction` cases are TODO-stubbed:
- `expired_claim_check` — needs to call `processExpiredClaims()` from lead-routing
- `auto_pond_check` — needs to call `evaluateAutoPondRules()` from lead-ponds
- `auto_resume_check` — needs to call `processAutoResumes()` from auto-pause
- `process_action_plans` — needs to call `getDueEnrollments()` + `processNextStep()` from action-plans

### Priority 5: Frontend Components Not Yet Built
- Action Plans builder/viewer page
- Lead Routing configuration page
- Lead Ponds management page
- Voice Commands interface (mobile-optimized)
- Reporting/BI dashboard with charts
- Contact detail page with inline AI suggestions + timeline

---

## Key Files to Read First

If you're picking this up, read these files in this order:

1. `/Users/michaelkraft/leadspot/CLAUDE.md` — Project-level instructions and port allocations
2. `/Users/michaelkraft/.claude/plans/glowing-wiggling-hinton.md` — The strategic integration plan
3. `/Users/michaelkraft/leadspot/agent-service/src/types.ts` — All shared types
4. `/Users/michaelkraft/leadspot/agent-service/src/server.ts` — Entry point, see all routes
5. `/Users/michaelkraft/leadspot/agent-service/src/orchestrator/index.ts` — Central brain
6. `/Users/michaelkraft/leadspot/frontend/lib/api/agent.ts` — Frontend API client
7. `/Users/michaelkraft/leadspot/frontend/app/(dashboard)/smart-lists/page.tsx` — Working frontend page

---

## How to Start Everything

```bash
# Terminal 1: Agent Service (required for all new features)
cd /Users/michaelkraft/leadspot/agent-service
npx tsx src/server.ts
# Runs on port 3008

# Terminal 2: FastAPI Backend (required for chat, contacts, Mautic integration)
cd /Users/michaelkraft/leadspot/backend
pip install -r requirements.txt  # First time only
uvicorn app.main:app --reload --port 8000

# Terminal 3: Frontend
cd /Users/michaelkraft/leadspot/frontend
npm run dev
# Usually port 3006, but check terminal output

# Initialize demo data (run once after agent-service starts):
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

## Environment Variables Needed

### Agent Service (`agent-service/`)
```bash
ANTHROPIC_API_KEY=sk-ant-...     # Required for AI features
AGENT_SERVICE_PORT=3008          # Default
LEADSPOT_API_URL=http://localhost:8000  # FastAPI backend
DEFAULT_TIMEZONE=America/Los_Angeles
```

### Frontend (`frontend/`)
```bash
NEXT_PUBLIC_API_URL=http://localhost:8000          # FastAPI (when running)
NEXT_PUBLIC_AGENT_SERVICE_URL=http://localhost:3008 # Direct (when FastAPI is down)
NEXT_PUBLIC_APP_ENV=development                     # Enables auth bypass
```

---

## Design Decisions the Next Agent Should NOT Change

1. **Do not merge agent-service into the FastAPI backend** — the sidecar architecture is intentional
2. **Do not expose Mautic terminology in the UI** — LeadSpot IS the product
3. **Do not change the SQLite per-org pattern** — it works and scales to 100 orgs
4. **Do not switch from Claude Haiku to a larger model** for classification/extraction — cost matters at scale
5. **Do not remove the dev auth bypass** — it's gated behind `NEXT_PUBLIC_APP_ENV=development`
6. **Keep all modules self-contained** — each module has its own `ensureTables()` for DB setup, no shared migrations

---

## Competitive Context

LeadSpot + Agent Service is positioned as a Follow Up Boss killer for real estate agents. The key differentiators vs FUB:

| Feature | FUB | LeadSpot |
|---------|-----|----------|
| AI | Bolted-on chatbot | Woven into every screen |
| Smart Lists | Static filters | AI-prioritized with Smart List Zero |
| Action Plans | Template-only | AI-drafted content with auto-pause on response |
| Lead Routing | Basic round-robin | 4 strategies + Lead Ponds |
| Voice | None | Hands-free mobile CRM updates |
| Memory | None | Per-contact fact extraction, gets smarter over time |
| Speed-to-Lead | Reports only | Real-time tracking + leaderboards |
| Pricing | $25-69/user/month | $297-797/org/month (all-inclusive) |

---

## Gotchas and Traps the Next Agent MUST Know

### 1. The DB module creates tables lazily — but modules don't share table creation
Each module (smart-lists, action-plans, lead-routing, lead-ponds, timeline, voice-commands, reporting) has its OWN `ensureTables()` function that creates its tables on first access. The central `db/index.ts` only creates the CORE tables (extracted_facts, suggestions, briefs, cron_jobs, cron_runs). If you add a new module that queries another module's tables, you must call that module's `ensureTables()` first or wrap the query in try/catch.

### 2. The frontend API client has TWO potential URL targets
`frontend/lib/api/agent.ts` currently points to `http://localhost:3008` (agent-service directly). In production it should point to `http://localhost:8000` (FastAPI which proxies). When you start the FastAPI backend, change the URL back to 8000 and test the proxy. The env var is `NEXT_PUBLIC_AGENT_SERVICE_URL`.

### 3. The `agent_proxy.py` uses httpx but it may not be installed
The FastAPI proxy router imports `httpx` for async HTTP forwarding. Check that it's in `requirements.txt`. If not, add it before starting the backend.

### 4. The orchestrator's exhaustive switch on CRMAction
The orchestrator in `orchestrator/index.ts` has a `default: never` exhaustive switch on `CRMAction` type. If you add new action types to `types.ts`, the TypeScript compiler will ERROR until you add a matching case in the orchestrator. This is by design — it prevents forgetting to handle new actions.

### 5. The cron service stores jobs in SQLite but the agent-service db/index.ts schema might not match
The `cron/index.ts` has its own CronStore that uses `getDb()` and creates `cron_jobs` + `cron_runs` tables. The `db/index.ts` ALSO creates `cron_jobs` and `cron_runs` in its `initializeDb()`. These schemas MUST match. If you modify one, update the other. Check both files' CREATE TABLE statements.

### 6. Multiple agents wrote files in parallel — watch for inconsistent patterns
This codebase was written by 6+ parallel sub-agents. While all files pass TypeScript type-checking, the internal patterns vary slightly:
- Some modules export classes (CRMCronService, CRMTaskRouter), others export functions
- Some use `ensureTables()` with a Set-based memoization, others use a boolean flag
- The reporting module uses `safeQuery`/`safeQuerySingle` helpers; other modules don't
- Type field naming varies between modules (e.g., `contact.score` vs `contact.leadScore`, `contact.firstName` vs `contact.name`)
These inconsistencies are handled in the frontend via accessor functions, but be aware when adding new features.

### 7. The frontend auth bypass has a subtle behavior
The `AuthGuard.tsx` dev bypass checks `process.env.NEXT_PUBLIC_APP_ENV === 'development'`. This is set in `/Users/michaelkraft/leadspot/frontend/.env`. If someone changes that value or the env file isn't loaded, the auth spinner returns. The bypass is in the component, not middleware.

### 8. Port conflicts are common on this machine
Mike runs many services. Ports 3000, 3001, 3002 were all occupied when we started the frontend. The normal LeadSpot frontend port is 3006. Always check terminal output for the actual port Next.js chose. The agent-service on 3008 should be stable.

### 9. The `reporting/index.ts` module queries tables from OTHER modules
The reporting module runs SQL queries against `timeline_events`, `routing_assignments`, `smart_list_actions`, `team_agents`, and `action_plan_enrollments`. These tables are created by their respective modules, NOT by the reporting module. If those modules haven't been accessed yet for a given org, the tables won't exist. The reporting module wraps all cross-module queries in `safeQuery()` which returns empty results on table-not-found errors.

### 10. There's no git commit yet
All of this work is uncommitted. The git status shows we're on branch `nightagent/2026-03-28` with a massive number of untracked files. The next agent should commit the agent-service, backend proxy, and frontend changes as a meaningful commit before doing more work.

### 11. The LeadSpot landing page says "home services" but we're targeting real estate
The GHL extraction funnel at `/Users/michaelkraft/ghl-extraction/funnels/leadspot-main.md` targets plumbers, HVAC, landscapers. Mike explicitly said the target is real estate agents. The landing page copy needs updating but that's a separate task from the backend work.

---

## Mike's Preferences (from this session)

- Prefers simple, minimal code changes — "every change should impact as little code as possible"
- Wants to see live results immediately — open browser after UI changes
- Dark theme UI with the existing LeadSpot color scheme (dark navy `#1e2639` sidebar, `#0a0a0d` content area)
- Card backgrounds should be lighter than the page background for contrast (currently `#283347`)
- Doesn't want to see "Mautic" anywhere in the product
- Prefers parallel agent execution for speed
- Target market: real estate agents (solo agents and teams/brokerages)
