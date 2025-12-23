# OAuth Integration Guide

Complete OAuth 2.0 integration for Google Drive, Microsoft SharePoint, and Slack.

## Overview

This implementation provides:
- ✅ **Secure OAuth 2.0 flows** with state parameter CSRF protection
- ✅ **Encrypted token storage** using Fernet symmetric encryption
- ✅ **Automatic token refresh** handling
- ✅ **Data connectors** for syncing content from external sources
- ✅ **Rate limiting** and error handling
- ✅ **Webhook support** for real-time sync (Google Drive, SharePoint delta)

## Architecture

```
app/
├── services/
│   ├── oauth/
│   │   ├── __init__.py          # OAuth services package
│   │   ├── base.py              # Base OAuth provider class
│   │   ├── google.py            # Google OAuth implementation
│   │   ├── microsoft.py         # Microsoft OAuth implementation
│   │   └── slack.py             # Slack OAuth implementation
│   ├── connectors/
│   │   ├── __init__.py          # Data connectors package
│   │   ├── base.py              # Base connector class
│   │   ├── google_drive.py      # Google Drive connector
│   │   ├── sharepoint.py        # SharePoint connector
│   │   └── slack.py             # Slack connector
│   └── encryption.py            # Token encryption service
├── models/
│   └── oauth_connection.py      # SQLAlchemy model
├── schemas/
│   └── oauth.py                 # Pydantic schemas
└── routers/
    └── oauth.py                 # API endpoints
```

## Setup Instructions

### 1. Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 2. Generate Encryption Key

```bash
python -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())'
```

Copy the output to your `.env` file as `ENCRYPTION_KEY`.

### 3. Configure OAuth Apps

#### Google Drive

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google Drive API
4. Create OAuth 2.0 credentials:
   - Application type: Web application
   - Authorized redirect URIs: `http://localhost:8000/api/oauth/google/callback`
5. Copy Client ID and Client Secret to `.env`:
   ```
   GOOGLE_CLIENT_ID=your-client-id
   GOOGLE_CLIENT_SECRET=your-client-secret
   ```

#### Microsoft SharePoint

1. Go to [Azure Portal](https://portal.azure.com/)
2. Navigate to Azure Active Directory > App registrations
3. Create a new registration:
   - Supported account types: Multitenant
   - Redirect URI: `http://localhost:8000/api/oauth/microsoft/callback`
4. Add API permissions:
   - Microsoft Graph: Sites.Read.All (Delegated)
   - Microsoft Graph: Files.Read.All (Delegated)
   - Microsoft Graph: User.Read (Delegated)
5. Create a client secret
6. Copy Application (client) ID and secret to `.env`:
   ```
   MICROSOFT_CLIENT_ID=your-client-id
   MICROSOFT_CLIENT_SECRET=your-client-secret
   ```

#### Slack

1. Go to [Slack API Apps](https://api.slack.com/apps)
2. Create a new app:
   - From scratch
   - App name: InnoSynth.ai
3. Add OAuth Redirect URL:
   - `http://localhost:8000/api/oauth/slack/callback`
4. Add OAuth Scopes (Bot Token):
   - channels:history
   - channels:read
   - groups:history
   - groups:read
   - im:history
   - im:read
   - mpim:history
   - mpim:read
   - users:read
   - users:read.email
5. Copy Client ID and Client Secret to `.env`:
   ```
   SLACK_CLIENT_ID=your-client-id
   SLACK_CLIENT_SECRET=your-client-secret
   ```

### 4. Set Environment Variables

Update your `.env` file:

```bash
# OAuth General
API_BASE_URL=http://localhost:8000
ENCRYPTION_KEY=<your-generated-encryption-key>

# Google OAuth
GOOGLE_CLIENT_ID=<your-google-client-id>
GOOGLE_CLIENT_SECRET=<your-google-client-secret>

# Microsoft OAuth
MICROSOFT_CLIENT_ID=<your-microsoft-client-id>
MICROSOFT_CLIENT_SECRET=<your-microsoft-client-secret>

# Slack OAuth
SLACK_CLIENT_ID=<your-slack-client-id>
SLACK_CLIENT_SECRET=<your-slack-client-secret>
```

### 5. Run Database Migration

```bash
psql -U postgres -d innosynth -f migrations/001_create_oauth_connections.sql
```

## API Endpoints

### Get Authorization URL

```http
GET /api/oauth/{provider}/authorize
```

**Providers:** `google`, `microsoft`, `slack`

**Response:**
```json
{
  "authorization_url": "https://...",
  "state": "random-csrf-token",
  "provider": "google"
}
```

**Usage:**
```javascript
// Frontend redirect to authorization URL
const response = await fetch('/api/oauth/google/authorize');
const data = await response.json();
window.location.href = data.authorization_url;
```

### OAuth Callback (Handled automatically)

```http
GET /api/oauth/{provider}/callback?code=xxx&state=xxx
```

This endpoint is called by the OAuth provider after user consent.

### List Connections

```http
GET /api/oauth/connections?provider=google&status=active
```

**Response:**
```json
{
  "connections": [
    {
      "connection_id": "uuid",
      "provider": "google",
      "connected_user_email": "user@example.com",
      "status": "active",
      "scopes": ["drive.readonly"],
      "expires_at": "2024-12-31T23:59:59",
      "last_sync_at": "2024-12-02T10:00:00",
      "documents_synced": 150
    }
  ],
  "total": 1
}
```

### Disconnect Provider

```http
DELETE /api/oauth/{provider}/disconnect?connection_id=xxx
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully disconnected from google"
}
```

### Refresh Token

```http
POST /api/oauth/{provider}/refresh?connection_id=xxx
```

**Response:**
```json
{
  "success": true,
  "message": "Token refreshed successfully",
  "expires_at": "2024-12-31T23:59:59"
}
```

## Using Data Connectors

### Google Drive Connector

```python
from app.services.connectors import GoogleDriveConnector
from app.services.encryption import get_encryption_service

# Get encrypted token from database
connection = db.query(OAuthConnection).filter(...).first()

# Decrypt token
encryption_service = get_encryption_service()
access_token = encryption_service.decrypt(connection.access_token)

# Initialize connector
connector = GoogleDriveConnector(access_token)

# List all files
files = await connector.list_files()

# Get specific file content
document = await connector.get_file_content(file_id)
print(document.content)

# Sync all files
async for document in connector.sync_all(batch_size=10):
    # Process document (e.g., create embeddings, store in vector DB)
    print(f"Synced: {document.name}")
```

### SharePoint Connector

```python
from app.services.connectors import SharePointConnector

connector = SharePointConnector(access_token, site_id="your-site-id")

# List all sites
sites = await connector.list_sites()

# List drives in a site
drives = await connector.list_drives(site_id)

# List files
files = await connector.list_files()

# Get file content
document = await connector.get_file_content(file_id, drive_id)

# Delta sync (only changes since last sync)
changes = await connector.get_delta_changes(drive_id, delta_token)
```

### Slack Connector

```python
from app.services.connectors import SlackConnector

connector = SlackConnector(access_token)

# List all conversations
conversations = await connector.list_conversations()

# Get messages from a channel
document = await connector.get_file_content(channel_id)
print(document.content)  # Formatted message history

# Get conversation history
messages = await connector.get_conversation_history(channel_id, limit=100)
```

## Security Features

### Token Encryption

All OAuth tokens are encrypted at rest using Fernet symmetric encryption:

```python
from app.services.encryption import get_encryption_service

encryption_service = get_encryption_service()

# Encrypt before storing
encrypted_token = encryption_service.encrypt("access_token_value")

# Decrypt when needed
decrypted_token = encryption_service.decrypt(encrypted_token)
```

### CSRF Protection

State parameter validation prevents CSRF attacks:

```python
# Generate state
state = provider.generate_state()

# Validate state in callback
if not provider.validate_state(received_state, stored_state):
    raise Exception("Invalid state parameter")
```

### HTTPS Only

OAuth flows must use HTTPS in production. Update `API_BASE_URL` in production:

```bash
API_BASE_URL=https://api.innosynth.ai
```

## Error Handling

All OAuth operations include comprehensive error handling:

```python
try:
    access_token, refresh_token, expires_at = await provider.exchange_code_for_tokens(code)
except httpx.HTTPError as e:
    # Handle OAuth errors (invalid code, expired state, etc.)
    logger.error(f"OAuth error: {e}")
```

## Rate Limiting

Connectors implement automatic rate limiting:

```python
class BaseConnector:
    def __init__(self, access_token: str):
        self._rate_limit_delay = 0.1  # 100ms between requests

    def _handle_rate_limit(self, retry_after: Optional[int] = None):
        if retry_after:
            self._rate_limit_delay = max(self._rate_limit_delay, retry_after)
        else:
            self._rate_limit_delay = min(self._rate_limit_delay * 2, 60)
```

## Webhook Support

### Google Drive Webhooks

```python
connector = GoogleDriveConnector(access_token)
webhook = await connector.setup_webhook(
    webhook_url="https://api.innosynth.ai/webhooks/google",
    channel_id="unique-channel-id"
)
```

### SharePoint Delta Sync

```python
connector = SharePointConnector(access_token, site_id)
changes = await connector.get_delta_changes(drive_id, delta_token)
# Store new delta_token for next sync
```

### Slack Events API

Configure Events API in Slack App settings to receive real-time message events.

## Testing

### Test OAuth Flow

1. Start the server: `uvicorn app.main:app --reload`
2. Visit: `http://localhost:8000/api/oauth/google/authorize`
3. Follow authorization flow
4. Check database for new connection

### Test Connectors

```python
# Test connection
connector = GoogleDriveConnector(access_token)
is_valid = await connector.test_connection()

# Check sync status
status = connector.get_sync_status()
print(f"Processed: {status.processed_files}/{status.total_files}")
```

## Production Considerations

1. **Use HTTPS only** - Update `API_BASE_URL` to use HTTPS
2. **Secure encryption key** - Store in secure secret manager (AWS Secrets Manager, etc.)
3. **Token rotation** - Implement automatic token refresh before expiration
4. **Rate limiting** - Monitor API usage and adjust rate limits
5. **Webhook verification** - Verify webhook signatures from providers
6. **Error monitoring** - Log and monitor OAuth errors
7. **User consent** - Clearly communicate what data is accessed

## Troubleshooting

### Token Refresh Fails

- Check if refresh token is available
- Verify OAuth app has `access_type=offline` and `prompt=consent`
- Ensure refresh token is encrypted correctly

### Connection Timeout

- Increase `httpx.AsyncClient(timeout=30.0)`
- Check network connectivity to provider APIs

### Invalid State Parameter

- Verify session storage is working correctly
- Check if state is properly stored before redirect
- Ensure state comparison uses `secrets.compare_digest()`

## Next Steps

1. Add authentication middleware to OAuth endpoints
2. Implement organization-based filtering
3. Add webhook handlers for real-time sync
4. Create background jobs for periodic sync
5. Add sync status monitoring dashboard
6. Implement connector health checks

## Support

For issues or questions, refer to provider documentation:
- [Google Drive API](https://developers.google.com/drive/api/v3/about-sdk)
- [Microsoft Graph API](https://docs.microsoft.com/en-us/graph/overview)
- [Slack API](https://api.slack.com/docs)
