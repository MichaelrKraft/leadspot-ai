# LeadSpot CRM — Hardening Audit

**Date:** 2026-07-15 | **Branch audited:** `feature/space-agent-workspace` (clean tree, HEAD `87f65aa`)
**Method:** Static code audit by 3 sequential read-only agents (backend / frontend / agent-service+voice+infra) + repo-wide checks. **No code was modified.**

---

## Fix Status — Hardening Pass 1 (2026-07-15, branch `fable5/hardening`)

Approved scope: **P0 + quick wins** (findings 1–11, 14, 15, 19). All complete, one commit per finding (2+3 and 5+7 share mechanisms and commits).

- [x] #1 Forgeable JWT fallback auth path — `0f4a3a6`
- [x] #2 + #3 Unauthenticated record-send + suppressions (internal API key) — `5748c94`
- [x] #4 Unauthenticated /api/chat + cross-org mautic_url match — `9764f28`
- [x] #5 agent-service auth boundary (middleware + proxy + rewrite + apiClient) — `d5df002`
- [x] #6 orgId path traversal — `7cf34f0`
- [x] #7 test-send open relay (frontend route auth; endpoints key-gated in #5) — `7258b14`
- [x] #8 Stripe refund credited wallet — `894bcc6`
- [x] #9 Deals/calendar CSRF 403s — `c5a90d2`
- [x] #10 `||` localhost:8000 fallbacks (7 files) — `e476dc6`
- [x] #11 Logout blocked by CSRF — `ff9a842`
- [x] #14 Suppression check fail-closed (3-state, retry-safe) — `c419b68`
- [x] #15 Workflows advancing on failed sends — `b4b3446`
- [x] #19 Stripe webhook signature mandatory — `2f87d7e`

**Verification:** `tsc --noEmit` clean for frontend, agent-service, and dashboard (two pre-existing errors untouched: `frontend/app/space/[[...path]]/route.ts` BodyInit, `dashboard/src/app/api/tasks/route.ts` prisma.contact). Backend pytest: **189 passed**; 8 pre-existing failures all in `tests/test_gmail_integration.py` (imports `app.services.connectors.gmail`, which doesn't exist in the repo).

**Deployment requirement:** set `INTERNAL_API_KEY` (backend) = `LEADSPOT_INTERNAL_API_KEY` (agent-service + frontend server env) to the same generated secret, and `STRIPE_WEBHOOK_SECRET` (dashboard) — the new guards fail closed, so drip emails, agent UI, and Stripe crediting stop working until these are set. Legacy unauthenticated Mautic-plugin access to /api/chat no longer works (documented in `9764f28`).

---

## Fix Status — Hardening Pass 2 (2026-07-15, branch `fable5/hardening`)

Approved scope: **remaining P1s**. Shipped 12–14, 16–18, 20–23, 26 (and #41 alongside #18). One logical commit per finding except where two findings share a file/flow (noted).

- [x] #12 Password-reset email was a print() stub — `8d44353` (added Resend-backed transactional sender)
- [x] #13 OAuth state never verified — `2dd0765` (Redis-backed state, both providers)
- [x] #16 + #17 Drip engines stall after restart + double-send race — `c506867` (boot-time org scan; atomic enrollment claim)
- [x] #18 + #41 Voice call ran unmetered / balance-check unauthenticated — `72bdf11` (fail-closed billing on all paths; API-key on balance-check; negative-balance overage)
- [x] #20 JWT persisted in localStorage — `a0dec7a`
- [x] #21 AuthGuard trusted stale localStorage — `40a63d9` (validates /auth/me on mount)
- [x] #22 Demo login no-opped in prod — `1aa0020` (real backend session, flag-gated)
- [x] #23 Dashboard permanently demo — `df336e8` (sends real org id to insights)
- [x] #26 Dead API surface + orphaned sidebar — `0100b7e`

**Deferred (needs its own session):**
- [ ] #25 Email model has no organization_id — requires an Alembic migration with backfill (join through users) plus a query-semantics change (org-wide vs per-user email visibility, a product decision). Not safe to rush at the end of a batch; recommend a dedicated pass with up/down migration testing on a scratch DB.

**Verification (pass 2):** `tsc --noEmit` clean across frontend, agent-service, dashboard (same two pre-existing errors untouched). Backend pytest: **189 passed**; the only failures remain the pre-existing `tests/test_gmail_integration.py` missing-module errors.

**Additional deployment requirements from pass 2:** set `RESEND_API_KEY` (backend, for password-reset email — fails soft if unset); optionally `DEMO_LOGIN_ENABLED=true` + `NEXT_PUBLIC_DEMO_LOGIN_ENABLED=true` to expose the demo button; `VOICE_AGENT_API_KEY` must be set on the dashboard (balance-check now requires it) and match the voice-agent. OAuth login now hard-requires Redis (state store) — consistent with the workspace-token flow, which already did.

---

## Summary

LeadSpot is architecturally further along than its docs admit — the "one critical code gap" in CLAUDE.md (stubbed email send) is **stale: real Resend sending with suppression checks, CAN-SPAM footer, and record-send bridge now exists** in agent-service. But the system is nowhere near production-safe. The single biggest risk is a **cluster of unauthenticated write surfaces**: agent-service has *zero* auth (any caller can read/write any org's data, trigger real emails via your Resend domain, and exploit an orgId **path traversal** to write SQLite files anywhere on disk), and the backend exposes unauthenticated `record-send`, `suppressions`, `chat`, and an open proxy into agent-service. The highest-leverage win is tiny: two mechanical frontend sweeps (`|| 'http://localhost:8000'` → `??`, and routing raw `fetch` writes through the existing `apiClient`) un-break OAuth login, password reset, logout, integrations, and all deal/calendar writes in production.

**Does it run?** Not verified this pass. No `node_modules` (frontend/agent-service/voice-agent) and no backend venv exist, and the machine was at **90% swap (CRITICAL)** during the audit — per build-safety rules I did not run installs, builds, typecheck, lint, or tests. All findings are from traced source paths (frontend↔backend pairs verified both sides). Backend has ~15 test files with decent auth/daemon coverage, but **zero tests on exactly the endpoints with P0 holes** (emails, suppressions, chat, workspace, agent_proxy).

---

## Prioritized Findings

### P0 — Breaks core use / security hole

| # | Lens | What & where | Why it matters | Recommended fix | Effort | Conf |
|---|------|--------------|----------------|-----------------|--------|------|
| 1 | Security | Parallel auth path with forgeable fallback secret — `backend/app/dependencies.py:88`. `get_current_user` decodes JWT with `os.getenv("JWT_SECRET", "your-secret-key-change-in-production")` (ignores `settings.JWT_SECRET`) and reads `user_id` claim that real tokens don't carry (they use `sub`). Used by `admin.py`, `superadmin.py`, `documents.py`. | If env var unset, anyone can forge admin tokens; and the wrong claim key means admin routes 401 on legit tokens — broken *and* dangerous. | Delete `dependencies.get_current_user`; import the canonical one from `auth_service` everywhere. | S | High |
| 2 | Security | `POST /api/emails/record-send` unauthenticated — `backend/app/routers/emails.py:220`. Caller supplies arbitrary `user_id`/`contact_id`/`to_addr`; CSRF also skipped (no cookie). | Any internet client can inject email records into any org. | Require internal shared-secret header (`compare_digest`), same pattern as `verify-workspace-token`. | S | High |
| 3 | Security | Suppression endpoints unauthenticated & global — `backend/app/routers/suppressions.py:22,39`. | Leaks bounce/complaint status of any address (PII enumeration); anyone can suppress arbitrary emails (denial-of-email on the pre-send safety gate). | Auth + internal key; consider org scoping. | S | High |
| 4 | Security | `POST /api/chat` has no `get_current_user` — `backend/app/routers/chat.py`; org id comes from client body. | Unauthenticated callers drive Claude + Mautic tools on your API key and any org's CRM data. | Add auth dependency; derive org from token, not body. | S | High |
| 5 | Security | agent-service has **zero authentication** — `agent-service/src/server.ts` (e.g. :139, :372, :796); open CORS; `organizationId` from client input. Backend `agent_proxy.py:22` compounds it by relaying `/api/agent/*` with raw headers, no auth. | Full cross-org read/write, workflow enrollment, and real email sends by anyone. | Shared-secret header middleware on agent-service + `get_current_user` on the backend proxy (forward derived identity, not raw headers). | S | High |
| 6 | Security | Path traversal in orgId → DB path — `agent-service/src/db/index.ts:40-42`. `path.join(dataDir,'orgs',organizationId,'agent.db')` unsanitized; orgId reachable from unauth requests incl. the public tracking-pixel token (`server.ts:391-401`, attacker-controlled base64). | `../../` writes directories/SQLite files at arbitrary filesystem paths. | Reject orgIds not matching `^[A-Za-z0-9_-]+$` in `getDbPath`. | S | High |
| 7 | Security | Open email relay — `agent-service/src/server.ts:796-832` (`/api/email/test-send`) and `:761` (campaign test-send): unauthenticated, arbitrary to/subject/body via your Resend domain. | Spam/phishing vector; burns the sending domain's reputation permanently. | Covered by #5's auth middleware; also gate test-send behind admin. | S | High |
| 8 | Bugs | Stripe **refund credits the wallet** — `dashboard/src/app/api/billing/stripe/webhook/route.ts:193-213`: `handleRefund` calls `addCreditsToWallet`. | Customer gets Stripe cash back AND wallet credits — direct money loss. | Deduct instead of credit. | S | High |
| 9 | Bugs | Deal & calendar writes 403 in prod — `frontend/lib/api/deals.ts:24-77`, `frontend/lib/api/calendar.ts:48-113` use raw `fetch` with no `X-CSRF-Token`; backend `middleware/security.py:94-110` rejects cookie-authed writes without it. | Kanban and calendar load but **every create/move/delete fails** for real users; dev masks it. | Route both files through existing `apiClient` (`lib/api.ts` already injects CSRF + refresh). | S | High |
| 10 | Bugs | `\|\| 'http://localhost:8000'` fires in prod — `frontend/lib/auth.ts:8`, `hooks/useIntegrations.ts:9`, `useDocuments.ts:13`, `useSources.ts:8`, `useQuery.ts:12`, `useHealth.ts:13`, `app/(dashboard)/superadmin/page.tsx:21`. `next.config.js:42` defaults `NEXT_PUBLIC_API_URL` to `''` (falsy). | Breaks Google/Microsoft OAuth, forgot/reset password, integrations (incl. Mautic), documents, sources, query, health, superadmin — in production. | Replace `\|\|` with `??` (deals/calendar already do this correctly). | S | High |
| 11 | Bugs | Cannot log out in prod — `frontend/stores/useAuthStore.ts:171-186`: logout POST lacks CSRF header → 403 → httpOnly cookie never cleared → middleware bounces `/login` back to `/dashboard`. | Logout silently doesn't work. | Use `api.auth.logout` via apiClient. | S | High |

### P1 — Significant correctness / UX

| # | Lens | What & where | Why it matters | Recommended fix | Effort | Conf |
|---|------|--------------|----------------|-----------------|--------|------|
| 12 | Bugs | Password-reset email is a `print()` + TODO — `backend/app/routers/auth.py:293-340` (token printed to stdout, line 332). | Flow non-functional for real users; reset tokens (secrets) land in logs. | Wire Resend (agent-service already has the sender pattern). | M | High |
| 13 | Security | OAuth `state` never verified on callback — `backend/app/routers/auth.py:468-591`; sessions not installed so state is stored nowhere. | Login CSRF on Google/Microsoft OAuth. | Persist state in Redis (same pattern as workspace tokens); compare on callback. | S | High |
| 14 | Bugs | Suppression check **fails open** — `agent-service/src/services/email.ts:81-90`: returns "allow" when backend unreachable, despite the comment claiming caution. | Sends to unsubscribed/bounced addresses whenever backend is down — CAN-SPAM exposure. | Fail closed (skip send, log, retry). | S | High |
| 15 | Bugs | Workflows silently mark failed emails as sent — `agent-service/src/workflows/index.ts:391-409, 576-600`: `executeSendEmailStep` discards `sendEmail()` result; steps advance regardless. (Action-plans engine at `action-plans/index.ts:436-442` does this correctly — reuse that pattern.) | Lost sends with no record or retry; org believes the sequence ran. | Respect the send result before advancing `current_step`. | S | High |
| 16 | Bugs | Both drip engines stall after restart — `agent-service/src/action-plans/index.ts:94-131` iterates in-memory `initializedOrgs` (empty on boot); cron only starts inside `enrollContacts`; `server.ts:865-875` never scans `data/orgs/`. | After any restart, due emails silently stop per org until an unrelated API call touches it. | Enumerate `data/orgs/*` at startup and initialize each. | M | High |
| 17 | Bugs | Action-plan double-send race — `action-plans/index.ts:350-408` read→await-send→write is not atomic; 60s loop fires unawaited promises; manual `/action-plans/process` (also unauth) can run concurrently. | Same email step can send twice. | Claim the row first: `UPDATE ... WHERE next_step_at <= now AND status='active'`. | M | High |
| 18 | Bugs | Voice call can run past zero balance — `voice-agent/src/agent.py:771-804` kill switch needs `tenantId` from room metadata (SIP rooms `call-{sid}` typically lack it → loop skips forever; balance-check errors fail open); legacy/outbound path deducts post-call with `Math.max(0, balance - cost)` (`dashboard/.../voice/webhook/route.ts:299-343`). | Unbounded free minutes; revenue loss clamped silently at $0. | Resolve tenant from call SID lookup, fail closed on check errors; record negative balances or pre-authorize. | M | Med-High |
| 19 | Security | Stripe webhook signature optional — `dashboard/.../stripe/webhook/route.ts:31-44`: without `STRIPE_WEBHOOK_SECRET` it `JSON.parse`es the body. | Unauthenticated wallet crediting if the env var is ever missing. | Refuse to process unsigned events outside test env. | S | High |
| 20 | Security | JWT persisted in localStorage — `frontend/stores/useAuthStore.ts:194-198` partialize includes `token`; `lib/api.ts:46-49` sends it as Bearer. | Defeats the httpOnly-cookie design; XSS-stealable. | Drop `token` from partialize; rely on cookie. | S | High |
| 21 | Bugs | Auth state desync (3 sources of truth) — cookie (middleware) vs zustand `auth-storage` localStorage (`components/auth/AuthGuard.tsx:31-41`) vs legacy `user` key from `lib/auth.ts`. AuthGuard never validates the session. | Expired cookie + persisted store → page renders, every fetch 401s. | AuthGuard validates once via `/auth/me`. | M | High |
| 22 | Bugs | Demo login broken in prod — `frontend/app/(auth)/login/page.tsx:44-64` writes fake localStorage then navigates; `middleware.ts:35` sees no cookie → bounced back. | The prominent "Explore Demo — No Sign Up" button silently no-ops. | Backend-issued demo session (real cookie) or remove the button. | M | High |
| 23 | Bugs | Dashboard insights permanently demo — `frontend/lib/api/dashboard.ts:32,51,60` hardcodes `mautic_url=http://localhost`; agent brief/queue/activity silently keep demo data on fetch failure with no badge (`dashboard/page.tsx:76-88`). | Fake data presented as real — trust-destroying for a CRM. | Use configured Mautic URL; show a "demo data" badge on fallback. | S-M | High |
| 24 | Bugs | API call during render — `frontend/components/deals/PipelineKanban.tsx:75-90`: `createDeal()` executed in render body; only safe because StrictMode is disabled (`next.config.js:10`). | Any re-render between state sets can double-create deals. | Move to `useEffect`. | S | High |
| 25 | Bugs | Email model has no `organization_id` — `backend/app/models/email.py`; lists scoped by `user_id` only; record-send stores literal `user_id="agent-service"`. | No org-level email visibility; agent-sent emails orphaned from any real user. | Add `organization_id` + migration; scope queries by it. | M | Med |
| 26 | Reuse | Dead legacy API surface — `frontend/lib/api.ts:133-202` (`/search/*`, `/analytics/*`, `/bookmarks`, `/feedback`) target routers that don't exist; `lib/auth.ts` still branded "InnoSynth.ai"; orphaned second `components/layout/Sidebar.tsx` (real nav is inline in `app/(dashboard)/layout.tsx:26`). | Dead code misleads future work; orphaned sidebar links to a stub page. | Delete/trim. | M | High |

### P2 — Polish / nice-to-have

| # | Lens | What & where | Recommended fix | Effort | Conf |
|---|------|--------------|-----------------|--------|------|
| 27 | Perf | Pagination counts load every row: `len(result.scalars().all())` — `backend/app/routers/emails.py:101-104`, `contacts.py:132-133`, `workspace.py` | `select(func.count())` | S | High |
| 28 | Bugs | Migration downgrade swallows all exceptions — `backend/alembic/versions/20251224_add_white_label_fields.py` (bare `try/except: pass`) | Gate on dialect instead | S | Med |
| 29 | Security/ops | `FileLogEmailSender` writes full email bodies + recipients to `logs/digest_emails.log`, unbounded, no rotation — `backend/app/services/digest_service.py:57,391` (violates repo logging rules) | Rotation + redaction, or ship real sender | S | High |
| 30 | Security | Workspace token not consumed on verify (replayable within 5-min TTL) — `backend/app/routers/auth.py:851`, contradicts "one-time" spec | Delete on verify or document the tradeoff | S | Med |
| 31 | Security | CSRF only enforced when `access_token` cookie present — `backend/app/middleware/security.py:94`; all Bearer/internal POSTs bypass it (by design, but only safe once #2/#3/#5 add auth) | Note in design docs; fix auth first | — | High |
| 32 | UX | Silent mutation failures (console.error only): calendar save/delete `frontend/app/(dashboard)/calendar/page.tsx:120-131`, deals, dashboard approve/dismiss. Contacts page has the right toast pattern — copy it | Shared toast on mutation failure | M | High |
| 33 | UX | Fake status bar hardcodes "Connected / API: Connected" — `frontend/app/(dashboard)/layout.tsx:346-356` | Wire to health ping or remove | S | High |
| 34 | UX | Chat 401 detection checks `err.message.includes('401')` but `APIError` carries `.status` — `frontend/app/(dashboard)/command-center/page.tsx:143` | Check `.status === 401` | S | High |
| 35 | UX | OAuth errors via `alert()` — `frontend/lib/auth.ts:195,220` | Inline error state | S | High |
| 36 | Perf | `import * as d3` — `frontend/components/admin/UsageChart.tsx:4`, `components/timeline/*` (~100KB+ gz per route) | Import submodules | M | High |
| 37 | UX | Mobile nav covers ~5 of 30+ routes; fixed 220px sidebar, no collapse | Expand MobileNav; collapsible sidebar | M | High |
| 38 | UX | A11y: unlabeled icon buttons, kanban drag has no keyboard path, modals not focus-trapped | Labels + focus traps first | M-L | High |
| 39 | Bugs | Query History stub page linked from orphaned Sidebar — `frontend/app/(dashboard)/query/history/page.tsx` | Unlink (covered by #26) | S | High |
| 40 | Security | Dev creds & exposed ports in compose: `leadspot_dev_password` (Postgres+Neo4j), Grafana `admin/admin`, `dev_jwt_secret_change_in_production`, all datastores host-bound — `docker-compose.yml:9,28,155-156` | Env-file overrides; never reuse in prod | S | High |
| 41 | Security | Forgeable open-tracking pixel token — `agent-service/src/services/email.ts:139-148`; `balance-check` route keyless — `dashboard/.../billing/balance-check/route.ts` (called keyless from `voice-agent/src/agent.py:788`) | HMAC the pixel token; API key on balance-check | S | High |
| 42 | Ops | docker-compose ≠ reality: agent-service/dashboard/voice-agent/mcp-server absent from compose; frontend mapped 3000 vs documented 3006; `docker-compose.dev.yml` references a `development` target the frontend Dockerfile doesn't define (dev override build fails); space-agent container npm-installs `@agent0ai/space-agent@latest` unpinned at start; no healthchecks/restart policies on backend/frontend | Align compose with start.sh/docs; pin space-agent version | M | High |
| 43 | Ops | No backup for per-org SQLite — nothing touches `agent-service/data/orgs/*/agent.db` (`scripts/backup-all-tenants.sh` covers Mautic MySQL only); WAL mode makes naive file copy unsafe | Nightly `sqlite3 .backup` loop over orgs | S | High |

---

## Top 3 Quick Wins

1. **Frontend prod-breakage sweep (~1 hr, fixes 5 P0s):** replace the seven `|| 'http://localhost:8000'` fallbacks with `??` (#10), and route `deals.ts`, `calendar.ts`, and logout through the existing `apiClient` (#9, #11). Un-breaks OAuth, password reset, logout, integrations, and all deal/calendar writes in production.
2. **One-line path-traversal kill (#6):** orgId regex validation in `agent-service/src/db/index.ts:getDbPath`. Highest severity-to-effort ratio in the codebase.
3. **Money + deliverability trio (all S):** fix `handleRefund` to deduct (#8), require Stripe signature unconditionally (#19), and flip the suppression check to fail-closed + make workflows respect send results (#14, #15).

*(The full auth cluster — #1–#5, #7 — is the real must-do before anything faces the internet; each fix is S but they're grouped as one hardening pass rather than a "quick win.")*

---

## Feature Recommendations

1. **Contact activity timeline** — contact detail has no history of emails/calls/deals; the single most-expected CRM feature and the data already exists across services. Effort: M.
2. **Link deals to contacts** — Kanban cards carry only free-text names (`contact_id` always null from the UI); no deal→contact navigation or pipeline-per-contact. Effort: M.
3. **Real first-run onboarding** — replace demo-data-as-real (#23) with a "connect Mautic → import contacts → create first deal" wizard; the current `?onboarded=1` banner is the only first-run affordance. Effort: M.
4. **Unified inbox (email + SMS threads)** — already on the roadmap in CLAUDE.md; record-send + voice/SMS data exists to back it. Effort: L.
5. **Ops hardening pack** — per-org SQLite nightly backup (#43), compose alignment (#42), health endpoints wired to the status bar (#33). Effort: S-M combined; makes everything else safe to run.

---

## Open Questions / Assumptions

- **Runtime not verified:** no `node_modules`/venv existed and the machine was at 90% swap (critical) — per build-safety rules I ran no installs, builds, typecheck, lint, or tests. First fix session should start with `npm install` (frontend), `tsc --noEmit`, `next lint`, and backend `pytest` on a venv to catch anything static analysis missed.
- **Branch:** audited `feature/space-agent-workspace` (currently checked out), not `master`. Findings in shared code almost certainly apply to master, but line numbers may drift.
- **Project status:** my notes say LeadSpot was shelved 2026-07-03 ("product dead"); this audit assumes an intentional revival/re-evaluation.
- **CLAUDE.md is stale:** the documented email-send stub at `agent-service/src/action-plans/index.ts:366` is gone — real Resend sending exists. Update CLAUDE.md when fixes begin.
- **Voice kill-switch (#18):** room-metadata absence on SIP inbound is inferred from code, not runtime-verified. Confidence medium-high.
- **Prod deploy target unknown:** `railway.toml` exists in backend; which env vars are actually set in prod (JWT_SECRET, STRIPE_WEBHOOK_SECRET, NEXT_PUBLIC_API_URL) couldn't be verified — several P0/P1s depend on them.
- Working-tree `backend/.env` contains real secrets (Anthropic key, JWT secret, Space Agent keys). Untracked so not leaked, but worth rotating if this repo ever changes hands.

---

**Audit complete — 43 findings (11 P0 / 15 P1 / 17 P2). Approve which items to fix (e.g. "do P0 + quick wins") and I'll implement on a feature branch.**
