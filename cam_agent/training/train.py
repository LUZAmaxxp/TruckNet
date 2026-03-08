#!/usr/bin/env python3
"""
Train TruckNet drowsiness classifier.

Improvements over v1:
  1. Keypoint normalization  — centers on nose, scales by inter-eye distance
                               so position/distance from camera don't affect features
  2. EAR as explicit feature — the best drowsiness signal is added directly
  3. Multi-model comparison  — tries MLP, RandomForest, GradientBoosting; saves best
  4. Augmentation option     — adds Gaussian noise to keypoints for larger effective dataset

Input:  datasets/keypoints_dataset.csv  (from prepare_dataset.py)
Output: models/drowsiness_mlp.pkl  (best model wins regardless of type)

Usage:
  python3 train.py
  python3 train.py --dataset datasets/keypoints_dataset.csv --output models/ --augment
"""

import numpy as np
import pandas as pd
import joblib
import argparse
import ast
from pathlib import Path
from sklearn.neural_network      import MLPClassifier
from sklearn.ensemble            import RandomForestClassifier, GradientBoostingClassifier
from sklearn.model_selection     import train_test_split, cross_val_score
from sklearn.preprocessing       import StandardScaler
from sklearn.pipeline            import Pipeline
from sklearn.metrics             import classification_report, confusion_matrix

# YOLOv8-pose COCO keypoint indices (same as ear_calculator.py)
_NOSE      = 0
_LEFT_EYE  = 1
_RIGHT_EYE = 2
_LEFT_EAR  = 3
_RIGHT_EAR = 4


def normalize_keypoints(flat_kp: np.ndarray) -> np.ndarray:
    """
    Normalize raw YOLOv8-pose keypoints so the classifier is invariant to:
      - face position on screen  (subtract nose position)
      - face size / camera distance  (divide by inter-eye distance)

    Input:  flat array of length 2*N  (x0,y0, x1,y1, ...)
    Output: same shape, normalized
    """
    kp = flat_kp.reshape(-1, 2).astype(float)
    nose      = kp[_NOSE]
    left_eye  = kp[_LEFT_EYE]
    right_eye = kp[_RIGHT_EYE]

    # Translate: center on nose
    kp -= nose

    # Scale: inter-eye distance → 1.0
    inter_eye = np.linalg.norm(left_eye - right_eye) + 1e-6
    kp /= inter_eye

    return kp.flatten()


def compute_ear(flat_kp: np.ndarray) -> float:
    """
    Compute Eye Aspect Ratio from raw (un-normalized) flattened keypoints.
    Mirrors ear_calculator.py logic.
    """
    kp = flat_kp.reshape(-1, 2)
    if len(kp) < 5:
        return 1.0
    left_eye  = kp[_LEFT_EYE]
    right_eye = kp[_RIGHT_EYE]
    left_ear  = kp[_LEFT_EAR]
    right_ear = kp[_RIGHT_EAR]
    nose      = kp[_NOSE]

    left_width   = np.linalg.norm(left_eye  - left_ear)  + 1e-6
    right_width  = np.linalg.norm(right_eye - right_ear) + 1e-6
    left_height  = abs(left_eye[1]  - nose[1]) * 0.3
    right_height = abs(right_eye[1] - nose[1]) * 0.3
    return float((left_height / left_width + right_height / right_width) / 2.0)


def build_features(raw_kps: np.ndarray) -> np.ndarray:
    """
    Build final feature matrix:
      - normalized keypoints  (pose-invariant coordinates)
      - EAR value             (strongest single drowsiness signal)
    """
    rows = []
    for kp in raw_kps:
        norm = normalize_keypoints(kp)
        ear  = compute_ear(kp)
        rows.append(np.append(norm, ear))
    return np.array(rows)


def augment_keypoints(X: np.ndarray, y: np.ndarray, noise_px: float = 2.0, factor: int = 3) -> tuple:
    """
    Augment dataset by adding Gaussian noise to raw keypoint coordinates.
    factor=3 triples the dataset size.
    """
    augmented_X = [X]
    augmented_y = [y]
    for _ in range(factor - 1):
        noise = np.random.normal(0, noise_px, X.shape)
        augmented_X.append(X + noise)
        augmented_y.append(y)
    return np.vstack(augmented_X), np.concatenate(augmented_y)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset", default="datasets/keypoints_dataset.csv")
    parser.add_argument("--output",  default="models/")
    parser.add_argument("--augment", action="store_true",
                        help="Augment training data with Gaussian noise (recommended for small datasets)")
    args = parser.parse_args()

    output = Path(args.output)
    output.mkdir(parents=True, exist_ok=True)

    print("Loading dataset...")
    df = pd.read_csv(args.dataset)
    raw_X = np.array([ast.literal_eval(kp) if isinstance(kp, str) else kp
                      for kp in df["keypoints"]])
    y = df["label"].values
    print(f"  {len(raw_X)} raw samples, {raw_X.shape[1]} raw features")

    # ── Augment raw keypoints BEFORE feature engineering ────────────────────
    if args.augment:
        raw_X, y = augment_keypoints(raw_X, y, noise_px=2.0, factor=5)
        print(f"  After augmentation: {len(raw_X)} samples")

    # ── Feature engineering ──────────────────────────────────────────────────
    print("Building features (normalize + EAR)...")
    X = build_features(raw_X)
    print(f"  Feature vector size: {X.shape[1]}  "
          f"(={raw_X.shape[1]} normalized kp + 1 EAR)")
    counts = dict(zip(*np.unique(y, return_counts=True)))
    print(f"  Classes: alert={counts.get(0,0)}, drowsy={counts.get(1,0)}")

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    # ── Candidate models ─────────────────────────────────────────────────────
    candidates = {
        "RandomForest": Pipeline([
            ("clf", RandomForestClassifier(
                n_estimators=300,
                max_depth=None,
                min_samples_leaf=2,
                random_state=42,
                n_jobs=-1,
            )),
        ]),
        "GradientBoosting": Pipeline([
            ("scaler", StandardScaler()),
            ("clf", GradientBoostingClassifier(
                n_estimators=200,
                max_depth=4,
                learning_rate=0.05,
                random_state=42,
            )),
        ]),
        "MLP": Pipeline([
            ("scaler", StandardScaler()),
            ("clf",    MLPClassifier(
                hidden_layer_sizes=(128, 64, 32),
                activation="relu",
                max_iter=500,
                random_state=42,
                early_stopping=True,
                validation_fraction=0.1,
                verbose=False,
            )),
        ]),
    }

    # ── Train & compare ───────────────────────────────────────────────────────
    print("\n── Training & comparing models ───────────────────")
    best_name, best_pipeline, best_f1 = None, None, 0.0

    for name, pipeline in candidates.items():
        pipeline.fit(X_train, y_train)
        cv_f1 = cross_val_score(pipeline, X, y, cv=5, scoring="f1").mean()
        y_pred = pipeline.predict(X_test)
        test_f1 = float(__import__("sklearn.metrics", fromlist=["f1_score"]).f1_score(y_test, y_pred))
        print(f"  {name:<20} CV F1={cv_f1:.3f}   Test F1={test_f1:.3f}")
        if cv_f1 > best_f1:
            best_f1, best_name, best_pipeline = cv_f1, name, pipeline

    # ── Full report for winner ────────────────────────────────────────────────
    print(f"\n── Best model: {best_name} (CV F1={best_f1:.3f}) ──────────────")
    y_pred = best_pipeline.predict(X_test)
    print(classification_report(y_test, y_pred, target_names=["alert", "drowsy"]))
    print("Confusion matrix:")
    print(confusion_matrix(y_test, y_pred))

    # ── Save ──────────────────────────────────────────────────────────────────
    model_path = output / "drowsiness_mlp.pkl"
    joblib.dump(best_pipeline, model_path)
    print(f"\nModel saved to {model_path}")


if __name__ == "__main__":
    main()
