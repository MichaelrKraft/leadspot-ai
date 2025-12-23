# InnoSynth.ai Monitoring - Quick Start Guide

## 5-Minute Setup

### 1. Install Dependencies (1 minute)

```bash
cd /Users/michaelkraft/innosynth-ai/backend
pip install prometheus-client==0.18.0
```

### 2. Update Your Main Application (2 minutes)

Copy the middleware setup from `app/main_example.py`:

```python
# In your main.py or app.py
from fastapi import FastAPI
from app.core.logging import setup_logging
from app.middleware.request_id import RequestIDMiddleware
from app.middleware.metrics import MetricsMiddleware
from app.middleware.error_handler import ErrorHandlerMiddleware
from app.routers import metrics

# Setup logging
setup_logging(log_level="INFO")

app = FastAPI(title="InnoSynth.ai")

# Add middleware (order matters!)
app.add_middleware(ErrorHandlerMiddleware, debug=False)
app.add_middleware(MetricsMiddleware)
app.add_middleware(RequestIDMiddleware)

# Include metrics endpoint
app.include_router(metrics.router, tags=["monitoring"])
```

### 3. Start Everything (2 minutes)

```bash
cd /Users/michaelkraft/innosynth-ai
docker-compose up -d
```

That's it! You're done.

---

## Verify Installation

### Check Backend is Running
```bash
curl http://localhost:8000/health
# Expected: {"status":"ok"}
```

### Check Metrics are Working
```bash
curl http://localhost:8000/metrics
# Expected: Prometheus metrics output
```

### Open Grafana Dashboard
```bash
open http://localhost:3001
# Login: admin/admin
# Navigate to: Dashboards → InnoSynth.ai Monitoring Dashboard
```

### Open Prometheus
```bash
open http://localhost:9090
# Try query: http_requests_total
```

---

## Generate Some Test Data

Run this to generate requests and see metrics populate:

```bash
# Generate 100 requests
for i in {1..100}; do
  curl -s http://localhost:8000/health > /dev/null
  echo "Request $i sent"
  sleep 0.1
done
```

Then refresh Grafana to see the data appear!

---

## Key URLs

| Service | URL | Purpose |
|---------|-----|---------|
| Backend | http://localhost:8000 | Main API |
| Health Check | http://localhost:8000/api/internal/health | Service health |
| Metrics | http://localhost:8000/metrics | Prometheus endpoint |
| Prometheus | http://localhost:9090 | Metrics database |
| Grafana | http://localhost:3001 | Dashboards |

---

## Using Custom Metrics in Your Code

### Record a Query
```python
from app.core.metrics import record_query
import time

start = time.time()
# ... do your query ...
duration = time.time() - start

record_query(
    query_type="search",
    status="success",
    duration=duration
)
```

### Raise a Custom Exception
```python
from app.core.exceptions import NotFoundError

raise NotFoundError(
    resource="Document",
    identifier="doc-123"
)
```

### Add Context to Logs
```python
from app.core.logging import get_logger

logger = get_logger(__name__)

logger.info(
    "User performed action",
    extra_fields={
        "user_id": "user-123",
        "action": "search",
        "query": "AI synthesis"
    }
)
```

---

## Useful Prometheus Queries

Try these in Prometheus (http://localhost:9090):

```promql
# Request rate
rate(http_requests_total[5m])

# Error percentage
sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m])) * 100

# P95 latency
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Active users
active_users_total
```

---

## Troubleshooting

### Metrics endpoint returns 404
- Check that you included the metrics router in your app
- Verify `app.include_router(metrics.router)` is present

### Grafana shows "No data"
- Wait 1-2 minutes for data to populate
- Generate some requests (see "Generate Test Data" above)
- Check Prometheus can reach backend: http://localhost:9090/targets
- Verify datasource in Grafana: Configuration → Data Sources

### Prometheus not scraping
- Check docker-compose is running: `docker-compose ps`
- Check backend is exposing metrics: `curl http://localhost:8000/metrics`
- Check Prometheus logs: `docker-compose logs prometheus`

### Can't access Grafana
- Check it's running: `docker-compose ps grafana`
- Check logs: `docker-compose logs grafana`
- Try: http://localhost:3001 (note: port 3001, not 3000)

---

## Next Steps

1. **Explore the Dashboard**:
   - View request rate trends
   - Monitor latency percentiles
   - Check error rates

2. **Set Up Alerts**:
   - Configure Slack webhook in `app/services/monitoring/alerting.py`
   - Test alert delivery

3. **Customize Metrics**:
   - Add business-specific metrics in your code
   - Update dashboard with new panels

4. **Production Config**:
   - Change Grafana admin password
   - Configure alert thresholds
   - Set up log aggregation

---

## Getting Help

- **Full Documentation**: See `MONITORING_README.md`
- **Implementation Details**: See `MONITORING_IMPLEMENTATION_SUMMARY.md`
- **Code Examples**: See `app/main_example.py`

---

## What's Included?

✅ Structured JSON logging with request tracing
✅ Prometheus metrics for HTTP, queries, AI/LLM operations
✅ Grafana dashboard with 8 pre-configured panels
✅ Health checks for 5 critical services
✅ Automated alerting with Slack integration
✅ Custom exception handling with structured errors
✅ Automatic request instrumentation
✅ Production-ready configuration

---

**You're all set!** Your monitoring infrastructure is ready for production use.
