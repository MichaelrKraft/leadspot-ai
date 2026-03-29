# Ploink Voice Agent

LiveKit-powered voice AI agent for Ploink CRM.

## Features

- **Book Appointments**: Natural language appointment booking with Google Calendar
- **Save Contacts**: Automatically save caller info to Mautic CRM
- **Send SMS**: Text confirmations during or after calls via Twilio
- **Lead Qualification**: Qualify leads and tag them in the CRM

## Quick Start

### 1. Install Dependencies

```bash
# Using uv (recommended)
uv sync

# Or using pip
pip install -e .
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your API keys
```

### 3. Set Up Google Calendar (Optional)

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a project and enable Google Calendar API
3. Create OAuth 2.0 credentials (Desktop app)
4. Download and save as `client_secret.json`
5. Run the authorization script:

```bash
python -c "
from google_auth_oauthlib.flow import InstalledAppFlow
SCOPES = ['https://www.googleapis.com/auth/calendar']
flow = InstalledAppFlow.from_client_secrets_file('client_secret.json', SCOPES)
creds = flow.run_local_server(port=0)
with open('google_creds.json', 'w') as f:
    f.write(creds.to_json())
print('Saved credentials to google_creds.json')
"
```

### 4. Test Locally

```bash
# Download required models (first time only)
uv run python src/agent.py download-files

# Test in console mode (text-based)
uv run python src/agent.py console

# Run with LiveKit (requires LiveKit Cloud account)
uv run python src/agent.py start
```

### 5. Deploy to LiveKit Cloud

```bash
# Install LiveKit CLI
brew install livekit-cli

# Authenticate
lk cloud auth

# Deploy
lk agent create
```

## Cost Breakdown

| Service | Cost |
|---------|------|
| LiveKit Cloud (free tier) | $0 (1,000 min/mo) |
| Twilio Voice | $0.0085/min inbound |
| OpenAI GPT-4o-mini | ~$0.002/min |
| Deepgram STT | $0.0077/min |
| Cartesia TTS | ~$0.01/min |
| **Total** | **~$0.03-0.04/min** |

## License

MIT
