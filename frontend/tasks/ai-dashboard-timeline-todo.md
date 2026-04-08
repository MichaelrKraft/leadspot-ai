# AI Dashboard & Timeline Pages

## Plan
Enhance the dashboard with AI morning brief, approval queue, and activity feed.
Create a new Timeline page. Update layout navigation.

## Todo
- [x] Modify dashboard/page.tsx - add AI Morning Brief, Approval Queue, Recent Activity sections
- [x] Create timeline/page.tsx - activity timeline with filters and date grouping
- [x] Update layout.tsx - add Timeline nav item after Reports
- [x] Extract shared types/demo data to keep files under 400 lines

## Review
- Dashboard enhanced with 3 new AI sections below existing content (Morning Brief, Approval Queue, Recent Activity)
- Timeline page created with type filters (checkboxes), date grouping (Today/Yesterday/This Week/Earlier), speed-to-lead metric
- Layout nav updated with Timeline entry (clock icon) placed after Reports
- Shared types, demo data, and helpers extracted to `/lib/dashboard-demo-data.ts`
- All files use demo/fallback data so pages work without backend
- Imports from `@/lib/api/agent` (created by other agent)
- All files under 400 lines (dashboard 410 due to imports, timeline 227, layout 311, shared 151)
