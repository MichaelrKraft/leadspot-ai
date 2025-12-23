# InnoSynth.ai Query & Documents Frontend Implementation

## Overview
Building the query and document management pages for InnoSynth.ai - a B2B SaaS platform for enterprise knowledge synthesis.

## Todo Items

### Phase 1: Core Hooks & Utilities
- [ ] Create `hooks/useQuery.ts` - Query submission, loading states, streaming support
- [ ] Create `hooks/useDocuments.ts` - Fetch documents, pagination, filters
- [ ] Create types for Query, Document, Source interfaces

### Phase 2: Reusable Components
- [ ] Create `components/query/QueryInput.tsx` - Enhanced search input with suggestions
- [ ] Create `components/query/QueryResult.tsx` - Formatted results with citations
- [ ] Create `components/documents/DocumentCard.tsx` - Document display card
- [ ] Create `components/documents/DocumentFilters.tsx` - Filter controls

### Phase 3: Query Pages
- [ ] Update `app/(dashboard)/query/page.tsx` - Main query interface
- [ ] Create `app/(dashboard)/query/[id]/page.tsx` - Query detail page
- [ ] Create `app/(dashboard)/query/history/page.tsx` - Query history page

### Phase 4: Document Pages
- [ ] Update `app/(dashboard)/documents/page.tsx` - Documents list with filters
- [ ] Create `app/(dashboard)/documents/[id]/page.tsx` - Document detail page
- [ ] Update `app/(dashboard)/sources/page.tsx` - Sources management page

## Technical Approach

### Design Decisions
1. **TypeScript-first**: Strict typing for all components and hooks
2. **Server Components**: Use Next.js 14 server components where possible
3. **Client Components**: Only for interactive elements (search, filters)
4. **Tailwind CSS**: Consistent styling with existing dashboard
5. **React Query Ready**: Hooks structured for easy React Query integration
6. **Accessibility**: WCAG 2.1 AA compliance with proper ARIA labels
7. **Responsive**: Mobile-first design approach

### State Management
- Local state with useState for UI interactions
- Custom hooks for data fetching (ready for React Query)
- URL state for filters and pagination (searchParams)
- Optimistic updates for better UX

### Component Architecture
- Atomic design pattern: hooks → components → pages
- Server components for static content
- Client components marked with 'use client'
- Proper separation of concerns

### API Integration Points
- `/api/query` - Submit queries
- `/api/query/history` - Get query history
- `/api/documents` - List documents with filters
- `/api/documents/:id` - Get document details
- `/api/sources` - Manage connected sources

## Implementation Order
1. Types and interfaces first
2. Custom hooks for data operations
3. Reusable UI components
4. Page implementations using components

## Review Section
(To be filled after implementation)

### Files Created
(List will be populated)

### Key Decisions Made
(Decisions will be documented)

### Known Issues / Future Improvements
(Issues will be noted)

### Next Steps
(Next steps will be outlined)
