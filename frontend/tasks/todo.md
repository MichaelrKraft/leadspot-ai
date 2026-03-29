# Pipeline/Kanban View - Todo

## Plan
Build a drag-and-drop Kanban board for deal pipeline management in the LeadSpot CRM.

## Tasks
- [x] Read existing codebase patterns (layout, sidebar nav, contacts page, Card component)
- [x] Create directories: `app/(dashboard)/deals/`, `components/deals/`
- [ ] Create `types/deals.ts` - Deal and PipelineStage interfaces
- [ ] Create `components/deals/DealCard.tsx` - Compact deal card with priority/days indicators
- [ ] Create `components/deals/NewDealModal.tsx` - Form modal to create deals
- [ ] Create `components/deals/PipelineKanban.tsx` - Kanban board with drag-and-drop
- [ ] Create `app/(dashboard)/deals/page.tsx` - Deals page wrapper
- [ ] Add "Deals" to sidebar navigation in `app/(dashboard)/layout.tsx`
- [ ] Verify TypeScript compiles cleanly

## Design Notes
- Match dark theme from existing pages
- Stage colors: blue (lead) -> indigo (qualified) -> purple (proposal) -> amber (negotiation) -> green (won) -> red (lost)
- HTML5 drag-and-drop API only, no extra dependencies
- Demo data with 8-10 deals spread across stages
- Mobile responsive: columns stack vertically on small screens

## Review Section
(To be filled after implementation)
