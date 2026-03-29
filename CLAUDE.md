# LeadSpot.ai - AI Agent Command Center for CRM

## Project Overview

LeadSpot is an AI-first CRM that combines Mautic's marketing automation with autonomous AI agents. Unlike traditional CRMs that require manual input, LeadSpot's AI agents proactively manage leads, make calls, send follow-ups, and book appointments.

**Target Market:** Small businesses, agencies, solopreneurs, developers, vibe coders

**Monetization:** Freemium with prepaid voice minutes ($0.10/min)

## Architecture

```
~/leadspot/
├── backend/           # FastAPI + 14 Mautic tools + Claude integration
├── frontend/          # Next.js 14 dashboard (port 3006)
├── dashboard/         # Voice AI billing dashboard
├── mautic-plugin/     # Chat command center embedded in Mautic
├── voice-agent/       # Autonomous voice AI (Deepgram/GPT-4/ElevenLabs)
├── database/          # PostgreSQL schemas
├── scripts/           # Server provisioning
└── docs/              # Documentation
```

## Component Details

### Backend (FastAPI) - COMPLETE
- **14 Mautic Tools:** CRUD for contacts, emails, campaigns, segments
- **Chat Endpoint:** `/api/chat` with Claude integration
- **OAuth Flow:** Token refresh working
- **Production:** Deployed and running

### Voice AI Agent - COMPLETE
- **STT:** Deepgram nova-2
- **LLM:** GPT-4
- **TTS:** ElevenLabs (8 voices)
- **Actions:** book_appointment, qualify_lead, save_contact, send_sms
- **Calendar:** Google Calendar integration for booking

### Frontend Dashboard - IN PROGRESS
- **Framework:** Next.js 14 with App Router
- **Auth:** Email/password + OAuth (Google, Microsoft)
- **Pages:** Dashboard, Command Center, Contacts, Query, Documents, Settings, Admin
- **Missing:** Pipeline/Kanban, Calendar UI, Unified Inbox

### Mautic Plugin - COMPLETE
- **Chat UI:** Pastel periwinkle theme
- **Dark/Light Toggle:** CSS variables
- **Sidebar Nav:** Dashboard, Contacts, Campaigns, Emails, Analytics

### Billing System - COMPLETE
- **Model:** Prepaid wallet
- **Rate:** $0.10/min for voice
- **Stripe:** Integration working
- **Auto-pause:** Pauses on zero balance

## Development Commands

```bash
# Frontend (main dashboard)
cd frontend && npm run dev  # Port 3006

# Backend
cd backend && uvicorn main:app --reload  # Port 8000

# Voice Agent
cd voice-agent && npm run dev
```

## API Endpoints

### Backend
- `POST /api/chat` - Claude chat with Mautic tools
- `GET /api/contacts` - List contacts
- `POST /api/contacts` - Create contact
- `GET /api/campaigns` - List campaigns
- `POST /api/emails/send` - Send email

### Voice Agent
- `POST /api/agents` - Create voice agent
- `GET /api/calls` - List calls
- `POST /api/calls/initiate` - Start outbound call
- `GET /api/usage` - Get usage stats

## Environment Variables

```bash
# Backend
MAUTIC_BASE_URL=
MAUTIC_CLIENT_ID=
MAUTIC_CLIENT_SECRET=
ANTHROPIC_API_KEY=

# Voice Agent
DEEPGRAM_API_KEY=
OPENAI_API_KEY=
ELEVENLABS_API_KEY=
GOOGLE_CALENDAR_CREDENTIALS=

# Billing
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
```

## Current Sprint (Beta Blockers)

### P0 - Pipeline/Kanban View
- `frontend/app/(dashboard)/deals/page.tsx` - Kanban board
- `frontend/components/deals/PipelineKanban.tsx` - Drag-drop stages
- API routes for deal stages

### P0 - Calendar UI
- `frontend/app/(dashboard)/calendar/page.tsx` - Calendar view
- `frontend/components/calendar/AvailabilityEditor.tsx`
- Public booking page
- Connect to existing Google Calendar integration

### P1 - MCP Tools for CLI
- Set up MCP server in `/mcp/`
- Wrap 14 Mautic tools as MCP tools
- Add voice agent control tools
- Test with Claude Code CLI

### P1 - Unified Inbox
- Email conversations view
- SMS conversations view
- Chat history

## Code Style

- TypeScript strict mode
- Tailwind CSS for styling
- Dark mode support via CSS variables
- Component co-location with pages
