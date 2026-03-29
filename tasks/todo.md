# LeadSpot.ai — Frontend Rebuild Plan

## Problem

The `frontend/` directory is a repurposed **InnoSynth.ai** knowledge management app. Evidence:
- `next.config.js` → `NEXT_PUBLIC_APP_NAME: 'InnoSynth.ai'`
- `ThemeToggle.tsx` → `localStorage.getItem('innosynth-theme')`
- `tailwind.config.ts` → "Professional blue tones for enterprise" (InnoSynth's palette)
- Sidebar nav → Decisions, Query, Documents, Health (knowledge management features)
- Dashboard → knowledge base search, "Recent Queries", generic "Connected Sources"

The **real LeadSpot design** is in `mautic-plugin/preview.html` (1,882 lines, fully polished). That file is the source of truth.

---

## What's Reusable vs What Gets Replaced

| Component | Status | Action |
|-----------|--------|--------|
| `mcp-server/` (22 tools) | Standalone, correct | **Keep 100%** |
| `backend/` (FastAPI + 14 Mautic tools) | Correct, untouched | **Keep 100%** |
| `deals/PipelineKanban.tsx` + `DealCard.tsx` + `NewDealModal.tsx` | Logic correct, wrong theme | **Restyle** |
| `calendar/CalendarGrid.tsx` + `EventModal.tsx` + `MiniCalendar.tsx` | Logic correct, wrong theme | **Restyle** |
| `auth/LoginForm.tsx` + login `page.tsx` | Demo login logic correct | **Restyle** |
| `auth/AuthGuard.tsx` + `useAuthStore.ts` | Auth flow correct | **Keep** |
| `Providers.tsx` + React Query setup | Correct | **Keep** |
| `middleware.ts` | Auth middleware correct | **Keep** |
| `dashboard/page.tsx` | Completely wrong content | **Rewrite** |
| `layout.tsx` (sidebar) | Wrong nav items, no icons | **Rewrite** |
| `ThemeToggle.tsx` | Uses `innosynth-theme` key | **Fix** |
| `tailwind.config.ts` | InnoSynth blue palette | **Rewrite** |
| `globals.css` | InnoSynth styles | **Update** |
| `next.config.js` | Says InnoSynth.ai | **Fix** |
| `command-center/page.tsx` | Chat interface exists but basic | **Rewrite to match preview.html** |
| `contacts/page.tsx` | Exists | **Restyle** |
| InnoSynth pages (decisions, health, query, documents) | Wrong product | **Remove from nav** |

---

## Phase 1: Foundation Fixes

These are small, precise changes that fix the InnoSynth contamination.

### 1.1 Fix `next.config.js`
**File:** `frontend/next.config.js`
**Change:** `NEXT_PUBLIC_APP_NAME: 'InnoSynth.ai'` → `'LeadSpot.ai'`
**Edge case:** Check if any component reads `process.env.NEXT_PUBLIC_APP_NAME` and renders it.

### 1.2 Fix `ThemeToggle.tsx`
**File:** `frontend/components/ThemeToggle.tsx`
**Changes:**
- `localStorage.getItem('innosynth-theme')` → `localStorage.getItem('leadspot-theme')`
- `localStorage.setItem('innosynth-theme', theme)` → `localStorage.setItem('leadspot-theme', theme)`
- Default theme: `'dark'` (already correct)
**Edge case:** Users who had InnoSynth installed locally will have `innosynth-theme` in localStorage. Add a one-time migration: if `innosynth-theme` exists and `leadspot-theme` doesn't, copy the value over.

### 1.3 Copy logo assets
**Source:** `mautic-plugin/leadspot-logo.png` (dark bg version) and `leadspot-logo-light.png` (light bg version)
**Destination:** `frontend/public/leadspot-logo.png` and `frontend/public/leadspot-logo-light.png`
**Edge case:** Current `frontend/public/` only has `favicon.ico` and `logo.png` (probably InnoSynth's logo). Keep `favicon.ico`, replace `logo.png`.

### 1.4 Update `tailwind.config.ts`
**File:** `frontend/tailwind.config.ts`
**Replace entire color palette** to match preview.html CSS variables:

```
primary: {
  DEFAULT: '#818cf8',    // --ls-primary (light)
  50:  '#eef2ff',
  100: '#e0e7ff',
  200: '#c7d2fe',        // --ls-accent (dark), --ls-primary-hover (dark)
  300: '#a5b4fc',        // --ls-primary (dark), --ls-primary-hover (light)
  400: '#818cf8',        // --ls-primary (light)
  500: '#6366f1',        // Main brand purple
  600: '#4f46e5',
  700: '#4338ca',
  800: '#3730a3',
  900: '#312e81',
}
background: {
  DEFAULT: '#0f0f12',    // --ls-bg (dark)
  secondary: '#18181b',  // --ls-bg-secondary (dark)
  tertiary: '#27272a',   // --ls-bg-tertiary (dark)
}
background-light: {
  DEFAULT: '#ffffff',    // --ls-bg (light)
  secondary: '#f8fafc',  // --ls-bg-secondary (light)
  tertiary: '#f1f5f9',   // --ls-bg-tertiary (light)
}
```

**Edge case:** Remove InnoSynth `accent.blue`, `accent.darkBlue`, `accent.lightBlue` which are hardcoded InnoSynth colors. Keep `success`, `warning`, `error` (same colors).

### 1.5 Update `globals.css`
**File:** `frontend/app/globals.css`
**Changes:**
- Dark body bg: `bg-background` → confirm maps to `#0f0f12`
- Add CSS custom properties from preview.html (`--ls-*` variables) for components that reference them
- Keep Inter + JetBrains Mono font imports (both match)

---

## Phase 2: Sidebar + Layout (layout.tsx rewrite)

### 2.1 Sidebar structure from preview.html

**Current sidebar width:** `w-64` (256px)
**preview.html sidebar width:** 220px → change to `w-[220px]`

**Navigation items (exact match from preview.html lines 32-74):**

```
[robot icon]   AI Command Center    ← active by default, separated
─── divider ───
[grid icon]    Dashboard
[people icon]  Contacts
[check icon]   Segments
[calendar icon] Campaigns
[mail icon]    Emails
[chart icon]   Reports
─── divider ───
[mic icon]     Voice Agents          ← external link to voice-agent
[group icon]   Community             ← external link
─── divider ───
[gear icon]    Settings
```

**Edge cases:**
- "Deals" and "Calendar" pages we built are NOT in preview.html's nav. Options:
  - Add them as sub-items under Dashboard, or
  - Add them to the nav (between Reports and Voice Agents divider)
  - **Recommendation:** Add Deals and Calendar between Reports and the divider. They're real CRM features even if the Mautic plugin doesn't have them yet.
- Voice Agents and Community are external links (`target="_blank"`) in preview.html — keep that behavior
- Active state styling: Left 3px border + gradient background (not filled box like current)

### 2.2 Logo
**Current:** Plain text `LeadSpot.ai` with blue accent
**preview.html:** `<img>` tag with `leadspot-logo.png` (dark) / `leadspot-logo-light.png` (light)
**Implementation:** `next/image` with conditional display based on theme class
**Size:** `height: 62px` per preview.html CSS

### 2.3 Header bar
**preview.html has a header bar** above main content with:
- Page title ("AI Command Center")
- User email on right
**Current layout:** No header bar, page content starts immediately
**Add:** Thin header bar matching preview.html's `.mautic-header` styles

### 2.4 Status bar
**preview.html has a status bar** at the bottom of the main content area:
- Connection indicator (green dot + "Connected")
- API status (green dot + "API: Connected")
- Quick stats (contact count, campaign count)
**Implementation:** Fixed at bottom of main area, fetches status from backend
**Edge case:** If backend is down, show yellow/red indicators

### 2.5 Remove user menu from sidebar bottom
**Current:** User avatar + name + email + logout button in sidebar footer
**preview.html:** No user menu in sidebar — user email is in the header bar
**Change:** Move user info to header, keep logout accessible

### 2.6 Final nav items for our app (combining preview.html + our new pages):

```
AI Command Center
─── divider ───
Dashboard
Contacts
Deals           ← NEW (our Kanban)
Segments
Campaigns
Calendar        ← NEW (our Calendar)
Emails
Inbox           ← NEW (Phase 4, initially hidden)
Reports
─── divider ───
Voice Agents    ← external
─── divider ───
Settings
```

---

## Phase 3: Dashboard Page (complete rewrite)

### 3.1 Layout from preview.html (lines 135-203)

```
┌─────────────────────────────────────────────┐
│         Good evening!                        │
│     Here's your daily briefing               │
├─────────────────────┬───────────────────────┤
│  🔥 Hot Leads       │  📊 CRM Stats         │
│                     │                        │
│  Sarah Johnson      │  ┌────────┬────────┐  │
│  Acme Corp  2450pts │  │ 3,942  │   47   │  │
│                     │  │CONTACTS│ EMAILS │  │
│  Mike Chen          │  ├────────┼────────┤  │
│  TechStart  1820pts │  │  12    │    8   │  │
│                     │  │CAMPAIGNS│SEGMENTS│  │
│  ...                │  └────────┴────────┘  │
├─────────────────────┴───────────────────────┤
│  💡 AI Insights (full width)                 │
│  📈 Sarah Johnson visited pricing 4x...     │
│  🎯 Holiday Sale has 34% open rate...       │
│  💡 3 contacts from TechStart engaged...    │
├─────────────────────────────────────────────┤
│        [ 💬 Start Chatting ]                 │
└─────────────────────────────────────────────┘
```

### 3.2 Data flow (from preview.html JS, lines 1543-1632)

1. On mount: call `setGreeting()` based on time of day (morning/afternoon/evening)
2. Fetch `/api/insights/daily?mautic_url=...`
3. Response contains: `{ hot_leads: [], stats: {}, ai_insights: "" }`
4. If fetch fails → `showDemoDashboard()` with hardcoded demo data

**Edge cases:**
- **Backend endpoint `/api/insights/daily`**: Check if it exists in `backend/app/routers/insights.py`. If not, we need to create it or use existing endpoints.
- **Demo fallback**: Must work when backend is off (demo users exploring)
- **Number formatting**: `formatNumber()` — 3942 → "3.9k"
- **HTML escaping**: All user data must go through `escapeHtml()` equivalent (React handles this by default with JSX)

### 3.3 Styling details
- Dashboard centered: `max-width: 800px; margin: 0 auto`
- Cards: `border-radius: 16px`, background `--ls-bg-secondary`, border `--ls-border`
- Card headers: subtle gradient `linear-gradient(135deg, rgba(129,140,248,0.05), transparent)`
- Card hover: border color change + purple box shadow
- Lead points: purple pill `rgba(129,140,248,0.1)` bg, `--ls-primary` text
- Stats values: `24px font-weight: 700`, purple color
- Stats labels: `12px uppercase letter-spacing: 0.5px`
- "Start Chatting" button: gradient pill with shadow, hover lift

### 3.4 Delete from current dashboard
- Remove: search form, `DEMO_RECENT_QUERIES`, `DEMO_CONNECTED_SOURCES`, Quick Actions grid
- Remove: stats grid that never populated

---

## Phase 4: AI Command Center (chat interface)

### 4.1 Welcome State (preview.html lines 210-236)
- Badge: "AI Agent Ready" with pulsing green dot
- Title: "What can I help you with?" (32px, bold)
- Subtitle: capabilities description
- 4 suggestion buttons in 2x2 grid:
  - 📊 CRM Overview
  - 👥 Top Contacts
  - 📧 Create Email
  - 🎯 Campaigns

### 4.2 Chat Messages (preview.html lines 877-1011)
- User messages: right-aligned, gradient bubble
- Bot messages: left-aligned, surface bg with accent border
- Avatars: 36px rounded-10px, bot=gradient bg, user=tertiary bg
- Tool result cards: nested inside bot messages, with icon + name + status badge + body
- Animations: fadeIn on new messages, slideIn on tool cards

### 4.3 Input Area (preview.html lines 1062-1195)
- Pill-shaped container (`border-radius: 100px`)
- Voice button (mic icon, Web Speech API)
- Send button (gradient circle, arrow icon)
- Focus state: purple ring glow
- Max width: 700px centered

### 4.4 Typing Indicator (preview.html lines 1012-1060)
- Bot avatar + 3 bouncing dots + "LeadSpot is thinking..."

### 4.5 API Integration
- POST to `/api/chat` with `{ message, mautic_url, organization_id, enable_tools: true }`
- Response: `{ response, tools_used, tool_results }`
- Tool results render as cards with icon + status

### 4.6 Voice Input (preview.html lines 1752-1878)
- Web Speech API (`webkitSpeechRecognition`)
- Recording state: red pulse animation on mic button
- Interim results populate input field
- Final result fills input, user can review before sending
- Graceful degradation: if browser doesn't support, disable + add `unsupported` class

### Edge cases:
- **Streaming**: Current backend returns full response. If we want streaming later, we need SSE. For now, show typing indicator → full response.
- **Long responses**: Max-width 75% on message content to prevent wall-of-text
- **Tool results format**: Backend returns `tool_results` as array of dicts. Need to parse `tool_name` to pick correct icon.
- **Error handling**: If chat fails, show error in red bubble, don't crash the UI
- **Chat history**: Currently ephemeral (no persistence). Store in state only. Backend doesn't persist yet.
- **Mobile**: Suggestion grid goes to 1 column, welcome title shrinks

---

## Phase 5: Restyle Existing Pages

### 5.1 Deals/Pipeline Kanban
- Replace blue accents with indigo/purple (`#6366f1`, `#818cf8`)
- Card backgrounds: `--ls-bg-secondary` / `--ls-surface`
- Borders: `--ls-border`
- Priority badges: keep green/yellow/red semantic colors
- Column headers: match card header gradient style

### 5.2 Calendar
- Replace blue accents with indigo/purple
- Today highlight: purple ring instead of blue
- Event pills: use calendar event type colors (already has its own color map)
- Mini calendar: same purple accent for selected day

### 5.3 Login Page
- Keep current flow (OAuth first, demo button, collapsible email form)
- Restyle: gradient on demo button should use `--ls-gradient` (indigo→purple, not blue→purple)
- Background: dark theme default

### 5.4 Contacts Page
- Restyle with LeadSpot theme
- This page already exists at `contacts/page.tsx`

---

## Phase 6: Wire MCP Server

### 6.1 Add to `~/.mcp.json`
```json
{
  "mcpServers": {
    "leadspot": {
      "command": "node",
      "args": ["/Users/michaelkraft/leadspot/mcp-server/dist/index.js"],
      "env": {
        "LEADSPOT_API_URL": "http://localhost:8000",
        "LEADSPOT_API_KEY": "",
        "LEADSPOT_ORG_ID": ""
      }
    }
  }
}
```

### 6.2 Verify
- [ ] Backend running: `curl http://localhost:8000/docs`
- [ ] MCP server compiles: `cd mcp-server && npx tsc`
- [ ] Test in Claude Code: ask "list my contacts"

### Edge cases:
- **API key**: Backend may not have API key auth yet (only session cookies). Check `backend/app/middleware/` for auth modes. If missing, add Bearer token validation.
- **Organization ID**: Need to look up from database or create default

---

## Phase 7: Connect Live Mautic Data

### 7.1 Backend endpoint check
Needed endpoints:
- `GET /api/insights/daily` — does it exist?
- `GET /api/contacts` — exists in routers
- `POST /api/chat` — exists, Claude + tools
- `GET /api/campaigns` — check if exists
- `GET /api/emails` — check if exists

**If `/api/insights/daily` doesn't exist:** Create it in `backend/app/routers/insights.py`:
- Calls Mautic API for top contacts by points
- Gets counts of contacts, emails, campaigns, segments
- Optionally calls Claude for AI insights summary

### 7.2 Frontend API service layer
Create thin fetch wrappers:
- `frontend/lib/api/dashboard.ts` — `fetchDashboardInsights()`, `fetchHotLeads()`, `fetchCRMStats()`
- `frontend/lib/api/chat.ts` — `sendChatMessage(message)`

### 7.3 Fallback strategy (matching preview.html's approach)
```typescript
try {
  const data = await fetchDashboardInsights();
  setHotLeads(data.hot_leads);
  setStats(data.stats);
} catch {
  // Show demo data (same as preview.html's showDemoDashboard)
  setHotLeads(DEMO_LEADS);
  setStats(DEMO_STATS);
  setDemoMode(true); // show "Demo Mode" badge
}
```

---

## Phase 8: Unified Inbox (P2 — not blocking beta)

### 8.1 Page structure
- `frontend/app/(dashboard)/inbox/page.tsx`
- Three-panel: conversation list | thread | contact sidebar
- Filter tabs: All, Email, SMS, Chat

### 8.2 Data sources
- Email: Mautic contact activity (email sent/received events)
- Chat: AI Command Center conversation history
- SMS: Voice agent logs (if available)

### 8.3 Navigation
- Add "Inbox" to sidebar between Emails and Reports
- Unread count badge (fetch from API)
- Initially show empty state with "Coming soon" if no backend support

---

## Execution Order

| Step | Phase | Files Changed | Risk | Time |
|------|-------|---------------|------|------|
| 1 | 1.1-1.3 | next.config.js, ThemeToggle.tsx, public/ | Low | 10 min |
| 2 | 1.4-1.5 | tailwind.config.ts, globals.css | Medium (may break existing styles) | 20 min |
| 3 | 2 | layout.tsx (sidebar rewrite) | Medium | 30 min |
| 4 | 3 | dashboard/page.tsx (full rewrite) | Low (new file) | 30 min |
| 5 | 4 | command-center/page.tsx (chat UI) | Medium (API integration) | 45 min |
| 6 | 5 | deals/, calendar/, login, contacts pages | Low (style only) | 30 min |
| 7 | 6 | ~/.mcp.json | Low | 10 min |
| 8 | 7 | lib/api/*.ts, backend insights route | Medium | 30 min |
| 9 | 8 | inbox/page.tsx | Low (new feature) | Later |

**Total Phases 1-7:** ~3 hours of focused work, parallelizable across sub-agents.

---

## Verification Checklist

After completion, verify in browser at `localhost:3006`:

- [ ] Logo: LEADSPOT.ai gradient image (not plain text)
- [ ] Sidebar: Icon-based nav, 220px wide, active=left purple border+gradient
- [ ] Sidebar: AI Command Center at top, correct nav order
- [ ] Dashboard: Time-based greeting (morning/afternoon/evening)
- [ ] Dashboard: Hot Leads card with names + companies + point scores
- [ ] Dashboard: CRM Stats 2x2 grid (Contacts, Emails, Campaigns, Segments)
- [ ] Dashboard: AI Insights full-width card
- [ ] Dashboard: "Start Chatting" gradient pill button
- [ ] Command Center: Welcome screen with 4 suggestion buttons
- [ ] Command Center: Chat input with voice button + send button
- [ ] Command Center: Messages render with correct bubble styles
- [ ] Deals: Kanban board with purple/indigo theme
- [ ] Calendar: Calendar with purple accents
- [ ] Theme toggle: Dark (default) ↔ Light works
- [ ] Theme: localStorage key is `leadspot-theme` (not `innosynth-theme`)
- [ ] Demo login: Still works end-to-end
- [ ] Status bar: Shows connection status at bottom
- [ ] Tab title: Shows "LeadSpot.ai" not "InnoSynth.ai"
- [ ] No InnoSynth references anywhere in visible UI

---

## Review

_To be filled after implementation._
