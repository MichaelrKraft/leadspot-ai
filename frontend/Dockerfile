# Multi-stage build for production optimization
FROM node:20-alpine as base

WORKDIR /app

# Install dependencies only when needed
FROM base as dependencies

COPY package.json package-lock.json* ./
RUN npm ci

# Development stage
FROM base as development

COPY --from=dependencies /app/node_modules ./node_modules
COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]

# Build stage
FROM base as builder

COPY --from=dependencies /app/node_modules ./node_modules
COPY . .

# Build application
RUN npm run build

# Production stage
FROM base as production

ENV NODE_ENV=production

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Copy built application
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Set ownership
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "server.js"]
