"""
======================================================================
 🌱 Agri-AI — Tomato Disease Classifier Training on Google Colab (CUDA)
 10 Classes:
   1. Tomato___Bacterial_spot
   2. Tomato___Early_blight
   3. Tomato___Late_blight
   4. Tomato___Leaf_Mold
   5. Tomato___Septoria_leaf_spot
   6. Tomato___Spider_mites Two-spotted_spider_mite
   7. Tomato___Target_Spot
   8. Tomato___Tomato_Yellow_Leaf_Curl_Virus
   9. Tomato___Tomato_mosaic_virus
  10. Tomato___healthy
======================================================================
"""

import os
import sys
import json
import time
import random
import zipfile
from pathlib import Path

# 1. Verify CUDA / GPU Availability
import torch
print("\n" + "=" * 65)
print("🚀 Agri-AI Tomato Specialist — Colab GPU (CUDA) Training")
print("=" * 65)

if not torch.cuda.is_available():
    print("⚠️ WARNING: GPU not detected! In Colab, go to:")
    print("   Runtime -> Change runtime type -> Hardware accelerator -> T4 GPU")
    DEVICE = torch.device("cpu")
else:
    DEVICE = torch.device("cuda")
    print(f"⚡ GPU Online: {torch.cuda.get_device_name(0)}")
    print(f"⚡ VRAM Available: {torch.cuda.get_device_properties(0).total_memory / (1024**3):.1f} GB")

# 2. Extract dataset if zip exists
ZIP_PATH = Path("tomato_dataset.zip")
DATASET_DIR = Path("dataset")

if ZIP_PATH.exists() and not DATASET_DIR.exists():
    print(f"\n📦 Unzipping {ZIP_PATH.name}...")
    with zipfile.ZipFile(ZIP_PATH, "r") as zip_ref:
        zip_ref.extractall(".")
    print("✅ Dataset extracted successfully!")

# Check if dataset is in a subdirectory
if not DATASET_DIR.exists():
    # If unzipped inside dataset/dataset or similar
    possible = list(Path(".").glob("**/Tomato___healthy"))
    if possible:
        DATASET_DIR = possible[0].parent
        print(f"📂 Detected dataset folder: {DATASET_DIR}")
    else:
        print("❌ Dataset folder 'dataset' not found. Please upload tomato_dataset.zip")
        sys.exit(1)

# 3. Imports
import numpy as np
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, Dataset, WeightedRandomSampler
import timm
import albumentations as A
from albumentations.pytorch import ToTensorV2
from PIL import Image
from sklearn.metrics import accuracy_score, f1_score, classification_report
import onnx

# 4. Configuration
TOMATO_CLASSES = sorted([
    "Tomato___Bacterial_spot",
    "Tomato___Early_blight",
    "Tomato___Late_blight",
    "Tomato___Leaf_Mold",
    "Tomato___Septoria_leaf_spot",
    "Tomato___Spider_mites Two-spotted_spider_mite",
    "Tomato___Target_Spot",
    "Tomato___Tomato_Yellow_Leaf_Curl_Virus",
    "Tomato___Tomato_mosaic_virus",
    "Tomato___healthy"
])

MODEL_ARCH       = "mobilenetv3_large_100"
IMAGE_SIZE       = 224
BATCH_SIZE       = 64       # Fast throughput on T4 GPU (16GB)
EPOCHS           = 20       # 20 epochs runs in ~3-5 mins on GPU!
LEARNING_RATE    = 1e-3
WEIGHT_DECAY     = 1e-4
VALIDATION_SPLIT = 0.15
SEED             = 42

random.seed(SEED)
np.random.seed(SEED)
torch.manual_seed(SEED)
if torch.cuda.is_available():
    torch.cuda.manual_seed_all(SEED)

# 5. Scan and index images
all_samples = []
class_to_idx = {cls: i for i, cls in enumerate(TOMATO_CLASSES)}

print(f"\n📂 Scanning 10 Tomato Classes from {DATASET_DIR}...")
for cls in TOMATO_CLASSES:
    cls_dir = DATASET_DIR / cls
    if not cls_dir.exists():
        print(f"⚠️ Class directory not found: {cls_dir}")
        continue
    images = [f for f in cls_dir.iterdir() if f.suffix.lower() in {".jpg", ".jpeg", ".png"}]
    for img_p in images:
        all_samples.append((str(img_p), class_to_idx[cls]))
    print(f"   [{class_to_idx[cls]}] {cls:<48} : {len(images)} images")

print(f"\nTotal Tomato Samples: {len(all_samples)}")

# Save labels.json
with open("labels.json", "w", encoding="utf-8") as f:
    json.dump(TOMATO_CLASSES, f, indent=2)
print("🏷️ labels.json saved (10 classes).")

# 6. Stratified Split
from collections import defaultdict
cls_map = defaultdict(list)
for s in all_samples:
    cls_map[s[1]].append(s)

train_samples, val_samples = [], []
for c_idx, samples in cls_map.items():
    random.shuffle(samples)
    n_val = max(1, int(len(samples) * VALIDATION_SPLIT))
    val_samples.extend(samples[:n_val])
    train_samples.extend(samples[n_val:])

random.shuffle(train_samples)
random.shuffle(val_samples)
print(f"📊 Training Set: {len(train_samples)} images | Validation Set: {len(val_samples)} images")

# 7. Transforms & Dataset
IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD  = [0.229, 0.224, 0.225]

train_transform = A.Compose([
    A.Resize(IMAGE_SIZE, IMAGE_SIZE),
    A.HorizontalFlip(p=0.5),
    A.VerticalFlip(p=0.2),
    A.RandomRotate90(p=0.3),
    A.ShiftScaleRotate(shift_limit=0.1, scale_limit=0.15, rotate_limit=30, p=0.6),
    A.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.2, p=0.5),
    A.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
    ToTensorV2(),
])

val_transform = A.Compose([
    A.Resize(IMAGE_SIZE, IMAGE_SIZE),
    A.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
    ToTensorV2(),
])

class TomatoDataset(Dataset):
    def __init__(self, samples, transform=None):
        self.samples = samples
        self.transform = transform

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        path, label = self.samples[idx]
        try:
            img = Image.open(path).convert("RGB")
            img = np.array(img)
        except Exception:
            img = np.zeros((IMAGE_SIZE, IMAGE_SIZE, 3), dtype=np.uint8)
        
        if self.transform:
            img = self.transform(image=img)["image"]
        return img, label

# Weighted sampler for class balance
counts = np.bincount([s[1] for s in train_samples], minlength=len(TOMATO_CLASSES)).astype(float)
counts = np.where(counts == 0, 1.0, counts)
weights = 1.0 / counts
sample_weights = [weights[s[1]] for s in train_samples]
sampler = WeightedRandomSampler(sample_weights, num_samples=len(train_samples), replacement=True)

train_loader = DataLoader(
    TomatoDataset(train_samples, transform=train_transform),
    batch_size=BATCH_SIZE, sampler=sampler, num_workers=2, pin_memory=True
)
val_loader = DataLoader(
    TomatoDataset(val_samples, transform=val_transform),
    batch_size=BATCH_SIZE, shuffle=False, num_workers=2, pin_memory=True
)

# 8. Model Architecture
print(f"\n🧠 Initializing {MODEL_ARCH} (pretrained=True, num_classes=10)...")
model = timm.create_model(MODEL_ARCH, pretrained=True, num_classes=len(TOMATO_CLASSES))
model = model.to(DEVICE)

criterion = nn.CrossEntropyLoss(label_smoothing=0.05)
optimizer = optim.AdamW(model.parameters(), lr=LEARNING_RATE, weight_decay=WEIGHT_DECAY)
scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=EPOCHS, eta_min=1e-6)
scaler    = torch.amp.GradScaler("cuda") if DEVICE.type == "cuda" else None

# 9. Training Loop
print("\n" + "=" * 65)
print(f"  🚀 Starting 20 Epochs on {DEVICE.type.upper()}...")
print("=" * 65)

best_val_acc = 0.0
best_model_path = "best_tomato_model.pth"

for epoch in range(1, EPOCHS + 1):
    t0 = time.time()
    model.train()
    total_loss, correct, total = 0.0, 0, 0

    for images, labels in train_loader:
        images, labels = images.to(DEVICE, non_blocking=True), labels.to(DEVICE, non_blocking=True)
        optimizer.zero_grad()

        if scaler:
            with torch.amp.autocast(device_type="cuda"):
                logits = model(images)
                loss = criterion(logits, labels)
            scaler.scale(loss).backward()
            scaler.step(optimizer)
            scaler.update()
        else:
            logits = model(images)
            loss = criterion(logits, labels)
            loss.backward()
            optimizer.step()

        total_loss += loss.item() * images.size(0)
        preds = logits.argmax(dim=1)
        correct += (preds == labels).sum().item()
        total += images.size(0)

    train_loss = total_loss / max(total, 1)
    train_acc = correct / max(total, 1)

    # Validation
    model.eval()
    v_loss, v_corr, v_tot = 0.0, 0, 0
    all_p, all_l = [], []
    with torch.no_grad():
        for images, labels in val_loader:
            images, labels = images.to(DEVICE, non_blocking=True), labels.to(DEVICE, non_blocking=True)
            if scaler:
                with torch.amp.autocast(device_type="cuda"):
                    logits = model(images)
                    loss = criterion(logits, labels)
            else:
                logits = model(images)
                loss = criterion(logits, labels)

            v_loss += loss.item() * images.size(0)
            preds = logits.argmax(dim=1)
            v_corr += (preds == labels).sum().item()
            v_tot += images.size(0)
            all_p.extend(preds.cpu().numpy())
            all_l.extend(labels.cpu().numpy())

    val_loss = v_loss / max(v_tot, 1)
    val_acc = v_corr / max(v_tot, 1)
    val_f1 = f1_score(all_l, all_p, average="weighted", zero_division=0)
    scheduler.step()

    elapsed = time.time() - t0
    is_best = val_acc > best_val_acc
    marker = " 🌟 [NEW BEST]" if is_best else ""
    print(f"Epoch {epoch:2d}/{EPOCHS:2d} | Train: {train_loss:.4f} (Acc: {train_acc*100:.1f}%) | Val: {val_loss:.4f} (Acc: {val_acc*100:.2f}%) | F1: {val_f1:.4f} ({elapsed:.1f}s){marker}")

    if is_best:
        best_val_acc = val_acc
        torch.save(model.state_dict(), best_model_path)

print(f"\n🎯 Peak Validation Accuracy: {best_val_acc*100:.2f}%")

# 10. Final Evaluation & Report
model.load_state_dict(torch.load(best_model_path, map_location=DEVICE))
model.eval()
all_p, all_l = [], []
with torch.no_grad():
    for images, labels in val_loader:
        images = images.to(DEVICE)
        preds = model(images).argmax(dim=1)
        all_p.extend(preds.cpu().numpy())
        all_l.extend(labels.cpu().numpy())

print("\n📋 Final Classification Report (10 Tomato Diseases):")
print(classification_report(all_l, all_p, target_names=TOMATO_CLASSES, zero_division=0))

# 11. Export ONNX Model
print("\n📦 Exporting to ONNX...")
dummy_input = torch.randn(1, 3, IMAGE_SIZE, IMAGE_SIZE).to(DEVICE)
onnx_output = "crop_disease_model.onnx"

torch.onnx.export(
    model, dummy_input, onnx_output,
    export_params=True,
    opset_version=18,
    do_constant_folding=True,
    input_names=["input"],
    output_names=["output"],
    dynamic_axes={"input": {0: "batch_size"}, "output": {0: "batch_size"}}
)

onnx_model = onnx.load(onnx_output)
onnx.checker.check_model(onnx_model)
size_mb = os.path.getsize(onnx_output) / (1024 * 1024)
print(f"✅ ONNX Exported: {onnx_output} ({size_mb:.1f} MB)")
print("=" * 65)
print("🎉 All 20 Epochs Complete! Download crop_disease_model.onnx and labels.json")
print("=" * 65 + "\n")

# If running in Google Colab, trigger browser downloads:
try:
    import importlib
    colab_files = importlib.import_module("google.colab.files")
    print("⬇️ Triggering download of crop_disease_model.onnx...")
    colab_files.download(onnx_output)
    if os.path.exists(onnx_output + ".data"):
        colab_files.download(onnx_output + ".data")
    colab_files.download("labels.json")
except (ImportError, ModuleNotFoundError, Exception):
    pass

