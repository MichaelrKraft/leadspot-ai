.PHONY: help dev build up down restart logs clean test db-migrate db-reset db-shell health

# Default target
help:
	@echo "InnoSynth.ai Development Commands"
	@echo "=================================="
	@echo ""
	@echo "Setup & Installation:"
	@echo "  make setup          - Initial setup (copy .env.example, create volumes)"
	@echo "  make build          - Build all Docker containers"
	@echo ""
	@echo "Development:"
	@echo "  make dev            - Start development environment with hot reload"
	@echo "  make up             - Start production environment"
	@echo "  make down           - Stop all containers"
	@echo "  make restart        - Restart all containers"
	@echo ""
	@echo "Monitoring:"
	@echo "  make logs           - View logs from all containers"
	@echo "  make logs-backend   - View backend logs only"
	@echo "  make logs-frontend  - View frontend logs only"
	@echo "  make health         - Check health status of all services"
	@echo ""
	@echo "Database:"
	@echo "  make db-migrate     - Run database migrations"
	@echo "  make db-reset       - Reset database (WARNING: deletes all data)"
	@echo "  make db-shell       - Open PostgreSQL shell"
	@echo "  make neo4j-shell    - Open Neo4j browser"
	@echo "  make redis-cli      - Open Redis CLI"
	@echo ""
	@echo "Testing:"
	@echo "  make test           - Run all tests"
	@echo "  make test-backend   - Run backend tests"
	@echo "  make test-frontend  - Run frontend tests"
	@echo ""
	@echo "Code Quality:"
	@echo "  make lint           - Run linters (ruff + eslint)"
	@echo "  make lint-fix       - Auto-fix lint issues"
	@echo "  make format         - Format code (ruff + prettier)"
	@echo "  make format-check   - Check code formatting"
	@echo ""
	@echo "Cleanup:"
	@echo "  make clean          - Remove containers and volumes (WARNING: deletes data)"
	@echo "  make clean-build    - Remove build artifacts"

# Setup
setup:
	@echo "Setting up InnoSynth.ai development environment..."
	@if [ ! -f .env ]; then \
		cp .env.example .env; \
		echo "✓ Created .env file from .env.example"; \
		echo "⚠️  Please update .env with your API keys"; \
	else \
		echo "✓ .env file already exists"; \
	fi
	@mkdir -p uploads
	@echo "✓ Created uploads directory"
	@echo "✓ Setup complete! Run 'make dev' to start development environment"

# Build containers
build:
	@echo "Building Docker containers..."
	docker-compose build

# Development environment (with hot reload)
dev: setup
	@echo "Starting development environment..."
	docker-compose -f docker-compose.yml -f docker-compose.dev.yml up

# Production environment
up: setup
	@echo "Starting production environment..."
	docker-compose up -d
	@echo "✓ Services started!"
	@echo "  Frontend: http://localhost:3000"
	@echo "  Backend:  http://localhost:8000"
	@echo "  Neo4j:    http://localhost:7474"

# Stop all containers
down:
	@echo "Stopping all containers..."
	docker-compose down

# Restart all containers
restart:
	@echo "Restarting all containers..."
	docker-compose restart

# View logs
logs:
	docker-compose logs -f

logs-backend:
	docker-compose logs -f backend

logs-frontend:
	docker-compose logs -f frontend

logs-postgres:
	docker-compose logs -f postgres

logs-neo4j:
	docker-compose logs -f neo4j

# Health check
health:
	@echo "Checking service health..."
	@echo "\nPostgreSQL:"
	@docker-compose exec postgres pg_isready -U innosynth || echo "❌ PostgreSQL not ready"
	@echo "\nNeo4j:"
	@curl -s -o /dev/null -w "%{http_code}" http://localhost:7474 | grep -q "200" && echo "✓ Neo4j ready" || echo "❌ Neo4j not ready"
	@echo "\nRedis:"
	@docker-compose exec redis redis-cli ping || echo "❌ Redis not ready"
	@echo "\nBackend API:"
	@curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/health | grep -q "200" && echo "✓ Backend ready" || echo "❌ Backend not ready"
	@echo "\nFrontend:"
	@curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 | grep -q "200" && echo "✓ Frontend ready" || echo "❌ Frontend not ready"

# Database operations
db-migrate:
	@echo "Running database migrations..."
	docker-compose exec backend alembic upgrade head

db-reset:
	@echo "⚠️  WARNING: This will delete ALL data!"
	@read -p "Are you sure? (y/N): " confirm && [ "$$confirm" = "y" ] || exit 1
	@echo "Resetting database..."
	docker-compose down -v
	docker-compose up -d postgres
	@sleep 5
	@echo "✓ Database reset complete"

db-shell:
	@echo "Opening PostgreSQL shell..."
	docker-compose exec postgres psql -U innosynth -d innosynth

neo4j-shell:
	@echo "Opening Neo4j browser..."
	@echo "Navigate to: http://localhost:7474"
	@echo "Credentials: neo4j / innosynth_dev_password"

redis-cli:
	@echo "Opening Redis CLI..."
	docker-compose exec redis redis-cli

# Testing
test:
	@echo "Running all tests..."
	make test-backend
	make test-frontend

test-backend:
	@echo "Running backend tests..."
	docker-compose exec backend pytest tests/ -v

test-frontend:
	@echo "Running frontend tests..."
	docker-compose exec frontend npm test

# Cleanup
clean:
	@echo "⚠️  WARNING: This will delete ALL containers and volumes!"
	@read -p "Are you sure? (y/N): " confirm && [ "$$confirm" = "y" ] || exit 1
	@echo "Cleaning up..."
	docker-compose down -v
	rm -rf postgres-data neo4j-data neo4j-logs redis-data
	@echo "✓ Cleanup complete"

clean-build:
	@echo "Removing build artifacts..."
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name "*.egg-info" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name "node_modules" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".next" -exec rm -rf {} + 2>/dev/null || true
	@echo "✓ Build artifacts removed"

# Install dependencies
install-backend:
	@echo "Installing backend dependencies..."
	cd backend && pip install -r requirements.txt

install-frontend:
	@echo "Installing frontend dependencies..."
	cd frontend && npm install

# Format code
format:
	@echo "Formatting code..."
	cd backend && ruff format .
	cd frontend && npm run format

format-check:
	@echo "Checking code formatting..."
	cd backend && ruff format --check .
	cd frontend && npm run format:check

# Lint code
lint:
	@echo "Linting code..."
	cd backend && ruff check .
	cd frontend && npm run lint

lint-fix:
	@echo "Fixing lint issues..."
	cd backend && ruff check --fix .
	cd frontend && npm run lint -- --fix
