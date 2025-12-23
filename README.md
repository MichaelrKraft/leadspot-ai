# InnoSynth.ai - Enterprise Knowledge Synthesis Platform

InnoSynth.ai is a B2B SaaS platform that transforms enterprise knowledge into actionable insights through advanced AI-powered synthesis, graph-based knowledge management, and intelligent querying.

## 🚀 Features

- **AI-Powered Knowledge Synthesis**: Upload documents and get intelligent insights across your entire knowledge base
- **Graph-Based Knowledge Management**: Understand relationships between concepts using Neo4j
- **Semantic Search**: Find relevant information using vector embeddings and hybrid search
- **Multi-Model AI**: Leverage GPT-4 and Claude for optimal results
- **Organization Management**: Multi-tenant architecture with role-based access control
- **Real-time Processing**: Instant document processing and query results

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Docker Desktop** (v20.10 or higher) - [Download](https://www.docker.com/products/docker-desktop)
- **Docker Compose** (v2.0 or higher) - Included with Docker Desktop
- **Make** (optional, but recommended) - Usually pre-installed on macOS/Linux
- **Git** - For version control

### API Keys Required

You'll need API keys from:
- **OpenAI** - For GPT models and embeddings ([Get API Key](https://platform.openai.com/api-keys))
- **Anthropic** - For Claude models ([Get API Key](https://console.anthropic.com/))

## 🏁 Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/innosynth-ai.git
cd innosynth-ai
```

### 2. Initial Setup

```bash
make setup
```

This will:
- Copy `.env.example` to `.env`
- Create necessary directories
- Prepare your environment

### 3. Configure Environment Variables

Edit the `.env` file and add your API keys:

```bash
# Required: Add your API keys
OPENAI_API_KEY=sk-your-openai-api-key-here
ANTHROPIC_API_KEY=sk-ant-your-anthropic-api-key-here

# Optional: Generate a secure JWT secret
JWT_SECRET=$(openssl rand -hex 32)
```

### 4. Start Development Environment

```bash
make dev
```

This will:
- Build all Docker containers
- Start PostgreSQL, Neo4j, Redis, Backend, and Frontend
- Enable hot reload for development

### 5. Access the Application

Once all services are healthy:

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs
- **Neo4j Browser**: http://localhost:7474 (credentials: neo4j / innosynth_dev_password)

### 6. Demo Credentials

For local development, use these demo credentials:

- **Email**: admin@demo.innosynth.ai
- **Password**: demo123

⚠️ **Change these credentials in production!**

## 📚 Architecture Overview

### Technology Stack

**Frontend**
- Next.js 14 (React 18)
- TypeScript
- Tailwind CSS
- React Query for data fetching

**Backend**
- FastAPI (Python 3.11)
- PostgreSQL 15 (relational data)
- Neo4j 5 (graph database)
- Redis 7 (caching)

**AI Services**
- OpenAI GPT-4 (synthesis)
- OpenAI Embeddings (text-embedding-3-small)
- Anthropic Claude (alternative LLM)

### Database Schema

**PostgreSQL** stores:
- Organizations and users
- Documents metadata
- Query history
- Authentication data

**Neo4j** stores:
- Document relationships
- Concept graphs
- Entity connections
- Topic hierarchies

### Service Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Frontend  │────▶│   Backend   │────▶│  PostgreSQL │
│  (Next.js)  │     │  (FastAPI)  │     │             │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                           ├────────────▶┌─────────────┐
                           │             │    Neo4j    │
                           │             │             │
                           │             └─────────────┘
                           │
                           ├────────────▶┌─────────────┐
                           │             │    Redis    │
                           │             │             │
                           │             └─────────────┘
                           │
                           └────────────▶┌─────────────┐
                                         │  OpenAI API │
                                         │Anthropic API│
                                         └─────────────┘
```

## 🛠️ Development Commands

### Common Commands

```bash
# Start development environment (hot reload enabled)
make dev

# Start production environment
make up

# Stop all containers
make down

# Restart all containers
make restart

# View logs from all services
make logs

# View logs from specific service
make logs-backend
make logs-frontend
```

### Database Operations

```bash
# Run database migrations
make db-migrate

# Reset database (deletes all data)
make db-reset

# Open PostgreSQL shell
make db-shell

# Open Neo4j browser
make neo4j-shell

# Open Redis CLI
make redis-cli
```

### Testing

```bash
# Run all tests
make test

# Run backend tests only
make test-backend

# Run frontend tests only
make test-frontend
```

### Health Checks

```bash
# Check health of all services
make health
```

Expected output:
```
PostgreSQL: ✓ Ready
Neo4j:      ✓ Ready
Redis:      ✓ Ready
Backend:    ✓ Ready
Frontend:   ✓ Ready
```

### Cleanup

```bash
# Remove build artifacts
make clean-build

# Remove all containers and volumes (WARNING: deletes all data)
make clean
```

## 📖 API Documentation

### Interactive API Docs

Once the backend is running, visit:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

### Key Endpoints

**Authentication**
```bash
POST /api/auth/register - Register new organization
POST /api/auth/login    - Login user
POST /api/auth/refresh  - Refresh JWT token
```

**Documents**
```bash
POST   /api/documents        - Upload document
GET    /api/documents        - List documents
GET    /api/documents/{id}   - Get document details
DELETE /api/documents/{id}   - Delete document
```

**Queries**
```bash
POST /api/queries           - Submit knowledge query
GET  /api/queries           - List query history
GET  /api/queries/{id}      - Get query result
```

**Knowledge Graph**
```bash
GET /api/graph/concepts     - Get concept graph
GET /api/graph/relationships - Get relationship map
GET /api/graph/search       - Search knowledge graph
```

## 🚢 Deployment

### Production Deployment

1. **Environment Setup**
```bash
cp .env.example .env.production
# Edit .env.production with production values
```

2. **Build Production Containers**
```bash
docker-compose build --no-cache
```

3. **Start Production Services**
```bash
docker-compose -f docker-compose.yml up -d
```

### Security Checklist

Before deploying to production:

- [ ] Change all default passwords
- [ ] Generate secure JWT secret (`openssl rand -hex 32`)
- [ ] Set `ENVIRONMENT=production`
- [ ] Configure CORS origins properly
- [ ] Enable HTTPS/TLS
- [ ] Set up database backups
- [ ] Configure rate limiting
- [ ] Set up monitoring (Sentry, etc.)
- [ ] Review and restrict API access
- [ ] Enable security headers

### Scaling Recommendations

**For High Traffic**:
- Increase backend workers in Dockerfile
- Set up Redis clustering
- Use PostgreSQL connection pooling
- Deploy Neo4j cluster for HA

**For Large Knowledge Bases**:
- Increase Neo4j heap size
- Add read replicas for PostgreSQL
- Implement document chunking
- Use async processing queues

## 🐛 Troubleshooting

### Common Issues

**Services won't start**
```bash
# Check Docker is running
docker info

# Check logs for errors
make logs

# Reset and restart
make down
make up
```

**Database connection errors**
```bash
# Verify PostgreSQL is healthy
docker-compose exec postgres pg_isready -U innosynth

# Check database logs
make logs-postgres

# Reset database
make db-reset
```

**Neo4j browser not accessible**
```bash
# Wait 30 seconds for Neo4j to fully start
# Check Neo4j logs
make logs-neo4j

# Verify Neo4j is running
curl http://localhost:7474
```

**Backend API errors**
```bash
# Verify API keys are set
cat .env | grep API_KEY

# Check backend logs
make logs-backend

# Restart backend only
docker-compose restart backend
```

### Performance Issues

If experiencing slow responses:

1. Check Redis cache is working:
```bash
make redis-cli
# In Redis CLI: INFO stats
```

2. Monitor database queries:
```bash
make logs-backend
# Look for slow query warnings
```

3. Check resource usage:
```bash
docker stats
```

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Write tests for new features
- Follow existing code style
- Update documentation
- Ensure all tests pass before submitting PR

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- FastAPI for the excellent Python web framework
- Neo4j for graph database capabilities
- OpenAI and Anthropic for AI models
- The open-source community

## 📧 Support

For support, please:
- Open an issue on GitHub
- Email: support@innosynth.ai
- Documentation: https://docs.innosynth.ai

---

**Built with ❤️ for enterprise knowledge workers**
