# Space Agent Production Deployment Runbook

This runbook covers production deployment of the LeadSpot × Space Agent
integration. Follow each section in order for a fresh deploy. Keep this
document current — it is the single source of truth for ops.

---

## 1. Architecture Overview

The Space Agent integration adds a fourth service to the LeadSpot stack.
All services run behind a shared reverse proxy / Render router and
communicate over private networking where possible.

| Service        | Tech                 | Port | Purpose                                                       |
| -------------- | -------------------- | ---- | ------------------------------------------------------------- |
| Frontend       | Next.js 14           | 3006 (prod) / 3000 (legacy dev) | LeadSpot dashboard, hosts `/workspace` page              |
| Backend        | FastAPI (Python)     | 8000 | LeadSpot REST API, auth, Space Agent token mint, batch endpoint |
| Agent-service  | Node/TypeScript      | 3008 | Per-org agent runtime (existing)                              |
| Space Agent    | Node/TypeScript      | 3009 | Workspace agent — runs SKILL.md, briefs, moments, persistent disk-backed |

```
        ┌───────────────┐         ┌────────────────┐
Browser→│  Frontend     │────────→│   Backend      │
        │  Next.js 3006 │         │  FastAPI 8000  │
        └───────┬───────┘         └────┬───────────┘
                │ /workspace iframe     │ token mint, batch
                ▼                       ▼
        ┌──────────────────┐   ┌─────────────────────┐
        │  Space Agent     │←──│ Agent-service 3008  │
        │  3009 + /data PD │   │ (per-org agent.db)  │
        └──────────────────┘   └─────────────────────┘
```

Space Agent reads/writes its own SQLite-style state under
`SPACE_AGENT_DATA_DIR` (mounted Render persistent disk in prod).

---

## 2. Environment Variables Checklist

Copy `.env.space-agent.example` and fill in real values. Generate any
secret with `openssl rand -hex 32`.

### Backend (FastAPI, port 8000)

| Variable                       | Required | Notes                                                 |
| ------------------------------ | -------- | ----------------------------------------------------- |
| `SPACE_AGENT_URL`              | Yes      | e.g. `https://space-agent.internal` or `http://localhost:3009` |
| `SPACE_AGENT_API_KEY`          | Yes      | Shared secret. Backend → Space Agent + Space Agent → Backend |
| `SPACE_AGENT_ADMIN_KEY`        | Yes      | Used to provision new orgs / rotate per-org tokens    |
| `SPACE_AGENT_API_KEY_PREVIOUS` | No       | Set during key rotation (5-min overlap), then unset   |

### Frontend (Next.js, port 3006)

| Variable                          | Required | Notes                                                   |
| --------------------------------- | -------- | ------------------------------------------------------- |
| `NEXT_PUBLIC_SPACE_AGENT_ENABLED` | Yes      | `true` to render the Workspace nav item / page          |
| `NEXT_PUBLIC_SPACE_AGENT_URL`     | Yes      | Public URL of the workspace page, usually `/workspace`  |

### Space Agent service (Node, port 3009)

| Variable                  | Required | Notes                                                |
| ------------------------- | -------- | ---------------------------------------------------- |
| `PORT`                    | Yes      | `3009`                                               |
| `NODE_ENV`                | Yes      | `production`                                         |
| `LEADSPOT_API_URL`        | Yes      | Backend base URL (private), e.g. `http://backend:8000` |
| `LEADSPOT_SPACE_API_KEY`  | Yes      | Same value as backend `SPACE_AGENT_API_KEY`          |
| `SPACE_AGENT_DATA_DIR`    | Yes      | `/data` — must point at the mounted persistent disk  |

---

## 3. Render Setup

Three Render services are required.

### 3a. Backend (`leadspot-backend`)

- Type: Web Service (Python)
- Plan: Standard (or higher)
- Build: `pip install -r backend/requirements.txt`
- Start: `uvicorn app.main:app --host 0.0.0.0 --port 8000`
- Env: see Backend table above

### 3b. Frontend (`leadspot-frontend`)

- Type: Web Service (Node)
- Build: `cd frontend && npm ci && npm run build`
- Start: `cd frontend && npm run start -- -p 3006`
- Env: see Frontend table above

### 3c. Space Agent (`leadspot-space-agent`) — **MANDATORY persistent disk**

- Type: Web Service (Node)
- Build: `cd space-agent && npm ci && npm run build`
- Start: `cd space-agent && npm run start`
- **Persistent disk: 10 GB attached at `/data`** (initial size; expandable)
- Env: see Space Agent table above

> The persistent disk is non-negotiable. Without it, all per-user
> workspace state (briefs, moments, SKILL_VERSION cache) is lost on
> redeploy.

---

## 4. Per-Org Enablement (SQL)

Space Agent is gated behind a per-org feature flag to allow staged
rollout.

```sql
UPDATE organizations
SET features = features || '{"space_agent_enabled": true}'::jsonb
WHERE id = $1;
```

To disable for a single org:

```sql
UPDATE organizations
SET features = features - 'space_agent_enabled'
WHERE id = $1;
```

To list orgs that have it enabled:

```sql
SELECT id, name
FROM organizations
WHERE (features->>'space_agent_enabled')::boolean = true;
```

---

## 5. Cold Start Mitigation

Render free/Starter tiers cold-start after ~15 minutes of idle traffic.
Cold starts on Space Agent break the workspace UX (3–8s load).

Pick **one** of the following:

### Option A — Always-on tier (recommended)

Upgrade Space Agent to **Starter ($7/mo)** or higher. No cold starts.

### Option B — Internal warm-ping cron

Run a cron job every 10 minutes hitting Space Agent's health endpoint:

```bash
*/10 * * * * curl -fsS https://space-agent.internal/health > /dev/null
```

A Render cron job with image `curlimages/curl:latest` works:

```yaml
schedule: "*/10 * * * *"
command: curl -fsS https://space-agent.internal/health
```

---

## 6. Persistent Disk Backup

Daily backup of `/data` to S3 at 02:00 UTC, 90-day retention.

### Render cron job

```yaml
schedule: "0 2 * * *"
command: /usr/local/bin/backup-space-agent.sh
```

### `backup-space-agent.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail

STAMP=$(date -u +%Y%m%d-%H%M%S)
BUCKET="s3://leadspot-prod-backups/space-agent"
SRC="/data/"

aws s3 sync "$SRC" "${BUCKET}/${STAMP}/" --delete
aws s3api put-object-tagging \
  --bucket leadspot-prod-backups \
  --key "space-agent/${STAMP}/" \
  --tagging 'TagSet=[{Key=ttl-days,Value=90}]'
```

### S3 lifecycle policy (90-day retention)

```json
{
  "Rules": [{
    "ID": "space-agent-90d",
    "Filter": { "Prefix": "space-agent/" },
    "Status": "Enabled",
    "Expiration": { "Days": 90 }
  }]
}
```

---

## 7. Key Rotation Procedure

`SPACE_AGENT_API_KEY` should be rotated every 90 days or immediately on
suspected compromise. Zero-downtime rotation uses a short overlap
window.

1. Generate the new key:

   ```bash
   NEW_KEY=$(openssl rand -hex 32)
   echo "$NEW_KEY"
   ```

2. On Backend, set the previous key to the **current** value before
   replacing:

   ```bash
   render env set SPACE_AGENT_API_KEY_PREVIOUS "$CURRENT_KEY" \
       --service leadspot-backend
   render env set SPACE_AGENT_API_KEY         "$NEW_KEY" \
       --service leadspot-backend
   ```

3. On Space Agent, rotate to the new key (Space Agent only knows one
   value at a time — the backend tolerates both during the window):

   ```bash
   render env set LEADSPOT_SPACE_API_KEY "$NEW_KEY" \
       --service leadspot-space-agent
   ```

4. Trigger redeploy of both services. Wait **5 minutes** for in-flight
   requests holding the old key to drain.

5. Remove the previous key:

   ```bash
   render env unset SPACE_AGENT_API_KEY_PREVIOUS \
       --service leadspot-backend
   ```

6. Verify with `curl -fsS $BACKEND_URL/health/full` — `space_agent`
   should be `ok`.

---

## 8. Smoke Test Checklist

Run after every deploy. All 20 must pass before declaring green.

- [ ] **1. Feature flag off** — Org without `space_agent_enabled` does
  not see Workspace nav item.
- [ ] **2. Feature flag on** — Org with flag sees Workspace and
  `/workspace` loads.
- [ ] **3. CSP** — Browser console shows zero CSP violations on
  `/workspace`.
- [ ] **4. Auth flow** — First load mints a Space Agent token and
  iframe authenticates without prompt.
- [ ] **5. Safari ITP** — In Safari with Prevent Cross-Site Tracking
  ON, `/workspace` still loads (cookie SameSite + storage access OK).
- [ ] **6. Ad blocker** — uBlock Origin enabled does not block
  `/workspace` or its API calls.
- [ ] **7. CSRF** — Mutating endpoints reject requests missing
  `X-CSRF-Token`.
- [ ] **8. SKILL.md endpoints** — `GET /api/skill/skill.md` returns
  current SKILL.md; `GET /api/skill/version` returns `SKILL_VERSION`.
- [ ] **9. Rate limiting** — 11th request in 60s to
  `/api/space/batch` returns 429 with `Retry-After`.
- [ ] **10. Audit trail** — Every write through Space Agent appears in
  `audit_log` with actor, org, action.
- [ ] **11. Multi-tab** — Two `/workspace` tabs in same browser stay
  in sync (no token clobber).
- [ ] **12. Session expiry** — After token TTL, iframe re-auths
  silently or prompts; no white screen.
- [ ] **13. Service restart** — `kill -HUP` Space Agent → /data state
  reloads, briefs/moments preserved.
- [ ] **14. Onboarding** — Brand-new user lands on `/workspace`,
  empty-state CTA works.
- [ ] **15. Zero-data** — Org with no contacts/briefs sees the
  zero-data illustration, no errors.
- [ ] **16. Rollback** — Toggling `space_agent_enabled` to `false`
  removes Workspace within one page reload.
- [ ] **17. Brief caching** — Re-visiting workspace within 5 minutes
  loads brief from cache (no LLM call billed).
- [ ] **18. Disk backup** — Confirm latest S3 snapshot at
  `s3://leadspot-prod-backups/space-agent/` is < 26h old.
- [ ] **19. Firefox** — `/workspace` loads on current Firefox stable.
- [ ] **20. Shareable moment** — Generating a moment URL and opening
  it in incognito loads it without auth.
- [ ] **21. SKILL_VERSION propagation** — Bumping `SKILL_VERSION` in
  backend invalidates Space Agent's cached SKILL within 60s.

---

## 9. Rollback Procedure (~95 minutes)

Use this if a deploy goes bad. Each phase is independent and can stop
the bleed at progressively deeper layers.

### Phase 0 — Immediate flag-off (~2 min)

```sql
UPDATE organizations
SET features = features - 'space_agent_enabled';
```

This hides the feature from all orgs instantly. No deploy needed.

### Phase 1 — Frontend revert (~10 min)

```bash
render deploys list --service leadspot-frontend
render deploys rollback --service leadspot-frontend --deploy <prev-id>
```

Verify Workspace nav item is gone for all orgs.

### Phase 2 — Backend auth revert + Redis flush (~20 min)

```bash
render deploys rollback --service leadspot-backend --deploy <prev-id>
# Flush any Space-Agent-related Redis state
redis-cli --scan --pattern 'space-agent:*' | xargs -r redis-cli del
redis-cli --scan --pattern 'csrf:space:*'  | xargs -r redis-cli del
```

### Phase 3 — Database revert (~25 min)

```bash
cd backend
alembic downgrade -1   # repeat per migration to revert
```

Reverify schema with:

```sql
\d organizations
SELECT column_name FROM information_schema.columns
WHERE table_name = 'space_agent_tokens';  -- should be empty if reverted
```

### Phase 4 — Infrastructure teardown (~30 min)

```bash
# Snapshot persistent disk before destroy
render disks snapshot --service leadspot-space-agent --name pre-rollback-$(date -u +%Y%m%d)

# Destroy service (disk snapshot is retained)
render services delete leadspot-space-agent
```

### Phase 5 — Verification (~10 min)

- [ ] `GET /health/full` returns `space_agent: not_configured`
- [ ] No 5xx in backend logs for last 5 min
- [ ] Frontend dashboard loads with no Workspace UI
- [ ] On-call confirms incident is closed

---

Maintainer: LeadSpot Platform Team
Last reviewed: see git log for this file
