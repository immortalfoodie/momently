# syntax=docker/dockerfile:1

# 1. Install dependencies from the lockfile only
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# 2. Build a standalone production bundle
FROM node:22-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 NEXT_OUTPUT=standalone
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# 3. Minimal runtime: only traced files, non-root user, no secrets baked in
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=8080 HOSTNAME=0.0.0.0
RUN addgroup -S momently && adduser -S momently -G momently
COPY --from=build --chown=momently:momently /app/.next/standalone ./
COPY --from=build --chown=momently:momently /app/.next/static ./.next/static
USER momently
EXPOSE 8080
CMD ["node", "server.js"]
