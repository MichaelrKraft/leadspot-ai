FROM node:20-alpine AS production
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ARG BACKEND_URL=http://localhost:8000
ARG AGENT_SERVICE_URL=http://localhost:3008
ENV BACKEND_URL=$BACKEND_URL
ENV AGENT_SERVICE_URL=$AGENT_SERVICE_URL

RUN npm run build

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0

CMD ["npm", "start"]
