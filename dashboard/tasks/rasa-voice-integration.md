# Voice AI Integration Plan for Ploink CRM (Assistable.ai-Style)

**Date:** December 22, 2025
**Status:** Planning Phase - Awaiting Approval
**Updated:** Pivoted from Rasa to Assistable.ai-style voice calling platforms

---

## Executive Summary

This plan outlines how to integrate an **Assistable.ai-style voice AI platform** with **Ploink CRM** to enable:
- Real inbound/outbound phone calls (not just browser-based)
- Automated appointment scheduling
- Lead qualification via voice
- CRM sync (contacts, campaigns, notes)
- No-code/low-code configuration

### Why NOT Rasa?
| Feature | Rasa | Assistable.ai / What You Need |
|---------|------|------------------------------|
| Real phone calls | No (browser only) | Yes (Twilio/SIP) |
| Appointment booking | No | Yes |
| CRM integration | Manual coding | Built-in |
| Lead qualification | No | Yes |
| Setup complexity | Developer-heavy | No-code UI |

---

## Top Open Source Alternatives to Assistable.ai

Based on research, these are the best open source options:

### 1. Dograh AI (RECOMMENDED)
- **GitHub:** https://github.com/dograh-hq/dograh
- **Type:** 100% open source, self-hostable, BSD-2 license
- **Setup:** 2-minute deployment via Docker
- **Features:**
  - No-code drag-and-drop workflow builder
  - Inbound/outbound phone calls via Twilio
  - CRM integration (custom API connections)
  - Appointment booking
  - Lead qualification
  - Real-time voice AI with <500ms latency
- **Best for:** Closest to Assistable.ai with no-code UI

### 2. Vocode
- **GitHub:** https://github.com/vocodedev/vocode-core
- **Type:** Open source, YC-backed
- **Setup:** Python + FastAPI + Twilio
- **Features:**
  - LLM-powered voice agents
  - Twilio integration for real calls
  - Deepgram STT + ElevenLabs TTS
  - Custom agent logic
- **Best for:** Developers who want more control

### 3. LiveKit Agents
- **GitHub:** https://github.com/livekit/agents
- **Type:** Open source WebRTC platform
- **Setup:** Self-hosted or cloud
- **Features:**
  - Voice + video AI agents
  - SIP/PSTN integration
  - Low latency (<300ms)
  - 1,000 free minutes/month
- **Best for:** Real-time communication apps

---

## Recommendation: Dograh AI

Given that Ploink is a GoHighLevel clone and you want Assistable.ai-like functionality, **Dograh AI** is the best fit because:

1. **No-code workflow builder** - like Assistable's UI
2. **100% open source** - self-host on your infrastructure
3. **Built for CRM use cases** - lead qualification, appointment booking
4. **Twilio integration** - real phone calls, not just web audio
5. **2-minute setup** - single Docker command

---

## Architecture Overview (with Dograh)

```
+-----------------------------------------------------------------------------+
|                    Ploink CRM + Dograh Voice AI                             |
+-----------------------------------------------------------------------------+
|                                                                             |
|   +-----------------+     +------------------+     +-------------------+    |
|   |  Phone Network  |     |   Dograh AI      |     |  Ploink Next.js   |    |
|   |  (PSTN/SIP)     |<--->|   Voice Agent    |<--->|  CRM Dashboard    |    |
|   |                 |     |                  |     |                   |    |
|   |  Inbound calls  |     |  - Workflow UI   |     |  - Mautic API     |    |
|   |  Outbound calls |     |  - LLM (OpenAI)  |     |  - Contacts       |    |
|   +-----------------+     |  - STT/TTS       |     |  - Campaigns      |    |
|          ^                |  - CRM Webhooks  |     |  - Segments       |    |
|          |                +------------------+     +-------------------+    |
|          |                        |                        |               |
|          v                        v                        v               |
|   +-----------------+     +------------------+     +-------------------+    |
|   |     Twilio      |     |   PostgreSQL     |     |     Mautic        |    |
|   |   Voice API     |     |   (Dograh DB)    |     |   (Backend CRM)   |    |
|   |                 |     |                  |     |                   |    |
|   |  $0.0085/min    |     |  Call logs       |     |  Marketing auto   |    |
|   +-----------------+     |  Transcripts     |     |  Email campaigns  |    |
|                           +------------------+     +-------------------+    |
|                                                                             |
+-----------------------------------------------------------------------------+
```

---

## Todo List

### Phase 1: Deploy Dograh AI
- [ ] Set up server (VPS or local Docker)
- [ ] Run Dograh via Docker Compose
- [ ] Access Dograh dashboard (http://localhost:3000)
- [ ] Configure API keys (OpenAI, Twilio, STT/TTS)

### Phase 2: Twilio Phone Integration
- [ ] Create Twilio account
- [ ] Purchase phone number for Ploink
- [ ] Configure Twilio webhook to point to Dograh
- [ ] Test inbound call handling
- [ ] Test outbound call initiation

### Phase 3: Build Ploink CRM Workflows
- [ ] Create "Lead Qualification" voice agent
- [ ] Create "Appointment Booking" voice agent
- [ ] Create "Customer Support" voice agent
- [ ] Configure CRM webhook to sync to Mautic contacts
- [ ] Set up call transcription logging

### Phase 4: Ploink Dashboard Integration
- [ ] Add `/app/voice-ai/page.tsx` to Ploink dashboard
- [ ] Create call log viewer component
- [ ] Add voice agent configuration UI
- [ ] Create appointment calendar integration
- [ ] Build real-time call monitoring view

### Phase 5: Testing & Refinement
- [ ] Test full call flow (inbound qualification)
- [ ] Test outbound calling campaigns
- [ ] Verify CRM sync (contacts created/updated)
- [ ] Optimize voice latency
- [ ] Train on edge cases and custom intents

---

## Dograh Quick Start

### 1. Deploy with Docker (2 minutes)
```bash
# Create directory
mkdir ~/dograh && cd ~/dograh

# Download and run
curl -o docker-compose.yaml \
  https://raw.githubusercontent.com/dograh-hq/dograh/main/docker-compose.yaml

docker compose up --pull always
```

### 2. Access Dashboard
Open http://localhost:3000 in your browser

### 3. Configure API Keys
In Dograh Settings, add:
- **OpenAI API Key** - for LLM conversations
- **Twilio Account SID + Auth Token** - for phone calls
- **Twilio Phone Number** - your business line
- **STT Provider** (Deepgram recommended)
- **TTS Provider** (ElevenLabs or Play.ht)

### 4. Create Your First Voice Agent
1. Click "Create Workflow"
2. Select "Inbound Call" or "Outbound Call"
3. Describe your agent: "Qualify leads for a real estate business. Ask about budget, timeline, and property preferences. If qualified, book an appointment."
4. Connect to Ploink CRM via webhook

---

## CRM Webhook Integration

Dograh can call Ploink's APIs via webhook actions. Example workflow:

### Lead Qualification Agent
```
1. Greet caller
2. Ask: "What's your name?"
3. Ask: "What's the best email to reach you?"
4. Ask: "What are you looking for help with today?"
5. [Webhook] POST /api/mautic/contacts
   - Create or update contact in Ploink CRM
6. Ask: "Would you like to schedule a call with our team?"
7. If yes → [Webhook] POST /api/appointments/book
8. End call with confirmation
```

### Webhook Configuration
```json
{
  "url": "http://localhost:3005/api/mautic/contacts",
  "method": "POST",
  "headers": {
    "Content-Type": "application/json"
  },
  "body": {
    "firstname": "{{caller_name}}",
    "email": "{{caller_email}}",
    "phone": "{{caller_phone}}",
    "notes": "{{call_transcript}}"
  }
}
```

---

## Ploink API Endpoints for Voice Integration

These are the Ploink endpoints Dograh will call:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/mautic/contacts` | POST | Create new contact from call |
| `/api/mautic/contacts` | GET | Look up existing contact |
| `/api/mautic/campaigns` | GET | Check active campaigns |
| `/api/mautic/segments` | POST | Add contact to segment |
| `/api/voice/call-log` | POST | Log call transcript (new) |
| `/api/appointments/book` | POST | Book appointment (new) |

### New APIs to Build
```typescript
// /api/voice/call-log/route.ts
// Log call transcripts and metadata from Dograh
export async function POST(req: Request) {
  const { phone, transcript, duration, outcome, contactId } = await req.json();
  // Save to database
  // Update contact in Mautic
}

// /api/appointments/book/route.ts
// Handle appointment booking from voice agent
export async function POST(req: Request) {
  const { contactId, dateTime, type, notes } = await req.json();
  // Create calendar event
  // Send confirmation email via Mautic
}
```

---

## Cost Comparison

| Platform | Type | Monthly Cost (1000 mins) |
|----------|------|--------------------------|
| Assistable.ai | SaaS | ~$99-299/mo |
| Dograh AI | Self-hosted | $0 (+ Twilio ~$8.50) |
| Vocode | Self-hosted | $0 (+ Twilio + API costs) |
| Bland AI | SaaS | $90/mo |
| Retell AI | SaaS | $49-199/mo |

### Dograh Cost Breakdown (self-hosted)
| Service | Cost |
|---------|------|
| Dograh | Free (open source) |
| Twilio Voice | $0.0085/min inbound, $0.014/min outbound |
| OpenAI GPT-4 | ~$0.03/1K tokens |
| Deepgram STT | $0.0043/min (or free tier) |
| ElevenLabs TTS | ~$0.30/1K chars |
| **Total ~1000 min/month** | **~$15-30** |

---

## Alternative: Vocode (Developer Option)

If you prefer more control and custom Python code:

### Vocode Setup
```bash
# Clone the repo
git clone https://github.com/vocodedev/vocode-core.git
cd vocode-core

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.template .env
# Add: OPENAI_API_KEY, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, etc.

# Run telephony server
python telephony_app/main.py
```

### Vocode + Ploink Integration
```python
# agent.py - Custom agent that syncs with Ploink CRM
from vocode.streaming.agent import ChatGPTAgent
import requests

class PloinkCRMAgent(ChatGPTAgent):
    async def on_call_end(self, conversation):
        # Sync to Ploink CRM
        contact_data = {
            "firstname": conversation.get("caller_name"),
            "phone": conversation.get("caller_phone"),
            "notes": conversation.get("transcript")
        }
        requests.post(
            "http://localhost:3005/api/mautic/contacts",
            json=contact_data
        )
```

---

## Implementation Roadmap

### Week 1: Infrastructure
- Deploy Dograh on VPS or local Docker
- Set up Twilio account and phone number
- Configure API keys
- Test basic inbound call handling

### Week 2: Voice Agents
- Build lead qualification agent
- Build appointment booking agent
- Configure webhook to Ploink CRM
- Test end-to-end call flows

### Week 3: Dashboard Integration
- Add voice AI page to Ploink dashboard
- Build call log viewer
- Create agent configuration UI
- Integrate with Mautic contacts

### Week 4: Polish & Launch
- Optimize voice latency
- Add error handling
- Create admin documentation
- Train team on using the system

---

## Environment Variables

Add to `/Users/michaelkraft/mautic-platform/dashboard/.env.local`:
```bash
# Dograh/Voice AI Configuration
DOGRAH_API_URL=http://localhost:3000
DOGRAH_API_KEY=your-dograh-api-key

# Twilio Configuration
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_PHONE_NUMBER=+1234567890

# Voice Service API Keys (passed to Dograh)
OPENAI_API_KEY=your-openai-key
DEEPGRAM_API_KEY=your-deepgram-key
ELEVENLABS_API_KEY=your-elevenlabs-key
```

---

## References

- [Dograh AI GitHub](https://github.com/dograh-hq/dograh)
- [Dograh Documentation](https://blog.dograh.com/)
- [Vocode Core GitHub](https://github.com/vocodedev/vocode-core)
- [Vocode Telephony Docs](https://docs.vocode.dev/open-source/telephony)
- [LiveKit Agents](https://github.com/livekit/agents)
- [Twilio Voice API](https://www.twilio.com/docs/voice)
- [Assistable.ai](https://www.assistable.ai/) (for reference)

---

## Decision: Which Platform?

| If you want... | Choose... |
|----------------|-----------|
| Fastest setup, no-code | **Dograh AI** |
| Full developer control | **Vocode** |
| Enterprise features | Commercial (Retell, Synthflow) |
| Maximum cost savings | Dograh + self-hosted everything |

**My recommendation: Start with Dograh AI** because it's closest to Assistable.ai's no-code experience while being 100% open source and self-hostable.

---

## Review Section

*To be filled after implementation*

### Summary of Changes
- TBD

### What Worked Well
- TBD

### Challenges Encountered
- TBD

---

**Next Step:** Review this plan and let me know if you want to proceed with Dograh AI, Vocode, or a different approach.
