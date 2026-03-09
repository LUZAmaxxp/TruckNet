# TruckNet

A full-stack fleet management platform for truck drivers and fleet administrators.
Drivers share live GPS locations, make voice/video calls, send messages, and broadcast SOS alerts.
Admins monitor the entire fleet in real-time: IoT sensor readings, driver behaviour reports, ESG compliance, trip management, and SOS alerts — in a single Next.js application.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Tech Stack](#tech-stack)
3. [Architecture Overview](#architecture-overview)
4. [Directory Structure](#directory-structure)
5. [Database Schema](#database-schema)
6. [Authentication & Roles](#authentication--roles)
7. [Real-Time Layer (Ably)](#real-time-layer-ably)
8. [API Routes](#api-routes)
9. [Frontend Pages & Components](#frontend-pages--components)
10. [Hooks](#hooks)
11. [Lib Utilities](#lib-utilities)
12. [Schemas & Validation](#schemas--validation)
13. [Middleware (Edge)](#middleware-edge)
14. [Rate Limiting](#rate-limiting)
15. [Security Headers](#security-headers)
16. [Environment Variables](#environment-variables)
17. [Workers](#workers)
18. [Camera Agent (cam_agent)](#camera-agent-cam_agent)
19. [Testing](#testing)
20. [Docker & Deployment](#docker--deployment)
21. [Scripts Reference](#scripts-reference)

---

## Project Overview

TruckNet serves two distinct user roles:

### Drivers
- **Live map** — see nearby drivers in real-time via GPS sharing
- **Voice & video calls** — 1-on-1 WebRTC calls powered by LiveKit SFU
- **Voice messages** — record and send audio clips up to 60 seconds
- **Text messages** — direct text messaging with friends
- **SOS alerts** — emergency signal processed by a Kafka consumer and delivered as in-app toasts + browser push notifications to nearby drivers
- **Friend system** — send/accept/reject friend requests; view a friend's last known location
- **Trips** — start/end trips; trip history with route, duration, and behaviour report
- **ESG report** — per-driver environmental and safety score calculated by a background worker

### Administrators
- **Fleet live map** — all active drivers with GPS positions and IoT sensor status
- **SOS management** — real-time stream of active SOS alerts, resolve with one click
- **Calls log** — full history of all calls across the fleet
- **Driver profiles** — view routes, trip history, behaviour summary, maintenance logs
- **Behaviour reports** — per-trip drowsiness / distraction / speed scores calculated from cam_agent events
- **IoT sensors** — real-time sensor readings per device, threshold configuration, alert acknowledgement
- **ESG dashboard** — fleet-level environmental and safety KPIs

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router) | 14.2.x |
| Language | TypeScript | 5.x |
| Auth | Auth.js (NextAuth v5 beta) | 5.0.0-beta.25 |
| Database | PostgreSQL | ≥ 15 |
| ORM | Drizzle ORM | 0.30.x |
| DB Migrations | drizzle-kit | 0.21.x |
| Real-time | Ably (Pub/Sub) | 2.x |
| Voice/Video Calls | LiveKit Server SDK + Components | latest |
| Message Queue (SOS) | KafkaJS | 2.2.x |
| Kafka Broker | Confluent CP-Kafka (KRaft) | 7.4.0 |
| Background Jobs | BullMQ + Redis | 5.x |
| Cache | Redis | 7 |
| IoT / Behaviour MQTT | Eclipse Mosquitto + paho-mqtt | 2 |
| Styling | Tailwind CSS | 3.4.x |
| UI Primitives | Radix UI | various |
| Animations | Framer Motion | 12.x |
| Maps | Leaflet + react-leaflet | 1.9.x / 4.x |
| Icons | Lucide React | 0.390.x |
| Validation | Zod | 3.23.x |
| Password Hashing | bcryptjs | 2.4.x |
| Notifications | Sonner + Browser Notifications API | 2.x |
| Unit Tests | Vitest | 1.6.x |
| E2E Tests | Playwright | 1.44.x |
| Load Tests | k6 | any |
| Containerisation | Docker + docker-compose | — |
| Code Quality | ESLint + Prettier | 8.x / 3.x |

---

## Architecture Overview

```
Browser (Client)
    │
    ├── REST API calls ──► Next.js App Router API Routes ──► Drizzle ORM ──► PostgreSQL
    │                                  │
    │                                  ├── Ably REST (ablyPublish) ──► Ably Channels
    │                                  ├── BullMQ ──► Redis ──► behaviour-report-worker
    │                                  └── Kafka Producer ──► Kafka ──► stress-signal-consumer
    │
    └── Ably Realtime ◄── Ably Channels
          │
          ├── "user:<userId>"         — private per-user events
          ├── "stress:alerts"         — SOS broadcast to all drivers
          ├── "admin:behaviour"       — behaviour alerts to admin
          └── "trips:<tripId>"        — trip-scoped events (report ready, etc.)

ESP32 Devices ──► MQTT (Mosquitto) ──► sensor-consumer worker ──► DB + Ably

cam_agent (cab laptop)
    ├── YOLOv8-pose + RandomForest classifier
    ├── MQTT publish trucknet/drivers/{id}/behaviour
    └── behaviour-event-consumer worker ──► DB + Ably
```

**Key design decisions:**

- **No persistent WebSocket server** — Ably handles all pub/sub; the app deploys as a stateless Next.js process
- **Ably token auth** — clients fetch a signed `TokenRequest` from `GET /api/auth/ably-token`; the raw API key never reaches the browser
- **Kafka for SOS criticality** — SOS produce is fire-and-forget; a dedicated worker handles fan-out, retry, and DLQ
- **BullMQ for behaviour reports** — report generation (waiting 30 s for late cam_agent events + score calculation) is deferred to a background job so the trip-end API response is immediate
- **MQTT for IoT + behaviour** — two separate workers subscribe: `sensor-consumer` (ESP32 readings) and `behaviour-event-consumer` (cam_agent events)
- **Worker auto-start** — `instrumentation.ts` spawns behaviour workers automatically on `npm run dev`; docker-compose has dedicated worker services for production
- **Two Kafka listeners** — `INTERNAL://kafka:29092` for Docker-to-Docker; `EXTERNAL://localhost:9092` for local `npm run dev`
- **Edge-safe auth split** — `auth.config.ts` (Edge-safe) used in middleware; `auth.ts` (Node.js) adds Credentials with bcrypt
- **Fail-fast env validation** — all env vars parsed through Zod at startup

---

## Directory Structure

```
TruckNet/
├── app/                            # Next.js App Router
│   ├── globals.css
│   ├── layout.tsx                  # Root layout (Providers, Toaster, fonts)
│   ├── page.tsx                    # Landing / redirect page
│   ├── (auth)/
│   │   ├── login/
│   │   └── register/
│   ├── (protected)/                # Driver-facing pages
│   │   ├── layout.tsx              # Navbar + BottomNav + CallStateWrapper + SosAlertListener
│   │   ├── dashboard/
│   │   ├── calls/[roomName]/       # LiveKit voice/video call room
│   │   ├── friends/
│   │   ├── map/
│   │   ├── messages/
│   │   ├── profile/
│   │   ├── stress/
│   │   └── trips/                  # Trip list + start/end trip
│   ├── (admin)/admin/              # Admin-only pages (role-guarded)
│   │   ├── page.tsx                # Admin dashboard
│   │   ├── sos/                    # Real-time SOS alert stream
│   │   ├── calls/                  # Fleet-wide call history
│   │   ├── drivers/                # Driver profiles + route + behaviour
│   │   ├── sensors/                # IoT device readings + alerts
│   │   └── behaviour/              # Behaviour scoring config
│   └── api/
│       ├── auth/                   # Auth.js handlers + Ably token
│       ├── calls/                  # Initiate, token, history, decline, end
│       ├── cam-agent/session/      # Email → UUID resolution for cam_agent
│       ├── drivers/                # location, nearby, route, active-trip,
│       │                           # behaviour-summary, maintenance, fleet-esg-summary
│       ├── esg-report-schedules/   # Create / list ESG report schedules
│       ├── friends/                # list, request, accept, reject, location
│       ├── geocode/                # Reverse geocode proxy
│       ├── health/
│       ├── profile/                # Get / update profile, avatar upload
│       ├── stress-signals/         # SOS broadcast + resolve
│       ├── text-messages/
│       ├── trips/                  # Start / end trip
│       ├── upload/audio/
│       ├── users/                  # by-tag lookup, account management
│       ├── voice-messages/
│       └── admin/                  # Admin-only routes
│           ├── stats/
│           ├── drivers/
│           ├── sos/                # SSE stream + resolve
│           ├── calls/
│           ├── routes/active/
│           ├── sensors/            # Readings, thresholds, alert acknowledge
│           └── behaviour/          # Fleet overview + config
│
├── components/
│   ├── Providers.tsx
│   ├── calls/
│   ├── drivers/
│   ├── layout/
│   │   ├── BottomNav.tsx
│   │   ├── LiveConnectionBadge.tsx
│   │   └── Navbar.tsx
│   ├── map/
│   ├── messages/
│   ├── stress/
│   │   └── SosAlertListener.tsx
│   ├── ui/
│   ├── admin/                      # Admin-specific components
│   └── voice/
│
├── db/
│   ├── index.ts
│   ├── schema.ts                   # All table definitions (see Database Schema)
│   └── migrations/
│
├── hooks/
│   ├── useSocket.ts                # Ably Realtime hook
│   ├── useCallState.tsx            # Global call state
│   ├── useVoiceRecorder.ts
│   ├── useAdminSosStream.ts        # SSE hook for admin SOS stream
│   └── useLiveKitRoom.ts
│
├── lib/
│   ├── ably-server.ts              # Ably REST singleton + ablyPublish()
│   ├── api.ts
│   ├── auth-helpers.ts
│   ├── behaviour/                  # score-calculator, behaviour-report-queue
│   ├── env.ts
│   ├── haversine.ts
│   ├── kafka.ts
│   ├── kafka-topics.ts
│   ├── kafka-init.ts
│   ├── livekit-server.ts
│   ├── osrm.ts                     # Route geometry from OSRM
│   ├── rate-limit.ts
│   ├── redis.ts                    # Redis client
│   ├── route-cache.ts              # Redis-backed OSRM route cache
│   ├── sensor-thresholds.ts
│   ├── stress-signal-expiry.ts
│   ├── utils.ts
│   └── validate-uuid.ts
│
├── workers/
│   ├── stress-signal-consumer.ts   # Kafka SOS → nearby drivers (Ably)
│   ├── sensor-consumer.ts          # MQTT ESP32 readings → DB + Ably alerts
│   ├── behaviour-event-consumer.ts # MQTT cam_agent events → DB + Ably
│   ├── behaviour-report-worker.ts  # BullMQ → behaviour score calculation
│   ├── gps-position-worker.ts      # GPS position processing
│   ├── driver-esg-report-worker.ts # BullMQ ESG report generation
│   └── esg-report-scheduler.ts     # Cron-like ESG scheduling
│
├── cam_agent/                      # Python camera inference agent
│   ├── live_test.py                # Pygame live test window
│   ├── inference/
│   │   ├── inference_agent.py      # Main agent (--auto / --trip-id)
│   │   ├── ear_calculator.py
│   │   ├── head_pose.py
│   │   ├── event_publisher.py
│   │   └── event_state.py
│   ├── training/
│   │   ├── train.py                # Multi-model training with augmentation
│   │   └── prepare_dataset.py      # Keypoint extraction from image datasets
│   ├── models/
│   │   ├── yolov8n-pose.pt
│   │   └── drowsiness_mlp.pkl      # Trained RandomForest (98% F1)
│   └── config/config.yaml
│
├── instrumentation.ts              # Auto-spawns behaviour workers on npm run dev
├── instrumentation.node.ts         # Node.js spawn logic (split to avoid Edge bundling)
├── schemas/
├── sockets/
├── __tests__/
├── e2e/
├── esp32/                          # ESP32 firmware + wiring docs
├── docker/
│   └── mosquitto/                  # Mosquitto config + password file
├── docker-compose.yml
├── Dockerfile
└── Dockerfile.worker
```

---

## Database Schema

All tables live in `db/schema.ts`, managed by Drizzle ORM. PKs are `uuid`. FKs use `ON DELETE CASCADE/SET NULL`.

### Core tables

| Table | Description |
|---|---|
| `users` | All accounts — drivers and admins (`user_role` enum) |
| `driver_locations` | Latest GPS position per driver (upsert on every update) |
| `voice_messages` | Voice clip metadata (audio stored in `public/uploads/`) |
| `text_messages` | Direct text messages between friends |
| `stress_signals` | SOS alerts `active` / `resolved` |
| `friend_requests` | `pending` / `accepted` / `rejected` |
| `call_history` | LiveKit call records — `ongoing`, `completed`, `missed`, `declined` |

### Fleet / IoT tables

| Table | Description |
|---|---|
| `driver_routes` | OSRM-computed route geometry per trip |
| `iot_devices` | Registered ESP32 devices linked to a driver |
| `sensor_readings` | Raw sensor data (temperature, fuel, RPM, etc.) |
| `sensor_alerts` | Threshold-crossing alert records |
| `transport_trips` | Trip records — start/end time, route, status, linked `behaviour_report_id` |
| `driver_profiles` | Extended driver info (licence, vehicle, emergency contact) |
| `driver_shifts` | Shift scheduling |
| `vehicle_maintenance_logs` | Maintenance history per vehicle |
| `driver_training_records` | Training completion tracking |

### ESG / Behaviour tables

| Table | Description |
|---|---|
| `driver_esg_reports` | Per-driver ESG scores (ESRS S1-14 aligned) |
| `esg_report_schedules` | Scheduled ESG report generation |
| `driving_events` | Camera AI events: drowsiness, microsleep, distraction |
| `behaviour_reports` | Per-trip aggregated behaviour scores |
| `behaviour_scoring_config` | Configurable thresholds for score calculation |

---

## Authentication & Roles

- **Provider**: Credentials (email + password)
- **Session strategy**: JWT (30-day maxAge)
- **Password hashing**: bcryptjs
- **Roles**: `driver` (default) | `admin` — stored in `users.role`
- **Edge split**:
  - `auth.config.ts` — callbacks only (JWT, session, authorized). No Node.js imports. Used by `middleware.ts` (Edge Runtime).
  - `auth.ts` — imports bcryptjs + Drizzle for the full Credentials provider. Used by API route handlers.
- **Protected paths** (middleware): all `/dashboard`, `/map`, `/messages`, `/stress`, `/trips`, `/calls/*`, `/friends`, `/profile`
- **Admin paths** (role-checked in layout): `/admin/*`
- **Session data**: `session.user.id`, `session.user.role`

---

## Real-Time Layer (Ably)

TruckNet uses [Ably](https://ably.com) for all pub/sub. There is no persistent WebSocket server.

1. On page load, `useSocket()` creates an `Ably.Realtime` instance
2. The client fetches a signed `TokenRequest` from `GET /api/auth/ably-token`
3. The client subscribes to relevant channels

### Channel topology

| Channel | Events |
|---|---|
| `user:<userId>` | `nearby_driver_update`, `voice_message_received`, `text_message_received`, `friend_request_received`, `friend_request_accepted`, `call_incoming`, `call_declined`, `call_missed`, `call_ended`, `error` |
| `stress:alerts` | `stress_signal_alert` |
| `admin:behaviour` | `behaviour_event_alert` (critical/high severity events from cam_agent) |
| `trips:<tripId>` | `behaviour_report_ready`, `behaviour_report_failed` |

---

## API Routes

All routes live under `app/api/`. Protected routes verify the session via `requireAuth()`.

### Driver routes

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Health probe |
| POST | `/api/auth/register` | Create account (rate limited: 5/hr per IP) |
| GET | `/api/auth/ably-token` | Signed Ably TokenRequest |
| POST | `/api/drivers/location` | Upsert GPS position + publish `nearby_driver_update` |
| GET | `/api/drivers/nearby` | Nearby drivers (haversine) |
| GET | `/api/drivers/[id]/active-trip` | Active trip for driver (accepts session or Bearer API key) |
| GET | `/api/drivers/[id]/behaviour-summary` | Latest behaviour report summary |
| GET | `/api/drivers/[id]/maintenance` | Maintenance log |
| POST | `/api/drivers/[id]/maintenance` | Add maintenance entry |
| GET | `/api/drivers/route` | Compute OSRM route |
| GET | `/api/drivers/fleet-esg-summary` | Fleet-level ESG stats |
| POST | `/api/cam-agent/session` | Email → UUID resolution for cam_agent (API key auth) |
| GET | `/api/trips` | List driver's trips |
| POST | `/api/trips` | Start a new trip |
| PATCH | `/api/trips/[id]/status` | End trip (triggers behaviour report job) |
| GET | `/api/esg-report-schedules` | List ESG schedules |
| POST | `/api/esg-report-schedules` | Create ESG schedule |
| GET | `/api/friends/list` | Accepted friends + pending requests |
| POST | `/api/friends/request` | Send friend request |
| PATCH | `/api/friends/[id]/accept` | Accept friend request |
| PATCH | `/api/friends/[id]/reject` | Reject friend request |
| GET | `/api/friends/[id]/location` | Friend's last GPS location |
| GET | `/api/users/by-tag` | Resolve `?tag=name%231234` to user UUID |
| GET | `/api/profile` | Current user profile |
| PATCH | `/api/profile` | Update name |
| POST | `/api/profile/upload-avatar` | Avatar upload (multipart) |
| POST | `/api/upload/audio` | Voice message audio upload |
| GET | `/api/voice-messages` | Received voice messages |
| POST | `/api/voice-messages` | Send voice message |
| PATCH | `/api/voice-messages/[id]/status` | Mark as listened |
| GET | `/api/text-messages` | Conversation messages |
| POST | `/api/text-messages` | Send text message |
| POST | `/api/stress-signals` | Broadcast SOS (rate limited: 3/10 min) |
| GET | `/api/stress-signals/active` | Active SOS signals |
| PATCH | `/api/stress-signals/[id]/resolve` | Resolve a signal |
| POST | `/api/calls/initiate` | Create LiveKit room + notify callee |
| GET | `/api/calls/token/[roomName]` | Issue LiveKit JWT for a room |
| DELETE | `/api/calls/[roomName]` | End a call |
| PATCH | `/api/calls/[roomName]/decline` | Decline incoming call |
| GET | `/api/calls/history` | User call history |
| GET | `/api/geocode` | Reverse geocode proxy |

### Admin-only routes

| Method | Path | Description |
|---|---|---|
| GET | `/api/admin/stats` | Fleet stats summary |
| GET | `/api/admin/drivers` | All drivers list |
| GET | `/api/admin/drivers/live` | Live driver positions |
| GET | `/api/admin/drivers/[id]/route` | Driver's active route |
| GET | `/api/admin/sos` | Paginated SOS history |
| GET | `/api/admin/sos/stream` | SSE stream of active SOS alerts |
| PATCH | `/api/admin/sos/[id]/resolve` | Resolve SOS |
| GET | `/api/admin/calls` | Fleet call history |
| GET | `/api/admin/routes/active` | All active routes |
| GET | `/api/admin/sensors` | All IoT devices |
| GET | `/api/admin/sensors/[deviceId]` | Device details |
| GET | `/api/admin/sensors/[deviceId]/readings` | Historical readings |
| PATCH | `/api/admin/sensors/[deviceId]/thresholds` | Update alert thresholds |
| GET | `/api/admin/sensors/alerts` | All sensor alerts |
| PATCH | `/api/admin/sensors/alerts/[id]/acknowledge` | Acknowledge alert |
| GET | `/api/admin/behaviour/fleet` | Fleet behaviour overview |
| GET | `/api/admin/behaviour/config` | Scoring config |
| PATCH | `/api/admin/behaviour/config` | Update scoring config |

---

## Frontend Pages & Components

### Route groups

**`(auth)`** — public, no layout chrome
- `/login` — email/password sign-in
- `/register` — account creation with auto-generated tag

**`(protected)`** — driver layout with Navbar, BottomNav, CallStateWrapper, SosAlertListener
- `/dashboard` — quick-access overview
- `/map` — Leaflet map with live driver pins; `?focus=<userId>` auto-selects a driver
- `/trips` — trip list; start/end trip
- `/messages` — combined voice + text inbox with inline playback
- `/friends` — friend cards with voice call, video call, text, and location actions
- `/profile` — name + avatar
- `/stress` — SOS broadcast + active signals
- `/calls/[roomName]` — LiveKit room (`?type=voice|video`)

**`(admin)/admin`** — admin layout, role-checked
- `/admin` — fleet dashboard (KPIs, map, alerts)
- `/admin/sos` — SSE-powered real-time SOS stream
- `/admin/calls` — fleet call log
- `/admin/drivers` — driver list; click through to profile + route + behaviour
- `/admin/sensors` — IoT device grid; readings chart + threshold editor
- `/admin/behaviour` — scoring config (drowsy weight, distraction weight, etc.)

---

## Workers

All workers live in `workers/` and use `tsx` as their runtime.
In development they are **auto-started** by `instrumentation.ts` when you run `npm run dev`.
In production they run as separate docker-compose services.

| Worker | Transport | What it does |
|---|---|---|
| `stress-signal-consumer.ts` | Kafka | Consumes SOS events → haversine-filters nearby drivers → Ably fan-out |
| `sensor-consumer.ts` | MQTT | ESP32 readings → `sensor_readings` DB + threshold alerts via Ably |
| `behaviour-event-consumer.ts` | MQTT | cam_agent events → `driving_events` DB + Ably admin alert |
| `behaviour-report-worker.ts` | BullMQ (Redis) | Triggered on trip end → waits 30 s → calculates scores → `behaviour_reports` DB + Ably |
| `gps-position-worker.ts` | — | GPS position post-processing |
| `driver-esg-report-worker.ts` | BullMQ (Redis) | ESG score calculation and report generation |
| `esg-report-scheduler.ts` | — | Schedules periodic ESG report jobs |

### Auto-start (development)

`instrumentation.ts` + `instrumentation.node.ts` spawn `behaviour-event-consumer` and
`behaviour-report-worker` automatically when the Next.js dev server starts. Both workers
restart automatically if they crash (3 s back-off).

---

## Camera Agent (cam_agent)

A Python process that runs on the cab laptop.
See [cam_agent/README.md](cam_agent/README.md) and [cam_agent/docs/SETUP.md](cam_agent/docs/SETUP.md) for full details.

**Quick reference:**

```bash
cd cam_agent
pip install -r requirements.txt

# Live visual test (no server needed)
python live_test.py

# Production — auto mode
python inference/inference_agent.py --auto
```

**Event flow:**
```
cam_agent
  └─ MQTT publish trucknet/drivers/{id}/behaviour
       └─ behaviour-event-consumer → driving_events DB + Ably admin alert
            └─ (on trip end) behaviour-report-worker → behaviour_reports DB
```

---

## Lib Utilities

| File | Purpose |
|---|---|
| `lib/ably-server.ts` | Singleton `Ably.Rest` client + `ablyPublish()` |
| `lib/api.ts` | Typed fetch wrappers for client→server API calls |
| `lib/auth-helpers.ts` | `requireAuth()` / `requireAdmin()` — gets session or throws 401/403 |
| `lib/behaviour/score-calculator.ts` | Computes speed, fatigue, style, idle sub-scores from `driving_events` |
| `lib/behaviour/behaviour-report-queue.ts` | BullMQ queue helper for queuing behaviour report jobs |
| `lib/env.ts` | Zod-validated env export |
| `lib/haversine.ts` | `haversineDistanceKm()` — pure function |
| `lib/kafka.ts` | Singleton Kafka client + `getProducer()` / `getAdmin()` |
| `lib/kafka-topics.ts` | Topic name constants |
| `lib/kafka-init.ts` | Idempotent topic creation |
| `lib/livekit-server.ts` | `getRoomService()` + `generateLiveKitToken()` |
| `lib/osrm.ts` | OSRM route geometry requests |
| `lib/rate-limit.ts` | Fixed-window in-memory `RateLimiter` |
| `lib/redis.ts` | Singleton `ioredis` client |
| `lib/route-cache.ts` | Redis-backed OSRM route cache (TTL: 10 min) |
| `lib/sensor-thresholds.ts` | Default + configurable thresholds for sensor alerts |
| `lib/driver-esg-aggregator.ts` | Aggregates KPIs from all tables into an ESG score |
| `lib/utils.ts` | `cn()` — clsx + tailwind-merge |
| `lib/validate-uuid.ts` | Guards route params that must be valid UUIDs |

---

## Schemas & Validation

| Schema file | Validates |
|---|---|
| `env.schema.ts` | All env vars (DATABASE_URL, NEXTAUTH_*, ABLY_API_KEY, LIVEKIT_*, KAFKA_*, REDIS_URL, MQTT_URL, CAM_AGENT_API_KEY) |
| `location.schema.ts` | `{ latitude, longitude }` GPS payload |
| `stress.schema.ts` | SOS signal request body |
| `sensor.schema.ts` | IoT sensor reading payload |
| `route.schema.ts` | Route request/response |
| `tag.schema.ts` | Username tag format |
| `user.schema.ts` | Register body |
| `voice.schema.ts` | Voice message metadata |

---

## Middleware (Edge)

`middleware.ts` executes on every matched request in the Edge Runtime:

```
Request
  │
  ├─ 1. Rate limit check → 429 if exceeded
  │
  └─ 2. Auth.js authorized() callback → 302 to /login if unauthenticated
```

The `matcher` excludes static assets and Next.js internals.

---

## Rate Limiting

Fixed-window, in-memory (`lib/rate-limit.ts`).

| Route | Limit | Window | Key |
|---|---|---|---|
| `POST /api/auth/register` | 5 | 1 hour | IP |
| `POST /api/stress-signals` | 3 | 10 minutes | `session.user.id` |
| `POST /api/voice-messages` | 10 | 1 minute | `session.user.id` |

> Production: swap `RateLimiter` for an Upstash Redis adapter to support multi-instance deployments.

---

## Security Headers

Set globally in `next.config.mjs`:

| Header | Value |
|---|---|
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(self), geolocation=(self), microphone=(self)` |
| `Content-Security-Policy` | Allows self + Ably + LiveKit domains; `blob:` for audio/map tiles |

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection URL |
| `NEXTAUTH_SECRET` | ✅ | Random secret ≥ 10 chars |
| `NEXTAUTH_URL` | ✅ | Full base URL of the app |
| `ABLY_API_KEY` | ✅ | Ably API key |
| `LIVEKIT_URL` | ✅ | LiveKit server URL |
| `LIVEKIT_API_KEY` | ✅ | LiveKit API key |
| `LIVEKIT_API_SECRET` | ✅ | LiveKit API secret |
| `KAFKA_BROKERS` | ✅ | `localhost:9092` locally, `kafka:29092` in Docker |
| `KAFKA_ENABLED` | ✅ | `true` to produce SOS to Kafka |
| `REDIS_URL` | ✅ | Redis URL for BullMQ + route cache (`redis://localhost:6379`) |
| `MQTT_URL` | ✅ | Full MQTT URL for workers (`mqtt://user:pass@host:1883`) |
| `MQTT_PASSWORD` | ✅ | Mosquitto broker password |
| `CAM_AGENT_API_KEY` | ✅ | API key for cam_agent endpoints |

All validated at boot by `schemas/env.schema.ts` — the app **refuses to start** with a missing variable.

---

## Testing

### Unit tests — Vitest
```bash
npm test
npm run test:watch
npm run test:coverage
```
Test files: `__tests__/api/`, `__tests__/lib/`, `__tests__/schemas/`, `__tests__/sockets/`.

### E2E tests — Playwright
```bash
npm run test:e2e
```
Tests: `e2e/auth.spec.ts`, `e2e/smoke.spec.ts`.

### Load tests — k6
```bash
k6 run load-tests/k6-script.js
```

---

## Docker & Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for the full guide.

### Local full-stack
```bash
docker compose up --build
```

Services started:

| Service | Port | Purpose |
|---|---|---|
| `postgres` | 5433 | PostgreSQL 16 |
| `livekit` | 7880/7881/7882 | WebRTC SFU |
| `redis` | 6379 | BullMQ + route cache |
| `kafka` | 9092 (ext) | Message broker (KRaft) |
| `kafka-ui` | 8080 | Kafka monitoring UI |
| `mosquitto` | 1883 / 9001 | MQTT broker |
| `app` | 3000 | Next.js application |
| `stress-worker` | — | Kafka SOS consumer |
| `sensor-worker` | — | MQTT ESP32 consumer |
| `behaviour-event-worker` | — | MQTT cam_agent consumer |
| `behaviour-report-worker` | — | BullMQ behaviour report processor |
| `esg-worker` | — | BullMQ ESG report processor |

---

## Scripts Reference

```bash
# Application
npm run dev              # Start dev server (auto-starts behaviour workers)
npm run build            # Production build
npm run start            # Start production server
npm run lint             # ESLint check
npm run lint:fix         # ESLint auto-fix
npm run format           # Prettier format
npm run type-check       # tsc --noEmit

# Database
npm run db:generate      # Generate new migration files
npm run db:migrate       # Apply pending migrations
npm run db:push          # Push schema directly (dev only)
npm run db:studio        # Open Drizzle Studio (browser DB GUI)

# Tests
npm test                 # Vitest unit tests
npm run test:watch       # Vitest watch mode
npm run test:coverage    # Vitest coverage report
npm run test:e2e         # Playwright E2E tests

# Workers (manual start — not needed in dev or docker-compose)
npm run worker:stress          # SOS Kafka consumer
npm run worker:sensors         # IoT MQTT consumer
npm run worker:behaviour-events # cam_agent MQTT consumer
npm run worker:behaviour        # Behaviour report BullMQ worker
npm run kafka:setup            # Provision Kafka topics (run once after broker starts)
```

