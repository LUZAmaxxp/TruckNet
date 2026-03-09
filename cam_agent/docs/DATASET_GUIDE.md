# TruckNet Drowsiness Classifier — Dataset Guide

The trained model (`models/drowsiness_mlp.pkl`) is already committed to the
repository with **98% F1** on a held-out test set.
Only follow this guide if you want to retrain from scratch or improve the model
with more data.

---

## How the classifier works

The RandomForest pipeline does **not** operate on raw images.
YOLOv8-pose extracts the 17 COCO keypoints, then the training pipeline:
1. Normalises keypoints (centre on nose, scale by inter-eye distance)
2. Appends the EAR (Eye Aspect Ratio) as feature #35
3. Trains a RandomForest with 5× data augmentation (Gaussian noise on keypoints)

This makes the model invariant to head position, distance from camera, and
resolution — which is why it generalises well on small datasets.

---

## Kaggle datasets (easiest, free account required)

### Option A — Drowsiness Dataset by dheerajperumandla (~1 400 images)
```
https://www.kaggle.com/datasets/dheerajperumandla/drowsiness-dataset
```
Folder structure after unzip:
```
drowsiness-dataset/
  Closed/     ← closed eyes
  Open/       ← open eyes
  Yawn/
  no_yawn/
```

### Option B — Driver Drowsiness Dataset V0 (~2 000 images)
```
https://www.kaggle.com/datasets/ismailnasri20/driver-drowsiness-dataset-v0
```

### Option C — Drowsiness Detection (CEW mirror, ~4 800 images)
```
https://www.kaggle.com/datasets/kutaykutlu/drowsiness-detection
```
Folder structure: `open_eye/` and `closed_eye/`.

All three work with `--generic-path`; the script auto-detects `Closed/Open`,
`closed_eye/open_eye`, and similar naming conventions.

---

## Download instructions

### Browser (no CLI)
1. Go to the dataset URL
2. Click **Download** (top right)
3. Unzip into `cam_agent/training/datasets/raw/`

### Kaggle CLI
```bash
pip install kaggle
# Place kaggle.json in ~/.kaggle/kaggle.json (from kaggle.com → Settings → API)
kaggle datasets download dheerajperumandla/drowsiness-dataset \
  -p cam_agent/training/datasets/raw/ --unzip
```

---

## Full training pipeline

```bash
cd cam_agent/training

# 1. Extract keypoints from images — outputs datasets/keypoints.csv
python prepare_dataset.py --generic-path datasets/raw/drowsiness-dataset

# Multiple folders can be merged:
python prepare_dataset.py \
  --generic-path datasets/raw/drowsiness-dataset \
  --generic-path datasets/raw/driver-drowsiness-dataset-v0

# 2. Train (--augment multiplies the dataset 5× via Gaussian noise)
python train.py --augment

# Model saved to: ../models/drowsiness_mlp.pkl
# Comparison output: RandomForest vs GradientBoosting vs MLP
```

Expected output with Option A + augmentation:
```
RandomForest    CV F1 = 0.983   Test F1 = 0.986   ← winner, auto-saved
GradientBoosting CV F1 = 0.971  Test F1 = 0.974
MLP              CV F1 = 0.955  Test F1 = 0.961
```

---

## Minimum dataset size

| Size         | Expected F1 | Notes |
|--------------|-------------|-------|
| 500 samples  | ~73%        | Too small for production |
| 1 400 samples + augment | ~98% | Option A only — sufficient |
| 8 000+ samples | 99%+     | Options A + B + C combined |

---

## Data augmentation

Augmentation is built into `train.py` — no separate script needed.
Pass `--augment` to enable 5× multiplication with Gaussian noise on keypoints:

```bash
python train.py --augment
```
