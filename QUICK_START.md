# InnoSynth.ai - Quick Start Guide

## ⚡ 5-Minute Setup

### 1. Prerequisites Check

Make sure you have installed:
- ✅ Docker Desktop (running)
- ✅ Git

### 2. Setup Environment

```bash
# Copy environment template
cp .env.example .env

# Edit .env and add your API keys
nano .env  # or use your preferred editor
```

**Required API Keys:**
```bash
OPENAI_API_KEY=sk-proj-your-key-here
ANTHROPIC_API_KEY=sk-ant-your-key-here
JWT_SECRET=$(openssl rand -hex 32)  # Generate secure secret
```

### 3. Start Services

```bash
# One-command setup and start
make dev
```

This will:
- Build all Docker containers
- Start PostgreSQL, Neo4j, Redis
- Start Backend (FastAPI)
- Start Frontend (Next.js)
- Initialize databases with demo data

### 4. Access Application

Once all services are healthy (check logs):

| Service | URL | Credentials |
|---------|-----|-------------|
| **Frontend** | http://localhost:3000 | admin@demo.innosynth.ai / demo123 |
| **Backend API** | http://localhost:8000/docs | N/A (JWT required) |
| **Neo4j Browser** | http://localhost:7474 | neo4j / innosynth_dev_password |

### 5. Verify Everything Works

```bash
# Check service health
make health

# View logs
make logs
```

## 📋 Common Commands

```bash
# Development
make dev              # Start with hot reload
make down             # Stop all services
make restart          # Restart services
make logs             # View all logs
make logs-backend     # View backend logs only
make logs-frontend    # View frontend logs only

# Database
make db-shell         # PostgreSQL shell
make neo4j-shell      # Open Neo4j browser
make redis-cli        # Redis CLI

# Testing
make test             # Run all tests
make health           # Check service health

# Cleanup
make clean-build      # Remove build artifacts
make clean            # Remove everything (⚠️ deletes data)
```

## 🎯 What to Do Next

### 1. Explore the Frontend (http://localhost:3000)
- Login with demo credentials
- Upload a sample document (PDF, DOCX, TXT)
- Ask a knowledge synthesis query
- View the results and sources

### 2. Explore the API (http://localhost:8000/docs)
- Interactive Swagger documentation
- Test authentication endpoints
- Try document upload API
- Execute knowledge queries

### 3. Explore the Graph Database (http://localhost:7474)
- View document relationships
- Explore concept graphs
- Run Cypher queries

Example Cypher query:
```cypher
// View all nodes
MATCH (n) RETURN n LIMIT 25

// View demo organization
MATCH (o:Organization {slug: 'demo-org'}) RETURN o

// View documents and their relationships
MATCH (o:Organization)-[:OWNS]->(d:Document)
RETURN o, d
```

### 4. Test Document Upload

```bash
# Using curl
curl -X POST http://localhost:8000/api/documents \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "file=@sample.pdf"
```

### 5. Test Knowledge Query

```bash
# Using curl
curl -X POST http://localhost:8000/api/queries \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query_text": "What are the main concepts in my documents?",
    "query_type": "synthesis"
  }'
```

## 🐛 Troubleshooting

### Services Won't Start

```bash
# Check Docker is running
docker info

# View error logs
make logs

# Clean and restart
make down
make clean-build
make dev
```

### Database Connection Errors

```bash
# Verify PostgreSQL
docker compose exec postgres pg_isready -U innosynth

# Check logs
make logs-postgres

# Reset database (⚠️ deletes data)
make db-reset
```

### Backend API Not Responding

```bash
# Check if API keys are set
cat .env | grep API_KEY

# Restart backend
docker compose restart backend

# View backend logs
make logs-backend
```

### Frontend Not Loading

```bash
# Check backend is running
curl http://localhost:8000/health

# Restart frontend
docker compose restart frontend

# View frontend logs
make logs-frontend
```

### Neo4j Not Accessible

```bash
# Wait 30 seconds for Neo4j to fully start
sleep 30

# Check Neo4j status
curl http://localhost:7474

# View Neo4j logs
make logs-neo4j
```

## 🔐 Security Notes

**⚠️ For Development Only:**
- Demo credentials are hardcoded
- Database passwords are defaults
- JWT secret is weak

**Before Production:**
- Change all passwords
- Generate secure JWT secret
- Configure CORS properly
- Enable HTTPS/TLS
- Review security checklist in README.md

## 📚 Documentation

- **Full README**: [README.md](./README.md)
- **Docker Setup**: [DOCKER_SETUP_SUMMARY.md](./DOCKER_SETUP_SUMMARY.md)
- **API Docs**: http://localhost:8000/docs (when running)
- **Database Schema**: [database/SCHEMA_OVERVIEW.md](./database/SCHEMA_OVERVIEW.md)

## 💡 Tips

1. **Use make commands** - They handle complexity for you
2. **Check logs often** - `make logs` is your friend
3. **Health checks** - Run `make health` to verify everything
4. **Database shell** - Use `make db-shell` for direct SQL access
5. **Clean rebuilds** - If stuck, try `make clean-build && make dev`

## 🎉 You're Ready!

Your InnoSynth.ai development environment is running. Start building!

**Questions?** Check the full [README.md](./README.md) or open an issue.
