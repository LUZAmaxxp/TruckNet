#!/usr/bin/env python3
"""
TruckNet cam_agent — Live Model Test
=====================================
Opens your camera, runs YOLOv8-pose + the drowsiness classifier and shows
everything in a pygame window.

Overlays drawn on the frame
---------------------------
  • Skeleton lines + keypoint circles (white / colour-coded joints)
  • Bounding box around detected person
  • EAR value bar (green → yellow → red)
  • Eye-state badge  : ALERT / DROWSY / MICROSLEEP
  • MLP confidence   : probability bar + numeric value
  • Yaw angle badge  : LOOKING LEFT / FORWARD / RIGHT
  • FPS counter (top-right)

Controls
--------
  Q / Esc  : quit
  +  / -   : increase / decrease EAR drowsy threshold by 0.01

Usage (from cam_agent folder)
------------------------------
  python live_test.py
  python live_test.py --camera 1          # try other camera indices
  python live_test.py --width 1280 --height 720
"""

import sys
import time
import argparse
import math
from pathlib import Path

import cv2
import numpy as np
import pygame

# ── local imports ─────────────────────────────────────────────────────────────
sys.path.insert(0, str(Path(__file__).parent / "inference"))
from ear_calculator import eye_aspect_ratio, classify_eye_state
from head_pose      import estimate_yaw_angle, estimate_pitch_angle

# EAR is only reliable when the head is approximately frontal.
# Outside this pitch range the eye-to-nose geometry is distorted → false alerts.
EAR_PITCH_MIN = 8.0   # degrees — below this: looking too far up
EAR_PITCH_MAX = 60.0  # degrees — above this: looking too far down


# ── COCO-17 skeleton (YOLOv8 pose) ────────────────────────────────────────────
SKELETON_EDGES = [
    (0, 1), (0, 2),                      # nose → eyes
    (1, 3), (2, 4),                      # eyes → ears
    (5, 6),                              # shoulders
    (5, 7), (7, 9),                      # left arm
    (6, 8), (8, 10),                     # right arm
    (5, 11), (6, 12),                    # torso sides
    (11, 12),                            # hips
    (11, 13), (13, 15),                  # left leg
    (12, 14), (14, 16),                  # right leg
]

# Eye-relevant keypoints drawn larger / highlighted
EYE_KP_IDX = {0, 1, 2, 3, 4}

# Colour palette  (BGR)
C_ALERT      = (0,   220,  0)
C_DROWSY     = (0,   165, 255)
C_MICROSLEEP = (0,    0,  220)
C_DISTRACTED = (0,   165, 255)
C_WHITE      = (255, 255, 255)
C_DARK       = (20,   20,  20)
C_BAR_BG     = (60,   60,  60)

# Layout constants
PANEL_W      = 300   # right-side info panel width (pixels)
FONT         = cv2.FONT_HERSHEY_SIMPLEX


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def load_yolo(model_path: Path | None = None):
    try:
        from ultralytics import YOLO
    except ImportError:
        print("[live_test] ERROR: ultralytics not installed.")
        print("           Run: pip install -r requirements.txt")
        sys.exit(1)

    if model_path is None:
        model_path = _resolve_model_path()

    if not model_path.exists():
        print(f"[live_test] ERROR: pose model not found at {model_path}")
        sys.exit(1)

    print(f"[live_test] Loading YOLO from {model_path} …")
    yolo = YOLO(str(model_path))
    # Warmup: run a dummy inference to compile the operator graph
    # so the first real camera frame has no extra lag
    yolo(np.zeros((640, 640, 3), dtype=np.uint8), verbose=False)
    return yolo


def _resolve_model_path() -> Path:
    """Read pose_model_path from config.yaml, falling back to yolov8n-pose.pt."""
    import yaml
    config_path = Path(__file__).parent / "config" / "config.yaml"
    if config_path.exists():
        with open(config_path) as f:
            cfg = yaml.safe_load(f)
        rel = cfg.get("pose_model_path", "models/yolov8n-pose.pt")
        return Path(__file__).parent / rel
    return Path(__file__).parent / "models" / "yolov8n-pose.pt"


def load_mlp():
    mlp_path = Path(__file__).parent / "models" / "drowsiness_mlp.pkl"
    if not mlp_path.exists():
        print("[live_test] WARNING: drowsiness_mlp.pkl not found — EAR-only mode")
        return None
    try:
        import joblib
        mlp = joblib.load(mlp_path)
        print(f"[live_test] Loaded drowsiness classifier from {mlp_path}")
        return mlp
    except Exception as e:
        print(f"[live_test] WARNING: could not load MLP: {e}")
        return None


def draw_bar(frame, x, y, w, h, fraction, color_filled, label):
    """Draw a labelled horizontal progress bar."""
    fraction = float(np.clip(fraction, 0.0, 1.0))
    cv2.rectangle(frame, (x, y), (x + w, y + h), C_BAR_BG, -1)
    filled_w = int(w * fraction)
    if filled_w > 0:
        cv2.rectangle(frame, (x, y), (x + filled_w, y + h), color_filled, -1)
    cv2.rectangle(frame, (x, y), (x + w, y + h), C_WHITE, 1)
    pct_txt = f"{int(fraction * 100)}%"
    cv2.putText(frame, label,   (x,         y - 5), FONT, 0.42, C_WHITE,  1, cv2.LINE_AA)
    cv2.putText(frame, pct_txt, (x + w + 5, y + h - 2), FONT, 0.42, C_WHITE, 1, cv2.LINE_AA)


def ear_colour(ear: float, drowsy_thresh: float, micro_thresh: float):
    if ear < micro_thresh:
        return C_MICROSLEEP
    if ear < drowsy_thresh:
        return C_DROWSY
    return C_ALERT


def state_colour(state: str):
    return {"alert": C_ALERT, "drowsy": C_DROWSY, "microsleep": C_MICROSLEEP}.get(state, C_WHITE)


def draw_panel(frame, panel_x: int, ear: float, eye_state: str, yaw_deg: float,
               mlp_prob: float | None, drowsy_thresh: float, micro_thresh: float,
               fps: float, person_detected: bool,
               pitch_deg: float = 25.0, ear_valid: bool = True):
    """Fill the right-side HUD panel."""
    h = frame.shape[0]
    cv2.rectangle(frame, (panel_x, 0), (frame.shape[1], h), C_DARK, -1)

    pad  = 12
    x    = panel_x + pad
    cy   = 28      # current Y cursor

    # ── Title ──────────────────────────────────────────────────────────────
    cv2.putText(frame, "cam_agent live test", (x, cy), FONT, 0.52, C_WHITE, 1, cv2.LINE_AA)
    cy += 24
    cv2.line(frame, (panel_x, cy), (frame.shape[1], cy), (70, 70, 70), 1)
    cy += 14

    if not person_detected:
        cv2.putText(frame, "NO FACE DETECTED", (x, cy + 20), FONT, 0.6, C_MICROSLEEP, 2, cv2.LINE_AA)
        return

    bar_w = PANEL_W - pad * 2 - 40

    # ── EAR ────────────────────────────────────────────────────────────────
    cv2.putText(frame, f"EAR  {ear:.3f}  (thresh {drowsy_thresh:.2f})", (x, cy), FONT, 0.44, C_WHITE, 1, cv2.LINE_AA)
    cy += 18
    ear_norm  = np.clip(ear / 0.5, 0.0, 1.0)             # 0–0.5 mapped to 0–100%
    draw_bar(frame, x, cy, bar_w, 14, ear_norm, ear_colour(ear, drowsy_thresh, micro_thresh), "")
    cy += 32

    # ── Eye state badge ────────────────────────────────────────────────────
    badge_color = state_colour(eye_state)
    badge_txt   = eye_state.upper()
    (tw, th), _ = cv2.getTextSize(badge_txt, FONT, 0.7, 2)
    bx, by = x, cy
    cv2.rectangle(frame, (bx - 4, by - th - 4), (bx + tw + 8, by + 4), badge_color, -1)
    cv2.putText(frame, badge_txt, (bx, by), FONT, 0.7, (10, 10, 10), 2, cv2.LINE_AA)
    cy += 36

    # ── MLP classifier ─────────────────────────────────────────────────────
    if mlp_prob is not None:
        cv2.putText(frame, f"MLP drowsy prob  {mlp_prob:.3f}", (x, cy), FONT, 0.44, C_WHITE, 1, cv2.LINE_AA)
        cy += 18
        mlp_bar_color = C_MICROSLEEP if mlp_prob > 0.65 else (C_DROWSY if mlp_prob > 0.35 else C_ALERT)
        draw_bar(frame, x, cy, bar_w, 14, mlp_prob, mlp_bar_color, "")
        cy += 32
    else:
        cv2.putText(frame, "MLP: not loaded", (x, cy), FONT, 0.44, (120, 120, 120), 1, cv2.LINE_AA)
        cy += 32

    # ── EAR validity warning ────────────────────────────────────────────────
    if not ear_valid:
        cv2.putText(frame, "EAR PAUSED (head tilted)", (x, cy), FONT, 0.44,
                    (0, 200, 255), 1, cv2.LINE_AA)
        cy += 20

    # ── Head yaw ───────────────────────────────────────────────────────────
    cv2.line(frame, (panel_x, cy), (frame.shape[1], cy), (70, 70, 70), 1)
    cy += 12

    yaw_ab    = abs(yaw_deg)
    yaw_norm  = np.clip(yaw_ab / 90.0, 0.0, 1.0)
    distracted = yaw_ab > 30
    yaw_color = C_DISTRACTED if distracted else C_ALERT

    dir_str   = "RIGHT" if yaw_deg > 5 else ("LEFT" if yaw_deg < -5 else "FORWARD")
    yaw_label = f"Yaw {yaw_deg:+.1f}°  {dir_str}"
    cv2.putText(frame, yaw_label, (x, cy), FONT, 0.46, yaw_color, 1, cv2.LINE_AA)
    cy += 18
    draw_bar(frame, x, cy, bar_w, 14, yaw_norm, yaw_color, "")
    cy += 32

    if distracted:
        cv2.putText(frame, "! DISTRACTION RISK", (x, cy), FONT, 0.52, C_DISTRACTED, 2, cv2.LINE_AA)
        cy += 28

    # ── Head pitch ─────────────────────────────────────────────────────────
    pitch_color = (120, 120, 120) if ear_valid else (0, 200, 255)
    pitch_dir   = "DOWN" if pitch_deg > 40 else ("UP" if pitch_deg < 8 else "FRONTAL")
    cv2.putText(frame, f"Pitch {pitch_deg:+.1f}°  {pitch_dir}",
                (x, cy), FONT, 0.44, pitch_color, 1, cv2.LINE_AA)
    cy += 20

    # ── Thresholds reminder ────────────────────────────────────────────────
    cy = h - 60
    cv2.line(frame, (panel_x, cy), (frame.shape[1], cy), (70, 70, 70), 1)
    cv2.putText(frame, f"drowsy thresh : {drowsy_thresh:.2f}  (+/-)", (x, cy + 18), FONT, 0.40, (150, 150, 150), 1, cv2.LINE_AA)
    cv2.putText(frame,  "Q / Esc : quit",                              (x, cy + 36), FONT, 0.40, (150, 150, 150), 1, cv2.LINE_AA)

    # ── FPS ────────────────────────────────────────────────────────────────
    cv2.putText(frame, f"{fps:.1f} fps", (panel_x + 4, 16), FONT, 0.45, (150, 150, 150), 1, cv2.LINE_AA)


def draw_skeleton(frame, keypoints: np.ndarray, ear: float,
                  drowsy_thresh: float, micro_thresh: float):
    """Draw skeleton edges and keypoint circles on the frame."""
    kp_color = ear_colour(ear, drowsy_thresh, micro_thresh)

    for i, j in SKELETON_EDGES:
        if i >= len(keypoints) or j >= len(keypoints):
            continue
        x1, y1 = keypoints[i][:2].astype(int)
        x2, y2 = keypoints[j][:2].astype(int)
        if x1 == 0 and y1 == 0:
            continue
        if x2 == 0 and y2 == 0:
            continue
        cv2.line(frame, (x1, y1), (x2, y2), (180, 180, 180), 1, cv2.LINE_AA)

    for idx, kp in enumerate(keypoints):
        x, y = int(kp[0]), int(kp[1])
        if x == 0 and y == 0:
            continue
        if idx in EYE_KP_IDX:
            cv2.circle(frame, (x, y), 6, kp_color, -1, cv2.LINE_AA)
            cv2.circle(frame, (x, y), 7, C_WHITE,   1, cv2.LINE_AA)
        else:
            cv2.circle(frame, (x, y), 3, C_WHITE, -1, cv2.LINE_AA)


def draw_bbox(frame, box, ear: float, drowsy_thresh: float, micro_thresh: float):
    x1, y1, x2, y2 = map(int, box[:4])
    color = ear_colour(ear, drowsy_thresh, micro_thresh)
    cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2, cv2.LINE_AA)


# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="cam_agent live model test (pygame)")
    parser.add_argument("--camera", type=int,  default=0,    help="Camera index (default 0)")
    parser.add_argument("--width",  type=int,  default=960,  help="Frame width  (default 960)")
    parser.add_argument("--height", type=int,  default=540,  help="Frame height (default 540)")
    args = parser.parse_args()

    # Load models in parallel
    from concurrent.futures import ThreadPoolExecutor
    model_path = _resolve_model_path()
    print(f"[live_test] Using pose model: {model_path.name}")
    print("[live_test] Loading models in parallel …")
    with ThreadPoolExecutor(max_workers=2) as ex:
        yolo_future = ex.submit(load_yolo, model_path)
        mlp_future  = ex.submit(load_mlp)
    yolo = yolo_future.result()
    mlp  = mlp_future.result()

    # Open camera
    cap = cv2.VideoCapture(args.camera)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH,  args.width)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, args.height)

    if not cap.isOpened():
        print(f"[live_test] ERROR: cannot open camera {args.camera}")
        sys.exit(1)

    cam_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    cam_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    win_w = cam_w + PANEL_W
    win_h = cam_h

    # Init pygame
    pygame.init()
    screen = pygame.display.set_mode((win_w, win_h))
    pygame.display.set_caption("cam_agent — Live Drowsiness Test")
    clock  = pygame.time.Clock()

    # Runtime thresholds (adjustable with +/-)
    drowsy_thresh = 0.25
    micro_thresh  = 0.20

    fps          = 0.0
    frame_times  = []
    MAX_FT       = 30

    print("[live_test] Running — press Q or Esc to quit, +/- to adjust EAR threshold")

    while True:
        t0 = time.monotonic()

        # ── Pygame event handling ─────────────────────────────────────────
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                cap.release()
                pygame.quit()
                sys.exit(0)
            if event.type == pygame.KEYDOWN:
                if event.key in (pygame.K_q, pygame.K_ESCAPE):
                    cap.release()
                    pygame.quit()
                    sys.exit(0)
                if event.key == pygame.K_EQUALS or event.key == pygame.K_PLUS:
                    drowsy_thresh = round(min(drowsy_thresh + 0.01, 0.60), 2)
                    print(f"[live_test] EAR drowsy threshold → {drowsy_thresh:.2f}")
                if event.key == pygame.K_MINUS:
                    drowsy_thresh = round(max(drowsy_thresh - 0.01, 0.05), 2)
                    print(f"[live_test] EAR drowsy threshold → {drowsy_thresh:.2f}")

        # ── Capture frame ─────────────────────────────────────────────────
        ret, frame = cap.read()
        if not ret:
            print("[live_test] Frame capture failed")
            time.sleep(0.05)
            continue

        # Allocate canvas with panel
        canvas = np.zeros((win_h, win_w, 3), dtype=np.uint8)
        canvas[:cam_h, :cam_w] = frame

        # ── YOLO inference ────────────────────────────────────────────────
        results        = yolo(frame, verbose=False)
        person_detected = False

        ear           = 1.0
        yaw_deg       = 0.0
        pitch_deg     = 25.0
        ear_valid     = True
        eye_state     = "alert"
        mlp_prob      = None

        if results and results[0].keypoints is not None and len(results[0].keypoints) > 0:
            person_detected = True
            keypoints = results[0].keypoints.xy[0].cpu().numpy()

            ear       = eye_aspect_ratio(keypoints)
            yaw_deg   = estimate_yaw_angle(keypoints)
            pitch_deg = estimate_pitch_angle(keypoints)

            # Only classify eye state when head is frontal — tilting up/down
            # compresses the eye-to-nose distance and causes false drowsy alerts.
            ear_valid = EAR_PITCH_MIN <= pitch_deg <= EAR_PITCH_MAX
            eye_state = (
                classify_eye_state(ear, drowsy_thresh, micro_thresh)
                if ear_valid else "alert"
            )

            # MLP inference
            if mlp is not None:
                try:
                    kp      = keypoints.astype(float)
                    nose    = kp[0]
                    inter   = float(np.linalg.norm(kp[1] - kp[2])) + 1e-6
                    norm_kp = ((kp - nose) / inter).flatten()
                    feat    = np.append(norm_kp, ear).reshape(1, -1)
                    mlp_prob = float(mlp.predict_proba(feat)[0][1])
                except Exception:
                    mlp_prob = None

            # Draw skeleton + bbox on canvas
            draw_skeleton(canvas, keypoints, ear, drowsy_thresh, micro_thresh)

            if results[0].boxes is not None and len(results[0].boxes) > 0:
                draw_bbox(canvas, results[0].boxes.xyxy[0].cpu().numpy(),
                          ear, drowsy_thresh, micro_thresh)

        # ── Info panel ────────────────────────────────────────────────────
        draw_panel(canvas, cam_w, ear, eye_state, yaw_deg, mlp_prob,
                   drowsy_thresh, micro_thresh, fps, person_detected,
                   pitch_deg=pitch_deg, ear_valid=ear_valid)

        # ── Divider line between frame and panel ─────────────────────────
        cv2.line(canvas, (cam_w, 0), (cam_w, win_h), (80, 80, 80), 1)

        # ── Blit to pygame ────────────────────────────────────────────────
        rgb     = cv2.cvtColor(canvas, cv2.COLOR_BGR2RGB)
        surface = pygame.surfarray.make_surface(rgb.swapaxes(0, 1))
        screen.blit(surface, (0, 0))
        pygame.display.flip()

        # ── FPS tracking ─────────────────────────────────────────────────
        elapsed = time.monotonic() - t0
        frame_times.append(elapsed)
        if len(frame_times) > MAX_FT:
            frame_times.pop(0)
        fps = 1.0 / (sum(frame_times) / len(frame_times) + 1e-9)

        clock.tick(60)


if __name__ == "__main__":
    main()
