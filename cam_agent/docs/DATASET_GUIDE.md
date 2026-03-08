# TruckNet Drowsiness Classifier — Dataset Guide

## Easiest option — Kaggle (requires free account)

Create a free account at kaggle.com, then download one of these:

### Option A — Drowsiness Dataset by dheerajperumandla (726 images each, ~4MB)
```
https://www.kaggle.com/datasets/dheerajperumandla/drowsiness-dataset
```
Folder structure after download + unzip:
```
drowsiness-dataset/
  Closed/     ← 726 images
  Open/       ← 726 images
  Yawn/
  no_yawn/
```
Run with:
```bash
python prepare_dataset.py --generic-path datasets/raw/drowsiness-dataset --output datasets/
```

### Option B — Driver Drowsiness Dataset V0 (~2,000 images)
```
https://www.kaggle.com/datasets/ismailnasri20/driver-drowsiness-dataset-v0
```
Same structure — works with `--generic-path`.

### Option C — Eye blink dataset (~4,800 images, CEW mirror)
```
https://www.kaggle.com/datasets/kutaykutlu/drowsiness-detection
```
Folder structure: `open_eye/` and `closed_eye/`
Run with `--generic-path` — auto-detected.

---

## Kaggle download instructions (no CLI needed)
1. Go to the dataset URL above
2. Click the **Download** button (top right)
3. Unzip into `cam_agent/training/datasets/raw/`

### Or via Kaggle CLI:
```bash
pip install kaggle
# Place your kaggle.json API token in ~/.kaggle/kaggle.json
kaggle datasets download dheerajperumandla/drowsiness-dataset -p datasets/raw/ --unzip
```

---

## Minimum training set
- 2,000 alert samples
- 2,000 drowsy samples

Option A (726 each) is small but sufficient for a first model. Combining A + B + C gives ~8,000 samples for a strong classifier.

## Full pipeline
```bash
cd cam_agent/training

python prepare_dataset.py --generic-path datasets/raw/drowsiness-dataset --output datasets/
python train.py
# Model saved to: models/drowsiness_mlp.pkl
```

## Data augmentation
Run `augment.py` to apply:
- Random horizontal flip
- Brightness variation ±30%
- Gaussian noise on keypoints ±2px
