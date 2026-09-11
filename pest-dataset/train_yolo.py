"""
train_yolo.py
─────────────────────────────────────────────────────────────────────────────
Steps 4, 5, 6, 7, 8 of the Pest Monitoring Pipeline:
- Augmentation
- YOLO / RT-DETR Training
- Evaluation
- Best Model Selection
- ONNX Model Export & Backend Deployment

Usage:
  # For Object Detection (if annotated with bounding boxes):
  python train_yolo.py --mode detect --epochs 50 --imgsz 640

  # For Classification (immediate training without manual bounding boxes):
  python train_yolo.py --mode classify --epochs 30 --imgsz 224
─────────────────────────────────────────────────────────────────────────────
"""

import os
import sys
import shutil
import argparse

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
YAML_PATH = os.path.join(BASE_DIR, "pest.yaml")
SPLIT_DIR = os.path.join(BASE_DIR, "split")
BACKEND_MODEL_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", "backend", "pest-model"))

def check_ultralytics():
    try:
        from ultralytics import YOLO
        return YOLO
    except ImportError:
        print("❌ 'ultralytics' is not installed yet.")
        print("   Run: pip install ultralytics")
        sys.exit(1)

def train(mode="classify", epochs=30, imgsz=224, batch=16):
    YOLO = check_ultralytics()

    print("=" * 65)
    print(f"🚀 AGRI-AI: TRAINING PEST MODEL [{mode.upper()} MODE]")
    print("=" * 65)
    print(f"📊 Epochs: {epochs} | Image Size: {imgsz} | Batch: {batch}")

    os.makedirs(BACKEND_MODEL_DIR, exist_ok=True)

    if mode == "detect":
        # Detection mode (requires bounding boxes in split/train/labels)
        model_name = "yolov8n.pt"
        data_target = YAML_PATH
        print(f"📦 Model: {model_name} (YOLOv8 Nano Detector)")
        print(f"📄 Dataset config: {data_target}")

        model = YOLO(model_name)
        results = model.train(
            data=data_target,
            epochs=epochs,
            imgsz=imgsz,
            batch=batch,
            # Augmentations enabled by default in YOLO:
            hsv_h=0.015, hsv_s=0.7, hsv_v=0.4,
            degrees=15.0, translate=0.1, scale=0.5,
            fliplr=0.5, flipud=0.2, mosaic=1.0,
            project=os.path.join(BASE_DIR, "runs"),
            name="pest_detect"
        )

        print("\n📈 EVALUATING ON TEST SPLIT...")
        metrics = model.val(data=data_target, split="test")
        print(f"✅ Detection Results — mAP50: {metrics.box.map50:.4f} | mAP50-95: {metrics.box.map:.4f}")

    else:
        # Classification mode
        model_name = "yolov8n-cls.pt"
        data_target = SPLIT_DIR
        print(f"📦 Model: {model_name} (YOLOv8 Nano Classifier)")
        print(f"📁 Dataset directory: {data_target}")

        model = YOLO(model_name)
        results = model.train(
            data=data_target,
            epochs=epochs,
            imgsz=imgsz,
            batch=batch,
            # Augmentation parameters
            hsv_h=0.015, hsv_s=0.7, hsv_v=0.4,
            degrees=15.0, translate=0.1, scale=0.5,
            fliplr=0.5,
            project=os.path.join(BASE_DIR, "runs"),
            name="pest_classify"
        )

        print("\n📈 EVALUATING ON TEST SPLIT...")
        metrics = model.val(data=data_target, split="test")
        print(f"✅ Classification Accuracy — Top 1: {metrics.top1:.4f} | Top 5: {metrics.top5:.4f}")

    # Export to ONNX
    print("\n🔄 EXPORTING BEST MODEL TO ONNX...")
    best_pt = os.path.join(model.trainer.save_dir, "weights", "best.pt")
    if not os.path.exists(best_pt):
        best_pt = os.path.join(BASE_DIR, "runs", f"pest_{mode}", "weights", "best.pt")

    onnx_file = model.export(format="onnx", imgsz=imgsz)
    print(f"✨ Model exported to ONNX: {onnx_file}")

    # Deploy to backend
    target_onnx = os.path.join(BACKEND_MODEL_DIR, "pest_detector.onnx")
    shutil.copy2(onnx_file, target_onnx)
    print(f"🚀 Model deployed to Backend: {target_onnx}")
    print("=" * 65)
    print("🎉 Training, Evaluation, Export, and Deployment Complete!")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train YOLO model for Agri-AI pest monitoring")
    parser.add_argument("--mode", choices=["detect", "classify"], default="classify", help="Training mode")
    parser.add_argument("--epochs", type=int, default=30, help="Number of training epochs")
    parser.add_argument("--imgsz", type=int, default=224, help="Input image size")
    parser.add_argument("--batch", type=int, default=16, help="Batch size")
    args = parser.parse_args()

    train(mode=args.mode, epochs=args.epochs, imgsz=args.imgsz, batch=args.batch)
