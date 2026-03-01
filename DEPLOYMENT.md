# TruckConnect — Deployment Guide

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Environment Variables](#environment-variables)
3. [Local Development](#local-development)
4. [Docker](#docker)
5. [docker-compose (local full-stack)](#docker-compose)
6. [Database Migrations](#database-migrations)
7. [Production Considerations](#production-considerations)
8. [Horizontal Scaling](#horizontal-scaling)
9. [CI/CD](#cicd)
10. [Load Testing](#load-testing)
11. [Deployment Checklist](#deployment-checklist)

---

## Prerequisites

| Tool          | Version  | Purpose                          |
|---------------|----------|----------------------------------|
| Node.js       | ≥ 20     | Runtime                          |
| PostgreSQL    | ≥ 15     | Primary database                 |
| Docker        | ≥ 24     | Container builds and deploys     |
| docker-compose| ≥ 2.x    | Local full-stack environment     |
| k6 (optional) | any      | Load testing                     |

---

## Environment Variables

Copy `.env.example` to `.env.local` (development) or inject via your platform's secrets manager (production).

| Variable         | Required | Description                                               |
|------------------|----------|-----------------------------------------------------------|
| `DATABASE_URL`   | ✅        | PostgreSQL connection URL                                 |
| `NEXTAUTH_SECRET`| ✅        | Auth.js signing secret — min 10 chars (`openssl rand -base64 32`) |
| `NEXTAUTH_URL`   | ✅        | Base URL of the app (e.g. `https://truckconnect.example.com`) |
| `SOCKET_PORT`    | ✅        | Port for the combined HTTP + WebSocket server (usually `3000`) |

The application validates all variables at startup via `schemas/env.schema.ts` (Zod). It **crashes with a descriptive error** if any variable is missing — intentional fail-fast behaviour.

---

## Local Development

```bash
# 1. Clone and install
git clone <repo>
cd TruckNet
npm install

# 2. Set up environment
cp .env.example .env.local
# Edit .env.local with your local DB credentials

# 3. Apply migrations
npm run db:migrate

# 4a. Run full server (Next.js + Socket.io on same port)
npm run dev          # tsx watch server.ts → http://localhost:3000

# 4b. Run Next.js only (no real-time features)
npm run dev:next     # next dev → http://localhost:3000
```

---

## Docker

### Build the image

```bash
docker build -t truckconnect .
```

The Dockerfile uses a 3-stage build:
- **deps** — installs all npm dependencies
- **builder** — runs `next build`
- **runner** — minimal production image (non-root user, HEALTHCHECK included)

### Run the container

```bash
docker run -d \
  --name truckconnect \
  -p 3000:3000 \
  -e DATABASE_URL="postgresql://user:pass@host:5432/truckconnect" \
  -e NEXTAUTH_SECRET="your-secret" \
  -e NEXTAUTH_URL="http://localhost:3000" \
  -e SOCKET_PORT="3000" \
  truckconnect
```

### Verify health

```bash
curl http://localhost:3000/api/health
# → {"status":"ok","timestamp":"...","uptime_seconds":5,"memory_rss_mb":120}
```

---

## docker-compose

Boots the **app + PostgreSQL** locally, applies migrations automatically on container start.

```bash
# Start everything (first run pulls images + builds app)
docker compose up --build

# Background
docker compose up -d --build

# Tear down (keeps volumes)
docker compose down

# Destroy volumes (wipes DB data)
docker compose down -v
```

Services:
| Service    | Port | Description                          |
|------------|------|--------------------------------------|
| `app`      | 3000 | TruckConnect (Next.js + Socket.io)   |
| `postgres` | 5432 | PostgreSQL 16                        |

Uploaded audio files are persisted in a Docker volume (`uploads_data`).

---

## Database Migrations

Migrations live in `db/migrations/` and are managed by Drizzle Kit.

```bash
# Generate a new migration after schema changes
npm run db:generate

# Apply pending migrations
npm run db:migrate

# Push schema directly to DB (dev only — skips migration history)
npm run db:push

# Open Drizzle Studio (browser DB UI)
npm run db:studio
```

In production, migrations run automatically via `docker-entrypoint.sh` before the server starts.

---

## Production Considerations

### HTTPS / TLS

TruckConnect does **not** handle TLS internally. You must terminate TLS upstream:

- **Reverse proxy**: nginx or Caddy in front of the container
- **Platform TLS**: Railway, Render, Fly.io, AWS ALB, etc.

Socket.io clients must connect over `wss://` in production. Set `NEXTAUTH_URL` to your HTTPS URL.

### Session Security

```bash
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=$(openssl rand -base64 32)
```

### Persistent Uploads

Audio files are written to `public/uploads/`. In production:
- Mount a persistent volume at `/app/public/uploads`, **or**
- Migrate to object storage (S3-compatible, Cloudinary, etc.) by replacing `app/api/upload/audio/route.ts`

### Resource Limits

Recommended container minimums for ~500 concurrent drivers:
- CPU: 1 vCPU
- RAM: 512 MB

---

## Horizontal Scaling

Running multiple app replicas requires a shared Socket.io adapter so events are broadcast across all instances.

### 1. Add socket.io-redis adapter

```bash
npm install socket.io-redis @socket.io/redis-adapter ioredis
```

### 2. Update `sockets/index.ts`

```typescript
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "ioredis";

const pubClient = createClient({ url: process.env.REDIS_URL });
const subClient = pubClient.duplicate();

await Promise.all([pubClient.connect(), subClient.connect()]);
io.adapter(createAdapter(pubClient, subClient));
```

### 3. Add Redis to docker-compose

Uncomment the `redis` service block in `docker-compose.yml` and add `REDIS_URL` to the app environment.

### 4. Session affinity (optional)

If you don't use the Redis adapter, configure sticky sessions (IP hash) on your load balancer.

---

## CI/CD

### CI (`.github/workflows/ci.yml`)

Runs on every push and pull request to `main`/`develop`:

| Step         | Command               |
|--------------|-----------------------|
| Install      | `npm ci`              |
| Lint         | `npm run lint`        |
| Type-check   | `npm run type-check`  |
| Unit tests   | `npm test`            |
| Build        | `npm run build`       |

### Deploy (`.github/workflows/deploy.yml`)

Triggers on merge to `main`:
1. Builds and pushes a Docker image to GitHub Container Registry (`ghcr.io`)
2. Runs a deploy step (configured per target platform — see comments in the file)

**Required GitHub Actions Secrets** (Settings → Secrets and variables → Actions):

| Secret           | Value                                        |
|------------------|----------------------------------------------|
| `DATABASE_URL`   | Production DB URL                            |
| `NEXTAUTH_SECRET`| Production signing secret                    |
| `NEXTAUTH_URL`   | Production base URL                          |
| `SOCKET_PORT`    | Production port                              |

---

## Load Testing

Uses [k6](https://k6.io) to validate real-time performance under concurrent socket load.

### Install k6

```bash
# macOS
brew install k6

# Linux
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
  --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" \
  | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6

# Windows (winget)
winget install k6 --source winget
```

### Run the load test

```bash
# Default run (ramp to 1 000 concurrent VUs over 8 minutes)
k6 run load-tests/k6-script.js

# Custom target/duration
k6 run --vus 5000 --duration 2m load-tests/k6-script.js

# With a real auth token
k6 run --env AUTH_TOKEN=<jwt> --env BASE_URL=http://localhost:3000 load-tests/k6-script.js
```

### Interpreting results

| Metric                   | Target        | Meaning                                   |
|--------------------------|---------------|-------------------------------------------|
| `socket_event_rtt_ms p95`| < 500 ms      | 95% of events processed in under 500 ms  |
| `socket_connection_errors`| < 1%          | WebSocket handshake failure rate          |
| `http_req_duration p95`  | < 1 000 ms    | REST API tail latency                     |
| `socket_messages_sent`   | —             | Total location-update events emitted      |

A passing run looks like:
```
✓ socket_event_rtt_ms........: p(95)=210ms
✓ socket_connection_errors...: 0
```

---

## Deployment Checklist

Before going to production, verify each item:

- [ ] `DATABASE_URL` points to a production PostgreSQL instance with SSL
- [ ] `NEXTAUTH_SECRET` is a cryptographically random string (`openssl rand -base64 32`)
- [ ] `NEXTAUTH_URL` is set to the public HTTPS URL
- [ ] TLS is terminated at the load balancer / reverse proxy
- [ ] `docker build -t truckconnect .` completes without errors
- [ ] `docker run` starts the container and `GET /api/health` returns `{"status":"ok"}`
- [ ] `docker compose up` boots app + DB and migrations run automatically
- [ ] CI workflow (lint → type-check → test → build) passes on `main`
- [ ] GitHub Actions Secrets are configured for the deploy workflow
- [ ] Persistent volume is mounted for `public/uploads/` (or S3 replaced)
- [ ] Redis adapter enabled if running > 1 replica
- [ ] k6 load test produces `p95 < 500 ms` under expected concurrency
- [ ] Log aggregation (e.g. Datadog, Grafana Loki) connected to container stdout
