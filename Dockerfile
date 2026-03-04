# ============================================================
# Stage 1 — deps
#   Install ALL dependencies (including devDeps for tsx + build tools).
#   Cached unless package-lock changes.
# ============================================================
FROM node:20-alpine AS deps
WORKDIR /app

# libc compatibility for some native addons
RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json ./
# Remove the Windows-only SWC binary from both manifests before install.
# @next/swc-win32-x64-msvc is a devDependency that only works on Windows;
# it causes EBADPLATFORM on Linux when the lock was generated on Windows.
RUN node -e " \
  const fs = require('fs'); \
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8')); \
  delete pkg.devDependencies['@next/swc-win32-x64-msvc']; \
  fs.writeFileSync('package.json', JSON.stringify(pkg)); \
  const lock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8')); \
  delete (lock.packages || {})['node_modules/@next/swc-win32-x64-msvc']; \
  delete (lock.dependencies || {})['@next/swc-win32-x64-msvc']; \
  fs.writeFileSync('package-lock.json', JSON.stringify(lock)); \
"
RUN npm ci

# ============================================================
# Stage 2 — builder
#   Build Next.js production bundle.
# ============================================================
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Validate env schema at build time via dummy values so `next build` succeeds.
# Real secrets are injected at runtime.
ENV DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder \
    NEXTAUTH_SECRET=build-time-placeholder-secret \
    NEXTAUTH_URL=http://localhost:3000 \
    SOCKET_PORT=3000 \
    NODE_ENV=production

RUN npm run build

# ============================================================
# Stage 3 — runner
#   Minimal production image.
#   Runs the custom server.ts via tsx (TypeScript is resolved at runtime).
# ============================================================
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

# Copy built assets
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.mjs ./
COPY --from=builder /app/package.json ./

# Copy source files needed by drizzle-kit migrate at runtime
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/schemas ./schemas
COPY --from=builder /app/sockets ./sockets
COPY --from=builder /app/db ./db
COPY --from=builder /app/auth.ts ./
COPY --from=builder /app/auth.config.ts ./
COPY --from=builder /app/middleware ./middleware
COPY --from=builder /app/tsconfig.json ./
COPY --from=builder /app/drizzle.config.ts ./

# Copy node_modules (includes tsx and all runtime deps)
COPY --from=deps /app/node_modules ./node_modules

# Copy entrypoint — applies migrations before server start
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Ensure uploads directory exists with correct ownership
RUN mkdir -p ./public/uploads && \
    chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

# Docker health check — waits 30s, then probes /api/health every 30s
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

# Entrypoint: run migrations then exec CMD
ENTRYPOINT ["docker-entrypoint.sh"]

# Env schema is validated by lib/env.ts on server startup (fail-fast)
CMD ["node_modules/.bin/next", "start"]
