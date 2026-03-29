# Phase 5.4 GDPR Compliance

**Date:** 2026-03-03
**Status:** In Progress

---

## Todo

- [x] Read prisma/schema.prisma to understand data model
- [x] Read src/lib/mautic-client.ts — confirm no deleteContact method exists
- [x] Read src/lib/mautic-server.ts — understand getMauticClientForTenant/persistRefreshedTokens
- [x] Read src/lib/auth.ts — confirm session auth pattern
- [x] Add `deleteContact` method to MauticClient
- [x] Create `src/app/api/user/export/route.ts` — GDPR data export endpoint
- [x] Create `src/app/api/contacts/[id]/route.ts` — DELETE contact with transcript cascade
- [x] Create `src/app/privacy/page.tsx` — Privacy policy page (dark theme, server component)
- [x] Run `npx tsc --noEmit` to verify 0 type errors
- [x] Git commit

---

## Changes Made

1. **`src/lib/mautic-client.ts`** — Added `deleteContact(id: string | number)` method using
   the Mautic REST API endpoint `DELETE /api/contacts/{id}`.

2. **`src/app/api/user/export/route.ts`** — New GET endpoint that exports all user data
   (profile, wallet, transactions, voice agents, calls with transcripts, usage records)
   as a downloadable JSON file with `Content-Disposition: attachment`.

3. **`src/app/api/contacts/[id]/route.ts`** — New DELETE endpoint that:
   - Authenticates via session
   - Deletes VoiceTranscript rows linked to calls for the given contactId/tenantId
   - Deletes the Mautic contact via the REST API

4. **`src/app/privacy/page.tsx`** — Static server component privacy policy page matching
   dark theme with cyan accents. Covers data collected, usage, rights, and GDPR contact.

## Notes

- The export endpoint uses `prisma` directly (not getTenantPrisma) because the User/Wallet
  models are not tenant-scoped for the export — we query by userId which is the user's own data.
- VoiceAgent is queried by userId, and VoiceTranscript has cascade delete from VoiceCall in
  schema, but the contacts DELETE route explicitly cascades to ensure GDPR "right to erasure".
- VoiceTranscript does not have a tenantId column itself; the tenantId check is done via
  the nested `call` relation (call.tenantId = tenantId) for security.
