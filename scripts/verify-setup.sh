#!/bin/bash
# InnoSynth.ai Setup Verification Script
# This script checks if all required files and configurations are in place

set -e

echo "🔍 InnoSynth.ai Setup Verification"
echo "==================================="
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
CHECKS_PASSED=0
CHECKS_FAILED=0
WARNINGS=0

# Function to check file exists
check_file() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}✓${NC} $2"
        ((CHECKS_PASSED++))
    else
        echo -e "${RED}✗${NC} $2 - Missing: $1"
        ((CHECKS_FAILED++))
    fi
}

# Function to check directory exists
check_dir() {
    if [ -d "$1" ]; then
        echo -e "${GREEN}✓${NC} $2"
        ((CHECKS_PASSED++))
    else
        echo -e "${RED}✗${NC} $2 - Missing: $1"
        ((CHECKS_FAILED++))
    fi
}

# Function to check command exists
check_command() {
    if command -v "$1" &> /dev/null; then
        echo -e "${GREEN}✓${NC} $2 installed"
        ((CHECKS_PASSED++))
    else
        echo -e "${RED}✗${NC} $2 not installed"
        ((CHECKS_FAILED++))
    fi
}

# Function to check environment variable
check_env_var() {
    if grep -q "^$1=" .env 2>/dev/null; then
        value=$(grep "^$1=" .env | cut -d '=' -f2)
        if [ -z "$value" ] || [[ "$value" == *"your-"* ]] || [[ "$value" == *"change-this"* ]]; then
            echo -e "${YELLOW}⚠${NC} $2 - Not configured (placeholder value)"
            ((WARNINGS++))
        else
            echo -e "${GREEN}✓${NC} $2 - Configured"
            ((CHECKS_PASSED++))
        fi
    else
        echo -e "${RED}✗${NC} $2 - Not found in .env"
        ((CHECKS_FAILED++))
    fi
}

echo "📦 Checking Prerequisites..."
echo "----------------------------"
check_command "docker" "Docker"
check_command "docker compose" "Docker Compose"
check_command "make" "Make"
echo ""

echo "📁 Checking Required Files..."
echo "------------------------------"
check_file "docker-compose.yml" "Docker Compose config"
check_file "docker-compose.dev.yml" "Docker Compose dev overrides"
check_file "backend/Dockerfile" "Backend Dockerfile"
check_file "frontend/Dockerfile" "Frontend Dockerfile"
check_file ".env.example" "Environment template"
check_file ".gitignore" "Git ignore file"
check_file "Makefile" "Makefile"
check_file "README.md" "README documentation"
echo ""

echo "🗄️  Checking Database Scripts..."
echo "----------------------------------"
check_file "scripts/init-db.sql" "PostgreSQL init script"
check_file "scripts/init-neo4j.cypher" "Neo4j init script"
echo ""

echo "📂 Checking Directory Structure..."
echo "-----------------------------------"
check_dir "backend" "Backend directory"
check_dir "backend/app" "Backend app directory"
check_dir "frontend" "Frontend directory"
check_dir "frontend/app" "Frontend app directory"
check_dir "scripts" "Scripts directory"
echo ""

echo "🔧 Checking Backend Configuration..."
echo "-------------------------------------"
check_file "backend/requirements.txt" "Python dependencies"
check_file "backend/app/__init__.py" "Backend app module"
echo ""

echo "🎨 Checking Frontend Configuration..."
echo "--------------------------------------"
check_file "frontend/package.json" "Node.js dependencies"
check_file "frontend/next.config.js" "Next.js configuration"
check_file "frontend/tsconfig.json" "TypeScript configuration"
check_file "frontend/tailwind.config.ts" "Tailwind CSS configuration"
echo ""

echo "🔐 Checking Environment Configuration..."
echo "-----------------------------------------"
if [ -f ".env" ]; then
    echo -e "${GREEN}✓${NC} .env file exists"
    ((CHECKS_PASSED++))
    echo ""
    echo "Checking required environment variables..."
    check_env_var "OPENAI_API_KEY" "OpenAI API Key"
    check_env_var "ANTHROPIC_API_KEY" "Anthropic API Key"
    check_env_var "JWT_SECRET" "JWT Secret"
    check_env_var "DATABASE_URL" "Database URL"
    check_env_var "NEO4J_URI" "Neo4j URI"
    check_env_var "REDIS_URL" "Redis URL"
else
    echo -e "${YELLOW}⚠${NC} .env file not found - Run 'make setup' to create it"
    ((WARNINGS++))
fi
echo ""

# Docker Compose validation
echo "🐳 Validating Docker Compose Configuration..."
echo "----------------------------------------------"
if command -v docker &> /dev/null; then
    if docker compose config --quiet 2>/dev/null; then
        echo -e "${GREEN}✓${NC} Docker Compose configuration is valid"
        ((CHECKS_PASSED++))
    else
        echo -e "${RED}✗${NC} Docker Compose configuration has errors"
        echo "Run 'docker compose config' to see details"
        ((CHECKS_FAILED++))
    fi
else
    echo -e "${YELLOW}⚠${NC} Docker not running - Cannot validate Docker Compose config"
    ((WARNINGS++))
fi
echo ""

# Summary
echo "📊 Verification Summary"
echo "======================="
echo -e "Checks Passed: ${GREEN}${CHECKS_PASSED}${NC}"
echo -e "Checks Failed: ${RED}${CHECKS_FAILED}${NC}"
echo -e "Warnings: ${YELLOW}${WARNINGS}${NC}"
echo ""

if [ $CHECKS_FAILED -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}🎉 All checks passed! Your setup is ready.${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Review and update .env with your API keys"
    echo "2. Run 'make dev' to start the development environment"
    echo "3. Access the application at http://localhost:3000"
    exit 0
elif [ $CHECKS_FAILED -eq 0 ]; then
    echo -e "${YELLOW}⚠️  Setup is mostly complete but has some warnings.${NC}"
    echo ""
    echo "Recommended actions:"
    echo "1. Configure environment variables in .env"
    echo "2. Add your OpenAI and Anthropic API keys"
    echo "3. Generate a secure JWT secret: openssl rand -hex 32"
    echo ""
    echo "Then run 'make dev' to start development"
    exit 0
else
    echo -e "${RED}❌ Setup verification failed with ${CHECKS_FAILED} error(s).${NC}"
    echo ""
    echo "Please address the failed checks above before proceeding."
    echo "Run './scripts/verify-setup.sh' again after fixing the issues."
    exit 1
fi
