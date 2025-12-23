# InnoSynth.ai Monitoring Infrastructure

## Overview

This monitoring infrastructure provides comprehensive observability for InnoSynth.ai using:

- **Structured Logging**: JSON-formatted logs with request tracing
- **Prometheus Metrics**: Application and business metrics collection
- **Grafana Dashboards**: Visual monitoring and analysis
- **Health Checks**: Service dependency monitoring
- **Alert Manager**: Automated alerting for critical issues

## Components

### 1. Logging (`app/core/logging.py`)

**Features:**
- JSON-formatted structured logs
- Request ID tracking across services
- User context in logs
- Sensitive data masking (passwords, API keys, tokens)
- Configurable log levels

**Usage:**
```python
from app.core.logging import get_logger, set_request_context

logger = get_logger(__name__)

# In middleware or route handlers
set_request_context(request_id="uuid", user_id="user123")

logger.info("Processing request", extra_fields={"endpoint": "/api/search"})
```

### 2. Metrics (`app/core/metrics.py`)

**Metrics Collected:**

**HTTP Metrics:**
- `http_requests_total` - Total requests by method, endpoint, status
- `http_request_duration_seconds` - Request latency histogram
- `active_users_total` - Current active users
- `active_sessions_total` - Current active sessions

**Query Metrics:**
- `query_duration_seconds` - Query execution time
- `query_total` - Total queries by type and status

**Error Metrics:**
- `errors_total` - Errors by type and endpoint
- `exceptions_total` - Exceptions by type

**Database Metrics:**
- `db_connections_total` - Database connections
- `db_query_duration_seconds` - Database query latency

**Cache Metrics:**
- `cache_hits_total` - Cache hits by type
- `cache_misses_total` - Cache misses by type

**Business Metrics:**
- `knowledge_graphs_total` - Total knowledge graphs
- `documents_processed_total` - Documents processed
- `synthesis_operations_total` - Synthesis operations
- `synthesis_duration_seconds` - Synthesis duration

**AI/LLM Metrics:**
- `llm_requests_total` - LLM API requests by provider/model/status
- `llm_request_duration_seconds` - LLM request latency
- `llm_tokens_total` - Token usage by provider/model/type

**Vector/Graph DB Metrics:**
- `vector_operations_total` - Vector DB operations
- `graph_operations_total` - Graph DB operations
- Various duration and size metrics

**Usage:**
```python
from app.core.metrics import record_request, record_query

# Record HTTP request
record_request(method="GET", endpoint="/api/search", status=200, duration=0.5)

# Record query
record_query(query_type="search", status="success", duration=1.2)
```

### 3. Custom Exceptions (`app/core/exceptions.py`)

**Exception Classes:**
- `BaseAPIException` - Base exception with structured error responses
- `NotFoundError` - Resource not found (404)
- `ValidationError` - Data validation failed (422)
- `AuthenticationError` - Authentication failed (401)
- `AuthorizationError` - Permission denied (403)
- `RateLimitError` - Rate limit exceeded (429)
- `ExternalServiceError` - External service failure (502)
- `DatabaseError` - Database operation failed (500)
- `ConflictError` - Resource conflict (409)
- `ServiceUnavailableError` - Service unavailable (503)
- `BusinessLogicError` - Business rule violation (400)

**Usage:**
```python
from app.core.exceptions import NotFoundError, ValidationError

# Raise specific error
raise NotFoundError(resource="KnowledgeGraph", identifier="kg-123")

# With field errors
raise ValidationError(
    message="Invalid input",
    field_errors={"email": "Invalid email format"}
)
```

### 4. Middleware

**Request ID Middleware (`app/middleware/request_id.py`):**
- Generates unique request ID for each request
- Adds `X-Request-ID` header to responses
- Tracks requests across services

**Metrics Middleware (`app/middleware/metrics.py`):**
- Automatically collects request metrics
- Normalizes paths (replaces IDs with placeholders)
- Logs slow requests (>5s)
- Records errors

**Error Handler Middleware (`app/middleware/error_handler.py`):**
- Global exception handling
- Converts exceptions to JSON responses
- Hides internal details in production
- Logs errors with full context

### 5. Health Checks (`app/services/monitoring/health_check.py`)

**Services Monitored:**
- PostgreSQL database
- Redis cache
- Neo4j graph database
- Pinecone vector database
- OpenAI API

**Endpoints:**
- `GET /health` - Simple health check
- `GET /api/internal/health` - Detailed health check
- `GET /api/internal/health/{service}` - Service-specific check
- `GET /api/internal/ready` - Kubernetes readiness probe
- `GET /api/internal/live` - Kubernetes liveness probe

**Usage:**
```python
from app.services.monitoring import health_check_service

# Check all services
status = await health_check_service.check_all()

# Check specific service
redis_status = await health_check_service.check_service('redis')
```

### 6. Alert Manager (`app/services/monitoring/alerting.py`)

**Alert Rules:**
- High error rate (>5%)
- Elevated error rate (>2%)
- High P95 latency (>5s)
- Critical P99 latency (>10s)
- Slow queries (>30s)
- High database connections (>80)
- Service health failures
- High rate limit hits

**Integrations:**
- Slack webhook notifications
- Email alerts (configurable)
- Alert deduplication (5-minute window)

**Usage:**
```python
from app.services.monitoring import alert_manager

# Evaluate metrics against rules
metrics = {
    'error_rate': 0.06,
    'request_duration_p95': 7.5
}
alerts = await alert_manager.evaluate_rules(metrics)

# Add custom rule
from app.services.monitoring.alerting import AlertRule

rule = AlertRule(
    name='custom_metric_high',
    metric='custom_metric',
    threshold=100,
    comparison='gt',
    window_seconds=300,
    severity='warning'
)
alert_manager.add_rule(rule)
```

## Setup

### 1. Install Dependencies

Add to `requirements.txt`:
```
prometheus-client==0.18.0
```

Install:
```bash
pip install -r requirements.txt
```

### 2. Update FastAPI Application

In your main application file (e.g., `main.py`):

```python
from fastapi import FastAPI
from app.core.logging import setup_logging
from app.middleware.request_id import RequestIDMiddleware
from app.middleware.metrics import MetricsMiddleware
from app.middleware.error_handler import ErrorHandlerMiddleware
from app.routers import metrics

# Setup logging
setup_logging(log_level="INFO")

# Create FastAPI app
app = FastAPI(title="InnoSynth.ai")

# Add middleware (order matters!)
app.add_middleware(ErrorHandlerMiddleware, debug=False)
app.add_middleware(MetricsMiddleware)
app.add_middleware(RequestIDMiddleware)

# Include metrics router
app.include_router(metrics.router, tags=["monitoring"])
```

### 3. Start Services

```bash
# Start all services including Prometheus and Grafana
docker-compose up -d

# View logs
docker-compose logs -f backend
docker-compose logs -f prometheus
docker-compose logs -f grafana
```

### 4. Access Monitoring Tools

**Prometheus:**
- URL: http://localhost:9090
- Metrics endpoint: http://localhost:8000/metrics

**Grafana:**
- URL: http://localhost:3001
- Default credentials: admin/admin (change on first login)
- Pre-configured InnoSynth dashboard available

**Health Checks:**
- Simple: http://localhost:8000/health
- Detailed: http://localhost:8000/api/internal/health

## Grafana Dashboard

The pre-configured dashboard includes:

1. **Request Rate Panel** - Requests per second by endpoint
2. **Latency Percentiles Panel** - P50, P95, P99 latencies
3. **Error Rate Panel** - 4xx and 5xx error rates
4. **Active Users Panel** - Current active users gauge
5. **Query Performance Panel** - Query latency by type
6. **Database Connections Panel** - Connection pool usage
7. **LLM Request Rate Panel** - AI API usage
8. **LLM Token Usage Panel** - Token consumption

## Alert Configuration

### Slack Notifications

Set Slack webhook URL:

```python
from app.services.monitoring.alerting import AlertManager

alert_manager = AlertManager(
    slack_webhook_url="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
)
```

### Custom Alert Rules

Add custom rules in `alert_manager.py` or dynamically:

```python
from app.services.monitoring.alerting import AlertRule

custom_rule = AlertRule(
    name='high_token_usage',
    metric='llm_tokens_per_minute',
    threshold=100000,
    comparison='gt',
    window_seconds=300,
    severity='warning'
)

alert_manager.add_rule(custom_rule)
```

## Prometheus Queries

Useful queries for manual investigation:

```promql
# Request rate by endpoint
sum(rate(http_requests_total[5m])) by (endpoint)

# Error rate percentage
sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m])) * 100

# P95 latency
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Active users trend
active_users_total

# LLM cost estimation (tokens * cost per token)
sum(rate(llm_tokens_total{token_type="completion"}[1h])) * 0.002
```

## Production Considerations

### 1. Log Aggregation

For production, consider shipping logs to a centralized system:
- ELK Stack (Elasticsearch, Logstash, Kibana)
- Splunk
- DataDog
- CloudWatch Logs (AWS)

### 2. Metrics Retention

Configure Prometheus retention in `prometheus.yml`:
```yaml
storage:
  tsdb:
    retention.time: 30d
    retention.size: 50GB
```

### 3. Alert Routing

Set up Alertmanager for advanced routing:
```yaml
# alertmanager.yml
route:
  group_by: ['severity']
  receiver: 'slack-critical'
  routes:
    - match:
        severity: warning
      receiver: 'slack-warnings'
```

### 4. Security

- Change Grafana admin password
- Restrict Prometheus/Grafana access (reverse proxy + auth)
- Use HTTPS for all external connections
- Rotate API keys and secrets regularly

### 5. Performance

- Use metric labels sparingly (high cardinality issues)
- Sample traces for high-volume endpoints
- Configure appropriate scrape intervals
- Monitor monitoring system resource usage

## Troubleshooting

### Metrics Not Appearing

1. Check backend is exposing `/metrics` endpoint:
   ```bash
   curl http://localhost:8000/metrics
   ```

2. Check Prometheus can scrape backend:
   ```bash
   docker-compose logs prometheus
   ```

3. Verify Prometheus targets in UI: http://localhost:9090/targets

### Grafana Dashboard Not Loading

1. Check Grafana can reach Prometheus:
   - Go to Configuration → Data Sources
   - Test Prometheus connection

2. Verify dashboard provisioning:
   ```bash
   docker-compose exec grafana cat /etc/grafana/provisioning/dashboards/default.yml
   ```

### Alerts Not Firing

1. Check alert rules in Prometheus: http://localhost:9090/alerts

2. Verify alert manager configuration

3. Check logs:
   ```bash
   docker-compose logs backend | grep -i alert
   ```

## Best Practices

1. **Always use structured logging** with context fields
2. **Record custom metrics** for business-critical operations
3. **Set up alerts** for SLO violations
4. **Review dashboards regularly** for anomalies
5. **Test alert notifications** before production
6. **Document custom metrics** and their meaning
7. **Use request IDs** for distributed tracing
8. **Monitor monitoring systems** themselves
9. **Set appropriate retention** for metrics and logs
10. **Regularly review and update** alert thresholds

## Support

For issues or questions:
- Check logs: `docker-compose logs -f backend`
- Review Prometheus UI: http://localhost:9090
- Check Grafana dashboards: http://localhost:3001
- Inspect health endpoints: http://localhost:8000/api/internal/health
