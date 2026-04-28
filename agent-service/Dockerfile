# Build stage — needs Python + make + g++ for better-sqlite3 native bindings
FROM node:20-alpine AS builder

RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./
RUN npm ci --include=dev

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

# Production stage
FROM node:20-alpine AS runner

RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

# Copy compiled output from builder
COPY --from=builder /app/dist ./dist

# Data directory for per-org SQLite databases
RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV AGENT_SERVICE_PORT=3008
ENV AGENT_DATA_DIR=/app/data

EXPOSE 3008

CMD ["node", "dist/server.js"]
