# LeadSpot MCP Server

MCP (Model Context Protocol) server for LeadSpot.ai. Exposes Mautic CRM tools to Claude Code, Claude Desktop, and other MCP clients.

## Tools Available

### Contacts
- `leadspot_contacts_list` - Search and browse contacts
- `leadspot_contacts_get` - Get contact details
- `leadspot_contacts_create` - Create a new contact
- `leadspot_contacts_update` - Update contact fields
- `leadspot_contacts_delete` - Delete a contact
- `leadspot_contacts_add_tag` - Add a tag to a contact
- `leadspot_contacts_add_note` - Add a note to contact timeline
- `leadspot_contacts_score` - Calculate lead engagement score

### Emails
- `leadspot_emails_list` - List email templates
- `leadspot_emails_get` - Get email details and stats
- `leadspot_emails_create` - Create a new email template
- `leadspot_emails_send` - Send an email to a contact

### Campaigns
- `leadspot_campaigns_list` - List automation workflows
- `leadspot_campaigns_get` - Get campaign details
- `leadspot_campaigns_create` - Create a new campaign
- `leadspot_campaigns_publish` - Publish/activate a campaign
- `leadspot_campaigns_add_contact` - Add contact to campaign

### Segments
- `leadspot_segments_list` - List contact segments
- `leadspot_segments_create` - Create a new segment
- `leadspot_segments_add_contact` - Add contact to segment

### AI & Status
- `leadspot_chat` - Natural language commands to the AI agent
- `leadspot_crm_summary` - Quick CRM overview with counts
- `leadspot_status` - Check backend service status

## Setup

### 1. Install dependencies

```bash
cd mcp-server
npm install
npm run build
```

### 2. Configure environment

Set these environment variables (or pass them in the MCP config):

| Variable | Description | Default |
|----------|-------------|---------|
| `LEADSPOT_API_URL` | LeadSpot backend URL | `http://localhost:8000` |
| `LEADSPOT_API_KEY` | API key for authentication | (none) |
| `LEADSPOT_ORG_ID` | Default organization ID | (none) |

### 3. Add to Claude Code

Add to `~/.mcp.json`:

```json
{
  "mcpServers": {
    "leadspot": {
      "command": "node",
      "args": ["/Users/michaelkraft/leadspot/mcp-server/dist/index.js"],
      "env": {
        "LEADSPOT_API_URL": "http://localhost:8000",
        "LEADSPOT_API_KEY": "your-api-key",
        "LEADSPOT_ORG_ID": "your-org-id"
      }
    }
  }
}
```

### 4. Add to Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "leadspot": {
      "command": "node",
      "args": ["/Users/michaelkraft/leadspot/mcp-server/dist/index.js"],
      "env": {
        "LEADSPOT_API_URL": "http://localhost:8000",
        "LEADSPOT_API_KEY": "your-api-key",
        "LEADSPOT_ORG_ID": "your-org-id"
      }
    }
  }
}
```

## Development

```bash
# Run in dev mode with hot reload
npm run dev

# Build for production
npm run build

# Run production build
npm start
```

## Architecture

```
src/
  index.ts              # Entry point - creates MCP server, registers tools
  lib/
    config.ts           # Environment variable loading
    mautic-client.ts    # HTTP client for LeadSpot backend API
  tools/
    contacts.ts         # Contact CRUD, tagging, scoring
    emails.ts           # Email templates and sending
    campaigns.ts        # Campaign/workflow management
    segments.ts         # Segment management
    voice.ts            # AI chat, CRM summary, status
```

The MCP server acts as a thin proxy: it receives tool calls from Claude, translates them into requests to the LeadSpot backend `/api/chat` endpoint, and returns the AI agent's response. The backend handles all Mautic OAuth, token refresh, and direct API calls.
