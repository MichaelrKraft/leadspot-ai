# LeadSpot.ai - AI Agent Command Center for CRM

LeadSpot.ai is an autonomous AI agent platform built on Mautic CRM. Users interact via natural language to launch agents that **execute complex marketing tasks** - not just answer questions.

## What LeadSpot Can Do

- "Create a 5-email nurture sequence for new leads"
- "Build a landing page for our upcoming webinar"
- "Set up a workflow that tags hot leads when they visit pricing 3+ times"
- "Respond to all unanswered emails from this week"
- "Analyze last month's campaigns and suggest improvements"

**This is NOT a chatbot.** It's a team of autonomous AI agents that DO the work.

## Quick Start

### Prerequisites
- Node.js 18+
- Python 3.11+
- Docker & Docker Compose

### Development Setup

```bash
# Start backend services (PostgreSQL, Redis, Neo4j)
docker-compose up -d postgres redis neo4j

# Backend
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python run.py

# Frontend (new terminal)
cd frontend
npm install
npm run dev
```

Access the application:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Required
DATABASE_URL=postgresql://leadspot:password@localhost:5432/leadspot
JWT_SECRET=your-secret-key-at-least-32-chars

# Optional - for AI features
ANTHROPIC_API_KEY=your-anthropic-key  # User brings their own key (BYOK)

# Mautic CRM Connection (per organization)
# Configured via Settings UI after login
```

## Architecture

### Tech Stack
- **Frontend**: Next.js 14, React 18, TypeScript, Tailwind CSS
- **Backend**: FastAPI (Python), async/await
- **Agent Runtime**: Claude API with tool use
- **Databases**: PostgreSQL (users), Pinecone (vectors), Redis (cache)
- **CRM Backend**: Mautic REST API

### BYOK (Bring Your Own Key) Model
Users provide their own Anthropic API key. This means:
- **$0 API cost to you** - users pay Anthropic directly
- **~$0.003 per simple query** for users
- **~$0.05-0.20 per complex multi-agent task**

## Agent Types

| Agent | Purpose |
|-------|---------|
| **Orchestrator** | Plans complex tasks, delegates to subagents |
| **Email Agent** | Creates/manages email campaigns |
| **Workflow Agent** | Builds automation workflows |
| **Segment Agent** | Creates/manages contact segments |
| **Landing Page Agent** | Creates landing pages & forms |
| **Analytics Agent** | Analyzes performance, suggests improvements |
| **Contact Agent** | Manages individual contacts |
| **Outreach Agent** | Handles communication |

## Features

### Command Center
Conversational interface where you chat with AI agents naturally. They respond in real-time while executing tasks.

### Scheduled Tasks
Schedule agents to run automatically:
- "Every Monday at 9am, send me a campaign performance report"
- "Check for new high-value leads every hour"
- One-time or recurring schedules

### Mautic Integration
Connect your Mautic CRM instance via OAuth2. LeadSpot agents can:
- Create and send emails
- Build automation workflows
- Manage contacts and segments
- Create landing pages and forms
- Analyze campaign performance

## Development Commands

```bash
# Start development
make dev

# Run tests
make test

# Build for production
make build

# View logs
make logs
```

## Deployment

LeadSpot is designed to run on the same server as your Mautic instance. See `DEPLOYMENT.md` for production setup instructions.

## License

Proprietary - All rights reserved

---

**Built for marketers who want AI that actually does the work.**
