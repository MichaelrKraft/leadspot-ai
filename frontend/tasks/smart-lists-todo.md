# Smart Lists Frontend Page

## Plan
Build the Smart Lists frontend page for LeadSpot's Next.js dashboard.

## Tasks
- [x] Create `/lib/api/agent.ts` - API client for agent-service endpoints
- [x] Create `/app/(dashboard)/smart-lists/page.tsx` - Smart Lists page with contact cards, tabs, progress tracking
- [x] Update `/app/(dashboard)/layout.tsx` - Add Smart Lists nav item after Contacts

## Review
- **`lib/api/agent.ts`**: 11 typed functions covering smart lists, pipeline brief, timeline, approval queue, and action plans. All use `fetch()` to `/api/agent/*` endpoints with `organizationId` as query param (GET) or body (POST).
- **`smart-lists/page.tsx`**: 260 lines. Horizontal tab bar for list selection, priority-coded contact cards (urgent/high/medium/low), "Mark Done" button per contact, Smart List Zero progress bar with celebration state, completed contacts shown faded below a divider. Loading/error/empty states all handled.
- **`layout.tsx`**: Added "Smart Lists" nav item after Contacts with a filter/grid icon. Added `/smart-lists` to `pageTitles` map for header display.

## Design Notes
- Dark theme matching existing dashboard (bg-gray-900, zinc, indigo accents)
- Horizontal tabs for smart list selection
- Priority badges: urgent=red, high=orange, medium=yellow, low=gray
- Smart List Zero progress bar
- Loading and empty states
- Under 300 lines per file
