# TruckNet

**Version 0.2.0 — Full-stack fleet management platform**

TruckNet is a production-grade, multi-tenant fleet operations system built as a monorepo combining a Next.js 14 App Router application, six standalone background workers, a Python ML inference agent, and ESP32 embedded firmware. The platform connects truck drivers and fleet administrators through real-time GPS tracking, WebRTC voice/video calls, driver-to-driver messaging, IoT container sensor monitoring, SOS stress signals, AI-based drowsiness detection, and automated ESG/CSRD-compliant reporting.

Two user roles exist throughout the system:

- **Driver** — shares live GPS, sends messages and voice clips, initiates SOS alerts, receives incoming calls, views own trip history and behaviour scores.
- **Admin** — monitors the entire fleet in real-time via a full operations dashboard: live map with all driver positions and active routes, SOS stream, IoT sensor readings, driver HR profiles, behaviour safety ranking, and ESG reports.

The transport layer is stateless: Ably handles all pub/sub so the Next.js process can run as many replicas without any sticky-session requirement. Heavy background tasks (SOS fan-out, behaviour scoring, ESG PDF generation) are delegated to isolated workers communicating over Kafka, MQTT, and BullMQ.

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [System Architecture](#system-architecture)
3. [Directory Structure](#directory-structure)
4. [Database Schema](#database-schema)
5. [Authentication & RBAC](#authentication--rbac)
6. [Feature Deep-Dives](#feature-deep-dives)
   - [GPS Tracking & Fleet Map (FEAT-004)](#gps-tracking--fleet-map-feat-004)
   - [Messaging — Text & Voice (FEAT-005)](#messaging--text--voice-feat-005)
   - [SOS / Stress Signals (FEAT-006)](#sos--stress-signals-feat-006)
   - [IoT Container Sensor Monitoring (FEAT-007)](#iot-container-sensor-monitoring-feat-007)
   - [Voice & Video Calls — LiveKit (FEAT-008)](#voice--video-calls--livekit-feat-008)
   - [Driver HR Profiles & Fleet Management (FEAT-010)](#driver-hr-profiles--fleet-management-feat-010)
   - [Trip Management (FEAT-011)](#trip-management-feat-011)
   - [ESG / CSRD Compliance Reports (FEAT-012)](#esg--csrd-compliance-reports-feat-012)
   - [Driver Behaviour Analysis (FEAT-013)](#driver-behaviour-analysis-feat-013)
   - [AI Camera Agent (FEAT-014)](#ai-camera-agent-feat-014)
7. [Real-Time Layer (Ably)](#real-time-layer-ably)
8. [Background Workers](#background-workers)
9. [Worker Auto-Start (Development)](#worker-auto-start-development)
10. [API Routes Reference](#api-routes-reference)
11. [Frontend Pages & Components](#frontend-pages--components)
12. [Hooks](#hooks)
13. [Lib Utilities](#lib-utilities)
14. [Schemas & Validation](#schemas--validation)
15. [Edge Middleware](#edge-middleware)
16. [Rate Limiting](#rate-limiting)
17. [Security Headers & CSP](#security-headers--csp)
18. [Environment Variables](#environment-variables)
19. [ESP32 Firmware](#esp32-firmware)
20. [Testing](#testing)
21. [Docker Services & Deployment](#docker-services--deployment)
22. [Scripts Reference](#scripts-reference)

---

## Tech Stack

| Layer | Technology | Version / Notes |
|---|---|---|
| Framework | Next.js App Router | 14.2.x — RSC + Route Handlers |
| Language | TypeScript | 5.x — strict mode |
| Auth | Auth.js (NextAuth v5 beta) | 5.0.0-beta.25 — Credentials provider, JWT sessions |
| Database | PostgreSQL | 16 — UUID PKs, pg enums, composite indexes |
| ORM | Drizzle ORM | 0.30.x — fully typed, zero-runtime query builder |
| DB Migrations | drizzle-kit | 0.21.x — SQL migration files in `db/migrations/` |
| Real-time pub/sub | Ably | v2 — server REST SDK + client Realtime SDK |
| WebRTC SFU | LiveKit | livekit-server-sdk + @livekit/components-react |
| Message broker | Apache Kafka (KRaft) | Confluent CP 7.4.0 — no ZooKeeper |
| Kafka client | KafkaJS | 2.2.x |
| Background jobs | BullMQ + Redis | 5.x — behaviour scoring & ESG generation queues |
| Cache | Redis | 7-alpine — OSRM LRU route cache (128 MB) |
| IoT broker | Eclipse Mosquitto | 2 — MQTT v5, QoS 1, password auth, LWT |
| Maps | Leaflet + react-leaflet | 1.9.x / 4.x |
| Routing engine | OSRM | Public API + Redis-backed result cache |
| Styling | Tailwind CSS | 3.4.x + CSS design tokens |
| UI primitives | Radix UI | various |
| Charts | Recharts | — |
| Animations | Framer Motion | 12.x |
| PDF generation | Puppeteer | headless Chromium — ESG reports |
| Email | Nodemailer | SMTP — ESG report dispatch |
| Validation | Zod | 3.23.x — all boundaries (env, API bodies, MQTT payloads) |
| Password hashing | bcryptjs | 2.4.x — cost factor 10 |
| Notifications | Sonner | 2.x toast system |
| Unit tests | Vitest | 1.6.x |
| E2E tests | Playwright | 1.44.x |
| Load tests | k6 | — |
| Containerisation | Docker + docker-compose | multi-service compose |
| Code quality | ESLint + Prettier | 8.x / 3.x |
| AI agent language | Python | 3.11 |
| Pose estimation | YOLOv8n-pose (Ultralytics) | CPU-only, ~30 ms/frame |
| Behaviour classifier | scikit-learn RandomForest | 98% F1 on drowsiness dataset |
| MQTT client (Python) | paho-mqtt | cam_agent ↔ Mosquitto |
| ESP32 framework | Arduino (PlatformIO) | DOIT ESP32 DEVKIT V1 |

---

## System Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          Browser (Client)                                │
│   React components + Leaflet + LiveKit components + Ably Realtime SDK   │
└───────────────┬──────────────────────────────────────┬───────────────────┘
                │ REST / multipart                     │ Ably Realtime (WSS)
                ▼                                      ▼
┌───────────────────────────────────┐    ┌─────────────────────────────────┐
│   Next.js 14 App Router (Node.js) │    │          Ably Channels           │
│   ├─ Route Handlers (app/api/)    │    │  user:<id>  drivers  stress:alerts│
│   ├─ requireAuth() / requireAdmin │    │  sensors:<id>  admin:behaviour   │
│   ├─ Zod validation on all bodies │    └─────────────────────────────────┘
│   ├─ Drizzle ORM → PostgreSQL 16  │                   ▲
│   ├─ Ably REST (ablyPublish)      │───────────────────┘
│   ├─ Kafka Producer (SOS path)    │
│   └─ BullMQ Producer (trip end)   │
└───┬───────────────────────────────┘
    │
    ├──► PostgreSQL 16 (primary store)
    ├──► Redis 7 (BullMQ jobs + OSRM route LRU cache)
    ├──► Kafka KRaft (trucknet.stress-signals topic)
    └──► LiveKit SFU (room management via REST SDK)

┌──────────────────────────────────────────────────────────────────────────┐
│                         Background Workers                               │
│                                                                          │
│  stress-signal-consumer   (Kafka → Ably fan-out to nearby drivers)      │
│  sensor-consumer          (MQTT Mosquitto → PostgreSQL + Ably)          │
│  behaviour-event-consumer (MQTT Mosquitto → PostgreSQL + Ably)          │
│  behaviour-report-worker  (BullMQ → score calculation → PostgreSQL)     │
│  gps-position-worker      (GPS stream → driving_events)                 │
│  driver-esg-report-worker (BullMQ → Puppeteer PDF + Nodemailer)         │
│  esg-report-scheduler     (cron-like → BullMQ job injection)            │
└──────────────────────────────────────────────────────────────────────────┘

┌────────────────────────┐    MQTT QoS 1    ┌────────────────────────────┐
│  ESP32 DEVKIT V1       │ ───────────────► │  Eclipse Mosquitto 2       │
│  DHT22 + MPU6050       │                  │  (password auth, LWT)      │
│  trucknet/sensors/+/   │ ◄─────────────── │                            │
└────────────────────────┘    LWT offline   └────────────┬───────────────┘
                                                         │ subscribed by
                                                         ▼
                                               sensor-consumer worker
                                               behaviour-event-consumer

┌────────────────────────┐    MQTT QoS 1    ┌────────────────────────────┐
│  cam_agent (Python)    │ ───────────────► │  Eclipse Mosquitto 2       │
│  YOLOv8n-pose +        │                  │  trucknet/drivers/+/       │
│  RandomForest          │                  │  behaviour                 │
│  (USB camera)          │                  └────────────┬───────────────┘
└────────────────────────┘                               │ subscribed by
                                                         ▼
                                               behaviour-event-consumer
```

### Key architectural decisions

| Decision | Rationale |
|---|---|
| **No persistent WebSocket server** | Ably handles all pub/sub. The Next.js process is fully stateless and can scale horizontally. |
| **Ably token auth** (`GET /api/auth/ably-token`) | Clients never see the raw API key. The server signs a `TokenRequest` scoped to the authenticated user's channel. |
| **Kafka for SOS** | SOS fan-out is fire-and-forget from the HTTP handler. A dedicated consumer handles haversine filtering, Ably delivery, retry (exponential backoff), and dead-letter queue. |
| **BullMQ for behaviour/ESG reports** | Report generation involves waiting 30 s for late cam_agent events, then CPU-intensive scoring. Deferring to BullMQ keeps the trip-end API response at <50 ms. |
| **MQTT over direct HTTP for IoT** | ESP32 firmware publishes over MQTT natively (PubSubClient). Mosquitto bridges to server workers at standard MQTT port 1883; no HTTP stack required on the device. |
| **Edge/Node split in auth** | `auth.config.ts` (callbacks only, no Node.js imports) is used by `middleware.ts` running in the Edge Runtime. `auth.ts` (imports bcryptjs + Drizzle) is used by API route handlers in the Node.js runtime. |
| **Fail-fast env validation** | `lib/env.ts` runs `EnvSchema.safeParse(process.env)` at module load. Any missing variable throws before the app binds to a port. |
| **Two Kafka listeners** | `INTERNAL://kafka:29092` for Docker-to-Docker traffic; `EXTERNAL://localhost:9092` for local `npm run dev`. |
| **Redis LRU for OSRM** | OSRM route geometry is expensive (HTTP call + JSON parse). Results are cached in Redis with a 10-minute TTL and a 128 MB LRU cap. |
| **`instrumentation.ts` auto-spawn** | In development the `NEXT_RUNTIME === "nodejs"` guard in `instrumentation.ts` imports `instrumentation.node.ts` which spawns `behaviour-event-consumer` and `behaviour-report-worker` as child processes, restarting them after crashes. |

---

## Directory Structure

```
TruckNet/
├── app/                                # Next.js App Router root
│   ├── globals.css                     # Design system CSS variables + base styles
│   ├── layout.tsx                      # Root layout (Providers, Sonner Toaster, fonts)
│   ├── page.tsx                        # Landing page → redirect to /dashboard or /login
│   ├── (auth)/                         # Public auth pages (no layout chrome)
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── (protected)/                    # Driver-facing pages
│   │   ├── layout.tsx                  # Navbar + BottomNav + CallStateWrapper + SosAlertListener
│   │   ├── dashboard/page.tsx
│   │   ├── map/page.tsx                # Leaflet fleet map
│   │   ├── calls/[roomName]/page.tsx   # LiveKit call room (?type=voice|video)
│   │   ├── friends/page.tsx
│   │   ├── messages/page.tsx
│   │   ├── profile/page.tsx
│   │   ├── stress/page.tsx             # SOS broadcast UI
│   │   └── trips/page.tsx
│   ├── (admin)/admin/                  # Admin-only pages (role-guarded in layout)
│   │   ├── page.tsx                    # Fleet operations dashboard
│   │   ├── layout.tsx                  # AdminSidebar with live badge counts
│   │   ├── sos/page.tsx                # SSE-powered SOS stream
│   │   ├── calls/page.tsx              # Fleet call history
│   │   ├── calls/[roomName]/page.tsx   # Call detail view
│   │   ├── drivers/page.tsx            # Driver list with search
│   │   ├── drivers/[driverId]/page.tsx # Tabbed driver detail (profile/trips/shifts/maintenance/training/ESG)
│   │   ├── drivers/[driverId]/trips/[tripId]/page.tsx  # Trip detail + behaviour report
│   │   ├── drivers/schedule/page.tsx
│   │   ├── drivers/esg-reports/page.tsx
│   │   ├── messages/page.tsx           # Admin message reader
│   │   ├── messages/[driverId]/page.tsx
│   │   ├── sensors/page.tsx            # IoT device grid
│   │   ├── sensors/[deviceId]/page.tsx # Device detail + readings chart
│   │   ├── behaviour/page.tsx          # Fleet safety ranking
│   │   └── behaviour/config/page.tsx   # Scoring thresholds editor
│   └── api/                            # All Route Handlers
│       ├── auth/                       # register, ably-token, socket-token, [...nextauth]
│       ├── calls/                      # initiate, token/[roomName], [roomName], decline
│       ├── cam-agent/session/          # Email → UUID + short-lived token for MQTT auth
│       ├── drivers/                    # location, nearby, route, active-trip, profile,
│       │                               # shifts, maintenance, training, trips, behaviour-summary,
│       │                               # fleet-esg-summary, esg-reports
│       ├── esg-report-schedules/       # CRUD schedule management
│       ├── friends/                    # list, request, [id]/accept|reject|location
│       ├── geocode/                    # Reverse geocode proxy
│       ├── health/                     # Liveness probe
│       ├── profile/                    # GET + PATCH profile, upload-avatar
│       ├── stress-signals/             # POST, GET active, PATCH resolve
│       ├── text-messages/              # POST, GET conversations, PATCH read
│       ├── trips/                      # POST start, GET list, PATCH status
│       ├── upload/audio/               # Multipart voice message audio
│       ├── users/                      # me, by-tag
│       ├── voice-messages/             # POST, GET, PATCH status
│       └── admin/                      # stats, drivers (list+live+route), sos (SSE+resolve),
│                                       # calls, routes/active, sensors (CRUD+readings+thresholds+alerts),
│                                       # behaviour (fleet+config)
│
├── components/
│   ├── Providers.tsx                   # SessionProvider + AblyProvider wrapper
│   ├── calls/
│   │   ├── CallButton.tsx              # Initiates LiveKit call via API
│   │   ├── IncomingCallModal.tsx       # Ably call_incoming → modal with accept/decline
│   │   ├── VoiceCallRoom.tsx           # LiveKit audio-only room UI
│   │   └── VideoCallRoom.tsx           # LiveKit video room UI
│   ├── drivers/
│   │   ├── ActiveTripCard.tsx          # Driver's current trip summary card
│   │   └── DriverCard.tsx
│   ├── layout/
│   │   ├── Navbar.tsx
│   │   ├── BottomNav.tsx               # Mobile bottom navigation
│   │   └── LiveConnectionBadge.tsx     # Ably connection state indicator
│   ├── map/
│   │   ├── DriverMap.tsx               # react-leaflet map with driver pins
│   │   ├── RouteSetupModal.tsx         # OSRM destination picker
│   │   └── RouteInfoBar.tsx            # Active route ETA overlay
│   ├── messages/
│   │   ├── FriendsSidebar.tsx
│   │   └── ChatPanel.tsx               # Text + voice message thread
│   ├── stress/
│   │   └── SosAlertListener.tsx        # Ably subscriber → Sonner toast on stress_signal_alert
│   ├── admin/
│   │   ├── AdminSidebar.tsx            # Nav with live SOS/sensor/behaviour badge counts
│   │   ├── StatsBar.tsx                # KPI strip: drivers online, active SOS, calls today…
│   │   ├── FleetMap.tsx                # Admin Leaflet map (all drivers + routes)
│   │   ├── SosPanel.tsx                # Active SOS cards with resolve button
│   │   ├── DriverTable.tsx             # Paginated driver list
│   │   ├── CallHistoryTable.tsx
│   │   ├── AdminConversationList.tsx
│   │   ├── AdminConversationThread.tsx
│   │   ├── RouteInfoPanel.tsx
│   │   ├── drivers/
│   │   │   ├── DriverProfileForm.tsx
│   │   │   ├── ShiftLogForm.tsx / ShiftLogTable.tsx
│   │   │   ├── MaintenanceLogForm.tsx / MaintenanceLogTable.tsx
│   │   │   ├── TrainingLogForm.tsx / TrainingLogTable.tsx
│   │   │   ├── TripLogForm.tsx / TripLogTable.tsx
│   │   │   ├── CertificationAlertBadge.tsx
│   │   │   ├── EsgDashboardWidgets.tsx
│   │   │   ├── EsgReportKpiGrid.tsx
│   │   │   ├── EsgReportScheduleForm.tsx
│   │   │   ├── GenerateEsgReportModal.tsx
│   │   │   └── FleetEsgBenchmarkChart.tsx
│   │   ├── behaviour/
│   │   │   ├── BehaviourAlertBanner.tsx
│   │   │   ├── BehaviourDashboardWidget.tsx
│   │   │   ├── BehaviourReportCard.tsx
│   │   │   ├── DriveScoreGauge.tsx
│   │   │   ├── EventTimeline.tsx
│   │   │   ├── EventTypeBadge.tsx
│   │   │   ├── FleetSafetyRanking.tsx
│   │   │   └── ScoreBreakdownBar.tsx
│   │   └── sensors/
│   │       ├── DeviceStatusDot.tsx
│   │       ├── VibrationIndicator.tsx
│   │       ├── SensorGauge.tsx
│   │       ├── SensorSparkline.tsx
│   │       ├── SensorAlertCard.tsx / SensorAlertPanel.tsx
│   │       ├── SensorDeviceCard.tsx
│   │       └── SensorDeviceGrid.tsx
│   └── ui/                             # Radix-based design-system primitives
│
├── db/
│   ├── index.ts                        # Drizzle client singleton (DATABASE_URL)
│   ├── schema.ts                       # All pgTable definitions + enums + indexes
│   └── migrations/                     # SQL migration files (drizzle-kit generate)
│
├── hooks/
│   ├── useSocket.ts                    # Creates Ably.Realtime, subscribes, exposes `channel.subscribe`
│   ├── useSocket.tsx                   # React context variant
│   ├── useCallState.tsx                # Global call state context (active room, call type)
│   ├── useVoiceRecorder.ts             # MediaRecorder wrapper (start/stop/upload)
│   ├── useAdminSosStream.ts            # EventSource hook consuming GET /api/admin/sos/stream (SSE)
│   └── useLiveKitRoom.ts               # LiveKit room connection lifecycle
│
├── lib/
│   ├── ably-server.ts                  # Singleton Ably.Rest + ablyPublish(channel, event, data)
│   ├── api.ts                          # Typed fetch wrappers used by client components
│   ├── auth-helpers.ts                 # requireAuth() → session or 401; requireAdmin() → 403
│   ├── behaviour/
│   │   ├── behaviour-report-queue.ts   # BullMQ queue + enqueueReport(tripId)
│   │   ├── esp32-classifier.ts         # Classifies raw accel magnitude → event type
│   │   ├── gps-classifier.ts           # Classifies GPS speed vs speed limit → speed_violation
│   │   ├── score-calculator.ts         # Computes 5-dimension score from driving_events rows
│   │   └── speed-limit-lookup.ts       # Resolves speed limit for a GPS coordinate
│   ├── driver-esg-aggregator.ts        # Joins trips/shifts/maintenance/training/sensors → ESG KPIs
│   ├── driver-esg-csv.ts               # ESG KPIs → CSV string
│   ├── driver-esg-html-template.ts     # ESG KPIs → HTML string for Puppeteer
│   ├── driver-esg-pdf.ts               # Launches Puppeteer, renders HTML → PDF Buffer
│   ├── esg-email.ts                    # Nodemailer transporter + sendEsgReport()
│   ├── env.ts                          # Zod-validated env export (throws on startup if invalid)
│   ├── haversine.ts                    # haversineDistanceKm(lat1,lng1,lat2,lng2) pure function
│   ├── kafka.ts                        # Singleton KafkaJS client + getProducer() / getAdmin()
│   ├── kafka-topics.ts                 # Topic name constants (STRESS_SIGNALS, DLQ)
│   ├── kafka-init.ts                   # Idempotent topic creation run once at startup
│   ├── livekit-server.ts               # getRoomService() + generateLiveKitToken(room, identity)
│   ├── osrm.ts                         # getRoute(origin, destination) → GeoJSON geometry
│   ├── rate-limit.ts                   # Fixed-window in-memory RateLimiter class
│   ├── redis.ts                        # Singleton ioredis client (REDIS_URL)
│   ├── route-cache.ts                  # Redis-backed OSRM route cache (10-min TTL, 128 MB LRU)
│   ├── sensor-thresholds.ts            # Default threshold constants + applyThresholds()
│   ├── stress-signal-expiry.ts         # Auto-resolve stale SOS signals
│   ├── utils.ts                        # cn() — clsx + tailwind-merge
│   ├── validate-uuid.ts                # validateUuid(param) → string | NextResponse 400
│   ├── validate.ts                     # Generic Zod parse helper
│   └── admin-sos-stream.ts             # SSE stream helper for active SOS alerts
│
├── workers/
│   ├── stress-signal-consumer.ts       # Kafka consumer → haversine filter → Ably fan-out
│   ├── sensor-consumer.ts              # MQTT sub → DB writes + sensor alert evaluation
│   ├── behaviour-event-consumer.ts     # MQTT sub → driving_events + Ably critical alert
│   ├── behaviour-report-worker.ts      # BullMQ worker → score-calculator → behaviour_reports
│   ├── gps-position-worker.ts          # Called from /api/drivers/location → speed/idle events
│   ├── driver-esg-report-worker.ts     # BullMQ worker → aggregator → PDF/CSV → email
│   └── esg-report-scheduler.ts        # Polls esg_report_schedules, enqueues BullMQ jobs
│
├── cam_agent/                          # Python ML inference agent (cab laptop)
│   ├── live_test.py                    # Pygame visual test (no MQTT/server needed)
│   ├── requirements.txt
│   ├── README.md
│   ├── inference/
│   │   ├── inference_agent.py          # Entry point (--auto | --trip-id <id>)
│   │   ├── ear_calculator.py           # Eye Aspect Ratio from YOLO keypoints
│   │   ├── head_pose.py                # Head yaw from nose/ear keypoints
│   │   ├── event_publisher.py          # paho-mqtt MQTT publish
│   │   └── event_state.py              # State machine: onset → sustained → published
│   ├── training/
│   │   ├── train.py                    # Multi-model training + cross-validation
│   │   └── prepare_dataset.py          # YOLO keypoint extraction from image datasets
│   ├── models/
│   │   ├── yolov8n-pose.pt             # YOLOv8n-pose weights
│   │   └── drowsiness_mlp.pkl          # Serialised RandomForest (98% F1)
│   ├── config/config.yaml              # Thresholds, MQTT broker, camera device index
│   └── docs/
│       ├── SETUP.md
│       └── DATASET_GUIDE.md
│
├── esp32/                              # Embedded firmware (PlatformIO / Arduino)
│   ├── platformio.ini
│   ├── src/
│   │   ├── main.ino                    # Setup + loop, hardware watchdog, OTA
│   │   ├── config.h                    # WiFi SSID, MQTT broker URL, device ID
│   │   ├── sensors.cpp                 # DHT22 + MPU6050 read functions
│   │   └── mqtt_client.cpp             # PubSubClient connection + publish helpers
│   ├── config/credentials.example.h   # Template for WiFi/MQTT credentials
│   └── docs/
│       ├── SETUP.md
│       ├── WIRING.md
│       └── PAYLOAD_SPEC.md
│
├── schemas/                            # Zod schemas (shared server + worker)
├── sockets/                            # Socket utility modules
├── __tests__/                          # Vitest unit tests
│   ├── setup.ts
│   ├── api/
│   ├── lib/
│   ├── schemas/
│   └── sockets/
├── e2e/                                # Playwright E2E tests
│   ├── auth.spec.ts
│   └── smoke.spec.ts
├── load-tests/k6-script.js             # k6 load test script
├── docker/
│   ├── mosquitto/mosquitto.conf        # Mosquitto config (password file, persistence, WS)
│   └── livekit/                        # LiveKit server config
├── auth.ts                             # NextAuth with Credentials provider (Node.js only)
├── auth.config.ts                      # NextAuth callbacks (Edge-safe — no Node.js imports)
├── middleware.ts                       # Edge middleware: rate limit + auth guard
├── instrumentation.ts                  # Next.js hook: guards Node.js runtime import
├── instrumentation.node.ts             # Spawns behaviour workers as child processes
├── drizzle.config.ts                   # Drizzle-kit config (schema path, migrations dir)
├── next.config.mjs                     # Next.js config (security headers, instrumentation hook)
├── docker-compose.yml                  # All 14 services
├── Dockerfile                          # app service image
├── Dockerfile.worker                   # Worker services image (tsx runtime)
└── Dockerfile.esg-worker               # ESG worker image (includes Puppeteer/Chromium)
```

---

## Database Schema

All tables are defined in `db/schema.ts` using Drizzle ORM. Primary keys are `uuid` with `defaultRandom()`. Foreign keys use `ON DELETE CASCADE` for child records and `ON DELETE SET NULL` for nullable references. PostgreSQL native enums are declared with `pgEnum`.

### PostgreSQL enums

| Enum | Values |
|---|---|
| `user_role` | `driver`, `admin` |
| `voice_message_status` | `delivered`, `listened` |
| `text_message_status` | `delivered`, `read` |
| `stress_signal_status` | `active`, `resolved` |
| `friend_request_status` | `pending`, `accepted`, `rejected` |
| `call_status` | `ongoing`, `completed`, `missed`, `declined` |
| `call_type` | `voice`, `video` |
| `route_status` | `active`, `completed`, `cancelled` |
| `trip_status` | `active`, `completed`, `cancelled` |
| `fuel_type` | `diesel`, `petrol`, `lpg`, `electric`, `hydrogen`, `cng`, `other` |
| `contract_type` | `cdi`, `cdd`, `interim`, `apprenticeship`, `other` |
| `maintenance_type` | `oil_change`, `tire_replacement`, `brake_service`, `technical_inspection`, `filter_replacement`, `battery`, `bodywork`, `fuel_fill`, `other` |
| `training_type` | `license_renewal`, `adr_certification`, `eco_driving`, `defensive_driving`, `first_aid`, `cargo_handling`, `digital_tools`, `other` |
| `esg_period_type` | `weekly`, `monthly`, `quarterly`, `custom` |
| `report_status` | `generating`, `ready`, `failed` |
| `event_type` | `speed_violation`, `harsh_braking`, `harsh_acceleration`, `sudden_swerve`, `drowsiness_alert`, `microsleep_alert`, `distraction_alert`, `idle_excess`, `sos_triggered` |
| `event_severity` | `low`, `medium`, `high`, `critical` |
| `event_source` | `gps`, `esp32`, `ai_camera`, `driver` |
| `device_status` | `online`, `offline`, `unknown` |
| `sensor_alert_type` | `temp_high`, `temp_low`, `humidity_high`, `vibration_high` |
| `sensor_alert_status` | `active`, `acknowledged` |

### Core tables

| Table | Key columns | Notes |
|---|---|---|
| `users` | `id`, `name`, `email` (UNIQUE), `password_hash`, `tag` (UNIQUE), `tag_number`, `profile_image_url`, `role` | `tag` = `name#1234` format. Index on `role`. |
| `driver_locations` | `id`, `user_id` (FK→users), `latitude`, `longitude`, `updated_at` | Upserted on every GPS broadcast. One row per driver. |
| `driver_routes` | `id`, `driver_id` (FK→users), `origin_lat/lng`, `destination_lat/lng`, `destination_label`, `route_geometry` (JSON GeoJSON), `distance_meters`, `duration_seconds`, `status` | GeoJSON stored as JSON column for Leaflet polyline rendering. |
| `text_messages` | `id`, `sender_id`, `receiver_id` (FK→users), `content`, `status`, `created_at` | Composite index on `(sender_id, receiver_id)`. |
| `voice_messages` | `id`, `sender_id`, `receiver_id` (FK→users), `audio_url`, `duration_seconds`, `status`, `created_at` | Audio files served from `public/uploads/`. |
| `stress_signals` | `id`, `user_id` (FK→users), `latitude`, `longitude`, `status`, `created_at` | Composite index on `(status, created_at)` for fast active-signal queries. |
| `friend_requests` | `id`, `sender_id`, `receiver_id` (FK→users), `status`, `created_at` | UNIQUE constraint on `(sender_id, receiver_id)`. |
| `call_history` | `id`, `room_name` (UNIQUE), `caller_id`, `callee_id` (FK→users), `call_type`, `status`, `started_at`, `ended_at`, `duration_seconds`, `created_at` | `room_name` = LiveKit room identifier. |

### Fleet & IoT tables

| Table | Key columns | Notes |
|---|---|---|
| `iot_devices` | `id`, `device_id` (UNIQUE text), `truck_label`, `status`, `driver_id` (FK→users nullable), `last_seen_at`, `firmware_version`, `alert_config` (JSON) | `alert_config` stores per-device threshold overrides. |
| `sensor_readings` | `id`, `device_id` (FK→iot_devices), `temperature_c`, `humidity_pct`, `vibration_magnitude`, `accel_x/y/z`, `recorded_at` | High-volume time-series. Index on `(device_id, recorded_at)`. ~1 row per 5 s per device. |
| `sensor_alerts` | `id`, `device_id`, `driver_id`, `alert_type`, `value`, `threshold`, `status`, `triggered_at`, `acked_by`, `acked_at` | Deduplication: a new alert is only raised if no `active` alert of the same type+device exists. |

### HR & trip tables

| Table | Key columns | Notes |
|---|---|---|
| `transport_trips` | `id`, `driver_id`, `route_id` (FK nullable), `vehicle_plate`, `origin/destination_label`, `distance_km`, `duration_minutes`, `fuel_liters`, `fuel_type`, `cargo_weight_kg`, `is_empty_run`, `load_factor_pct`, `started_at`, `completed_at`, `status`, `behaviour_report_id` (FK nullable), `created_by` | `is_empty_run` and `load_factor_pct` feed GHG intensity calculations in ESG reports. |
| `driver_profiles` | `id`, `driver_id` (FK UNIQUE), `gender`, `birth_year`, `nationality`, `contract_type`, `contract_start/end_date`, `weekly_hours_contractual`, `driving_license_categories` (JSON string[]), `license_obtained_year` | 1-to-1 with `users` where `role = driver`. |
| `driver_shifts` | `id`, `driver_id`, `trip_id` (FK nullable), `shift_date`, `started_at`, `ended_at`, `break_minutes`, `driving_minutes`, `overtime_minutes`, `night_shift`, `status` | Indexes on `driver_id`, `shift_date`, `(driver_id, shift_date)`. |
| `vehicle_maintenance_logs` | `id`, `driver_id`, `vehicle_plate`, `maintenance_type`, `performed_at`, `odometer_km`, `cost_eur`, `fuel_liters`, `fuel_type`, `provider_name`, `next_due_at/km`, `regulatory_compliant` | Feeds ESG `maintenance_count` metric and compliance checks. |
| `driver_training_records` | `id`, `driver_id`, `training_type`, `title`, `provider`, `completed_at`, `duration_hours`, `cost_eur`, `certification_number`, `expiry_date`, `passed` | Index on `expiry_date` for expiring-cert alert queries. |

### ESG & behaviour tables

| Table | Key columns | Notes |
|---|---|---|
| `driver_esg_reports` | `id`, `driver_id`, `period_type`, `period_start/end`, `total_trips`, `empty_run_count`, `empty_run_pct`, `total_distance_km`, `total_driving_hours`, `total_shift_hours`, `total_overtime_hours`, `total_fuel_liters`, `total_ghg_kgco2eq`, `ghg_intensity_per_km`, `ghg_intensity_per_tonne_km`, `incident_count`, `cargo_breach_count`, `avg_cargo_temp_c`, `maintenance_count`, `training_hours`, `certifications_count`, `expiring_certifications_count`, `trip_ids/shift_ids/… (JSON)`, `status`, `error_message`, `generated_at` | Aligned to ESRS E1, E5, G1, S1-7, S1-12, S1-13. Generated by `driver-esg-report-worker`. |
| `esg_report_schedules` | `id`, `period_type`, `active`, `hr_email`, `language`, `next_run_at`, `last_run_at`, `last_run_report_count` | Scheduler polls this table; updates `next_run_at` after each run. |
| `driving_events` | `event_id`, `driver_id`, `trip_id` (FK), `event_type`, `severity`, `source`, `occurred_at`, `duration_seconds`, `gps_lat/lng`, `gps_speed_kmh`, `speed_limit_kmh`, `speed_excess_kmh`, `vibration_magnitude`, `accel_x/y/z`, `ear_value`, `head_angle_deg`, `confidence`, `idle_duration_minutes`, `metadata` (JSON) | Immutable append-only event log from all three sources (GPS, ESP32, AI camera). |
| `behaviour_reports` | `behaviour_report_id`, `driver_id`, `trip_id` (UNIQUE FK), `global_score`, `speed_score`, `driving_style_score`, `fatigue_score`, `idle_score`, `speed_violation_count`, `max_speed_recorded_kmh`, `harsh_braking_count`, `harsh_acceleration_count`, `sudden_swerve_count`, `drowsiness_alert_count`, `microsleep_alert_count`, `distraction_alert_count`, `idle_excess_count`, `total_idle_minutes`, `sos_count`, `total_events`, `critical_events`, `trip_distance_km`, `trip_duration_hours`, `events_per_100km`, `status`, `admin_reviewed`, `admin_note` | One report per trip. Score range 0–100. |
| `behaviour_scoring_config` | `config_id`, threshold columns for g-forces/EAR/head-angle/durations, weight columns for each of the 5 dimensions, deduction columns | Single-row table. System defaults used when empty. Editable by admins at `/admin/behaviour/config`. |

---

## Authentication & RBAC

### Provider and session

- **Provider**: Credentials (email + bcrypt password verification, cost factor 10)
- **Session strategy**: JWT — `maxAge` 30 days
- **Session payload**: `{ user: { id: string, name: string, email: string, role: 'driver' | 'admin' } }`
- **Admin registration**: gated by `ADMIN_INVITE_CODE` env var (min 8 chars). Absence of the var disables admin self-registration entirely.

### Edge/Node split

Auth.js v5 requires a strict split because `middleware.ts` runs in the Edge Runtime which cannot import Node.js modules:

| File | Runtime | Purpose |
|---|---|---|
| `auth.config.ts` | Edge-safe | `jwt`, `session`, `authorized` callbacks only. No bcryptjs, no Drizzle. |
| `auth.ts` | Node.js only | Imports Drizzle + bcryptjs for the Credentials provider `authorize()` function. |

`middleware.ts` imports `NextAuth(authConfig)` (Edge-safe). API route handlers import `auth` from `auth.ts` (Node.js).

### Route protection

- **`middleware.ts`** (Edge): protects `/dashboard`, `/map`, `/messages`, `/stress`, `/trips`, `/calls/*`, `/friends`, `/profile`. Unauthenticated requests are redirected to `/login`.
- **`requireAuth()`** (`lib/auth-helpers.ts`): called in every API handler — reads the session, returns the user object or throws a 401 response.
- **`requireAdmin()`** (`lib/auth-helpers.ts`): extends `requireAuth()` — additionally throws 403 if `user.role !== 'admin'`.
- **Admin layout** (`app/(admin)/admin/layout.tsx`): server component that calls `requireAdmin()`, redirecting non-admins before rendering.

---

## Feature Deep-Dives

### GPS Tracking & Fleet Map (FEAT-004)

**Data flow:**

```
Driver browser
  └─ POST /api/drivers/location  { latitude, longitude }
       ├─ Upsert driver_locations (ON CONFLICT user_id DO UPDATE)
       ├─ Query all drivers within 50 km (Haversine in SQL + lib/haversine.ts)
       ├─ ablyPublish("user:<driverId>", "nearby_driver_update", nearbyList)
       │    ← personalised per-driver (each driver gets only their nearby peers)
       └─ gps-position-worker.processPosition()
            ├─ speed-limit-lookup (GPS coordinate → speed limit)
            ├─ If speed > limit + threshold → INSERT driving_events (speed_violation)
            └─ If delta from last position ≈ 0 for N minutes → INSERT driving_events (idle_excess)
```

- GPS broadcast interval: 20 seconds (client-side `setInterval`)
- Nearby radius: 50 km Haversine
- OSRM route results are cached in Redis with `route-cache.ts` — key = `route:{originLat},{originLng},{destLat},{destLng}`, TTL = 10 min
- Admin fleet map subscribes to the `drivers` channel and receives `driver_location_updated` events pushed by the same location handler

### Messaging — Text & Voice (FEAT-005)

**Text messages:**

- `POST /api/text-messages` — inserts to `text_messages` (status = `delivered`), then `ablyPublish("user:<receiverId>", "text_message_received", message)`
- `PATCH /api/text-messages/[id]/read` — sets status = `read`
- Conversation view: `GET /api/text-messages/conversations` returns the last message per friend pair

**Voice messages:**

1. `useVoiceRecorder.ts` wraps `MediaRecorder` API — records in `audio/webm` or `audio/ogg`
2. `POST /api/upload/audio` — multipart upload, saves to `public/uploads/<uuid>.webm`, returns URL
3. `POST /api/voice-messages` — inserts metadata row, `ablyPublish("user:<receiverId>", "voice_message_received", { audioUrl, durationSeconds })`
4. `ChatPanel.tsx` renders `<audio>` elements inline with duration display and playback controls
5. `PATCH /api/voice-messages/[id]/status` — sets status = `listened` when playback starts

### SOS / Stress Signals (FEAT-006)

**Publish path (HTTP handler → Kafka):**

```
POST /api/stress-signals
  ├─ Rate limit check: 3 req / 10 min / user (middleware)
  ├─ INSERT stress_signals (status = active)
  ├─ If KAFKA_ENABLED=true:
  │    └─ kafka producer.send({ topic: "trucknet.stress-signals", messages: [{ value: JSON }] })
  └─ Else (dev fallback):
       └─ ablyPublish("stress:alerts", "stress_signal_alert", signal)  ← direct
```

**Consumer path (worker → Ably):**

```
stress-signal-consumer.ts
  ├─ KafkaJS consumer.run({ eachMessage })
  ├─ Parse + validate message with Zod
  ├─ Query all drivers within 50 km of SOS origin (Haversine)
  ├─ For each nearby driver:
  │    └─ ablyPublish("user:<driverId>", "stress_signal_alert", signal)
  ├─ ablyPublish("stress:alerts", "stress_signal_alert", signal)  ← admin broadcast
  ├─ On failure: retry with exponential backoff (max 3 attempts)
  └─ After max retries: produce to "trucknet.stress-signals.dlq"
```

**SosAlertListener** (`components/stress/SosAlertListener.tsx`) subscribes to `user:<userId>` and displays a Sonner toast with the sender's name and distance.

**Admin SSE stream** (`GET /api/admin/sos/stream`): uses `admin-sos-stream.ts` to push server-sent events to `useAdminSosStream.ts` hook, which feeds the `SosPanel` component with live updates without polling.

### IoT Container Sensor Monitoring (FEAT-007)

**ESP32 → Mosquitto → sensor-consumer → DB + Ably:**

```
ESP32 (every 5 s):
  └─ MQTT publish "trucknet/sensors/<deviceId>/readings" QoS 1
       payload: { device_id, temperature_c, humidity_pct,
                  vibration_magnitude, accel_x, accel_y, accel_z, timestamp }

sensor-consumer.ts:
  ├─ mqttClient.subscribe("trucknet/sensors/+/readings")
  ├─ mqttClient.subscribe("trucknet/sensors/+/status")  ← LWT + heartbeat
  ├─ Zod validation on every message (malformed → logged + dropped)
  ├─ INSERT sensor_readings
  ├─ Upsert iot_devices.last_seen_at + status = 'online'
  ├─ Evaluate thresholds (lib/sensor-thresholds.ts):
  │    threshold sources: per-device alert_config JSON → fallback to global defaults
  │    alert types: temp_high, temp_low, humidity_high, vibration_high
  │    deduplication: only insert sensor_alerts if no active alert of same type+device
  ├─ ablyPublish("sensors:<deviceId>", "sensor_reading", reading)
  └─ ablyPublish("admin:sensors", "fleet_sensor_update", { deviceId, reading })
       + "sensor_alert" if threshold crossed
```

**LWT (Last Will & Testament):** each ESP32 connects with `will_topic = "trucknet/sensors/<deviceId>/status"` and `will_payload = '{"status":"offline"}'`. Mosquitto auto-publishes this on unclean disconnect — the consumer updates `iot_devices.status = 'offline'` and notifies admin via Ably.

### Voice & Video Calls — LiveKit (FEAT-008)

**Call initiation flow:**

```
Caller: POST /api/calls/initiate  { calleeId, callType }
  ├─ Verify caller & callee are friends (friend_requests table)
  ├─ Create LiveKit room (livekit-server-sdk RoomServiceClient)
  ├─ Generate caller JWT (8 h TTL, scoped to room)
  ├─ Generate callee JWT (8 h TTL, scoped to room)
  ├─ INSERT call_history (status = ongoing)
  ├─ ablyPublish("user:<calleeId>", "call_incoming",
  │    { roomName, callerName, callerAvatar, callType, calleeToken })
  └─ Return { roomName, token, callType } to caller

Callee: Receives "call_incoming" via Ably → IncomingCallModal appears
  ├─ Accept → navigate to /calls/<roomName>?type=<callType>
  └─ Decline → POST /api/calls/<roomName>/decline
                  └─ ablyPublish("user:<callerId>", "call_declined", …)
                     UPDATE call_history.status = 'declined'
```

**In-call:** `VoiceCallRoom.tsx` / `VideoCallRoom.tsx` use `@livekit/components-react` — the `LiveKitRoom` component connects to the LiveKit SFU using the pre-generated JWT from `GET /api/calls/token/[roomName]`.

**Call end:** LiveKit webhooks or client-side disconnect → `DELETE /api/calls/[roomName]` → `duration_seconds` calculated, `status = completed`, `ablyPublish("user:<*>", "call_ended", …)`.

### Driver HR Profiles & Fleet Management (FEAT-010)

The admin driver detail page (`/admin/drivers/[driverId]`) is a tabbed interface:

| Tab | Data source | API |
|---|---|---|
| Profile | `driver_profiles` | `GET/PATCH /api/drivers/[driverId]/profile` |
| Trips | `transport_trips` | `GET /api/drivers/[driverId]/trips` |
| Shifts | `driver_shifts` | `GET/POST /api/drivers/[driverId]/shifts` |
| Maintenance | `vehicle_maintenance_logs` | `GET/POST /api/drivers/[driverId]/maintenance` |
| Training | `driver_training_records` | `GET/POST /api/drivers/[driverId]/training` |
| ESG Report | `driver_esg_reports` | `GET /api/drivers/esg-reports` |

`CertificationAlertBadge.tsx` queries `GET /api/drivers/[driverId]/training/expiring` — returns training records with `expiry_date` within 30 days — and renders a badge on the driver list row.

### Trip Management (FEAT-011)

**Trip lifecycle:**

```
POST /api/trips  { vehiclePlate, originLabel, destinationLabel, fuelType, cargoWeightKg, loadFactorPct }
  ├─ INSERT transport_trips (status = active, started_at = NOW())
  └─ Return trip

PATCH /api/trips/[tripId]/status  { status: "completed" | "cancelled" }
  ├─ UPDATE transport_trips
  ├─ If completed:
  │    └─ enqueueReport(tripId)  ← lib/behaviour/behaviour-report-queue.ts
  │         └─ BullMQ: add job to "behaviour-reports" queue
  └─ Return updated trip
```

The `ActiveTripCard.tsx` component on the driver dashboard polls `GET /api/drivers/[driverId]/active-trip` and displays the live route progress. When no active trip exists the card renders a "Start Trip" prompt.

### ESG / CSRD Compliance Reports (FEAT-012)

**Generation flow:**

```
BullMQ job "behaviour-reports" (triggered by trip completion or manual admin trigger):
  └─ driver-esg-report-worker.ts
       ├─ UPDATE driver_esg_reports (status = generating)
       ├─ lib/driver-esg-aggregator.ts
       │    ├─ JOIN transport_trips WHERE period_start ≤ started_at ≤ period_end
       │    ├─ JOIN driver_shifts (overtime_minutes, night_shift)
       │    ├─ JOIN vehicle_maintenance_logs (maintenance_count, fuel_fills)
       │    ├─ JOIN driver_training_records (training_hours, certifications)
       │    ├─ JOIN sensor_readings (avg_cargo_temp_c, cargo_breach_count)
       │    └─ Compute: total_ghg_kgco2eq = Σ(fuel_liters × emission_factor[fuel_type])
       │                ghg_intensity_per_km = total_ghg / total_distance_km
       │                ghg_intensity_per_tonne_km = total_ghg / (distance × cargo_weight_t)
       ├─ lib/driver-esg-html-template.ts → HTML string with KPI tables + charts
       ├─ lib/driver-esg-pdf.ts → Puppeteer.launch() → page.setContent(html) → page.pdf()
       ├─ lib/driver-esg-csv.ts → CSV string
       ├─ UPDATE driver_esg_reports (status = ready, generated_at = NOW())
       └─ lib/esg-email.ts → Nodemailer.sendMail({ to: hr_email, attachments: [pdf, csv] })
```

**CSRD alignment:**

| ESRS Reference | Metric |
|---|---|
| E1 (GHG emissions) | `total_ghg_kgco2eq`, `ghg_intensity_per_km`, `ghg_intensity_per_tonne_km` |
| E5 (circular economy) | `empty_run_count`, `empty_run_pct` |
| G1 (anti-corruption) | `incident_count`, `work_stoppage_count` |
| S1-7 (working time) | `total_driving_hours`, `total_overtime_hours`, `night_shift` count |
| S1-12 (diversity) | Driver `gender`, `nationality` (from `driver_profiles`) |
| S1-13 (training & development) | `training_hours`, `certifications_count`, `expiring_certifications_count` |

**Scheduled generation:** `esg-report-scheduler.ts` polls `esg_report_schedules` every minute, enqueues a BullMQ job for every active driver when `next_run_at ≤ NOW()`, then updates `next_run_at` based on `period_type`.

### Driver Behaviour Analysis (FEAT-013)

**Event sources and ingestion:**

| Source | Transport | Consumer | Event types |
|---|---|---|---|
| GPS worker | Called from `/api/drivers/location` | `gps-position-worker.ts` | `speed_violation`, `idle_excess` |
| ESP32 accelerometer | MQTT `trucknet/drivers/+/behaviour` | `behaviour-event-consumer.ts` | `harsh_braking`, `harsh_acceleration`, `sudden_swerve` |
| AI camera agent | MQTT `trucknet/drivers/+/behaviour` | `behaviour-event-consumer.ts` | `drowsiness_alert`, `microsleep_alert`, `distraction_alert` |

All three sources write to `driving_events` with the same schema. The `source` column distinguishes origin.

**Scoring (on trip completion):**

`behaviour-report-worker.ts` waits 30 s (configurable) after job creation to absorb late events, then calls `lib/behaviour/score-calculator.ts`:

```
global_score = (
  speed_score        × weight_speed          (default 25%)
  + driving_style    × weight_driving_style  (default 20%)
  + fatigue_score    × weight_fatigue        (default 30%)
  + idle_score       × weight_idle           (default 10%)
  + sos_score        × weight_sos            (default 15%)
)
```

Each sub-score starts at 100 and deducts points per event count and severity, using thresholds from `behaviour_scoring_config`. The final `global_score` (0–100) determines the fleet safety ranking.

**Critical event alerts:** when `behaviour-event-consumer.ts` receives an event with `severity = 'critical'` or `'high'`, it immediately publishes to `ablyPublish("admin:behaviour", "critical_driving_event", event)` — triggering `BehaviourAlertBanner.tsx` in the admin sidebar.

### AI Camera Agent (FEAT-014)

The camera agent runs on the driver's cab laptop as a Python 3.11 process. No video data is ever transmitted — only event JSON payloads.

**Inference pipeline (per frame, ~30 ms on CPU):**

```
USB camera frame (640×480 minimum, 10 fps)
  └─ YOLOv8n-pose inference
       └─ 17-point COCO skeleton extracted
            ├─ ear_calculator.py
            │    EAR = (‖p1−p5‖ + ‖p2−p4‖) / (2 × ‖p0−p3‖)
            │    using left eye keypoints (indices 1,2,3,4,5)
            │
            ├─ head_pose.py
            │    head_yaw = atan2(nose_x − midpoint(left_ear_x, right_ear_x), …)
            │
            └─ RandomForest classifier
                 features: [EAR, head_yaw, frame_delta, blink_rate]
                 validates geometric heuristics before publishing
                 (suppresses false positives from poor lighting / partial occlusion)
```

**Event state machine** (`event_state.py`):

| State | Condition | Next state |
|---|---|---|
| idle | EAR > 0.25 AND yaw < 30° | idle |
| onset | EAR < threshold OR yaw > 30° | sustained |
| sustained | Duration ≥ required (2–3 s) AND RandomForest confirms | published |
| published | — | idle (cooldown) |

**Detected events and thresholds:**

| Event | Trigger |
|---|---|
| `drowsiness_alert` | EAR < 0.25 sustained ≥ 2 s, RandomForest confirms |
| `microsleep_alert` | EAR < 0.20 sustained ≥ 3 s, RandomForest confirms |
| `distraction_alert` | head yaw > 30° sustained ≥ 3 s |

**MQTT auth:** the agent calls `POST /api/cam-agent/session` with its API key (`CAM_AGENT_API_KEY`) to resolve the driver's email to a UUID. It uses this UUID as the MQTT client ID and as the `{driverId}` path segment in `trucknet/drivers/{driverId}/behaviour`.

---

## Real-Time Layer (Ably)

All real-time delivery uses [Ably](https://ably.com) pub/sub. There is no persistent WebSocket server in the Next.js process.

### Client connection

`useSocket.ts` creates a single `Ably.Realtime` instance per browser session:

```typescript
const client = new Ably.Realtime({ authUrl: "/api/auth/ably-token" });
```

The `authUrl` endpoint (`GET /api/auth/ably-token`) calls `ablyRest.auth.createTokenRequest({ clientId: user.id })` and returns the signed `TokenRequest` object. Ably auto-refreshes tokens before expiry.

### Channel topology

| Channel | Direction | Events |
|---|---|---|
| `user:<userId>` | server → specific client | `nearby_driver_update`, `text_message_received`, `voice_message_received`, `friend_request_received`, `friend_request_accepted`, `call_incoming`, `call_declined`, `call_missed`, `call_ended`, `stress_signal_alert` |
| `drivers` | server → all clients | `driver_location_updated`, `driver_route_set`, `driver_route_cleared` |
| `stress:alerts` | server → all clients | `stress_signal_alert` |
| `sensors:<deviceId>` | sensor-worker → admin device detail | `sensor_reading`, `device_status` |
| `admin:sensors` | sensor-worker → admin fleet page | `sensor_alert`, `sensor_alert_acked`, `fleet_sensor_update` |
| `admin:behaviour` | behaviour workers → admin dashboard | `behaviour_report_ready`, `critical_driving_event` |

### Server publish

`lib/ably-server.ts` exports a fire-and-forget helper:

```typescript
export async function ablyPublish(channel: string, event: string, data: unknown): Promise<void>
```

All API route handlers and workers call this helper. It uses the singleton `Ably.Rest` client initialised with `ABLY_API_KEY`.

---

## Background Workers

All workers live in `workers/` and run with `tsx` as their TypeScript runtime. In Docker they are separate services; in development they are auto-started via `instrumentation.node.ts`.

### stress-signal-consumer

- **Transport:** Kafka (`trucknet.stress-signals` topic, consumer group `stress-consumer-group`)
- **Logic:** Validates message with Zod → queries `driver_locations` for all drivers within 50 km of SOS origin using Haversine → `ablyPublish("user:<driverId>", "stress_signal_alert", …)` for each → `ablyPublish("stress:alerts", "stress_signal_alert", …)` fleet-wide
- **Error handling:** exponential backoff retry (max 3 attempts) → dead-letter to `trucknet.stress-signals.dlq`

### sensor-consumer

- **Transport:** MQTT, subscribes to `trucknet/sensors/+/readings` and `trucknet/sensors/+/status` (QoS 1)
- **Logic:** Zod validation → INSERT `sensor_readings` → upsert `iot_devices` status → evaluate thresholds → conditionally INSERT `sensor_alerts` → Ably fan-out
- **Error handling:** malformed payloads logged and dropped; alert deduplication prevents duplicate `active` alerts

### behaviour-event-consumer

- **Transport:** MQTT, subscribes to `trucknet/drivers/+/behaviour` (QoS 1)
- **Logic:** Zod validation → INSERT `driving_events` → if severity = critical/high: `ablyPublish("admin:behaviour", "critical_driving_event", event)`
- **Error handling:** events with unknown `trip_id` dropped with a warning; Zod failures logged

### behaviour-report-worker

- **Transport:** BullMQ queue `behaviour-reports` (Redis-backed)
- **Logic:** waits 30 s → queries all `driving_events` for the trip → calls `score-calculator.ts` → INSERT/UPDATE `behaviour_reports` → UPDATE `transport_trips.behaviour_report_id` → `ablyPublish("admin:behaviour", "behaviour_report_ready", report)`
- **Error handling:** BullMQ retry with exponential backoff; `behaviour_reports.status = 'failed'` + `error_message` stored on permanent failure

### gps-position-worker

- **Transport:** called synchronously from `POST /api/drivers/location` handler (runs in main app process)
- **Logic:** resolves speed limit for GPS coordinate → compares against posted speed → INSERT `driving_events` (speed_violation) if exceeded; tracks idle time per driver in memory → INSERT idle_excess event if threshold met
- **Error handling:** speed limit lookup failures fall back gracefully; all events Zod-validated before insert

### driver-esg-report-worker

- **Transport:** BullMQ queue `driver-esg-reports` (Redis-backed)
- **Logic:** UPDATE status → aggregate KPIs → generate HTML → Puppeteer PDF → CSV → email via Nodemailer → UPDATE status = ready
- **Error handling:** status set to `failed` + `error_message`; BullMQ retry with backoff; Puppeteer runs in `--no-sandbox` mode inside Docker

### esg-report-scheduler

- **Transport:** in-process timer (runs in the same process as `driver-esg-report-worker` in production)
- **Logic:** every minute, SELECT active schedules where `next_run_at ≤ NOW()` → for each: query all drivers → enqueue one BullMQ job per driver → UPDATE `next_run_at` based on `period_type`

---

## Worker Auto-Start (Development)

```
instrumentation.ts
  └─ register()
       └─ if (NEXT_RUNTIME === "nodejs")
            └─ import("./instrumentation.node")
                  └─ spawn("tsx", ["workers/behaviour-event-consumer.ts"])
                     spawn("tsx", ["workers/behaviour-report-worker.ts"])
                     (restarts each worker after 3 s if it crashes)
```

This eliminates the need to manually start workers during `npm run dev`. The split into two files (`instrumentation.ts` guards the import; `instrumentation.node.ts` contains the actual `child_process.spawn` calls) is required because Webpack compiles `instrumentation.ts` for both runtimes — importing `child_process` at the top level would fail on the Edge bundle.

In production all workers run as separate docker-compose services (`stress-worker`, `sensor-worker`, `behaviour-event-worker`, `behaviour-report-worker`, `esg-worker`).

---

## API Routes Reference

All routes live under `app/api/`. Every handler follows the same pattern: `requireAuth()` or `requireAdmin()` → Zod parse body → Drizzle query → JSON response.

### Authentication & profile

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | Public | Create account. Rate limited: 5/hr/IP. Bcrypt hashes password. Generates unique `tag`. Admin role requires valid `ADMIN_INVITE_CODE`. |
| GET | `/api/auth/ably-token` | Session | Returns signed Ably `TokenRequest` for the authenticated user. |
| GET | `/api/users/me` | Session | Returns `{ id, name, email, tag, role, profileImageUrl }`. |
| GET | `/api/users/by-tag?tag=…` | Session | Resolves `name#1234` tag to user UUID. |
| GET | `/api/profile` | Session | Returns full profile. |
| POST | `/api/profile/upload-avatar` | Session | Multipart — saves to `public/uploads/`, updates `users.profile_image_url`. |

### Friends

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/friends/request` | Session | Inserts `friend_requests` row. Publishes `friend_request_received` to recipient. |
| GET | `/api/friends/list` | Session | Returns accepted friends + pending requests. |
| PATCH | `/api/friends/[id]/accept` | Session | Sets status = accepted. Publishes `friend_request_accepted` to sender. |
| PATCH | `/api/friends/[id]/reject` | Session | Sets status = rejected. |
| GET | `/api/friends/[id]/location` | Session | Returns friend's `driver_locations` row. |

### GPS & Routes

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/drivers/location` | Session | Upserts `driver_locations`. Runs `gps-position-worker`. Publishes `nearby_driver_update`. |
| GET | `/api/drivers/nearby` | Session | Returns drivers within 50 km (Haversine). |
| GET | `/api/drivers/route` | Session | Computes OSRM route + caches in Redis. Returns GeoJSON geometry. |
| POST | `/api/drivers/route` | Session | Saves route to `driver_routes`. Publishes `driver_route_set`. |
| DELETE | `/api/drivers/route` | Session | Deletes active route. Publishes `driver_route_cleared`. |
| GET | `/api/geocode?q=…` | Session | Reverse geocode proxy (Nominatim). |

### Trips

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/trips` | Session | Creates trip (status = active). |
| GET | `/api/trips` | Session | Lists current driver's trips. |
| PATCH | `/api/trips/[tripId]/status` | Admin or owner | `completed` → triggers behaviour report BullMQ job. |
| GET | `/api/drivers/[driverId]/active-trip` | Session | Returns active trip or 404. |
| GET | `/api/drivers/[driverId]/trips` | Admin | Paginated trip list for driver. |
| GET | `/api/drivers/[driverId]/trips/stats` | Admin | Aggregated trip stats. |

### Messaging

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/text-messages` | Session | Inserts message. Publishes `text_message_received`. |
| GET | `/api/text-messages/conversations` | Session | Returns last message per friend pair. |
| PATCH | `/api/text-messages/[id]/read` | Session | Sets status = read. |
| POST | `/api/voice-messages` | Session | Inserts metadata. Publishes `voice_message_received`. |
| PATCH | `/api/voice-messages/[id]/status` | Session | Sets status = listened. |
| POST | `/api/upload/audio` | Session | Multipart audio upload → `public/uploads/`. |

### SOS Signals

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/stress-signals` | Session | Rate limited: 3/10 min/user. Inserts signal. Produces to Kafka (or direct Ably fallback). |
| GET | `/api/stress-signals/active` | Session | Returns active signals near requester. |
| PATCH | `/api/stress-signals/[id]/resolve` | Session | Sets status = resolved. |

### Calls

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/calls/initiate` | Session | Creates LiveKit room, generates JWTs, inserts `call_history`, notifies callee. |
| GET | `/api/calls/token/[roomName]` | Session | Issues LiveKit JWT for an existing room. |
| GET | `/api/calls/[roomName]` | Session | Returns call details. |
| POST | `/api/calls/[roomName]/decline` | Session | Sets status = declined. Notifies caller. |
| GET | `/api/calls/history` | Session | Returns user's call history. |

### Driver HR & behaviour

| Method | Path | Auth | Description |
|---|---|---|---|
| GET/PATCH | `/api/drivers/[driverId]/profile` | Admin | Read/write `driver_profiles`. |
| GET/POST | `/api/drivers/[driverId]/shifts` | Admin | List/create `driver_shifts`. |
| GET/PATCH | `/api/drivers/[driverId]/shifts/[shiftId]` | Admin | Read/update shift. |
| POST | `/api/drivers/[driverId]/shifts/[shiftId]/complete` | Admin | Marks shift completed, calculates duration. |
| GET/POST | `/api/drivers/[driverId]/maintenance` | Admin | List/create `vehicle_maintenance_logs`. |
| GET/POST | `/api/drivers/[driverId]/training` | Admin | List/create `driver_training_records`. |
| GET | `/api/drivers/[driverId]/training/expiring` | Admin | Returns records with `expiry_date` within 30 days. |
| GET | `/api/drivers/[driverId]/behaviour-summary` | Admin | Latest behaviour report summary. |
| GET | `/api/drivers/[driverId]/trips/[tripId]/behaviour` | Admin | Full behaviour report for trip. |
| GET | `/api/drivers/[driverId]/trips/[tripId]/behaviour/events` | Admin | All `driving_events` for trip. |

### ESG reports

| Method | Path | Auth | Description |
|---|---|---|---|
| GET/POST | `/api/drivers/esg-reports` | Admin | List all reports or trigger manual generation. |
| GET | `/api/drivers/esg-reports/[reportId]` | Admin | Report detail. |
| GET | `/api/drivers/esg-reports/[reportId]/download` | Admin | Download PDF or CSV attachment. |
| GET | `/api/drivers/fleet-esg-summary` | Admin | Aggregated fleet-level ESG KPIs. |
| GET/POST | `/api/esg-report-schedules` | Admin | List/create schedules. |
| GET/PATCH/DELETE | `/api/esg-report-schedules/[scheduleId]` | Admin | Read/update/delete schedule. |

### Admin-only

| Method | Path | Description |
|---|---|---|
| GET | `/api/admin/stats` | KPI summary: `totalDrivers`, `onlineDrivers`, `activeSos`, `ongoingCalls`, `callsToday`, `msgsToday`, `sensorAlerts` |
| GET | `/api/admin/drivers` | Paginated driver list with optional search. |
| GET | `/api/admin/drivers/live` | All drivers with current GPS coordinates. |
| GET | `/api/admin/drivers/[driverId]/route` | Driver's active `driver_routes` row. |
| GET | `/api/admin/routes/active` | All drivers with `status = active` routes. |
| GET | `/api/admin/sos` | Paginated SOS history. |
| GET | `/api/admin/sos/stream` | **SSE** — streams active SOS inserts to admin in real-time. |
| PATCH | `/api/admin/sos/[id]/resolve` | Resolves SOS signal. |
| GET | `/api/admin/calls` | Fleet call history with caller/callee names. |
| GET | `/api/admin/calls/[roomName]` | Call detail. |
| GET | `/api/admin/sensors` | All `iot_devices` with latest reading. |
| POST | `/api/admin/sensors/[deviceId]/register` | Registers a new device in `iot_devices`. |
| GET/PATCH | `/api/admin/sensors/[deviceId]` | Device detail / update truck label or driver assignment. |
| GET | `/api/admin/sensors/[deviceId]/readings` | Paginated reading history (for sparkline charts). |
| GET/PATCH | `/api/admin/sensors/[deviceId]/thresholds` | Read/update per-device `alert_config` JSON. |
| GET | `/api/admin/sensors/alerts` | All sensor alerts with device and driver info. |
| PATCH | `/api/admin/sensors/alerts/[alertId]/acknowledge` | Sets alert status = acknowledged, records `acked_by` + `acked_at`. |
| GET | `/api/admin/behaviour/fleet` | All `behaviour_reports` with driver info, sorted by `global_score`. |
| GET/PATCH | `/api/admin/behaviour/config` | Read/update `behaviour_scoring_config` row. |

### Misc

| Method | Path | Description |
|---|---|---|
| POST | `/api/cam-agent/session` | API key auth. Returns `{ driverId }` for email lookup. Used by cam_agent for MQTT client ID. |
| GET | `/api/health` | Returns `{ status: "ok" }` — used by docker-compose healthchecks. |

---

## Frontend Pages & Components

### Route groups

**`(auth)`** — public, no layout chrome
- `/login` — email + password sign-in with Auth.js `signIn()`
- `/register` — account creation; auto-generates `tag` on the server from the name + a random 4-digit suffix

**`(protected)`** — server layout renders `Navbar`, `BottomNav`, `CallStateWrapper` (global call state context), and `SosAlertListener` (Ably subscriber for incoming SOS toasts)
- `/dashboard` — quick-access card grid
- `/map` — `DriverMap.tsx` Leaflet map with live driver pins updated via `user:<userId>` Ably channel; `RouteSetupModal.tsx` opens destination picker; `RouteInfoBar.tsx` shows live ETA overlay
- `/messages` — `FriendsSidebar.tsx` + `ChatPanel.tsx` combining text and voice message thread with inline audio playback
- `/friends` — friend cards with call/message/location action buttons
- `/profile` — name edit + avatar upload
- `/stress` — SOS broadcast button + list of active nearby signals
- `/calls/[roomName]` — LiveKit `VoiceCallRoom.tsx` or `VideoCallRoom.tsx` depending on `?type=` query param

**`(admin)/admin`** — all pages are server components that call `requireAdmin()` before rendering
- `/admin` — `StatsBar` KPIs + `FleetMap` + `SosPanel` + `BehaviourDashboardWidget`
- `/admin/sos` — `useAdminSosStream` SSE hook feeds live `SosPanel`
- `/admin/calls` — `CallHistoryTable` with pagination
- `/admin/drivers` — `DriverTable` with search; `CertificationAlertBadge` shows expiry warnings
- `/admin/drivers/[driverId]` — tabbed: `DriverProfileForm`, `TripLogTable`, `ShiftLogTable`, `MaintenanceLogTable`, `TrainingLogTable`, `EsgReportKpiGrid`
- `/admin/drivers/[driverId]/trips/[tripId]` — `BehaviourReportCard` + `EventTimeline` + `ScoreBreakdownBar` + GPS replay map
- `/admin/sensors` — `SensorDeviceGrid` + `SensorAlertPanel` (both subscribe to `admin:sensors` Ably channel)
- `/admin/sensors/[deviceId]` — `SensorGauge` (temperature/humidity), `VibrationIndicator`, `SensorSparkline` (Recharts), threshold editor
- `/admin/behaviour` — `FleetSafetyRanking` table sorted by `global_score`; `DriveScoreGauge` per driver
- `/admin/behaviour/config` — form bound to `GET/PATCH /api/admin/behaviour/config`
- `/admin/drivers/esg-reports` — `FleetEsgBenchmarkChart` (Recharts) + `GenerateEsgReportModal` + `EsgReportScheduleForm`

---

## Hooks

| Hook | Purpose |
|---|---|
| `useSocket.ts` | Creates `Ably.Realtime`, subscribes to `user:<userId>` channel, exposes `subscribe(event, callback)` |
| `useSocket.tsx` | React context variant of the above for use in the providers tree |
| `useCallState.tsx` | React context that tracks active call state (roomName, callType, isIncoming). Used by `CallStateWrapper` to persist call UI across navigation. |
| `useVoiceRecorder.ts` | Wraps `MediaRecorder` API. `start()` → `stop()` → uploads to `/api/upload/audio` → returns `{ audioUrl, durationSeconds }` |
| `useAdminSosStream.ts` | Creates an `EventSource` pointing to `GET /api/admin/sos/stream`. Parses SSE messages into typed SOS signal objects. Reconnects on error. |
| `useLiveKitRoom.ts` | Manages LiveKit `Room` lifecycle (connect, disconnect, track publication). |

---

## Lib Utilities

| File | Purpose |
|---|---|
| `lib/ably-server.ts` | Singleton `Ably.Rest` client. `ablyPublish(channel, event, data)` — fire-and-forget, logs errors. |
| `lib/api.ts` | Typed `apiFetch<T>()` wrapper for client → server REST calls. Throws on non-2xx. |
| `lib/auth-helpers.ts` | `requireAuth()` returns session user or throws `NextResponse` 401. `requireAdmin()` additionally checks `role === 'admin'`. |
| `lib/behaviour/score-calculator.ts` | Accepts `driving_events[]` + `behaviour_scoring_config`. Returns `{ global_score, speed_score, driving_style_score, fatigue_score, idle_score }`. |
| `lib/behaviour/behaviour-report-queue.ts` | `enqueueReport(tripId)` — adds job to BullMQ `behaviour-reports` queue. |
| `lib/behaviour/esp32-classifier.ts` | Maps raw accelerometer magnitudes to `harsh_braking` / `harsh_acceleration` / `sudden_swerve` based on configurable g-force thresholds. |
| `lib/behaviour/gps-classifier.ts` | Compares `gps_speed_kmh` against `speed_limit_kmh` → `speed_violation` with severity bucketing. |
| `lib/behaviour/speed-limit-lookup.ts` | Resolves a (lat, lng) pair to a speed limit (km/h). Uses OSRM annotation or static lookup. |
| `lib/driver-esg-aggregator.ts` | Joins all HR, trip, sensor, and training data for a driver + period → returns typed `EsgKpis` object. |
| `lib/driver-esg-html-template.ts` | Pure function: `EsgKpis` → HTML string with tables and inline chart SVGs. |
| `lib/driver-esg-pdf.ts` | Launches Puppeteer, calls `page.setContent(html)`, returns `Buffer` from `page.pdf()`. |
| `lib/driver-esg-csv.ts` | `EsgKpis` → CSV string with headers. |
| `lib/esg-email.ts` | `sendEsgReport({ to, driverName, period, pdfBuffer, csvString })` via Nodemailer SMTP. Skips silently if `SMTP_HOST` is unset. |
| `lib/env.ts` | Calls `EnvSchema.safeParse(process.env)` at import time. Exports typed `env` object. Throws with field-level errors if invalid. |
| `lib/haversine.ts` | `haversineDistanceKm(lat1, lng1, lat2, lng2)` — pure implementation of the haversine formula. |
| `lib/kafka.ts` | Singleton `KafkaJS` client. `getProducer()` / `getAdmin()` — lazy connect with retry. |
| `lib/kafka-topics.ts` | `STRESS_SIGNALS = "trucknet.stress-signals"`, `STRESS_SIGNALS_DLQ = "trucknet.stress-signals.dlq"` |
| `lib/kafka-init.ts` | `initKafkaTopics()` — creates topics idempotently at startup. |
| `lib/livekit-server.ts` | `getRoomService()` → `RoomServiceClient`. `generateLiveKitToken(roomName, participantIdentity, metadata)` → signed JWT string. |
| `lib/osrm.ts` | `getRoute(origin, destination)` → `{ geometry: GeoJSON.LineString, distanceMeters, durationSeconds }` via OSRM public API. |
| `lib/rate-limit.ts` | `class RateLimiter { check(key): { allowed: boolean, retryAfterSeconds: number } }` — fixed-window, in-memory `Map`. |
| `lib/redis.ts` | Singleton `ioredis` client. Connects lazily on first use. |
| `lib/route-cache.ts` | `getCachedRoute(key)` / `setCachedRoute(key, value)` — Redis `GET`/`SETEX` with 10-min TTL. |
| `lib/sensor-thresholds.ts` | `DEFAULT_THRESHOLDS` constant. `evaluateThresholds(reading, config)` → `AlertType[]`. |
| `lib/admin-sos-stream.ts` | `createSosStream(res)` — sets SSE headers, returns an emitter. Called by the `GET /api/admin/sos/stream` handler. |
| `lib/stress-signal-expiry.ts` | `autoResolveExpiredSignals()` — called periodically to resolve signals older than N hours. |
| `lib/utils.ts` | `cn(...inputs)` — clsx + tailwind-merge. |
| `lib/validate-uuid.ts` | `validateUuid(param)` → `string` or `NextResponse` 400. Used in all `[id]` route handlers. |

---

## Schemas & Validation

All API request bodies, MQTT payloads, and environment variables are validated with Zod at their respective entry points.

| Schema file | Validates |
|---|---|
| `schemas/env.schema.ts` | All env vars: `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `ABLY_API_KEY`, `LIVEKIT_*`, `KAFKA_*`, `REDIS_URL`, `MQTT_URL`, `SMTP_*`, `ADMIN_INVITE_CODE` |
| `schemas/user.schema.ts` | `POST /api/auth/register` body: name, email, password (min 8 chars), role, inviteCode |
| `schemas/location.schema.ts` | GPS payload: `{ latitude: number, longitude: number }` with range validation |
| `schemas/stress.schema.ts` | SOS request body + Kafka message envelope |
| `schemas/sensor.schema.ts` | ESP32 MQTT payload: all numeric sensor fields + `device_id` + `timestamp` |
| `schemas/behaviour.schema.ts` | cam_agent + ESP32 MQTT behaviour event payload |
| `schemas/route.schema.ts` | Route request/response (lat/lng pairs) |
| `schemas/voice.schema.ts` | Voice message metadata (audioUrl, durationSeconds) |
| `schemas/driver-esg-report.schema.ts` | ESG report generation request and schedule body |

---

## Edge Middleware

`middleware.ts` runs on every matched request in the Edge Runtime, executing two checks in order:

```
Request
  │
  1. Rate limit check
  │    POST /api/auth/register   → registerLimiter.check(IP)        → 429 if exceeded
  │    POST /api/stress-signals  → stressSignalLimiter.check(userId) → 429 if exceeded
  │    POST /api/voice-messages  → voiceMessageLimiter.check(userId) → 429 if exceeded
  │    POST /api/calls/initiate  → callInitiateLimiter.check(userId) → 429 if exceeded
  │
  2. Auth.js authorized() callback
       → unauthenticated → 302 to /login
       → authenticated  → request passes through
```

The `matcher` config excludes `/_next/static`, `/_next/image`, `/favicon.ico`, and `/public`.

Response headers on rate-limit rejections include `Retry-After: <seconds>`.

---

## Rate Limiting

Fixed-window, in-memory `RateLimiter` (`lib/rate-limit.ts`). The store is a `Map<string, { count, resetAt }>`.

| Route | Limit | Window | Key |
|---|---|---|---|
| `POST /api/auth/register` | 5 requests | 1 hour | IP address (`x-forwarded-for` → `x-real-ip` → `"unknown"`) |
| `POST /api/stress-signals` | 3 requests | 10 minutes | `session.user.id` |
| `POST /api/voice-messages` | 10 requests | 1 minute | `session.user.id` |
| `POST /api/calls/initiate` | 10 requests | 1 minute | `session.user.id` |

> For multi-replica deployments replace `RateLimiter` with an Upstash Redis adapter. The `check()` interface is unchanged.

---

## Security Headers & CSP

Set globally in `next.config.mjs` for all routes (`source: "/(.*)"`):

| Header | Value | Purpose |
|---|---|---|
| `X-Frame-Options` | `DENY` | Prevent clickjacking |
| `X-Content-Type-Options` | `nosniff` | Prevent MIME sniffing |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` | Enforce HTTPS for 1 year |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Limit referrer leakage |
| `Permissions-Policy` | `camera=(self), geolocation=(self), microphone=(self)` | Restrict browser feature access |
| `Content-Security-Policy` | (see below) | Restrict resource origins |

**CSP details:**

```
default-src  'self'
style-src    'self' 'unsafe-inline'
script-src   'self' 'unsafe-inline' ['unsafe-eval' in dev only]
connect-src  'self' ws: wss: https://*.ably.io wss://*.ably.io
             https://*.ably-realtime.com wss://*.ably-realtime.com
             https://*.ably.net wss://*.ably.net
             https://main.realtime.ably.net
             wss://*.livekit.cloud https://*.livekit.cloud
media-src    'self' blob:
img-src      'self' data: blob: https://*.tile.openstreetmap.org
font-src     'self'
worker-src   'self' blob:
frame-ancestors 'none'
```

`'unsafe-eval'` is stripped in production builds. `blob:` in `media-src` is required for `MediaRecorder` voice message playback.

---

## Environment Variables

| Variable | Required | Default | Notes |
|---|---|---|---|
| `DATABASE_URL` | ✅ | — | PostgreSQL connection URL e.g. `postgresql://user:pass@localhost:5433/trucknet` |
| `NEXTAUTH_SECRET` | ✅ | — | Random secret ≥ 10 chars — used to sign JWT sessions |
| `NEXTAUTH_URL` | ✅ | — | Full canonical URL of the app e.g. `http://localhost:3000` |
| `ABLY_API_KEY` | ✅ | — | Ably API key — used by both server REST client and to sign `TokenRequest` for clients |
| `LIVEKIT_URL` | ✅ | — | LiveKit SFU URL e.g. `wss://my-livekit.livekit.cloud` |
| `LIVEKIT_API_KEY` | ✅ | — | LiveKit API key |
| `LIVEKIT_API_SECRET` | ✅ | — | LiveKit API secret |
| `KAFKA_BROKERS` | ✅ | `localhost:9092` | Comma-separated: `localhost:9092` locally, `kafka:29092` in Docker |
| `KAFKA_ENABLED` | ✅ | `false` | `true` to produce SOS to Kafka; `false` falls back to direct Ably publish |
| `REDIS_URL` | ✅ | — | `redis://localhost:6379` — used by BullMQ and route cache |
| `MQTT_URL` | ✅ | — | `mqtt://user:pass@host:1883` — used by sensor and behaviour workers. `@` in password must be `%40` |
| `MQTT_PASSWORD` | ✅ | — | Plain password — used by docker-compose healthchecks |
| `ADMIN_INVITE_CODE` | Optional | — | Required when registering `role=admin`. Min 8 chars. Unset = admin self-registration disabled. |
| `SMTP_HOST` | Optional | — | SMTP server hostname. Unset = email dispatch silently skipped. |
| `SMTP_PORT` | Optional | `587` | SMTP port |
| `SMTP_USER` | Optional | — | SMTP auth username |
| `SMTP_PASS` | Optional | — | SMTP auth password |
| `SMTP_FROM` | Optional | `noreply@trucknet.local` | From address for ESG report emails |

All variables are validated at boot by `lib/env.ts` using `schemas/env.schema.ts`. The server **refuses to start** on any validation failure.

---

## ESP32 Firmware

Located in `esp32/`. Built with PlatformIO (Arduino framework) targeting the DOIT ESP32 DEVKIT V1.

**Hardware:**

| Component | Purpose |
|---|---|
| DHT22 | Temperature (±0.5°C) and humidity (±2–5% RH) |
| MPU6050 | 3-axis accelerometer for vibration magnitude measurement |

**Firmware features:**
- QoS 1 MQTT publish via `PubSubClient`
- Hardware watchdog (auto-resets on hang)
- OTA firmware update (`ArduinoOTA`)
- NTP time sync for accurate timestamps in payloads
- LWT (Last Will & Testament) — Mosquitto auto-publishes `{"status":"offline"}` on disconnect

**MQTT topics:**

| Topic | Direction | QoS | Payload |
|---|---|---|---|
| `trucknet/sensors/<deviceId>/readings` | ESP32 → broker | 1 | `{ device_id, temperature_c, humidity_pct, vibration_magnitude, accel_x, accel_y, accel_z, timestamp }` |
| `trucknet/sensors/<deviceId>/status` | LWT + heartbeat | 1 | `{ status: "online" \| "offline" }` |

**Libraries:**

```ini
lib_deps =
  knolleary/PubSubClient @ 2.8.0
  adafruit/DHT sensor library @ 1.4.6
  adafruit/Adafruit MPU6050 @ 2.2.6
  bblanchon/ArduinoJson @ 6.21.5
```

See [esp32/docs/WIRING.md](esp32/docs/WIRING.md) for pin assignments and [esp32/docs/PAYLOAD_SPEC.md](esp32/docs/PAYLOAD_SPEC.md) for the full JSON payload schema.

---

## Environment Variables

| Variable | Required | Default | Notes |
|---|---|---|---|
| `DATABASE_URL` | ✅ | — | PostgreSQL connection URL e.g. `postgresql://user:pass@localhost:5433/trucknet` |
| `NEXTAUTH_SECRET` | ✅ | — | Random secret ≥ 10 chars — used to sign JWT sessions |
| `NEXTAUTH_URL` | ✅ | — | Full canonical URL of the app e.g. `http://localhost:3000` |
| `ABLY_API_KEY` | ✅ | — | Ably API key — used by both server REST client and to sign `TokenRequest` for clients |
| `LIVEKIT_URL` | ✅ | — | LiveKit SFU URL e.g. `wss://my-livekit.livekit.cloud` |
| `LIVEKIT_API_KEY` | ✅ | — | LiveKit API key |
| `LIVEKIT_API_SECRET` | ✅ | — | LiveKit API secret |
| `KAFKA_BROKERS` | ✅ | `localhost:9092` | Comma-separated: `localhost:9092` locally, `kafka:29092` in Docker |
| `KAFKA_ENABLED` | ✅ | `false` | `true` to produce SOS to Kafka; `false` falls back to direct Ably publish |
| `REDIS_URL` | ✅ | — | `redis://localhost:6379` — used by BullMQ and route cache |
| `MQTT_URL` | ✅ | — | `mqtt://user:pass@host:1883` — used by sensor and behaviour workers. `@` in password must be `%40` |
| `MQTT_PASSWORD` | ✅ | — | Plain password — used by docker-compose healthchecks |
| `ADMIN_INVITE_CODE` | Optional | — | Required when registering `role=admin`. Min 8 chars. Unset = admin self-registration disabled. |
| `SMTP_HOST` | Optional | — | SMTP server hostname. Unset = email dispatch silently skipped. |
| `SMTP_PORT` | Optional | `587` | SMTP port |
| `SMTP_USER` | Optional | — | SMTP auth username |
| `SMTP_PASS` | Optional | — | SMTP auth password |
| `SMTP_FROM` | Optional | `noreply@trucknet.local` | From address for ESG report emails |

All variables are validated at boot by `lib/env.ts` using `schemas/env.schema.ts`. The server **refuses to start** on any validation failure.

---

## Testing

### Unit tests — Vitest

Tests live in `__tests__/` mirroring the source layout. The setup file (`__tests__/setup.ts`) mocks Drizzle, Ably, and Redis.

```bash
npm test                # Run all unit tests once
npm run test:watch      # Watch mode
npm run test:coverage   # Coverage report (Istanbul/v8)
```

**Test areas:**
- `__tests__/api/` — API route handler logic (mocked DB)
- `__tests__/lib/` — Pure library functions (haversine, score-calculator, sensor-thresholds, etc.)
- `__tests__/schemas/` — Zod schema validation edge cases
- `__tests__/sockets/` — Ably publish helpers

### E2E tests — Playwright

```bash
npm run test:e2e
```

- `e2e/auth.spec.ts` — register, login, logout flows
- `e2e/smoke.spec.ts` — dashboard load, map render, friend search

### Load tests — k6

```bash
k6 run load-tests/k6-script.js
```

The k6 script exercises `POST /api/drivers/location`, `POST /api/stress-signals`, and `GET /api/admin/stats` under concurrent virtual users to validate Redis and Kafka throughput.

---

## Docker Services & Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for the complete production deployment guide.

### Local full-stack

```bash
docker compose up --build
```

### Services

| Service | Image | Port(s) | Purpose |
|---|---|---|---|
| `postgres` | `postgres:16-alpine` | 5433:5432 | Primary PostgreSQL database |
| `redis` | `redis:7-alpine` | 6379:6379 | BullMQ job backend + OSRM route LRU cache (128 MB) |
| `redisinsight` | `redis/redisinsight:latest` | 5540:5540 | Redis browser GUI |
| `kafka` | `confluentinc/cp-kafka:7.4.0` | 9092:9092 | Kafka broker (KRaft mode, no ZooKeeper) |
| `kafka-ui` | `provectuslabs/kafka-ui:latest` | 8080:8080 | Kafka topic / consumer-lag GUI |
| `mosquitto` | `eclipse-mosquitto:2` | 1883:1883, 9001:9001 | MQTT broker for ESP32 and cam_agent |
| `livekit` | `livekit/livekit-server:latest` | 7880, 7881, 7882/udp | WebRTC SFU |
| `app` | `Dockerfile` | 3000:3000 | Next.js application |
| `stress-worker` | `Dockerfile.worker` | — | Kafka SOS consumer → Ably fan-out |
| `sensor-worker` | `Dockerfile.worker` | — | MQTT ESP32 sensor consumer → PostgreSQL + Ably |
| `behaviour-event-worker` | `Dockerfile.worker` | — | MQTT cam_agent + ESP32 behaviour event consumer → `driving_events` |
| `behaviour-report-worker` | `Dockerfile.worker` | — | BullMQ behaviour report scorer → `behaviour_reports` |
| `esg-worker` | `Dockerfile.esg-worker` | — | BullMQ ESG report generator + Puppeteer PDF + Nodemailer |

### Dockerfile notes

- `Dockerfile` — standard Next.js production image; runs `npm run db:migrate` via `docker-entrypoint.sh` before starting
- `Dockerfile.worker` — installs only `package.worker.json` dependencies; entry point selects the correct worker via `WORKER_NAME` env var
- `Dockerfile.esg-worker` — extends worker image with Puppeteer + Chromium; runs with `--no-sandbox` flag

### Data volumes

| Volume | Mount | Purpose |
|---|---|---|
| `postgres_data` | `/var/lib/postgresql/data` | Database persistence |
| `uploads_data` | `/app/public/uploads` | User avatars + voice message audio files |
| `mosquitto_data` | `/mosquitto/data` | MQTT message persistence |
| `mosquitto_log` | `/mosquitto/log` | Mosquitto logs |

---

## Scripts Reference

```bash
# ── Application ────────────────────────────────────────────────────────────
npm run dev              # Start Next.js dev server (hot reload + auto-starts behaviour workers)
npm run build            # Production build (type-check + Next.js build)
npm run start            # Start production server (requires prior build)
npm run lint             # ESLint check
npm run lint:fix         # ESLint auto-fix
npm run format           # Prettier format all files
npm run type-check       # tsc --noEmit (full type check without build)

# ── Database ───────────────────────────────────────────────────────────────
npm run db:generate      # Generate new SQL migration file from schema changes
npm run db:migrate       # Apply all pending migrations to DATABASE_URL
npm run db:push          # Push schema directly without migration file (dev only)
npm run db:studio        # Open Drizzle Studio (browser DB GUI on localhost:4983)

# ── Tests ──────────────────────────────────────────────────────────────────
npm test                 # Vitest unit tests (run once)
npm run test:watch       # Vitest watch mode
npm run test:coverage    # Vitest coverage report
npm run test:e2e         # Playwright E2E tests

# ── Workers (manual — not needed in dev or docker-compose) ─────────────────
npm run worker:stress          # Kafka SOS consumer
npm run worker:sensors         # MQTT IoT sensor consumer
npm run worker:behaviour-events # MQTT cam_agent + ESP32 behaviour event consumer
npm run worker:behaviour        # BullMQ behaviour report scorer
npm run worker:esg             # BullMQ ESG report generator + scheduler

# ── Infrastructure ─────────────────────────────────────────────────────────
npm run kafka:setup            # Provision Kafka topics (run once after broker starts)
```

