# TruckNet Camera Agent

Real-time driver behaviour monitoring via USB camera.
Runs on the cab laptop. Sends **only events** (never video) to TruckNet via MQTT.

## What it detects

| Behaviour       | Method                          | Threshold            |
|----------------|---------------------------------|----------------------|
| Drowsiness     | Eye Aspect Ratio (EAR)          | EAR < 0.25 for 2 s   |
| Microsleep     | EAR below critical threshold    | EAR < 0.20 for 3 s   |
| Distraction    | Head yaw angle (nose + ears)    | > 30° for 3 s        |

## Hardware
- Any USB camera (minimum 640×480, 10 fps)
- Cab laptop (CPU only — no GPU required, ~30 ms/frame)

## Quick start
See `docs/SETUP.md`

## Model training
See `docs/DATASET_GUIDE.md`

## MQTT event format
Topic: `trucknet/drivers/{driver_id}/behaviour`
```json
{
  "driver_id":   "3f2a...",
  "trip_id":     "7b1c...",
  "event_type":  "drowsiness_alert",
  "severity":    "high",
  "source":      "ai_camera",
  "occurred_at": 1741392000000,
  "confidence":  0.87,
  "ear_value":   0.21
}
```

## Privacy
Raw video is **never stored or transmitted**. Only event metadata leaves the cab.
