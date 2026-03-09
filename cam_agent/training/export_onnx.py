#!/usr/bin/env python3
"""
Export yolov8n-pose.pt → yolov8n-pose.onnx for faster CPU load and inference.

Run once after placing models/yolov8n-pose.pt:
    cd cam_agent
    python training/export_onnx.py

Then update config/config.yaml:
    pose_model_path: "models/yolov8n-pose.onnx"
"""
from pathlib import Path
from ultralytics import YOLO

model_path = Path(__file__).parent.parent / "models" / "yolov8n-pose.pt"

if not model_path.exists():
    raise FileNotFoundError(
        f"Model not found: {model_path}\n"
        "Download it first:\n"
        "  https://github.com/ultralytics/assets/releases/download/v8.1.0/yolov8n-pose.pt"
    )

print(f"Exporting {model_path} to ONNX …")
YOLO(str(model_path)).export(format="onnx", imgsz=640)

onnx_path = model_path.with_suffix(".onnx")
print(f"\nDone — saved to {onnx_path}")
print("\nUpdate config/config.yaml to use the ONNX model:")
print('  pose_model_path: "models/yolov8n-pose.onnx"')
