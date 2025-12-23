# InnoSynth.ai Monitoring - Cheat Sheet

## Quick Commands

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f backend
docker-compose logs -f prometheus
docker-compose logs -f grafana

# Stop all services
docker-compose down

# Restart monitoring stack
docker-compose restart prometheus grafana

# Check service status
docker-compose ps

# Install dependencies
pip install prometheus-client==0.18.0
```

---

## URLs & Credentials

| Service | URL | Credentials |
|---------|-----|-------------|
| Backend API | http://localhost:8000 | - |
| Metrics Endpoint | http://localhost:8000/metrics | - |
| Health Check | http://localhost:8000/api/internal/health | - |
| Prometheus | http://localhost:9090 | - |
| Grafana | http://localhost:3001 | admin/admin |

---

## Common Curl Commands

```bash
# Simple health check
curl http://localhost:8000/health

# Detailed health check
curl http://localhost:8000/api/internal/health | jq

# Service-specific health
curl http://localhost:8000/api/internal/health/database | jq

# Get metrics
curl http://localhost:8000/metrics

# Kubernetes readiness
curl http://localhost:8000/api/internal/ready | jq

# Kubernetes liveness
curl http://localhost:8000/api/internal/live | jq
```

---

## Code Snippets

### Setup in main.py
```python
from fastapi import FastAPI
from app.core.logging import setup_logging
from app.middleware.request_id import RequestIDMiddleware
from app.middleware.metrics import MetricsMiddleware
from app.middleware.error_handler import ErrorHandlerMiddleware
from app.routers import metrics

setup_logging(log_level="INFO")
app = FastAPI()

# Order matters!
app.add_middleware(ErrorHandlerMiddleware, debug=False)
app.add_middleware(MetricsMiddleware)
app.add_middleware(RequestIDMiddleware)

app.include_router(metrics.router)
```

### Use Logger
```python
from app.core.logging import get_logger

logger = get_logger(__name__)
logger.info("Message", extra_fields={"key": "value"})
```

### Record Metrics
```python
from app.core.metrics import record_query

record_query(
    query_type="search",
    status="success",
    duration=1.5
)
```

### Raise Exception
```python
from app.core.exceptions import NotFoundError

raise NotFoundError(resource="User", identifier="123")
```

### Get Request ID
```python
from app.middleware.request_id import get_request_id

request_id = get_request_id(request)
```

---

## Prometheus Queries

```promql
# Request rate
rate(http_requests_total[5m])

# Error rate %
sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m])) * 100

# P95 latency
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# P99 latency
histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))

# Active users
active_users_total

# Query count
sum(increase(query_total[5m]))

# LLM requests
sum(rate(llm_requests_total[5m])) by (provider, model)

# Token usage
sum(increase(llm_tokens_total[1h]))

# Health status
health_check_status

# Error count
sum(increase(errors_total[5m])) by (error_type)
```

---

## Exception Types

```python
NotFoundError(404)           # Resource not found
ValidationError(422)         # Invalid input
AuthenticationError(401)     # Auth failed
AuthorizationError(403)      # No permission
RateLimitError(429)          # Too many requests
ExternalServiceError(502)    # External API failed
DatabaseError(500)           # DB operation failed
ConflictError(409)           # Resource conflict
ServiceUnavailableError(503) # Service down
BusinessLogicError(400)      # Business rule violation
```

---

## Middleware Order

**CRITICAL**: Add middleware in this exact order:

1. `ErrorHandlerMiddleware` - Catches all exceptions
2. `MetricsMiddleware` - Records request metrics
3. `RequestIDMiddleware` - Adds request tracking

---

## Health Check Response

```json
{
  "status": "healthy",
  "timestamp": "2025-01-01T00:00:00Z",
  "checks": {
    "database": {"status": "healthy", "latency_ms": 5},
    "redis": {"status": "healthy", "latency_ms": 2},
    "neo4j": {"status": "healthy", "latency_ms": 10},
    "pinecone": {"status": "healthy", "latency_ms": 50},
    "openai": {"status": "healthy", "latency_ms": 100}
  }
}
```

---

## Error Response Format

```json
{
  "error": {
    "message": "Resource not found",
    "code": "NOT_FOUND",
    "status": 404,
    "request_id": "uuid-here",
    "details": {
      "resource": "User",
      "identifier": "123"
    }
  }
}
```

---

## Log Format

```json
{
  "timestamp": "2025-01-01T00:00:00Z",
  "level": "INFO",
  "logger": "app.api.search",
  "message": "Search completed",
  "request_id": "uuid-here",
  "user_id": "user-123",
  "module": "search",
  "function": "execute_search",
  "line": 42,
  "duration": 1.5,
  "results": 10
}
```

---

## Key Metrics by Category

**HTTP**:
- `http_requests_total`
- `http_request_duration_seconds`

**Queries**:
- `query_total`
- `query_duration_seconds`

**Errors**:
- `errors_total`
- `exceptions_total`

**AI/LLM**:
- `llm_requests_total`
- `llm_tokens_total`
- `llm_request_duration_seconds`

**Business**:
- `knowledge_graphs_total`
- `documents_processed_total`
- `synthesis_operations_total`

**Health**:
- `health_check_status`

---

## Alert Severities

- **critical** 🔴 - Immediate action (service down, >5% errors)
- **warning** 🟡 - Monitor closely (slow queries, elevated errors)
- **info** 🔵 - Informational (deployments, config changes)

---

## Grafana Panels

1. Request Rate - Requests/sec by endpoint
2. Latency Percentiles - P50/P95/P99
3. Error Rate - 4xx/5xx percentages
4. Active Users - Current active users
5. Query Performance - Query latency
6. Database Connections - Pool usage
7. LLM Request Rate - AI API usage
8. LLM Token Usage - Token consumption

---

## Default Alert Rules

- High error rate (>5%, 5min, critical)
- Elevated error rate (>2%, 10min, warning)
- High P95 latency (>5s, 5min, warning)
- Critical P99 latency (>10s, 5min, critical)
- Slow queries (>30s, 10min, warning)
- High DB connections (>80, 5min, warning)
- Service unhealthy (3 failures, 3min, critical)
- High rate limits (>10%, 5min, warning)

---

## Directory Structure

```
backend/
├── app/
│   ├── core/
│   │   ├── logging.py
│   │   ├── metrics.py
│   │   └── exceptions.py
│   ├── middleware/
│   │   ├── request_id.py
│   │   ├── metrics.py
│   │   └── error_handler.py
│   ├── services/
│   │   └── monitoring/
│   │       ├── __init__.py
│   │       ├── health_check.py
│   │       └── alerting.py
│   └── routers/
│       └── metrics.py
├── docker/
│   ├── prometheus/
│   │   ├── prometheus.yml
│   │   └── rules/
│   │       └── alerts.yml
│   └── grafana/
│       ├── provisioning/
│       │   ├── datasources/
│       │   │   └── default.yml
│       │   └── dashboards/
│       │       └── default.yml
│       └── dashboards/
│           └── innosynth.json
└── docs/
    ├── MONITORING_README.md
    ├── MONITORING_QUICKSTART.md
    ├── MONITORING_IMPLEMENTATION_SUMMARY.md
    └── MONITORING_CHEATSHEET.md (this file)
```

---

## Troubleshooting One-Liners

```bash
# Check if backend is healthy
curl -sf http://localhost:8000/health || echo "Backend is down!"

# Count total requests
curl -s http://localhost:8000/metrics | grep -c "http_requests_total"

# Check Prometheus targets
curl -s http://localhost:9090/api/v1/targets | jq '.data.activeTargets[].health'

# Restart just monitoring
docker-compose restart prometheus grafana

# View last 100 backend logs
docker-compose logs --tail=100 backend

# Check disk space for metrics
docker system df -v | grep prometheus

# Test health endpoint
watch -n 1 'curl -s http://localhost:8000/api/internal/health | jq .status'
```

---

## Generate Test Data

```bash
# 100 requests with delay
for i in {1..100}; do curl -s http://localhost:8000/health > /dev/null; sleep 0.1; done

# Continuous load
while true; do curl -s http://localhost:8000/health; sleep 1; done

# Parallel requests
seq 100 | xargs -P10 -I{} curl -s http://localhost:8000/health

# Load test with Apache Bench
ab -n 1000 -c 10 http://localhost:8000/health
```

---

## Production Checklist

- [ ] Change Grafana admin password
- [ ] Configure Slack webhook for alerts
- [ ] Set appropriate metric retention
- [ ] Enable HTTPS for Grafana
- [ ] Configure log aggregation
- [ ] Set up backups for dashboards
- [ ] Test alert delivery
- [ ] Document custom metrics
- [ ] Review alert thresholds
- [ ] Set up monitoring for monitoring

---

**Last Updated**: December 2025
**Version**: 1.0.0
