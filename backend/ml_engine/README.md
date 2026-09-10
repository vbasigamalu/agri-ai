# 🌱 Agri-AI — PyTorch ML Engine

> **Standalone Python training pipeline. Zero changes to Node.js production code.**

---

## Architecture

```
Plant Image (224×224)
        ↓
MobileNetV3-Large (timm, pretrained ImageNet)
        ↓  [fine-tuned end-to-end]
Global Average Pooling
        ↓
Classifier Head (N classes)
        ↓
Softmax → Disease Label + Confidence
```

## Files

| File | Purpose |
|------|---------|
| `train.py` | Full training pipeline (scan → train → evaluate → export) |
| `requirements.txt` | Python dependencies |
| `crop_disease_model.onnx` | **Output** — auto-loaded by `classifier.js` |
| `labels.json` | **Output** — class index array |
| `training_results.json` | **Output** — accuracy, F1, per-class metrics |
| `confusion_matrix.png` | **Output** — SIH evaluation chart |

## Quick Start

### Option A: One-Click (Windows)
```
Double-click train_model.bat  (in project root)
```

### Option B: Manual
```bash
cd backend/ml_engine
pip install -r requirements.txt
python train.py
```

## Dataset Structure
The script reads from `backend/dataset/` which must follow PlantVillage format:
```
backend/dataset/
├── Apple___Apple_scab/       ← 631 images
├── Apple___Black_rot/        ← 621 images
├── Tomato___Early_blight/    ← 1000 images
└── ...  (38 classes total)
```

## Inference Integration
After training, Node.js **automatically** switches to ONNX inference:

```
server start
    ↓
classifier.js checks: backend/ml_engine/crop_disease_model.onnx
    ↓ found?
    YES → ONNX Runtime (PyTorch model, higher accuracy)
    NO  → TF.js WASM  (original MobileNetV2, backward compat)
```

## GPU Upgrade
This system was set up for **Intel Iris Xe (CPU-only)**. To use NVIDIA GPU:

1. Install CUDA 12.x from https://developer.nvidia.com/cuda-downloads
2. Edit `requirements.txt`, replace the `--index-url` line:
   ```
   --index-url https://download.pytorch.org/whl/cu121
   torch==2.3.1+cu121
   torchvision==0.18.1+cu121
   ```
3. Re-run `pip install -r requirements.txt`
4. Training will be **10–30× faster**

## Expected Results (PlantVillage 38-class)

| Metric | CPU (no augmentation) | CPU (with Albumentations) |
|--------|----------------------|--------------------------|
| Val Accuracy | ~88% | **~93–96%** |
| F1-Score | ~0.87 | **~0.92–0.95** |
| Training time | ~4–6 hr | ~4–6 hr |

> Tip: Set `EPOCHS = 15` in `train.py` for a faster test run (~2.5 hr)
