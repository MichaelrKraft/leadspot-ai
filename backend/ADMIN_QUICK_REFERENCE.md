# Admin Panel Quick Reference Guide

## Common Operations

### User Management

```python
# Create a new user
POST /api/admin/users
{
  "email": "user@company.com",
  "name": "John Doe",
  "password": "SecurePass123",
  "role": "user"
}

# List all users
GET /api/admin/users?skip=0&limit=100&role=admin&search=john

# Update user role
PATCH /api/admin/users/{user_id}
{
  "role": "admin"
}

# Reset password
POST /api/admin/users/{user_id}/reset-password
{
  "new_password": "NewSecurePass123"
}

# Deactivate user
DELETE /api/admin/users/{user_id}
```

### Organization Management

```python
# Get organization details
GET /api/admin/organization

# Update organization
PATCH /api/admin/organization
{
  "name": "Acme Corporation",
  "subscription_tier": "growth"
}

# Check subscription limits
GET /api/admin/organization/subscription
```

### Audit Logs

```python
# View recent audit logs
GET /api/admin/audit?skip=0&limit=50

# Filter by user
GET /api/admin/audit?user_id={uuid}

# Filter by action type
GET /api/admin/audit?action=user.*

# Export audit logs
GET /api/admin/audit/export?format=csv&start_date=2025-01-01
```

### Statistics

```python
# Get usage statistics
GET /api/admin/usage?days=30

# Get audit statistics
GET /api/admin/audit/statistics?days=30
```

### Permissions

```python
# List all roles and permissions
GET /api/admin/roles

# Get user permissions
GET /api/admin/users/{user_id}/permissions
```

---

## Permission Levels

### Admin
- Full system access
- User management
- Organization settings
- Audit log access
- All document and query operations

### User
- Document management (own documents)
- Query execution
- View organization info
- View own profile

### Viewer
- Read-only access
- View documents
- Execute queries
- No management capabilities

---

## Service Layer Usage

### In Your Code

```python
from app.services.admin import (
    UserAdminService,
    OrganizationAdminService,
    PermissionService,
    AuditService,
)

# User management
async with get_db() as db:
    user_service = UserAdminService(db)
    users, total = await user_service.list_users(
        organization_id=org_id,
        skip=0,
        limit=100
    )

# Audit logging
async with get_db() as db:
    audit_service = AuditService(db)
    await audit_service.log_action(
        organization_id=org_id,
        user_id=user_id,
        action="document.delete",
        resource_type="document",
        resource_id=doc_id,
        details={"filename": "report.pdf"}
    )
```

---

## Decorators

### Require Admin Access

```python
from app.core.permissions import require_admin

@router.delete("/sensitive-operation")
@require_admin
async def delete_something(
    current_user: dict = Depends(get_current_user)
):
    # Only admins can access this
    pass
```

### Require Specific Permission

```python
from app.core.permissions import require_permission, Permission

@router.post("/documents")
@require_permission(Permission.DOCUMENT_CREATE)
async def create_document(
    current_user: dict = Depends(get_current_user)
):
    # Only users with document:create permission
    pass
```

---

## Middleware Configuration

### Audit Paths

The audit middleware automatically logs requests to:
- `/api/admin/*` - All admin operations
- `/api/users/*` - User management
- `/api/auth/*` - Authentication
- `/api/documents/*` (DELETE only) - Document deletion

### Excluded Paths

These paths are NOT audited (too noisy):
- `/api/health`
- `/api/docs`
- `/api/openapi.json`
- `/metrics`

---

## Database Queries

### Find Admin Users

```sql
SELECT * FROM users WHERE role = 'admin';
```

### Recent Audit Logs

```sql
SELECT * FROM audit_logs
ORDER BY created_at DESC
LIMIT 50;
```

### Failed Actions

```sql
SELECT * FROM audit_logs
WHERE status IN ('failure', 'error')
ORDER BY created_at DESC;
```

### User Activity

```sql
SELECT user_id, COUNT(*) as action_count
FROM audit_logs
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY user_id
ORDER BY action_count DESC;
```

---

## Subscription Tier Changes

### Upgrade Organization

```python
from app.services.admin import OrganizationAdminService

async with get_db() as db:
    org_service = OrganizationAdminService(db)
    await org_service.upgrade_subscription(
        organization_id=org_id,
        new_tier="enterprise"
    )
```

### Check Usage Limits

```python
async with get_db() as db:
    org_service = OrganizationAdminService(db)
    is_within_limits, error = await org_service.check_usage_limits(
        organization_id=org_id,
        check_type="users"
    )
```

---

## Error Handling

### Common HTTP Status Codes

- `200 OK` - Success
- `201 Created` - Resource created
- `204 No Content` - Success, no response body
- `400 Bad Request` - Validation error
- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - Not authorized (wrong role)
- `404 Not Found` - Resource doesn't exist
- `500 Internal Server Error` - Server error

### Validation Errors

```json
{
  "detail": "Email already exists"
}
```

### Permission Errors

```json
{
  "detail": "Admin access required"
}
```

---

## Testing Commands

### Create Test Admin User

```bash
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@test.com",
    "name": "Admin User",
    "password": "AdminPass123",
    "organization_domain": "test.com"
  }'

# Then manually update role in database:
# UPDATE users SET role = 'admin' WHERE email = 'admin@test.com';
```

### Get Admin Token

```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@test.com",
    "password": "AdminPass123"
  }'
```

### Test Admin Endpoint

```bash
TOKEN="your_token_here"

curl -X GET http://localhost:8000/api/admin/users \
  -H "Authorization: Bearer $TOKEN"
```

---

## Monitoring

### Check Audit Log Growth

```sql
SELECT DATE(created_at) as day, COUNT(*) as log_count
FROM audit_logs
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY day DESC;
```

### Failed Authentication Attempts

```sql
SELECT ip_address, COUNT(*) as failed_attempts
FROM audit_logs
WHERE action = 'auth.login'
  AND status = 'failure'
  AND created_at >= NOW() - INTERVAL '1 hour'
GROUP BY ip_address
HAVING COUNT(*) > 5
ORDER BY failed_attempts DESC;
```

### Most Active Admins

```sql
SELECT u.email, COUNT(al.log_id) as actions
FROM audit_logs al
JOIN users u ON al.user_id = u.user_id
WHERE u.role = 'admin'
  AND al.created_at >= NOW() - INTERVAL '30 days'
GROUP BY u.email
ORDER BY actions DESC;
```

---

## Environment Variables

No additional environment variables required. Uses existing:
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - For token validation

---

## Frontend Integration

### Example React Hook

```typescript
// useAdmin.ts
import { useState } from 'react';

export function useAdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchUsers = async (filters = {}) => {
    setLoading(true);
    try {
      const params = new URLSearchParams(filters);
      const response = await fetch(
        `/api/admin/users?${params}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
      const data = await response.json();
      setUsers(data.users);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  return { users, loading, fetchUsers };
}
```

---

This quick reference covers the most common admin operations. For complete documentation, see `ADMIN_PANEL_IMPLEMENTATION.md`.
