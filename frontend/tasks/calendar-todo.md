# Calendar UI - Build Plan

## Summary
Build a full Calendar UI for the LeadSpot.ai CRM dashboard. Monthly/weekly/day views, event management modal, availability editor, mini calendar sidebar, and sidebar nav integration.

## Tasks

- [ ] 1. Create `types/calendar.ts` - CalendarEvent, Availability, DayEvents interfaces
- [ ] 2. Create `components/calendar/CalendarGrid.tsx` - Monthly/weekly/day views with navigation, event pills, today highlight
- [ ] 3. Create `components/calendar/EventModal.tsx` - Create/edit event form with contact dropdown, duration presets
- [ ] 4. Create `components/calendar/AvailabilityEditor.tsx` - Weekly hours editor with day toggles and time slots
- [ ] 5. Create `components/calendar/MiniCalendar.tsx` - Small month calendar + today's schedule + upcoming events
- [ ] 6. Create `app/(dashboard)/calendar/page.tsx` - Calendar page combining all components with demo data
- [ ] 7. Add "Calendar" to sidebar navigation in `app/(dashboard)/layout.tsx`
- [ ] 8. Verify compilation with `npx tsc --noEmit`

## Design Patterns (from codebase analysis)
- Dark mode: `dark:bg-[#0A0F1C]`, `dark:border-white/10`, `dark:bg-white/5`
- Cards: `rounded-2xl border border-gray-200 bg-white backdrop-blur-xl dark:border-white/10 dark:bg-white/5`
- Active nav: `border border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400`
- Page wrapper: `<div className="p-8">`
- Headings: `text-3xl font-bold text-gray-900 dark:text-white`
- Muted text: `text-gray-600 dark:text-gray-400`
- Hover items: `dark:hover:bg-white/10`
- Icons: lucide-react (already installed)
- Auth: `useAuthStore` from `@/stores/useAuthStore`

## Review
_(to be filled after completion)_
