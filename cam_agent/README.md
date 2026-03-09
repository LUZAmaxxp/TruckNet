# TruckNet Camera Agent

Real-time driver behaviour monitoring via USB camera.
Runs on the cab laptop alongside the driver's TruckNet session.
Sends **only events** (never video) to TruckNet via MQTT.

## What it detects

| Behaviour   | Method                                      | Default threshold      |
|-------------|---------------------------------------------|------------------------|
| Drowsiness  | Eye Aspect Ratio (EAR) + RandomForest model | EAR < 0.25 for 2 s     |
| Microsleep  | EAR below critical level + model confirm    | EAR < 0.20 for 3 s     |
| Distraction | Head yaw angle estimated from nose + ears   | > 30° sustained for 3 s|

## Two-layer detection

Detection uses **both** a geometric heuristic (EAR / head angle) and a trained
ML classifier:

1. **YOLOv8n-pose** extracts the 17-point COCO skeleton from each frame (~30 ms/frame on CPU)
2. **EAR** (Eye Aspect Ratio) is computed from the eye and ear keypoints
3. **Head yaw** is estimated from nose-to-ear geometry
4. A **RandomForest classifier** (98% F1) validates drowsiness events before they are published — suppresses false positives when EAR is low due to lighting or partial occlusion

## Hardware
- Any USB camera (minimum 640×480, 10 fps)
- Cab laptop — CPU only, no GPU required

## Quick start
See [docs/SETUP.md](docs/SETUP.md)

## Model training
See [docs/DATASET_GUIDE.md](docs/DATASET_GUIDE.md)

## Live visual test
```bash
python live_test.py
```
Opens a pygame window with live camera feed, skeleton overlay, EAR bar,
MLP confidence bar, and head-yaw indicator. Press `Q` to quit.

## MQTT event format
Topic: `trucknet/drivers/{driver_id}/behaviour`
```json
{
  "driver_id":        "3f2a...",
  "trip_id":          "7b1c...",
  "event_type":       "drowsiness_alert",
  "severity":         "high",
  "source":           "ai_camera",
  "occurred_at":      1741392000000,
  "confidence":       0.87,
  "ear_value":        0.21,
  "duration_seconds": 2
}
```

## Pipeline (end-to-end)
```
cam_agent
  └─ publishes MQTT event
       └─ behaviour-event-consumer worker
            └─ validates + inserts driving_events row
            └─ Ably alert to admin (critical/high severity)
       └─ behaviour-report-worker (BullMQ, triggered on trip end)
            └─ calculates scores (speed, fatigue, style, idle)
            └─ inserts behaviour_reports row
            └─ Ably 'behaviour_report_ready' to admin
```

## Privacy
Raw video is **never stored or transmitted**. Only event metadata leaves the cab.
