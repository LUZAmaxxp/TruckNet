# TruckNet Camera Agent — Setup Guide

## Requirements
- Python 3.10+
- USB camera connected to cab laptop
- Same network as MQTT broker

## Step 1 — Install dependencies
```bash
cd cam_agent
python3 -m venv venv
source venv/bin/activate     # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

## Step 2 — Configure
```bash
cp config/config.example.yaml config/config.yaml
# Edit config.yaml:
#   driver_id: your driver ID from TruckNet
#   mqtt_broker_host: your server IP
#   mqtt_password: from server .env MQTT_PASSWORD
```

## Step 3 — Train model (one time)
```bash
# Download CEW dataset — see docs/DATASET_GUIDE.md
python3 training/prepare_dataset.py --cew-path /path/to/CEW
python3 training/train.py
# Model saved to models/drowsiness_mlp.pkl
```

## Step 4 — Test camera
```bash
python3 -c "import cv2; cap=cv2.VideoCapture(0); print('OK' if cap.isOpened() else 'FAILED')"
```

## Step 5 — Run the agent

### Auto mode (recommended) — starts automatically when driver starts trip on UI
```bash
cd inference
python3 inference_agent.py --auto
# ► Waits silently, polls TruckNet every 5 seconds
# ► Camera starts the moment the driver clicks "Start trip" on the UI
# ► Camera stops automatically when the trip ends
# ► Restarts waiting for the next trip
```

### Manual mode — pass trip ID explicitly
```bash
cd inference
python3 inference_agent.py --trip-id YOUR_TRIP_ID
```

### Run on startup (Windows — optional)
Add to Task Scheduler or create a shortcut in the Startup folder:
```
pythonw inference_agent.py --auto
```

## Verify MQTT events
```bash
mosquitto_sub -h YOUR_BROKER -t 'trucknet/drivers/#/behaviour' \
  -u trucknet -P YOUR_PASSWORD -v
# Close eyes for 3s → drowsiness_alert should appear
```
