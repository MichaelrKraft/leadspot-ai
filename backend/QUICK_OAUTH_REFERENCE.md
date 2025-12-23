# Quick OAuth Integration Reference

**Quick reference for developers working with InnoSynth.ai OAuth integration.**

---

## 🚀 Quick Start (5 Minutes)

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Generate encryption key
python -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())'

# 3. Add to .env
ENCRYPTION_KEY=<your-generated-key>
GOOGLE_CLIENT_ID=<from-google>
GOOGLE_CLIENT_SECRET=<from-google>

# 4. Run migration
psql -U postgres -d innosynth -f migrations/001_create_oauth_connections.sql

# 5. Start server
uvicorn app.main:app --reload
```

---

## 🔐 Common Code Patterns

### Initialize OAuth Provider

```python
from app.services.oauth import GoogleOAuthProvider
from app.config import settings

provider = GoogleOAuthProvider(
    client_id=settings.GOOGLE_CLIENT_ID,
    client_secret=settings.GOOGLE_CLIENT_SECRET,
    redirect_uri=f"{settings.API_BASE_URL}/oauth/google/callback"
)
```

### Encrypt/Decrypt Tokens

```python
from app.services.encryption import get_encryption_service

encryption = get_encryption_service()

# Encrypt before saving
encrypted = encryption.encrypt("access_token_value")

# Decrypt before using
decrypted = encryption.decrypt(encrypted)
```

### Get Active Connection

```python
from app.models.oauth_connection import OAuthConnection, ConnectionStatus

connection = db.query(OAuthConnection).filter(
    OAuthConnection.organization_id == org_id,
    OAuthConnection.provider == "google",
    OAuthConnection.status == ConnectionStatus.ACTIVE
).first()
```

### Use Data Connector

```python
from app.services.connectors import GoogleDriveConnector
from app.services.encryption import get_encryption_service

# Get and decrypt token
encryption = get_encryption_service()
access_token = encryption.decrypt(connection.access_token)

# Initialize connector
connector = GoogleDriveConnector(access_token)

# List files
files = await connector.list_files(recursive=True, max_results=100)

# Get file content
document = await connector.get_file_content(file_id)
```

### Sync All Files

```python
async for document in connector.sync_all(batch_size=10):
    # Process document
    print(f"Synced: {document.name}")
    print(f"Content: {document.content[:100]}...")

# Check status
status = connector.get_sync_status()
print(f"Progress: {status.processed_files}/{status.total_files}")
```

---

## 🔄 OAuth Flow Sequence

```
1. User clicks "Connect Google Drive"
   └─> GET /api/oauth/google/authorize

2. Backend generates state and authorization URL
   └─> Returns: { authorization_url, state }

3. Frontend redirects user to authorization_url
   └─> User grants permissions on Google

4. Google redirects back to callback
   └─> GET /api/oauth/google/callback?code=xxx&state=xxx

5. Backend validates state and exchanges code
   └─> Encrypts tokens, saves to database

6. User's connection is now active
   └─> Can sync files via connectors
```

---

## 📋 API Endpoints Cheatsheet

```bash
# Get authorization URL
GET /api/oauth/{provider}/authorize
# Returns: { authorization_url, state, provider }

# List connections
GET /api/oauth/connections?provider=google&status=active
# Returns: { connections: [...], total: N }

# Disconnect
DELETE /api/oauth/{provider}/disconnect?connection_id=xxx
# Returns: { success: true, message: "..." }

# Refresh token
POST /api/oauth/{provider}/refresh?connection_id=xxx
# Returns: { success: true, expires_at: "..." }
```

---

## 🛠️ Provider-Specific Notes

### Google Drive

**Scopes:**
- `drive.readonly` - Read files
- `drive.metadata.readonly` - Read file metadata
- `userinfo.email` - User email
- `userinfo.profile` - User profile

**Special Features:**
- Export Google Docs to plain text
- Export Sheets to CSV
- Webhook support for real-time updates

**Example:**
```python
# Setup webhook
webhook = await connector.setup_webhook(
    webhook_url="https://api.innosynth.ai/webhooks/google",
    channel_id="unique-channel-id"
)
```

### Microsoft SharePoint

**Scopes:**
- `Sites.Read.All` - Read all sites
- `Files.Read.All` - Read all files
- `User.Read` - User profile
- `offline_access` - Refresh token

**Special Features:**
- List multiple sites
- Delta sync for efficient updates
- Document library traversal

**Example:**
```python
# Get delta changes
changes = await connector.get_delta_changes(
    drive_id="xxx",
    delta_token=previous_token  # or None for initial sync
)
# Store: changes['delta_token'] for next sync
```

### Slack

**Scopes:**
- `channels:history` - Public channel messages
- `groups:history` - Private channel messages
- `im:history` - Direct messages
- `users:read.email` - User emails

**Special Features:**
- Thread message support
- User information retrieval
- Events API subscription

**Example:**
```python
# Get conversation with threads
document = await connector.get_file_content(channel_id)
# Content includes threaded replies
```

---

## 🔍 Debugging

### Check if token is encrypted

```python
from app.models.oauth_connection import OAuthConnection

conn = db.query(OAuthConnection).first()
print(conn.access_token)  # Should look like: gAAAAA...
# If it's a normal token string, encryption failed!
```

### Test encryption service

```python
from app.services.encryption import get_encryption_service

service = get_encryption_service()
test = "test-token-12345"
encrypted = service.encrypt(test)
decrypted = service.decrypt(encrypted)

assert test == decrypted, "Encryption/decryption failed!"
print("✅ Encryption working correctly")
```

### Test connector connection

```python
connector = GoogleDriveConnector(access_token)
is_valid = await connector.test_connection()

if is_valid:
    print("✅ Connection valid")
else:
    print("❌ Connection failed - check token")
```

### Check sync status

```python
status = connector.get_sync_status()
print(f"Status: {status.status}")
print(f"Progress: {status.processed_files}/{status.total_files}")
print(f"Failed: {status.failed_files}")
if status.error_message:
    print(f"Error: {status.error_message}")
```

---

## ⚠️ Common Issues

### Issue: "Invalid state parameter"
**Cause:** Session not persisted between requests
**Fix:** Use Redis for session storage in production

### Issue: Token refresh fails
**Cause:** No refresh token available
**Fix:** Ensure OAuth app requests `offline_access` scope

### Issue: Rate limit errors
**Cause:** Too many API requests
**Fix:** Connectors handle this automatically with exponential backoff

### Issue: Encryption key error
**Cause:** `ENCRYPTION_KEY` not set in environment
**Fix:** Generate and add to `.env`:
```bash
python -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())'
```

---

## 🎯 Production Deployment

### Before Deploy Checklist

- [ ] Change `API_BASE_URL` to production HTTPS URL
- [ ] Update OAuth redirect URIs in provider consoles
- [ ] Store `ENCRYPTION_KEY` in secure secret manager
- [ ] Use Redis for session storage
- [ ] Enable HTTPS enforcement
- [ ] Set up monitoring and alerts
- [ ] Add authentication middleware
- [ ] Configure rate limiting
- [ ] Test token refresh flows
- [ ] Document OAuth scopes for users

### Environment Variables (Production)

```bash
API_BASE_URL=https://api.innosynth.ai
ENCRYPTION_KEY=<from-secret-manager>
GOOGLE_CLIENT_ID=<production-client-id>
GOOGLE_CLIENT_SECRET=<from-secret-manager>
MICROSOFT_CLIENT_ID=<production-client-id>
MICROSOFT_CLIENT_SECRET=<from-secret-manager>
SLACK_CLIENT_ID=<production-client-id>
SLACK_CLIENT_SECRET=<from-secret-manager>
```

---

## 📚 Additional Resources

- **Full Setup Guide:** `OAUTH_INTEGRATION_README.md`
- **Implementation Summary:** `OAUTH_IMPLEMENTATION_SUMMARY.md`
- **API Documentation:** http://localhost:8000/docs (when server running)
- **Database Migration:** `migrations/001_create_oauth_connections.sql`

---

## 💡 Tips

1. **Always decrypt tokens just before use** - Don't store decrypted tokens
2. **Use batch processing** - Set appropriate batch sizes for large syncs
3. **Check connection status** - Before syncing, verify status is "active"
4. **Handle token expiration** - Automatically refresh before API calls
5. **Log errors clearly** - Include provider and connection_id in logs

---

**Last Updated:** December 2, 2024
