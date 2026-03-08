#!/usr/bin/env python3
"""
TruckNet Camera Inference Agent
Runs on the cab laptop during a trip.
Detects drowsiness and distraction via USB camera.
Sends ONLY events (never video) to TruckNet via MQTT.

Usage:
  # Manual — pass trip ID explicitly
  python3 inference_agent.py --trip-id TRP-2026-042

  # Auto — polls TruckNet API, starts/stops automatically when driver starts trip on UI
  python3 inference_agent.py --auto
"""

import cv2
import sys
import time
import argparse
import logging
import yaml
import numpy as np
import urllib.request
import urllib.error
import json
from pathlib import Path

# Local imports
from ear_calculator import eye_aspect_ratio, classify_eye_state
from head_pose       import estimate_yaw_angle
from event_state     import EventState
from event_publisher import EventPublisher

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-8s %(message)s",
)
logger = logging.getLogger(__name__)

POLL_INTERVAL = 5  # seconds between active-trip API checks


def resolve_driver_id(cfg: dict) -> str:
    """
    Call POST /api/cam-agent/session with driver_email to get the driver's UUID.
    Exits with a clear error message if the email is not found or not a driver.
    """
    base_url = cfg.get("auto_start_url", "http://localhost:3000/api/drivers/{driver_id}/active-trip")
    # Derive base server URL from auto_start_url
    from urllib.parse import urlparse
    parsed   = urlparse(base_url)
    base     = f"{parsed.scheme}://{parsed.netloc}"
    url      = f"{base}/api/cam-agent/session"
    api_key  = cfg.get("cam_agent_api_key", "")
    email    = cfg.get("driver_email", "")

    if not email:
        logger.error("driver_email not set in config.yaml")
        sys.exit(1)

    payload = json.dumps({"driver_email": email}).encode()
    req = urllib.request.Request(
        url,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read())
            driver_id   = data.get("data", data).get("driver_id")
            driver_name = data.get("data", data).get("driver_name", email)
            if not driver_id:
                logger.error(f"Session endpoint returned no driver_id: {data}")
                sys.exit(1)
            logger.info(f"Resolved driver: {driver_name} ({driver_id})")
            return driver_id
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        logger.error(f"Could not resolve driver email '{email}': HTTP {e.code} — {body}")
        logger.error("Check that driver_email in config.yaml matches a driver account in TruckNet.")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Could not reach TruckNet to resolve driver: {e}")
        logger.error("Make sure the TruckNet server is running (npm run dev).")
        sys.exit(1)


def fetch_active_trip(cfg: dict) -> str | None:
    """
    Poll /api/drivers/{driver_id}/active-trip.
    Returns the trip_id string if a trip is active, else None.
    """
    url = cfg.get("auto_start_url", "").replace("{driver_id}", cfg["driver_id"])
    if not url:
        logger.error("auto_start_url not set in config.yaml")
        return None
    api_key = cfg.get("cam_agent_api_key", "")
    headers = {"Accept": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read())
            trip = data.get("trip")
            if not trip:
                return None
            return trip.get("id") or trip.get("tripId") or trip.get("trip_id")
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None  # no active trip — normal
        logger.warning(f"API error {e.code} polling active trip")
        return None
    except Exception as e:
        logger.warning(f"Could not reach TruckNet API: {e}")
        return None


def load_config() -> dict:
    config_path = Path(__file__).parent.parent / "config" / "config.yaml"
    if not config_path.exists():
        logger.error(f"Config not found: {config_path}")
        logger.error("Copy config/config.example.yaml → config/config.yaml and fill in your values")
        sys.exit(1)
    with open(config_path) as f:
        return yaml.safe_load(f)


def load_models(cfg: dict):
    """Load YOLO pose model and optional MLP classifier. Returns (yolo_model, mlp)."""
    try:
        from ultralytics import YOLO
    except ImportError:
        logger.error("ultralytics not installed. Run: pip install -r requirements.txt")
        sys.exit(1)

    model_path = Path(__file__).parent.parent / cfg["pose_model_path"]
    logger.info(f"Loading pose model from {model_path}")
    yolo = YOLO(str(model_path))

    mlp = None
    mlp_path = Path(__file__).parent.parent / cfg.get("classifier_path", "models/drowsiness_mlp.pkl")
    if mlp_path.exists():
        try:
            import joblib
            mlp = joblib.load(mlp_path)
            logger.info(f"Loaded drowsiness classifier from {mlp_path}")
        except Exception as e:
            logger.warning(f"Could not load MLP classifier: {e} — using EAR-only mode")
    else:
        logger.warning("drowsiness_mlp.pkl not found — using EAR-only mode")

    return yolo, mlp


def run_trip(trip_id: str, cfg: dict, yolo, mlp, publisher: EventPublisher):
    """
    Run camera monitoring for a single trip.
    Returns when the trip ends (API reports no active trip in --auto mode,
    or KeyboardInterrupt in --trip-id mode).
    """
    drowsy_state      = EventState(cfg["drowsy_duration_seconds"],      cooldown_seconds=60)
    microsleep_state  = EventState(cfg["microsleep_duration_seconds"],  cooldown_seconds=30)
    distraction_state = EventState(cfg["distraction_duration_seconds"], cooldown_seconds=45)

    cap = cv2.VideoCapture(cfg["camera_index"])
    cap.set(cv2.CAP_PROP_FRAME_WIDTH,  cfg["frame_width"])
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, cfg["frame_height"])

    if not cap.isOpened():
        logger.error(f"Cannot open camera index {cfg['camera_index']}")
        return

    logger.info(f"▶  Monitoring started — trip {trip_id}")
    frame_interval    = 1.0 / cfg["fps_target"]
    last_frame_time   = 0.0
    last_poll_time    = time.monotonic()

    try:
        while True:
            now = time.monotonic()

            # In auto mode: periodically check if trip is still active
            if cfg.get("auto_detect_trip") and now - last_poll_time >= POLL_INTERVAL:
                last_poll_time = now
                active = fetch_active_trip(cfg)
                if active != trip_id:
                    logger.info(f"■  Trip {trip_id} ended — stopping camera")
                    break

            if now - last_frame_time < frame_interval:
                time.sleep(0.005)
                continue
            last_frame_time = now

            ret, frame = cap.read()
            if not ret:
                logger.warning("Frame capture failed — retrying")
                time.sleep(0.1)
                continue

            results = yolo(frame, verbose=False)

            if not results or results[0].keypoints is None or len(results[0].keypoints) == 0:
                drowsy_state.reset()
                microsleep_state.reset()
                distraction_state.reset()
                continue

            keypoints = results[0].keypoints.xy[0].cpu().numpy()
            ear       = eye_aspect_ratio(keypoints)
            yaw_deg   = estimate_yaw_angle(keypoints)
            eye_state = classify_eye_state(
                ear,
                cfg["ear_drowsy_threshold"],
                cfg["ear_microsleep_threshold"],
            )

            # ── MLP confidence score ─────────────────────────────────────────
            mlp_drowsy_prob = None
            if mlp is not None:
                try:
                    kp      = keypoints.astype(float)
                    nose    = kp[0]
                    inter   = float(np.linalg.norm(kp[1] - kp[2])) + 1e-6
                    norm_kp = ((kp - nose) / inter).flatten()
                    feat    = np.append(norm_kp, ear).reshape(1, -1)
                    mlp_drowsy_prob = float(mlp.predict_proba(feat)[0][1])
                except Exception:
                    mlp_drowsy_prob = None

            def drowsy_confidence(ear_default: float) -> float:
                return round(mlp_drowsy_prob, 3) if mlp_drowsy_prob is not None else ear_default

            def mlp_confirms(min_prob: float = 0.35) -> bool:
                if mlp_drowsy_prob is None:
                    return True
                return mlp_drowsy_prob >= min_prob

            if microsleep_state.update(eye_state == "microsleep") and mlp_confirms(0.30):
                publisher.publish_event(
                    trip_id=trip_id,
                    event_type="microsleep_alert",
                    severity="critical",
                    confidence=drowsy_confidence(0.90),
                    ear_value=round(ear, 3),
                    duration_seconds=cfg["microsleep_duration_seconds"],
                )
            elif drowsy_state.update(eye_state == "drowsy") and mlp_confirms(0.35):
                publisher.publish_event(
                    trip_id=trip_id,
                    event_type="drowsiness_alert",
                    severity="high",
                    confidence=drowsy_confidence(0.85),
                    ear_value=round(ear, 3),
                    duration_seconds=cfg["drowsy_duration_seconds"],
                )

            is_distracted = abs(yaw_deg) > cfg["head_angle_distraction_deg"]
            if distraction_state.update(is_distracted):
                publisher.publish_event(
                    trip_id=trip_id,
                    event_type="distraction_alert",
                    severity="medium",
                    confidence=0.80,
                    head_angle_deg=round(yaw_deg, 1),
                    duration_seconds=cfg["distraction_duration_seconds"],
                )

    finally:
        cap.release()


def main():
    parser = argparse.ArgumentParser(description="TruckNet camera inference agent")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--trip-id", help="Run monitoring for a specific trip ID")
    group.add_argument("--auto",    action="store_true",
                       help="Auto-detect trip from TruckNet API — starts/stops automatically "
                            "when the driver starts/ends a trip on the UI")
    parser.add_argument("--driver-email",
                        help="Driver email (overrides driver_email in config.yaml). "
                             "Use this so each laptop needs no yaml editing.")
    args = parser.parse_args()

    cfg = load_config()

    # CLI --driver-email overrides config.yaml value
    if args.driver_email:
        cfg["driver_email"] = args.driver_email

    # ── Resolve driver email → UUID (once on startup) ─────────────────────
    cfg["driver_id"] = resolve_driver_id(cfg)

    yolo, mlp = load_models(cfg)

    publisher = EventPublisher(cfg)
    publisher.connect()
    time.sleep(1)

    try:
        if args.trip_id:
            # ── Manual mode ───────────────────────────────────────────────
            cfg["auto_detect_trip"] = False
            try:
                run_trip(args.trip_id, cfg, yolo, mlp, publisher)
            except KeyboardInterrupt:
                logger.info("Camera agent stopped by user")

        else:
            # ── Auto mode ─────────────────────────────────────────────────
            cfg["auto_detect_trip"] = True
            logger.info(f"Auto mode — polling {cfg.get('auto_start_url')} every {POLL_INTERVAL}s")
            logger.info("Waiting for driver to start a trip on TruckNet UI...")

            current_trip = None
            try:
                while True:
                    active = fetch_active_trip(cfg)

                    if active and active != current_trip:
                        # New trip started
                        current_trip = active
                        logger.info(f"▶  Trip detected: {current_trip} — starting camera")
                        run_trip(current_trip, cfg, yolo, mlp, publisher)
                        current_trip = None
                        logger.info("Waiting for next trip...")

                    elif not active and current_trip:
                        # Trip ended between polls (edge case)
                        current_trip = None
                        logger.info("Waiting for next trip...")

                    time.sleep(POLL_INTERVAL)

            except KeyboardInterrupt:
                logger.info("Camera agent stopped by user")
    finally:
        publisher.disconnect()


if __name__ == "__main__":
    main()
