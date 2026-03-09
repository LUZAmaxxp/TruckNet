# TruckNet — Deployment Guide

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Environment Variables](#environment-variables)
3. [Local Development](#local-development)
4. [docker-compose (full-stack)](#docker-compose)
5. [Workers](#workers)
6. [Camera Agent](#camera-agent)
7. [Database Migrations](#database-migrations)
8. [Production Considerations](#production-considerations)
9. [Horizontal Scaling](#horizontal-scaling)
10. [CI/CD](#cicd)
11. [Load Testing](#load-testing)
12. [Deployment Checklist](#deployment-checklist)

---

## Prerequisites

| Tool | Version | Purpose |
|---|---|---|
| Node.js | ≥ 20 | App + worker runtime |
| PostgreSQL | ≥ 15 | Primary database |
| Redis | ≥ 7 | BullMQ queues + route cache |
| Eclipse Mosquitto | ≥ 2 | MQTT broker for IoT + cam_agent |
| Docker | ≥ 24 | Container builds and deploys |
| docker-compose | ≥ 2.x | Local full-stack environment |
| Python | ≥ 3.10 | cam_agent inference process |
| k6 (optional) | any | Load testing |

---

## Environment Variables

Copy `.env.example` to `.env.local` (development) or inject via your platform's secrets manager (production).

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection URL (`postgresql://user:pass@host:5432/db`) |
| `NEXTAUTH_SECRET` | ✅ | Auth.js signing secret — min 10 chars (`openssl rand -base64 32`) |
| `NEXTAUTH_URL` | ✅ | Base URL of the app (e.g. `https://trucknet.example.com`) |
| `ABLY_API_KEY` | ✅ | Ably API key — get from the [Ably dashboard](https://ably.com) |
| `LIVEKIT_URL` | ✅ | LiveKit server URL (`wss://...` or `ws://livekit:7880` in Docker) |
| `LIVEKIT_API_KEY` | ✅ | LiveKit API key |
| `LIVEKIT_API_SECRET` | ✅ | LiveKit API secret |
| `KAFKA_BROKERS` | ✅ | Comma-separated broker addresses — `localhost:9092` locally, `kafka:29092` in Docker |
| `KAFKA_ENABLED` | ✅ | `true` to produce SOS to Kafka; `false` to skip (dev without broker) |
| `REDIS_URL` | ✅ | Redis URL for BullMQ + route cache (`redis://localhost:6379`) |
| `MQTT_URL` | ✅ | MQTT broker URL for workers (`mqtt://user:pass@localhost:1883`) |
| `MQTT_PASSWORD` | ✅ | Mosquitto broker password (also used in docker-compose health-check) |
| `CAM_AGENT_API_KEY` | ✅ | Bearer key for `POST /api/cam-agent/session` — cam_agent uses this to resolve driver UUIDs |
| `SMTP_HOST` | ⬜ | SMTP server for ESG report emails (optional) |
| `SMTP_PORT` | ⬜ | SMTP port (default `587`) |
| `SMTP_USER` | ⬜ | SMTP username |
| `SMTP_PASS` | ⬜ | SMTP password |
| `SMTP_FROM` | ⬜ | Sender address for ESG emails (default `noreply@trucknet.local`) |

All variables are validated at startup by `schemas/env.schema.ts` (Zod). The app **refuses to start** with a missing or invalid variable.

---

## Local Development

TruckNet requires several backing services (PostgreSQL, Redis, Kafka, Mosquitto). Two approaches:

### Option A — Docker for infra, Node.js for app (recommended for rapid iteration)

```bash
# 1. Start backing services only (no app container)
docker compose up -d postgres redis kafka mosquitto livekit

# 2. Install dependencies
npm install

# 3. Set up environment
cp .env.example .env.local
# fill in .env.local — ABLY_API_KEY, MQTT_PASSWORD etc.

# 4. Apply DB migrations
npm run db:migrate

# 5. Start the app  (behaviour workers auto-start via instrumentation.ts)
npm run dev
```

The app will be on **http://localhost:3000**.

### Option B — Full docker-compose (no local Node.js required)

```bash
docker compose up --build
```

All services start together. See [docker-compose section](#docker-compose) for the full service list.

---

## docker-compose

Boots all 13 services locally. Migrations run automatically on container start via `docker-entrypoint.sh`.

```bash
# Start everything (first run pulls images + builds app)
docker compose up --build

# Detached
docker compose up -d --build

# Tear down (keeps volumes)
docker compose down

# Destroy volumes (wipes all data)
docker compose down -v
```

### Services

| Service | Port(s) | Purpose |
|---|---|---|
| `postgres` | 5433 | PostgreSQL 16 — primary database |
| `redis` | 6379 | Redis 7 — BullMQ + route cache |
| `redisinsight` | 5540 | RedisInsight web UI |
| `livekit` | 7880 / 7881 / 7882 | LiveKit WebRTC SFU |
| `kafka` | 9092 (external) | Confluent Kafka (KRaft, no ZooKeeper) |
| `kafka-ui` | 8080 | Kafka monitoring dashboard |
| `mosquitto` | 1883 / 9001 (WS) | Eclipse Mosquitto MQTT broker |
| `app` | 3000 | Next.js application |
| `stress-worker` | — | Kafka SOS consumer → Ably fan-out |
| `sensor-worker` | — | MQTT ESP32 readings → DB + Ably alerts |
| `behaviour-event-worker` | — | MQTT cam_agent events → DB + Ably admin alert |
| `behaviour-report-worker` | — | BullMQ → trip behaviour score calculation |
| `esg-worker` | — | BullMQ → driver ESG report generation |

### Kafka dual-listener

| Listener | Address | Used by |
|---|---|---|
| `INTERNAL` | `kafka:29092` | `app`, all worker containers |
| `EXTERNAL` | `localhost:9092` | local `npm run dev`, Kafka UI, CLI tools |

```bash
# Verify Kafka topics
docker exec trucknet-kafka-1 kafka-topics --bootstrap-server localhost:9092 --list
# trucknet.stress-signals
# trucknet.stress-signals.dlq
```

### Mosquitto authentication

Mosquitto uses password-file auth. The password file lives at `docker/mosquitto/passwd`. The username (`trucknet`) and password must match the `MQTT_PASSWORD` env var passed to worker containers and to cam_agent's `config/config.yaml`.

### Uploaded files

Audio files are persisted in a Docker volume (`uploads_data` → `/app/public/uploads`).

---

## Workers

Workers are TypeScript processes that run outside the Next.js request cycle.

### Development (auto-start)

`instrumentation.ts` + `instrumentation.node.ts` automatically spawn two workers when `npm run dev` starts:
- `behaviour-event-consumer.ts` — MQTT cam_agent events
- `behaviour-report-worker.ts` — BullMQ behaviour reports

Both restart automatically on crash (3 s back-off). The remaining workers (`stress-signal-consumer`, `sensor-consumer`, `esg-report-scheduler`) must be started manually or via docker-compose in dev.

### Production (docker-compose)

All workers run as separate docker-compose services (`stress-worker`, `sensor-worker`, `behaviour-event-worker`, `behaviour-report-worker`, `esg-worker`). Each uses `Dockerfile.worker` (or `Dockerfile.esg-worker` for the ESG worker).

### Manual start (dev, without docker-compose)

```bash
npm run worker:stress           # SOS Kafka consumer
npm run worker:sensors          # IoT MQTT consumer
npm run worker:behaviour-events # cam_agent MQTT consumer
npm run worker:behaviour        # Behaviour report BullMQ worker
```

---

## Camera Agent

The cam_agent Python process runs on the driver's cab laptop and publishes behaviour events to Mosquitto over MQTT. It is **not** containerised — it connects to the same MQTT broker.

See [cam_agent/docs/SETUP.md](cam_agent/docs/SETUP.md) for full setup instructions.

**Quick steps:**
1. Edit `cam_agent/config/config.yaml` — set `driver_email` and `cam_agent_api_key`
2. `pip install -r cam_agent/requirements.txt`
3. `cd cam_agent && python inference/inference_agent.py --auto`

The MQTT broker address in `config.yaml` must match the host where Mosquitto is running (`localhost:1883` for local dev, or the server IP in production).

---

## Database Migrations

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

TruckNet does **not** handle TLS internally. Terminate TLS upstream:

- **Reverse proxy**: nginx or Caddy in front of the container
- **Platform TLS**: Railway, Render, Fly.io, AWS ALB, etc.

Set `NEXTAUTH_URL` to your HTTPS URL and ensure `LIVEKIT_URL` uses `wss://`.

### Session Security

```bash
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=$(openssl rand -base64 32)
```

### MQTT in Production

- Generate a strong `MQTT_PASSWORD`
- If Mosquitto is on a different host from the app/workers, expose port `1883` only to trusted internal IPs
- Never expose MQTT to the public internet without TLS (`mqtts://`)

### Redis in Production

- `REDIS_URL` is used by both BullMQ workers and the OSRM route cache
- Use a managed Redis service (Upstash, Redis Cloud, ElastiCache) or a dedicated container
- Set `--maxmemory` and `--maxmemory-policy allkeys-lru` (already configured in docker-compose)

### Persistent Uploads

Audio files are written to `public/uploads/`. In production:
- Mount a persistent volume at `/app/public/uploads`, **or**
- Migrate to object storage (S3-compatible, Cloudinary, etc.) by replacing `app/api/upload/audio/route.ts`

### Resource Limits

Recommended container minimums for ~500 concurrent drivers:

| Container | CPU | RAM |
|---|---|---|
| `app` | 1 vCPU | 512 MB |
| `stress-worker` | 0.25 vCPU | 128 MB |
| `sensor-worker` | 0.25 vCPU | 128 MB |
| `behaviour-event-worker` | 0.25 vCPU | 128 MB |
| `behaviour-report-worker` | 0.25 vCPU | 128 MB |
| `esg-worker` | 0.5 vCPU | 256 MB |

### Verify health

```bash
curl https://your-domain.com/api/health
# → {"status":"ok","timestamp":"...","uptime_seconds":5,"memory_rss_mb":120}
```

---

## Horizontal Scaling

TruckNet is designed for horizontal scaling:

- **Ably** handles all pub/sub — no sticky sessions or shared socket adapters needed. Multiple `app` replicas work out of the box.
- **BullMQ** uses Redis as the queue backend — any number of `behaviour-report-worker` or `esg-worker` instances can process jobs concurrently.
- **Rate limiter** — the in-memory `RateLimiter` (`lib/rate-limit.ts`) is per-process. Swap it for an Upstash Redis adapter at the same interface to share limits across replicas:

  ```bash
  npm install @upstash/ratelimit @upstash/redis
  ```

  Then replace the `RateLimiter` instantiation in API routes with `new Ratelimit(...)` from `@upstash/ratelimit`.

- **MQTT workers** — run exactly one `sensor-worker` and one `behaviour-event-worker` per broker (multiple consumers on the same topic partition is fine, but topic-per-driver routing means one consumer per broker is sufficient).

- **Kafka SOS worker** — scale with `--scale stress-worker=N`; Kafka partition assignment handles load distribution.

---

## CI/CD

### CI (`.github/workflows/ci.yml`)

Runs on every push and pull request to `main`/`develop`:

| Step | Command |
|---|---|
| Install | `npm ci` |
| Lint | `npm run lint` |
| Type-check | `npm run type-check` |
| Unit tests | `npm test` |
| Build | `npm run build` |

### Deploy (`.github/workflows/deploy.yml`)

Triggers on merge to `main`:
1. Builds and pushes Docker images to GitHub Container Registry (`ghcr.io`)
2. Runs a deploy step (configured per target platform — see comments in the file)

**Required GitHub Actions Secrets** (Settings → Secrets and variables → Actions):

| Secret | Value |
|---|---|
| `DATABASE_URL` | Production PostgreSQL URL |
| `NEXTAUTH_SECRET` | Production signing secret |
| `NEXTAUTH_URL` | Production base URL |
| `ABLY_API_KEY` | Production Ably key |
| `REDIS_URL` | Production Redis URL |
| `MQTT_URL` | Production MQTT URL |
| `MQTT_PASSWORD` | Mosquitto password |
| `CAM_AGENT_API_KEY` | cam_agent endpoint key |
| `LIVEKIT_URL` | Production LiveKit URL |
| `LIVEKIT_API_KEY` | LiveKit API key |
| `LIVEKIT_API_SECRET` | LiveKit API secret |
| `KAFKA_BROKERS` | Production broker addresses |

---

## Load Testing

Uses [k6](https://k6.io) to validate REST API performance under concurrent driver load.

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

| Metric | Target | Meaning |
|---|---|---|
| `http_req_duration p95` | < 1 000 ms | REST API tail latency |
| `http_req_failed` | < 1% | Request error rate |

---

## Deployment Checklist

Before going to production, verify each item:

- [ ] `DATABASE_URL` points to a production PostgreSQL instance with SSL
- [ ] `NEXTAUTH_SECRET` is a cryptographically random string (`openssl rand -base64 32`)
- [ ] `NEXTAUTH_URL` is set to the public HTTPS URL
- [ ] `ABLY_API_KEY` is a production Ably key (not a dev sandbox key)
- [ ] `REDIS_URL` points to a production Redis instance
- [ ] `MQTT_URL` and `MQTT_PASSWORD` are configured and Mosquitto is reachable
- [ ] `CAM_AGENT_API_KEY` is set and matches `cam_agent/config/config.yaml`
- [ ] `LIVEKIT_*` variables point to your production LiveKit server
- [ ] `KAFKA_BROKERS` and `KAFKA_ENABLED=true` are set
- [ ] TLS is terminated at the load balancer / reverse proxy
- [ ] `docker compose up --build` boots all 13 services without errors
- [ ] `GET /api/health` returns `{"status":"ok"}` after startup
- [ ] DB migrations ran successfully (`docker-entrypoint.sh` output shows no errors)
- [ ] CI workflow (lint → type-check → test → build) passes on `main`
- [ ] GitHub Actions Secrets are configured for the deploy workflow
- [ ] Persistent volume is mounted for `public/uploads/` (or object storage configured)
- [ ] Rate limiter uses Redis adapter if running > 1 app replica
- [ ] k6 load test passes under expected concurrency
- [ ] Log aggregation (e.g. Grafana Loki, Datadog) connected to container stdout
- [ ] cam_agent laptops configured with correct `mqtt_url` and `cam_agent_api_key`
