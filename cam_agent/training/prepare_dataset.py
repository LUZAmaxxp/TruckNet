#!/usr/bin/env python3
"""
Prepare keypoint dataset for drowsiness classifier.

Supported datasets (use whichever you have — they are merged automatically):

  1. CEW — Closed Eyes in the Wild
       openLeftEyes/    → alert (label 0)
       closedLeftEyes/  → drowsy (label 1)

  2. MRL Eye Dataset  (mrl.cs.vsb.cz/eyedataset — recommended, 84k images)
       s01/, s02/, ... — images named  <id>_0_<...>.png  (0=closed) or  <id>_1_<...>.png  (1=open)

  3. Kaggle / generic flat folder
       Structure: open/ and closed/ (or eye_open/ and eye_closed/)

Output: datasets/keypoints_dataset.csv

Usage examples:
  # MRL only
  python3 prepare_dataset.py --mrl-path datasets/raw/MRL --output datasets/

  # CEW only
  python3 prepare_dataset.py --cew-path datasets/raw/CEW --output datasets/

  # Both merged
  python3 prepare_dataset.py --cew-path datasets/raw/CEW --mrl-path datasets/raw/MRL --output datasets/
"""

import cv2
import numpy as np
import pandas as pd
import argparse
from pathlib import Path
from tqdm import tqdm

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".bmp"}


def extract_keypoints(model, image_path: str):
    """Run YOLOv8-pose on image, return flattened keypoints or None."""
    img = cv2.imread(image_path)
    if img is None:
        return None
    results = model(img, verbose=False)
    if not results or results[0].keypoints is None or len(results[0].keypoints) == 0:
        return None
    return results[0].keypoints.xy[0].cpu().numpy().flatten().tolist()


def process_cew_dataset(model, cew_path: Path) -> list[dict]:
    """
    CEW structure:
      closedLeftEyes/ → label 1 (drowsy)
      openLeftEyes/   → label 0 (alert)
    """
    records = []
    for label, folder in [(0, "openLeftEyes"), (1, "closedLeftEyes")]:
        folder_path = cew_path / folder
        if not folder_path.exists():
            print(f"[CEW] Warning: {folder_path} not found — skipping")
            continue
        images = [p for p in folder_path.iterdir() if p.suffix.lower() in IMAGE_EXTS]
        for img_path in tqdm(images, desc=f"CEW/{folder}"):
            kp = extract_keypoints(model, str(img_path))
            if kp is not None:
                records.append({"keypoints": kp, "label": label, "source": "CEW"})
    print(f"[CEW] {len(records)} samples extracted")
    return records


def process_mrl_dataset(model, mrl_path: Path) -> list[dict]:
    """
    MRL Eye Dataset structure:
      s01/, s02/, ... — one folder per subject
      Filename convention:  <subjectId>_<label>_<rest>.png
        label 0 = closed (drowsy), label 1 = open (alert)
      We map: filename label 0 → classifier label 1 (drowsy)
                         label 1 → classifier label 0 (alert)
    """
    records = []
    subject_dirs = sorted([d for d in mrl_path.iterdir() if d.is_dir()])
    if not subject_dirs:
        # flat folder — try direct images
        subject_dirs = [mrl_path]

    for subject_dir in subject_dirs:
        images = [p for p in subject_dir.iterdir() if p.suffix.lower() in IMAGE_EXTS]
        for img_path in tqdm(images, desc=f"MRL/{subject_dir.name}", leave=False):
            # MRL naming: subjectId_eyeState_... where eyeState 0=closed,1=open
            parts = img_path.stem.split("_")
            if len(parts) < 2:
                continue
            try:
                eye_state = int(parts[1])  # 0=closed, 1=open
            except ValueError:
                continue
            label = 1 if eye_state == 0 else 0  # closed→drowsy(1), open→alert(0)
            kp = extract_keypoints(model, str(img_path))
            if kp is not None:
                records.append({"keypoints": kp, "label": label, "source": "MRL"})

    print(f"[MRL] {len(records)} samples extracted")
    return records


def process_generic_dataset(model, root_path: Path) -> list[dict]:
    """
    Generic flat structure with open/ and closed/ subdirectories.
    Case-insensitive matching — works with Kaggle datasets that use Open/, Closed/,
    eye_open/, eye_closed/, Alert/, Drowsy/, openLeftEyes/, closedLeftEyes/, etc.
    """
    open_keywords   = {"open", "eye_open", "alert", "openlefteyes", "eyes_open", "awake"}
    closed_keywords = {"closed", "eye_closed", "drowsy", "closedlefteyes", "eyes_closed", "sleepy", "microsleep"}
    records = []

    # Build a lowercase-name → actual Path map of subdirectories
    subdirs = {d.name.lower(): d for d in root_path.iterdir() if d.is_dir()}

    open_dir   = next((subdirs[k] for k in open_keywords   if k in subdirs), None)
    closed_dir = next((subdirs[k] for k in closed_keywords if k in subdirs), None)

    if open_dir is None and closed_dir is None:
        available = list(subdirs.keys())
        print(f"[Generic] ERROR: Could not auto-detect open/closed folders in {root_path}")
        print(f"[Generic] Found subdirectories: {available}")
        print(f"[Generic] Rename your folders to 'open' and 'closed' and retry.")
        return records

    for label, folder in [(0, open_dir), (1, closed_dir)]:
        if folder is None:
            continue
        images = [p for p in folder.iterdir() if p.suffix.lower() in IMAGE_EXTS]
        for img_path in tqdm(images, desc=f"Generic/{folder.name}"):
            kp = extract_keypoints(model, str(img_path))
            if kp is not None:
                records.append({"keypoints": kp, "label": label, "source": "generic"})
    print(f"[Generic] {len(records)} samples extracted")
    return records


def main():
    parser = argparse.ArgumentParser(
        description="Prepare keypoint dataset from CEW and/or MRL Eye Dataset"
    )
    parser.add_argument("--cew-path",     default=None, help="Path to CEW dataset root")
    parser.add_argument("--mrl-path",     default=None, help="Path to MRL Eye Dataset root")
    parser.add_argument("--generic-path", default=None, action="append",
                        help="Path to generic open/closed folder (can be repeated)")
    parser.add_argument("--output",       default="datasets/")
    args = parser.parse_args()

    if not any([args.cew_path, args.mrl_path, args.generic_path]):
        parser.error("Provide at least one of --cew-path, --mrl-path, or --generic-path")

    output = Path(args.output)
    output.mkdir(parents=True, exist_ok=True)

    try:
        from ultralytics import YOLO
    except ImportError:
        print("ERROR: pip install ultralytics first")
        return

    model = YOLO("yolov8n-pose.pt")

    all_records: list[dict] = []

    if args.cew_path:
        all_records += process_cew_dataset(model, Path(args.cew_path))
    if args.mrl_path:
        all_records += process_mrl_dataset(model, Path(args.mrl_path))
    if args.generic_path:
        all_records += process_generic_dataset(model, Path(args.generic_path))

    if not all_records:
        print("No samples extracted — check your dataset paths and folder structure")
        return

    df = pd.DataFrame(all_records)
    counts = df["label"].value_counts().to_dict()
    print(f"\nDataset summary: alert={counts.get(0,0)}, drowsy={counts.get(1,0)}, total={len(df)}")

    out_path = output / "keypoints_dataset.csv"
    df.to_csv(out_path, index=False)
    print(f"Saved to {out_path}")


if __name__ == "__main__":
    main()
