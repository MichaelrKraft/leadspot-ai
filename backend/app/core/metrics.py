"""
Prometheus metrics configuration for monitoring application performance.
"""

from prometheus_client import Counter, Gauge, Histogram, Info

# Application info
app_info = Info('innosynth_app', 'InnoSynth.ai application information')
app_info.info({
    'version': '1.0.0',
    'environment': 'production',
    'name': 'InnoSynth.ai'
})

# Request metrics
http_requests_total = Counter(
    'http_requests_total',
    'Total HTTP requests',
    ['method', 'endpoint', 'status']
)

http_request_duration_seconds = Histogram(
    'http_request_duration_seconds',
    'HTTP request duration in seconds',
    ['method', 'endpoint'],
    buckets=(0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0)
)

# Active users
active_users = Gauge(
    'active_users_total',
    'Number of currently active users'
)

active_sessions = Gauge(
    'active_sessions_total',
    'Number of active sessions'
)

# Query metrics
query_duration_seconds = Histogram(
    'query_duration_seconds',
    'Query execution duration in seconds',
    ['query_type', 'status'],
    buckets=(0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0, 60.0)
)

query_total = Counter(
    'query_total',
    'Total number of queries executed',
    ['query_type', 'status']
)

# Error metrics
errors_total = Counter(
    'errors_total',
    'Total number of errors',
    ['error_type', 'endpoint']
)

exceptions_total = Counter(
    'exceptions_total',
    'Total number of exceptions',
    ['exception_type']
)

# Database metrics
db_connections = Gauge(
    'db_connections_total',
    'Number of database connections',
    ['database']
)

db_query_duration_seconds = Histogram(
    'db_query_duration_seconds',
    'Database query duration in seconds',
    ['database', 'operation'],
    buckets=(0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0)
)

# Cache metrics
cache_hits_total = Counter(
    'cache_hits_total',
    'Total number of cache hits',
    ['cache_type']
)

cache_misses_total = Counter(
    'cache_misses_total',
    'Total number of cache misses',
    ['cache_type']
)

cache_size = Gauge(
    'cache_size_bytes',
    'Current cache size in bytes',
    ['cache_type']
)

# Business metrics
knowledge_graphs_total = Gauge(
    'knowledge_graphs_total',
    'Total number of knowledge graphs'
)

documents_processed_total = Counter(
    'documents_processed_total',
    'Total number of documents processed',
    ['status']
)

synthesis_operations_total = Counter(
    'synthesis_operations_total',
    'Total number of synthesis operations',
    ['operation_type', 'status']
)

synthesis_duration_seconds = Histogram(
    'synthesis_duration_seconds',
    'Synthesis operation duration in seconds',
    ['operation_type'],
    buckets=(1.0, 5.0, 10.0, 30.0, 60.0, 120.0, 300.0)
)

# AI/LLM metrics
llm_requests_total = Counter(
    'llm_requests_total',
    'Total number of LLM API requests',
    ['provider', 'model', 'status']
)

llm_request_duration_seconds = Histogram(
    'llm_request_duration_seconds',
    'LLM request duration in seconds',
    ['provider', 'model'],
    buckets=(0.5, 1.0, 2.5, 5.0, 10.0, 30.0, 60.0)
)

llm_tokens_total = Counter(
    'llm_tokens_total',
    'Total number of tokens used',
    ['provider', 'model', 'token_type']
)

# Vector database metrics
vector_operations_total = Counter(
    'vector_operations_total',
    'Total number of vector database operations',
    ['operation', 'status']
)

vector_operation_duration_seconds = Histogram(
    'vector_operation_duration_seconds',
    'Vector database operation duration in seconds',
    ['operation'],
    buckets=(0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0)
)

vector_index_size = Gauge(
    'vector_index_size_total',
    'Total number of vectors in index'
)

# Graph database metrics
graph_operations_total = Counter(
    'graph_operations_total',
    'Total number of graph database operations',
    ['operation', 'status']
)

graph_operation_duration_seconds = Histogram(
    'graph_operation_duration_seconds',
    'Graph database operation duration in seconds',
    ['operation'],
    buckets=(0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0)
)

graph_nodes_total = Gauge(
    'graph_nodes_total',
    'Total number of nodes in graph database',
    ['node_type']
)

graph_relationships_total = Gauge(
    'graph_relationships_total',
    'Total number of relationships in graph database',
    ['relationship_type']
)

# API rate limiting metrics
rate_limit_exceeded_total = Counter(
    'rate_limit_exceeded_total',
    'Total number of rate limit exceeded events',
    ['user_tier']
)

# Health check metrics
health_check_status = Gauge(
    'health_check_status',
    'Health check status (1 = healthy, 0 = unhealthy)',
    ['service']
)


def record_request(method: str, endpoint: str, status: int, duration: float) -> None:
    """
    Record HTTP request metrics.

    Args:
        method: HTTP method
        endpoint: Request endpoint
        status: Response status code
        duration: Request duration in seconds
    """
    http_requests_total.labels(method=method, endpoint=endpoint, status=status).inc()
    http_request_duration_seconds.labels(method=method, endpoint=endpoint).observe(duration)


def record_error(error_type: str, endpoint: str | None = None) -> None:
    """
    Record error metric.

    Args:
        error_type: Type of error
        endpoint: Endpoint where error occurred
    """
    errors_total.labels(error_type=error_type, endpoint=endpoint or 'unknown').inc()


def record_exception(exception_type: str) -> None:
    """
    Record exception metric.

    Args:
        exception_type: Type of exception
    """
    exceptions_total.labels(exception_type=exception_type).inc()


def record_query(query_type: str, status: str, duration: float) -> None:
    """
    Record query execution metrics.

    Args:
        query_type: Type of query (search, synthesis, etc.)
        status: Query status (success, error)
        duration: Query duration in seconds
    """
    query_total.labels(query_type=query_type, status=status).inc()
    query_duration_seconds.labels(query_type=query_type, status=status).observe(duration)
