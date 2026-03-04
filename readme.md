# TruckNet

A real-time web application for truck drivers to share live GPS locations, make voice and video calls, send voice and text messages, broadcast emergency SOS signals with Kafka-powered fan-out, and manage friend connections — all in a single full-stack Next.js application.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Tech Stack](#tech-stack)
3. [Architecture Overview](#architecture-overview)
4. [Directory Structure](#directory-structure)
5. [Database Schema](#database-schema)
6. [Authentication](#authentication)
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
17. [Testing](#testing)
18. [Docker & Deployment](#docker--deployment)
19. [Scripts Reference](#scripts-reference)

---

## Project Overview

TruckNet is built for a fleet of truck drivers who need:

- **Live map** — see nearby drivers in real-time via GPS sharing; `?focus=<userId>` to jump to a friend
- **Voice & video calls** — 1-on-1 WebRTC calls powered by LiveKit SFU
- **Voice messages** — record and send audio clips up to 60 seconds
- **Text messages** — send direct text messages to friends
- **SOS alerts** — trigger an emergency signal processed by a Kafka consumer and delivered as in-app toasts + browser push notifications to all online drivers
- **Friend system** — send/accept/reject friend requests; view a friend's last known location
- **Profile management** — editable profile with avatar upload

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
| Message Queue | KafkaJS | 2.2.x |
| Kafka Broker | Confluent CP-Kafka (KRaft) | 7.4.0 |
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
    ├── REST API calls  ──►  Next.js App Router API Routes  ──►  Drizzle ORM  ──►  PostgreSQL
    │                                    │
    │                                    └──►  Ably REST (ablyPublish)
    │
    └── Ably Realtime  ◄──  Ably Channels  ◄──  API routes publish events on write
         │
         ├── "user:<clientId>"   — private per-user channel
         │     • nearby_driver_update
         │     • voice_message_received
         │     • text_message_received
         │     • friend_request_received
         │     • friend_request_accepted
         │     • error
         │
         └── "stress:alerts"     — shared broadcast channel
               • stress_signal_alert
```

**Key design decisions:**

- **No persistent WebSocket server** — Ably handles all pub/sub so the app deploys as a stateless Next.js application
- **Ably token auth** — clients never receive the API key; they fetch a signed `TokenRequest` from `GET /api/auth/ably-token`
- **Kafka for SOS criticality** — SOS produce is fire-and-forget from the API route; a dedicated worker process handles fan-out, retry, and DLQ so the API response is never delayed
- **Two Kafka listeners** — `INTERNAL://kafka:29092` for Docker-to-Docker; `EXTERNAL://localhost:9092` for local `npm run dev`. Fixes the advertised-listener hostname issue that causes `getaddrinfo ENOTFOUND kafka`
- **LiveKit SFU** — WebRTC media goes peer-to-server-to-peer via the LiveKit server; the Next.js app only handles signalling (room creation, JWT tokens, Ably call events)
- **Stale call cleanup** — `POST /api/calls/initiate` auto-expires the caller's own `ongoing` records and verifies each callee room against LiveKit's participant list before returning 409
- **Edge-safe auth split** — `auth.config.ts` (Edge-safe, no Node APIs) used in middleware; `auth.ts` (Node.js) adds Credentials with bcrypt
- **Fail-fast env validation** — all env vars parsed through Zod at startup; process exits with a descriptive error if anything is wrong

---

## Directory Structure

```
TruckNet/
├── app/                        # Next.js App Router
│   ├── globals.css
│   ├── layout.tsx              # Root layout (Providers, Toaster, fonts)
│   ├── page.tsx                # Landing / redirect page
│   ├── (auth)/
│   │   ├── login/
│   │   └── register/
│   ├── (protected)/
│   │   ├── layout.tsx          # Navbar + BottomNav + CallStateWrapper + SosAlertListener
│   │   ├── dashboard/
│   │   ├── calls/
│   │   │   └── [roomName]/     # LiveKit voice/video call room page
│   │   ├── friends/            # Friend cards with call/message/location actions
│   │   ├── map/                # Live map; ?focus= auto-selects a driver
│   │   ├── messages/
│   │   ├── profile/
│   │   └── stress/
│   └── api/
│       ├── auth/               # Auth.js handlers + Ably token
│       ├── calls/              # POST initiate, GET/DELETE [roomName], POST decline
│       ├── drivers/
│       ├── friends/            # list, request, accept, reject, [id]/location
│       ├── health/
│       ├── profile/
│       ├── stress-signals/
│       ├── text-messages/
│       ├── upload/
│       ├── users/
│       └── voice-messages/
│
├── components/
│   ├── Providers.tsx
│   ├── calls/
│   │   ├── CallStateWrapper.tsx    # Global call state provider + incoming call modal
│   │   ├── IncomingCallModal.tsx   # Full-screen overlay on call_incoming
│   │   ├── ActiveCallBadge.tsx     # Floating badge when in a call on another page
│   │   ├── VoiceCallRoom.tsx       # LiveKit voice room UI
│   │   └── VideoCallRoom.tsx       # LiveKit video room UI
│   ├── drivers/
│   ├── layout/
│   │   ├── BottomNav.tsx
│   │   ├── LiveConnectionBadge.tsx
│   │   └── Navbar.tsx
│   ├── map/
│   ├── messages/
│   ├── stress/
│   │   └── SosAlertListener.tsx    # Global SOS toast + browser notification
│   ├── ui/
│   └── voice/
│
├── db/
│   ├── index.ts
│   ├── schema.ts               # users, driver_locations, voice_messages, text_messages,
│   │                           # stress_signals, friend_requests, call_history
│   └── migrations/
│
├── hooks/
│   ├── useSocket.ts            # Ably Realtime hook
│   ├── useCallState.ts         # Global call state (incoming/active call)
│   └── useVoiceRecorder.ts
│
├── lib/
│   ├── ably-server.ts          # Ably REST singleton + ablyPublish()
│   ├── api.ts
│   ├── auth-helpers.ts
│   ├── env.ts
│   ├── haversine.ts
│   ├── kafka.ts                # Kafka singleton client + getProducer() / getAdmin()
│   ├── kafka-topics.ts         # Topic name constants
│   ├── kafka-init.ts           # Idempotent topic provisioning
│   ├── livekit-server.ts       # RoomServiceClient singleton + generateLiveKitToken()
│   ├── rate-limit.ts
│   ├── stress-signal-expiry.ts
│   ├── utils.ts
│   └── validate-uuid.ts
│
├── workers/
│   └── stress-signal-consumer.ts  # KafkaJS consumer — SOS fan-out to nearby drivers
│
├── scripts/
│   └── kafka-setup.ts              # One-shot topic provisioning script
│
├── schemas/
├── sockets/
├── __tests__/
├── e2e/
├── load-tests/
├── auth.config.ts
├── auth.ts
├── middleware.ts
├── next.config.mjs
├── drizzle.config.ts
├── docker-compose.yml          # postgres, livekit, kafka, kafka-ui, app, stress-worker
├── Dockerfile                  # 3-stage build; strips @next/swc-win32 before npm ci
├── Dockerfile.worker           # Minimal build for stress-signal-consumer only
├── package.worker.json         # Minimal deps for the worker image
└── docker-entrypoint.sh
```

---

## Database Schema

All tables use PostgreSQL, managed by Drizzle ORM. Primary keys are `uuid` (random). Foreign keys have `ON DELETE CASCADE`.

### `users`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | default random |
| `name` | text | |
| `email` | text | unique |
| `password_hash` | text | bcryptjs hash |
| `tag` | varchar(20) | unique display handle e.g. `john#0042` |
| `tag_number` | integer | numeric suffix |
| `profile_image_url` | varchar(255) | nullable |
| `created_at` | timestamptz | |

### `driver_locations`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK → users | indexed |
| `latitude` | double precision | |
| `longitude` | double precision | |
| `updated_at` | timestamptz | indexed |

### `voice_messages`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `sender_id` | uuid FK → users | |
| `receiver_id` | uuid FK → users | |
| `audio_url` | text | path to stored file |
| `duration_seconds` | double precision | |
| `created_at` | timestamptz | |
| `status` | enum | `delivered` \| `listened` |

### `text_messages`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `sender_id` | uuid FK → users | indexed |
| `receiver_id` | uuid FK → users | indexed |
| `content` | text | |
| `status` | enum | `delivered` \| `read` |
| `created_at` | timestamptz | indexed |

### `stress_signals`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK → users | |
| `latitude` | double precision | |
| `longitude` | double precision | |
| `created_at` | timestamptz | |
| `status` | enum | `active` \| `resolved` |

### `friend_requests`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `sender_id` | uuid FK → users | |
| `receiver_id` | uuid FK → users | |
| `status` | enum | `pending` \| `accepted` \| `rejected` |
| `created_at` | timestamptz | |
| unique constraint | | `(sender_id, receiver_id)` |

TruckNet uses [LiveKit](https://livekit.io) as the WebRTC SFU for voice and video calls.

### Flow

1. Caller hits `POST /api/calls/initiate` — verifies friendship, auto-expires stale `ongoing` records, creates a LiveKit room, inserts a `call_history` row, returns `{ roomName, token, liveKitUrl }`
2. Server notifies callee via Ably `call_incoming` event (includes a pre-generated `calleeToken` to skip a second round-trip)
3. `IncomingCallModal` renders full-screen on the callee's device
4. Callee accepts → navigates to `/calls/[roomName]?type=voice|video`
5. Either party ends → `DELETE /api/calls/[roomName]` marks the row `completed` and fires `call_ended` to the other side

### Stale call cleanup

Every `POST /api/calls/initiate` automatically:
- Expires any `ongoing` records the **caller** appears in (caller can't be on a call if initiating one)
- Checks each `ongoing` record for the **callee** against LiveKit's participant list — empty rooms → expired

This prevents the `409 The person you are trying to call is busy` error caused by browser-close or network-drop without hitting the end endpoint.

### `call_history`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `room_name` | varchar(100) | unique, LiveKit room identifier |
| `caller_id` | uuid FK → users | set null on delete |
| `callee_id` | uuid FK → users | set null on delete |
| `call_type` | enum | `voice` \| `video` |
| `status` | enum | `ongoing` \| `completed` \| `missed` \| `declined` |
| `started_at` | timestamptz | nullable |
| `ended_at` | timestamptz | nullable |
| `duration_seconds` | integer | nullable |
| `created_at` | timestamptz | |

---

## Calls (LiveKit)

- **Provider**: Credentials (email + password)
- **Session strategy**: JWT (30-day maxAge)
- **Password hashing**: bcryptjs
- **Edge split**:
  - `auth.config.ts` — only callbacks (JWT, session, authorized). No Node.js-only imports. Used by `middleware.ts` (Edge Runtime).
  - `auth.ts` — imports bcryptjs + Drizzle for the full Credentials provider. Used by API route handlers.
- **Protected paths** (enforced in middleware): `/dashboard`, `/map`, `/messages`, `/stress`
- **Session data**: `session.user.id` (UUID from DB)

---

## Real-Time Layer (Ably)

TruckNet uses [Ably](https://ably.com) for all real-time pub/sub. There is no persistent WebSocket server process.

### How it works

1. On page load, `useSocket()` hook creates an `Ably.Realtime` instance
2. The client fetches a signed `TokenRequest` from `GET /api/auth/ably-token` (never receives the raw API key)
3. The client subscribes to:
   - `"user:<clientId>"` — private per-user channel
   - `"stress:alerts"` — shared emergency channel
4. When an API route writes data (e.g. a new voice message), it calls `ablyPublish()` server-side to push the event to the appropriate channel

### Channel topology

| Channel | Events |
|---|---|
| `user:<userId>` | `nearby_driver_update`, `voice_message_received`, `text_message_received`, `friend_request_received`, `friend_request_accepted`, `call_incoming`, `call_declined`, `call_missed`, `call_ended`, `error` |
| `stress:alerts` | `stress_signal_alert` |

### Server helpers (`lib/ably-server.ts`)

```ts
ablyPublish(channelName, eventName, data)
// Lazy-init singleton Ably.Rest → channel.publish()
// Errors are swallowed — real-time delivery is best-effort
```

---

## Kafka (SOS Alert Pipeline)

SOS alerts use a Kafka message queue to decouple the API response from the potentially slow fan-out to nearby drivers.

### Flow

```
POST /api/stress-signals
  └─ Insert to DB
  └─ producer.send() → trucknet.stress-signals  (fire-and-forget when KAFKA_ENABLED=true)

stress-signal-consumer.ts (Docker worker)
  └─ Consume message
  └─ Validate with Zod
  └─ Query all driver_locations
  └─ Haversine-filter to ≤50 km
  └─ ablyPublish("stress:alerts", "stress_signal_alert", payload)   ← all online drivers
  └─ ablyPublish("user:<driverId>", ...) per nearby driver           ← private per-user
  └─ On error → DLQ (trucknet.stress-signals.dlq)
```

### Topics

| Topic | Partitions | Retention | Key |
|---|---|---|---|
| `trucknet.stress-signals` | 3 | 7 days | signal UUID |
| `trucknet.stress-signals.dlq` | 1 | 30 days | signal UUID |

### Local dev vs Docker

| Env | `KAFKA_BROKERS` | `KAFKA_ENABLED` | Behaviour |
|---|---|---|---|
| `npm run dev` (no Docker Kafka) | `localhost:9092` | `false` | Kafka produce skipped entirely |
| `npm run dev` (with Docker Kafka) | `localhost:9092` | `true` | Produces to external listener |
| `docker-compose up` | `kafka:29092` | `true` | Internal listener, full pipeline |

### Client-side SOS notification

`SosAlertListener` (`components/stress/SosAlertListener.tsx`) is mounted in the protected layout and active on **every page**:
- Shows a **Sonner toast** (`duration: 12s`) with sender name and a "View Alerts" action
- Fires a **native browser `Notification`** even when the tab is minimised (`requireInteraction: true`)
- Suppresses notification for the sender (checked against `session.user.id`)

---

## API Routes

All routes under `app/api/`. All protected routes verify the session via Auth.js helpers.

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/health` | No | Uptime probe |
| POST | `/api/auth/register` | No | Create account (rate limited: 5/hr per IP) |
| GET | `/api/auth/ably-token` | Yes | Returns signed Ably TokenRequest |
| POST | `/api/drivers/location` | Yes | Upsert current location + publish nearby_driver_update |
| GET | `/api/drivers/nearby` | Yes | List nearby drivers (haversine) |
| GET | `/api/friends/list` | Yes | List accepted friends + pending requests |
| POST | `/api/friends/request` | Yes | Send friend request |
| PATCH | `/api/friends/:id/accept` | Yes | Accept a friend request |
| PATCH | `/api/friends/:id/reject` | Yes | Reject a friend request |
| GET | `/api/friends/:id/location` | Yes | Get friend's last GPS location (403 if not friends) |
| GET | `/api/users/by-tag` | Yes | Resolve `?tag=name%231234` to user UUID |
| GET | `/api/profile` | Yes | Get current user profile |
| PATCH | `/api/profile` | Yes | Update name |
| POST | `/api/profile/upload-avatar` | Yes | Upload avatar (multipart) |
| POST | `/api/upload/audio` | Yes | Upload voice message audio (multipart) |
| GET | `/api/voice-messages` | Yes | List received voice messages |
| POST | `/api/voice-messages` | Yes | Send voice message (rate limited: 10/min) |
| PATCH | `/api/voice-messages/:id/status` | Yes | Mark as listened |
| GET | `/api/text-messages` | Yes | List conversation messages |
| POST | `/api/text-messages` | Yes | Send text message |
| POST | `/api/stress-signals` | Yes | Broadcast SOS (rate limited: 3/10min); produces to Kafka |
| GET | `/api/stress-signals/active` | Yes | List active signals |
| PATCH | `/api/stress-signals/:id/resolve` | Yes | Resolve a signal |
| POST | `/api/calls/initiate` | Yes | Initiate a call (creates LiveKit room, notifies callee) |
| GET | `/api/calls/:roomName` | Yes | Get call details / issue token |
| DELETE | `/api/calls/:roomName` | Yes | End a call |
| POST | `/api/calls/:roomName/decline` | Yes | Decline an incoming call |

---

## Frontend Pages & Components

### Route Groups

**`(auth)`** — public, no layout chrome
- `/login` — email/password sign-in form
- `/register` — account creation form with tag auto-generation

**`(protected)`** — wrapped in `layout.tsx` with `<Navbar>`, `<BottomNav>`, `<CallStateWrapper>`, and `<SosAlertListener>`
- `/dashboard` — overview, quick-access cards
- `/map` — `<DriverMap>` (Leaflet) with live driver pins; `?focus=<userId>` auto-selects a driver
- `/messages` — combined voice + text inbox; voice playback inline
- `/friends` — friend cards with voice call, text message, video call, and location buttons; pending requests
- `/profile` — editable profile (name, avatar upload)
- `/stress` — send SOS signal + view active signals
- `/calls/[roomName]` — LiveKit voice or video call room (`?type=voice|video`)

### Key Components

| Component | Purpose |
|---|---|
| `DriverMap` | Leaflet map, subscribes to `nearby_driver_update`, renders marker per driver |
| `BottomNav` | Mobile tab bar |
| `LiveConnectionBadge` | Shows Ably connection status |
| `Providers` | Wraps tree with `SessionProvider` and `<Toaster>` (Sonner) |
| `CallStateWrapper` | Provides global call state; renders `IncomingCallModal` on `call_incoming` |
| `IncomingCallModal` | Full-screen overlay with accept/decline; shown on any page |
| `ActiveCallBadge` | Floating badge when user is in a call but navigates away |
| `SosAlertListener` | Subscribes to `stress_signal_alert`; shows toast + browser push notification |
| `useVoiceRecorder` | MediaRecorder hook — 60 s max, releases mic on stop/unmount |

---

## Hooks

### `useSocket` (`hooks/useSocket.ts`)

Ably-backed real-time hook.

```ts
const { on, off, emit, isConnected } = useSocket();

// Subscribe to a server event
on("voice_message_received", (msg) => { ... });

// emit() is a no-op — client→server data is sent via REST
```

Internally:
- One `Ably.Realtime` instance per client session (ref-stable)
- Subscribes to `"user:<clientId>"` for personal events
- Subscribes to `"stress:alerts"` for shared alerts
- Auto-reconnects via Ably SDK

### `useVoiceRecorder` (`hooks/useVoiceRecorder.ts`)

```ts
const { start, stop, isRecording, audioBlob, durationSeconds, permissionError } = useVoiceRecorder();
```

- Wraps `MediaRecorder` API
- Auto-stops at 60 seconds
- Returns a `Blob` ready for upload to `POST /api/upload/audio`
- Surfaces `permissionError` if mic is denied

---

## Lib Utilities

| File | Purpose |
|---|---|
| `lib/ably-server.ts` | Singleton `Ably.Rest` client + `ablyPublish()` |
| `lib/api.ts` | Typed fetch wrappers for all client→server API calls |
| `lib/auth-helpers.ts` | `requireAuth()` — gets session or throws 401 |
| `lib/env.ts` | Zod-validated env export — import this, not `process.env` |
| `lib/haversine.ts` | `haversineDistanceKm(lat1, lon1, lat2, lon2)` — pure function |
| `lib/kafka.ts` | Singleton Kafka client + `getProducer()` / `getAdmin()` |
| `lib/kafka-topics.ts` | Topic name constants (`STRESS_SIGNALS_TOPIC`, `STRESS_SIGNALS_DLQ`) |
| `lib/kafka-init.ts` | `kafkaInit()` — idempotent topic creation |
| `lib/livekit-server.ts` | `getRoomService()` + `generateLiveKitToken()` |
| `lib/rate-limit.ts` | `RateLimiter` class — fixed-window, in-memory |
| `lib/stress-signal-expiry.ts` | Marks old `active` signals as `resolved` |
| `lib/utils.ts` | `cn(...classes)` — clsx + tailwind-merge |
| `lib/validate-uuid.ts` | Guards route params that must be valid UUIDs |

---

## Schemas & Validation

All request/response shapes are defined as Zod schemas in `schemas/`. These are shared between API route handlers (server) and form validation (client).

| Schema file | Validates |
|---|---|
| `env.schema.ts` | `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `ABLY_API_KEY`, `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `KAFKA_BROKERS`, `KAFKA_ENABLED` |
| `location.schema.ts` | `{ latitude, longitude }` GPS update payload |
| `stress.schema.ts` | Stress signal request body |
| `tag.schema.ts` | Username tag format |
| `user.schema.ts` | Register body (`name`, `email`, `password`, `tag`) |
| `voice.schema.ts` | Voice message metadata (`receiverId`, `durationSeconds`, `audioUrl`) |

---

## Middleware (Edge)

`middleware.ts` runs in the **Edge Runtime** on every matched request. Execution order:

```
Request
  │
  ├─ 1. Rate limit check  →  429 if exceeded
  │
  └─ 2. Auth.js authorized() callback  →  302 to /login if unauthenticated
```

The `matcher` config excludes static assets and Next.js internals.

---

## Rate Limiting

In-memory, fixed-window rate limiter (`lib/rate-limit.ts`). Three pre-configured instances:

| Route | Limit | Window | Key |
|---|---|---|---|
| `POST /api/auth/register` | 5 requests | 1 hour | IP address |
| `POST /api/stress-signals` | 3 requests | 10 minutes | `session.user.id` |
| `POST /api/voice-messages` | 10 requests | 1 minute | `session.user.id` |

Responses include a `Retry-After` header on 429.

> **Production note**: Replace `RateLimiter` with an Upstash Redis adapter at the same interface boundary to support multi-instance deployments.

---

## Security Headers

Set globally via `next.config.mjs` `headers()`:

| Header | Value |
|---|---|
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), geolocation=(self), microphone=(self)` |
| `Content-Security-Policy` | Allows self + Ably domains; `blob:` for audio playback |

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection URL |
| `NEXTAUTH_SECRET` | ✅ | Random secret ≥ 10 chars — `openssl rand -base64 32` |
| `NEXTAUTH_URL` | ✅ | Full base URL of the app (e.g. `http://localhost:3000`) |
| `ABLY_API_KEY` | ✅ | Ably API key from the Ably dashboard |
| `LIVEKIT_URL` | ✅ | LiveKit server URL (`wss://...` or `ws://livekit:7880` in Docker) |
| `LIVEKIT_API_KEY` | ✅ | LiveKit API key |
| `LIVEKIT_API_SECRET` | ✅ | LiveKit API secret |
| `KAFKA_BROKERS` | ✅ | Comma-separated broker addresses. `localhost:9092` locally, `kafka:29092` in Docker |
| `KAFKA_ENABLED` | ✅ | `true` to produce SOS to Kafka; `false` to skip (local dev without broker) |

All validated at boot by `schemas/env.schema.ts` — the app **refuses to start** with a missing/invalid variable.

---

## Testing

### Unit tests — Vitest

```bash
npm test              # run once
npm run test:watch    # watch mode
npm run test:coverage # coverage report (v8)
```

Test files live in `__tests__/`:
- `api/` — API route handlers (location, register, stress)
- `lib/` — pure functions (haversine, rate-limit, validate)
- `schemas/` — Zod schema acceptance/rejection cases
- `sockets/` — socket event handling

### E2E tests — Playwright

```bash
npm run test:e2e
```

Tests in `e2e/`:
- `auth.spec.ts` — registration and login flows
- `smoke.spec.ts` — critical path smoke test

### Load tests — k6

```bash
k6 run load-tests/k6-script.js
```

Simulates concurrent drivers sending location updates and stress signals.

---

## Docker & Deployment

### Local full-stack (docker-compose)

```bash
docker-compose up --build
```

Starts 6 services:

| Service | Image | Port | Purpose |
|---|---|---|---|
| `postgres` | postgres:16-alpine | 5432 | Primary database |
| `livekit` | livekit/livekit-server | 7880/7881/7882 | WebRTC SFU |
| `kafka` | confluentinc/cp-kafka:7.4.0 | 9092 (external) | Message broker (KRaft) |
| `kafka-ui` | provectuslabs/kafka-ui | 8080 | Kafka monitoring dashboard |
| `app` | Dockerfile | 3000 | Next.js application |
| `stress-worker` | Dockerfile.worker | — | Kafka SOS consumer |

**Kafka dual-listener setup:**
- `INTERNAL://kafka:29092` — used by `app` and `stress-worker` containers
- `EXTERNAL://localhost:9092` — used by local `npm run dev` and Kafka tooling on the host

**Verify Kafka topics:**
```bash
docker exec trucknet-kafka-1 kafka-topics --bootstrap-server localhost:9092 --list
# trucknet.stress-signals
# trucknet.stress-signals.dlq
```

**Check SOS worker logs:**
```bash
docker logs trucknet-stress-worker-1 -f
# [stress-worker] signal <id> delivered to N nearby driver(s)
```

### Production Docker image

3-stage Dockerfile:
1. **deps** — `npm ci` (all deps)
2. **builder** — `next build`
3. **runner** — minimal Node 20 Alpine image, non-root user, `HEALTHCHECK` on `/api/health`

`docker-entrypoint.sh` runs `npm run db:migrate` before `npm start`.

### Horizontal scaling

- Replace the in-memory `location.store.ts` Map with a Redis adapter
- Replace in-memory `RateLimiter` with Upstash Ratelimit
- Ably already handles pub/sub at scale — no changes needed there

---

## Scripts Reference

```bash
npm run dev              # Start development server
npm run build            # Production build
npm run start            # Start production server
npm run lint             # ESLint check
npm run lint:fix         # ESLint auto-fix
npm run format           # Prettier format all files
npm run type-check       # tsc --noEmit
npm run db:generate      # Generate new Drizzle migration files
npm run db:migrate       # Apply pending migrations
npm run db:push          # Push schema directly (dev only)
npm run db:studio        # Open Drizzle Studio (DB GUI)
npm test                 # Vitest unit tests
npm run test:watch       # Vitest watch mode
npm run test:coverage    # Vitest coverage
npm run test:e2e         # Playwright e2e tests
npm run worker:stress    # Run SOS Kafka consumer (production)
npm run worker:dev:stress # Run SOS Kafka consumer with tsx watch (dev)
npm run kafka:setup      # Provision Kafka topics (run once after broker starts)
```