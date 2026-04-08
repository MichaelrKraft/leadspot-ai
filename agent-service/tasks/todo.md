# CRM Cron Service & Database Layer

## Plan

- [x] Read types.ts for type definitions
- [x] Read Johnny5 cron-service.ts for reference implementation
- [x] Verify directory structure exists
- [x] Create `src/db/index.ts` - SQLite database layer with per-org DBs
- [x] Create `src/cron/index.ts` - CRM-adapted cron service using SQLite
- [x] Type-check (no new errors - only pre-existing server.ts issues)

## Review

Both files created successfully. No type errors introduced.

### src/db/index.ts
- `getDb(organizationId)` returns cached `better-sqlite3` connection
- DBs stored at `{dataDir}/orgs/{organizationId}/agent.db`
- WAL mode + foreign keys enabled on each connection
- Tables: `extracted_facts` (with UNIQUE on org+contact+key), `suggestions`, `briefs`, `cron_jobs` (with UNIQUE on org+name), `cron_runs`
- Indexes on common query patterns (org_contact, org_status, job_id)
- Exports: `getDb`, `initializeDb`, `closeAll`, `closeDb`, `setDataDir`, `getDataDir`, `connectionCount`

### src/cron/index.ts
- `CRMCronService` class adapted from Johnny5's `CronService`
- SQLite-backed `CronStore` replaces file-based JSON storage
- `organizationId` replaces `userId` throughout
- Scheduling: croner for cron expressions, setTimeout for at/every
- Retry logic: 3 attempts with exponential backoff (1s, 2s, 4s)
- 30s execution timeout per job
- Default CRM jobs: Daily Pipeline Brief (7am), Follow-Up Check (8am/12pm/4pm M-F), Stalled Deal Alert (9am daily), Weekly Report (Friday 5pm)
- Factory: `createCronService(config)` with singleton pattern + `resetCronService()`
- Helpers: `parseDuration`, `formatDuration`, `formatJobInfo`
- No `any` types used anywhere

---

# Smart Lists Engine

## Plan

- [x] Read types.ts and db/index.ts for context
- [x] Create `src/smart-lists/index.ts` with:
  - [x] SmartList types (SmartListRule, SmartList, SmartListContact, SmartListResult)
  - [x] DB table creation (smart_lists, smart_list_actions)
  - [x] CRUD functions (create, get, getAll, update, delete)
  - [x] evaluateSmartList with rule matching, priority calc, suggested actions
  - [x] createDefaultSmartLists (5 default lists)
  - [x] markContactActedUpon for "Smart List Zero" tracking
- [x] Type-check (no new errors; only pre-existing action-plans/index.ts spread type issue)

## Review

Created `/Users/michaelkraft/leadspot/agent-service/src/smart-lists/index.ts` (~390 lines).

### Types
- `SmartListRule` - field/operator/value filter definition (7 operators)
- `SmartList` - saved list with rules, sort config, org binding
- `SmartListContact` - enriched contact with priority + suggested action
- `SmartListResult` - evaluation output with Smart List Zero tracking
- `RawContact` (internal) - pre-enrichment contact shape for rule matching

### DB
- `smart_lists` table with JSON rules column, default flag, timestamps
- `smart_list_actions` table for tracking acted-upon contacts
- Lazy `ensureTables()` with per-org memoization via Set

### Exported Functions
- `createSmartList()` - insert with UUID, returns full SmartList
- `getSmartLists()` - all lists for org, defaults first
- `getSmartList()` - single list by ID
- `updateSmartList()` - partial update (name, description, rules, sort)
- `deleteSmartList()` - cascades to actions table
- `evaluateSmartList()` - main engine: loads rules, filters contacts, assigns priority/action, sorts
- `createDefaultSmartLists()` - 5 FUB-style defaults in a transaction
- `markContactActedUpon()` - records action for Smart List Zero

### Heuristics
- Priority: urgent/high/medium/low based on staleness, score, recency, email engagement
- Suggested actions: speed-to-lead, email engagement, stalled deals, overdue follow-ups, nurture

### Mock Data
- 7 realistic RE contacts with varied profiles (new leads, stalled deals, nurture, hot leads)

---

# Voice Commands & Contact Timeline

## Plan

- [x] Read types.ts and db/index.ts for existing patterns
- [x] Create `src/voice-commands/index.ts` - Parse voice text into CRM actions via Claude Haiku
- [x] Create `src/timeline/index.ts` - Unified chronological activity feed per contact
- [x] Type-check both files (zero errors)
- [x] Review

## Review

Both files created and type-check cleanly. No `any` types used.

### src/voice-commands/index.ts (~310 lines)
- **Types:** VoiceCommandType (9 variants), ParsedVoiceCommand, VoiceCommandResult
- **DB:** `voice_commands` table with org index, lazy `ensureTables()` with Set memoization
- **`parseVoiceCommand()`** - Sends transcribed text to Claude Haiku with a RE-specific system prompt covering tags (hot/warm/cold lead, buyer/seller), stages (under contract, pending, closing), and activities (showing, open house, CMA). Returns structured ParsedVoiceCommand with confidence score and suggestedConfirmation.
- **`executeVoiceCommand()`** - Dispatcher to 9 per-type handler functions. Low-confidence (<0.6) commands auto-require confirmation. Each handler validates required fields and returns success/confirm result. Actual CRM API calls are stubbed with TODO comments.
- **`getCommandHistory()`** - Queries voice_commands table ordered by created_at DESC.
- **Handlers:** addTag, removeTag, addNote, updateStage, scheduleFollowup, logActivity, createContact, getSummary, unknown -- all with proper parameter validation.

### src/timeline/index.ts (~340 lines)
- **Types:** TimelineEventType (20 variants), TimelineEvent, TimelineSummary, TimelineQueryOptions
- **DB:** `timeline_events` table with contact + recent indexes, lazy `ensureTables()`
- **`logEvent()`** - Inserts event with UUID and ISO timestamp, returns full TimelineEvent.
- **`getTimeline()`** - Per-contact query with optional type filtering, limit, offset. Dynamic SQL with parameterized IN clause.
- **`getTimelineSummary()`** - Gathers total count, last contact date, days since, channel breakdown (20 event types mapped to 10 channels), then calls Claude Haiku for a 2-3 sentence actionable summary. Falls back to a static string on error.
- **`getRecentActivity()`** - Cross-contact dashboard feed ordered by created_at DESC.
- **`getSpeedToLead()`** - Minutes between first event and first outbound (call_outbound, email_sent, sms_sent). Returns null if no outbound yet.
- **`getAverageSpeedToLead()`** - Iterates all contacts with events in the time window, averages their speed-to-lead values.

### voice-commands/index.ts
1. Define types: VoiceCommandType, ParsedVoiceCommand, VoiceCommandResult
2. `ensureTables()` - create voice_commands table on first use
3. `parseVoiceCommand()` - Claude Haiku prompt with RE-specific patterns
4. `executeVoiceCommand()` - dispatcher to per-type handlers (stubbed)
5. `getCommandHistory()` - query from DB

### timeline/index.ts
1. Define types: TimelineEventType, TimelineEvent, TimelineSummary
2. `ensureTables()` - create timeline_events table with indexes
3. `logEvent()` - insert new event
4. `getTimeline()` - query with optional type filtering
5. `getTimelineSummary()` - AI-generated summary via Claude Haiku
6. `getRecentActivity()` - cross-contact recent feed
7. `getSpeedToLead()` - minutes from contact creation to first outbound
8. `getAverageSpeedToLead()` - org-wide average

---

# Action Plans Engine

## Plan

- [x] Read types.ts and db/index.ts for context
- [x] Create action-plans directory
- [x] Create `/src/action-plans/index.ts` with:
  - [x] Type definitions (ActionStepType, ActionStep, ActionPlan, ActionPlanEnrollment, ActionStepExecution)
  - [x] DB table initialization (action_plans, action_plan_enrollments + 4 indexes)
  - [x] CRUD functions (create, get, getAll, update, delete)
  - [x] Enrollment functions (enroll, getEnrollments, pause, resume, cancel)
  - [x] Step execution engine (processNextStep, getDueEnrollments)
  - [x] Placeholder replacement utility ({firstName}, {lastName}, {agentName}, {propertyAddress})
  - [x] 3 default plans (Speed to Lead, Open House Follow-Up, Long-Term Nurture)
- [x] Type-check: zero errors

## Review

### src/action-plans/index.ts (435 lines)

- **Types**: ActionStepType (6 types), ActionStep, ActionPlan, ActionStepExecution, ActionPlanEnrollment
- **DB**: 2 tables (action_plans, action_plan_enrollments), 4 indexes, lazy init via ensureTables()
- **CRUD**: createActionPlan, getActionPlans, getActionPlan, updateActionPlan, deleteActionPlan
- **Enrollment**: enrollContact (calculates first step delay), getEnrollments (filterable by plan/contact/status), pause/resume/cancel
- **Execution**: processNextStep loads enrollment + plan, validates timing, executes step by type, records history, advances or completes. getDueEnrollments queries by next_step_at <= now.
- **Step types**: email/sms (with useAiDraft path), task/call_reminder, tag, wait -- all stubbed with TODO comments
- **Default plans**: Speed to Lead (6 steps, 0-7 days), Open House Follow-Up (4 steps, 1h-7d), Long-Term Nurture (5 steps, 0-90 days)
- **No `any` types** -- PlanRow/EnrollmentRow interfaces for DB rows
- **Exhaustive switch** with `never` check on step type

---

# Lead Routing Engine

## Plan

- [x] Read context files (types.ts, db/index.ts, smart-lists/index.ts)
- [x] Define all types (RoutingStrategy, LeadSource, PropertyType, TeamAgent, RoutingRule, RoutingCondition, RoutingConfig, RoutingAssignment)
- [x] Create DB tables via ensureTables pattern (team_agents, routing_rules, routing_config, routing_assignments)
- [x] Implement row mappers (rowToAgent, rowToRule, rowToConfig, rowToAssignment)
- [x] Implement RoutingConfig CRUD (getRoutingConfig, updateRoutingConfig)
- [x] Implement TeamAgent CRUD (add, getAll, get, update, remove, setOnlineStatus)
- [x] Implement RoutingRule CRUD (create, getAll, update, delete)
- [x] Implement condition matching engine (matchesConditions, matchesSingleCondition)
- [x] Implement getEligibleAgents filter (active, online for first-to-claim, below capacity)
- [x] Implement round-robin strategy (advance index, wrap around, persist)
- [x] Implement weighted random strategy (filter by minWeight, weighted random selection)
- [x] Implement rules-based routing (priority order, first match wins)
- [x] Implement routeLead main entry point (rules first, fallback to default, create assignment, increment count)
- [x] Implement assignment queries (getAssignment, forAgent, forContact, history)
- [x] Implement first-to-claim flow (claimLead, getUnclaimedLeads, processExpiredClaims)
- [x] Implement handleAgentDeparture (reassign via round_robin or pond)

## Review

Created `/Users/michaelkraft/leadspot/agent-service/src/lead-routing/index.ts` (~590 lines).

### Types
- `RoutingStrategy` - 4 strategies: round_robin, first_to_claim, weighted, rules_based
- `LeadSource` - 8 sources: zillow, realtor, website, referral, open_house, social, manual, other
- `PropertyType` - 7 types: single_family, condo, townhouse, multi_family, land, commercial, other
- `TeamAgent` - Full agent profile with capacity, weight, specialties, zip codes, price range
- `RoutingRule` - Priority-ordered rule with conditions and assignment target
- `RoutingCondition` - Field/operator/value with 7 operators (eq, neq, gt, lt, between, in, contains)
- `RoutingConfig` - Org-level config with strategy defaults and capacity limits
- `RoutingAssignment` - Assignment record with status lifecycle and metadata

### DB
- 4 tables: team_agents (UNIQUE on org+user), routing_rules, routing_config (org PK), routing_assignments
- 5 indexes: rules by priority, assignments by org/agent/contact/pending status

### Routing Flow
1. `routeLead()` first tries rules-based routing (priority-ordered, first match wins)
2. Falls back to org's `defaultStrategy`
3. Creates a RoutingAssignment record
4. Increments agent's currentActiveLeads
5. If first-to-claim or no agent available: status=pending_claim with claimExpiresAt

### Edge Cases
- All agents offline/at capacity: stored as pending_claim with expiry
- Agent weight below weightedMinWeight: skipped in weighted distribution
- Multiple rule matches: first by priority wins
- Between operator: [min, max] inclusive range check
- In operator: string array membership check
- Agent departure: reassign via round-robin or pond all active leads
- Expired claims: auto-reassign via round-robin fallback, pond if nobody available
- No `any` types used anywhere

---

# Wire Orchestrator + Create Agent Proxy

## Plan

- [x] Replace `fetchPipelineData` stub with real fetch to `/api/insights/daily`
- [x] Replace `fetchContact` stub with real fetch to `/api/insights/hot-leads`
- [x] Keep mock data as fallback in try/catch for both methods
- [x] Create `/backend/app/routers/agent_proxy.py` using httpx
- [x] Handle GET/POST/PUT/DELETE/PATCH to forward to agent-service on port 3008
- [x] Forward query params, body, headers, and response
- [x] Add error handling (503 connect, 504 timeout, 502 other)
- [x] Register router in `main.py` with prefix `/api/agent`

## Review

### Task 1: Orchestrator API Integration
- `fetchPipelineData` now calls `GET /api/insights/daily?mautic_url=...&organization_id=...`
- Maps backend response (hot_leads, campaigns) to internal LeadSpotPipelineData shape
- `fetchContact` now calls `GET /api/insights/hot-leads?...` and filters by contactId
- Both methods fall back to empty/stub data on any error (network, parse, HTTP status)

### Task 2: Agent Proxy Router
- Created `agent_proxy.py` with a single catch-all route using `@router.api_route`
- Forwards all HTTP methods to `AGENT_SERVICE_URL` (env var, default `http://localhost:3008`)
- Forwards query params, request body, and headers (excluding hop-by-hop)
- Returns 503 on connect error, 504 on timeout, 502 on other failures
- Registered in main.py as `prefix="/api/agent"`, so `/api/agent/foo` proxies to `http://localhost:3008/api/agent/foo`

---

# Add /api/agent/context endpoint

## Plan
- [x] Add imports for `buildContactContext`, `buildBriefContext`, `formatContextForPrompt` from `./memory/context-builder`
- [x] Add imports for `getLatestBrief`, `getSuggestions` from `./db`
- [x] Add `GET /api/agent/context` route after the dismiss route and before cron routes
- [x] Run `npx tsc --noEmit` and fix any type errors

## Review
- Added two import lines to server.ts
- Added the GET /api/agent/context route handler between the approval queue and cron sections
- Contact-level path: calls `buildContactContext` (async) + `formatContextForPrompt`, returns `{ context, type: 'contact', contactId }`
- Org-level path: calls `buildBriefContext` (async) + `getLatestBrief` + `getSuggestions` (both sync), returns structured JSON with brief summary, latest brief metadata, and recent suggestions
- TypeScript compiles clean with zero errors
