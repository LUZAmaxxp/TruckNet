# TruckNet Camera Agent — Setup Guide

## Requirements
- Python 3.10+
- USB camera connected to the cab laptop
- TruckNet server running and reachable (default `http://localhost:3000`)
- MQTT broker running (included in `docker compose up`)

---

## Step 1 — Install dependencies

```bash
cd cam_agent
python -m venv venv

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate

pip install -r requirements.txt
```

---

## Step 2 — Configure

```bash
cp config/config.example.yaml config/config.yaml
```

Edit `config/config.yaml`:

```yaml
# The driver's TruckNet account email.
# The agent resolves this to a UUID automatically on startup.
driver_email: "driver@example.com"

# MQTT broker address (same machine = localhost; Docker = container IP)
mqtt_broker_host: "localhost"
mqtt_username:    "trucknet"
mqtt_password:    "TruckMQTT2024@@"   # must match server .env MQTT_PASSWORD

# TruckNet server (for active-trip polling in --auto mode)
auto_start_url: "http://localhost:3000/api/drivers/{driver_id}/active-trip"

# API key for cam-agent endpoints (must match server .env CAM_AGENT_API_KEY)
cam_agent_api_key: "CamAgent-TruckNet-2026-SecretKey"
```

> **Note**: `driver_email` replaces the old `driver_id` field. The agent calls
> `POST /api/cam-agent/session` on startup to resolve the email to a UUID
> automatically — no manual UUID lookup needed.

---

## Step 3 — Download models

### YOLOv8n-pose (required)
```bash
# Automatic — ultralytics downloads it on first run
# Or manually:
curl -L https://github.com/ultralytics/assets/releases/download/v8.1.0/yolov8n-pose.pt \
     -o models/yolov8n-pose.pt
```

### Drowsiness classifier (pre-trained, 98% F1)
The file `models/drowsiness_mlp.pkl` is committed to the repository.
If it is missing, retrain it — see `docs/DATASET_GUIDE.md`.

---

## Step 4 — Verify camera

```bash
python -c "import cv2; cap=cv2.VideoCapture(0); print('OK' if cap.isOpened() else 'FAILED')"
```

If your camera is not index `0`, change `camera_index` in `config.yaml`.

---

## Step 5 — Live visual test (optional but recommended)

Before deploying, verify the model works on your face:

```bash
python live_test.py
```

A **pygame window** opens with:
- Live camera feed with skeleton overlay
- Colour-coded bounding box (green = alert, orange = drowsy, red = microsleep)
- EAR bar and MLP confidence bar
- Head-yaw indicator with distraction warning

Press `Q` or `Esc` to close. Use `+` / `-` to adjust the EAR threshold live.

---

## Step 6 — Run the agent

### Auto mode (recommended)
The agent waits silently, starts the camera when the driver starts a trip on
the TruckNet UI, and stops when the trip ends.

```bash
# From the cam_agent folder:
python inference/inference_agent.py --auto

# Override driver email without editing config.yaml:
python inference/inference_agent.py --auto --driver-email driver@example.com
```

### Manual mode
Use when you already know the trip ID:

```bash
python inference/inference_agent.py --trip-id <TRIP_UUID>
```

### Run on startup (Windows — optional)
Add to **Task Scheduler** or place a shortcut in the Startup folder:
```
pythonw inference\inference_agent.py --auto
```

---

## Step 7 — Verify MQTT events are arriving

```bash
mosquitto_sub -h localhost -t 'trucknet/drivers/#' \
  -u trucknet -P TruckMQTT2024@@ -v

# Close eyes for 3 seconds → drowsiness_alert should appear
# Turn head past 30° for 3 seconds → distraction_alert should appear
```

---

## Worker auto-start (server side)

The two behaviour workers start automatically with the Next.js server:

- **Development** (`npm run dev`): spawned by `instrumentation.ts`
- **Docker** (`docker compose up`): `behaviour-event-worker` and `behaviour-report-worker` services

No manual worker startup is required.
