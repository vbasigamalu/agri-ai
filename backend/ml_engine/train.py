"""
======================================================================
  Agri-AI — PyTorch Training Pipeline with Background-Bias Reduction
======================================================================
  Architecture  : MobileNetV3-Large (timm) — Field Robustness Tuning
  Augmentation  : Albumentations — 12 Comprehensive Field Transforms
  Debiasing     : Realistic Agricultural Background Randomization (Soil, Grass, Farm Field, Vegetation, Neutral)
  Evaluation    : 3-Way Stratified Split (Train / Val / Test)
                  + Dedicated Real-World Noisy-Background Robustness Test Set
  Metrics       : Accuracy, Macro/Weighted Precision, Recall, F1-Score,
                  Normal & Noisy Confusion Matrices
  Export        : ONNX (crop_disease_model.onnx) + labels.json for Node.js
======================================================================
"""

import os
import sys
import json
import time
import random
import warnings
import argparse
import functools
from pathlib import Path

# Unbuffered live stdout flushing
print = functools.partial(print, flush=True)

warnings.filterwarnings("ignore")

# Force UTF-8 output encoding on Windows consoles
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# ─── Package Imports with Friendly Diagnostic ────────────────
try:
    import numpy as np
    import cv2
    from PIL import Image
    import torch
    import torch.nn as nn
    import torch.optim as optim
    from torch.utils.data import DataLoader, Dataset, WeightedRandomSampler
    import timm
    import albumentations as A
    from albumentations.pytorch import ToTensorV2
    from sklearn.metrics import (
        accuracy_score,
        precision_score,
        recall_score,
        f1_score,
        classification_report,
        confusion_matrix
    )
    import matplotlib
    matplotlib.use("Agg")  # Non-interactive headless backend
    import matplotlib.pyplot as plt
    import seaborn as sns
    import onnx
except ImportError as e:
    print("\n" + "=" * 65)
    print(f"[!] Missing required Python package: {e}")
    print("    Please install dependencies first by running:")
    print("    pip install -r requirements.txt")
    print("=" * 65 + "\n")
    sys.exit(1)

# Import background randomizer module
try:
    from background_randomizer import (
        BACKGROUND_TYPES,
        generate_agricultural_background,
        extract_leaf_mask,
        replace_background,
        RealisticBackgroundRandomizer
    )
except ImportError:
    from .background_randomizer import (
        BACKGROUND_TYPES,
        generate_agricultural_background,
        extract_leaf_mask,
        replace_background,
        RealisticBackgroundRandomizer
    )

# ─────────────────────────────────────────────────────────────
#  DEFAULT CONFIGURATION
# ─────────────────────────────────────────────────────────────
DATASET_DIR          = Path(__file__).parent.parent / "dataset"
OUTPUT_DIR           = Path(__file__).parent
MODEL_ARCH           = "mobilenetv3_large_100"
IMAGE_SIZE           = 224
BATCH_SIZE           = 32
DEFAULT_EPOCHS       = 5
LEARNING_RATE        = 1e-3
WEIGHT_DECAY         = 1e-4
TRAIN_SPLIT          = 0.70
VAL_SPLIT            = 0.15
TEST_SPLIT           = 0.15
DEFAULT_MAX_PER_CLS  = 120
BG_RANDOMIZE_PROB    = 0.60
CONFIDENCE_THRESHOLD = 0.55
SEED                 = 42

SUPPORTED_EXTS = {".jpg", ".jpeg", ".png", ".JPG", ".JPEG", ".PNG"}
IMAGENET_MEAN  = [0.485, 0.456, 0.406]
IMAGENET_STD   = [0.229, 0.224, 0.225]

# ─────────────────────────────────────────────────────────────
#  SEED FOR REPRODUCIBILITY
# ─────────────────────────────────────────────────────────────
def set_seed(seed=SEED):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)

set_seed(SEED)

# ─────────────────────────────────────────────────────────────
#  DEVICE AUTO-DETECT
# ─────────────────────────────────────────────────────────────
if torch.cuda.is_available():
    DEVICE = torch.device("cuda")
    print(f"⚡ GPU Detected: {torch.cuda.get_device_name(0)}")
elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
    DEVICE = torch.device("mps")
    print("⚡ Apple Silicon MPS Detected")
else:
    DEVICE = torch.device("cpu")
    cpu_count = os.cpu_count() or 4
    torch.set_num_threads(cpu_count)
    print(f"💻 CPU Mode: Using {cpu_count} CPU threads")

print(f"   Target Device: {DEVICE}")

# ─────────────────────────────────────────────────────────────
#  REALISTIC ALBUMENTATIONS PIPELINE (12 Transforms)
# ─────────────────────────────────────────────────────────────
# TRAIN: Field-Realistic Augmentation
train_transform = A.Compose([
    # 1. Random Crop & Scale
    A.RandomResizedCrop(
        size=(IMAGE_SIZE, IMAGE_SIZE),
        scale=(0.85, 1.0),
        ratio=(0.9, 1.1),
        p=0.6
    ),
    # 2. Resize
    A.Resize(IMAGE_SIZE, IMAGE_SIZE),
    # 3. Horizontal Flip
    A.HorizontalFlip(p=0.5),
    # 4. Limited Rotation & Scale Variation
    A.Affine(
        scale=(0.9, 1.1),
        rotate=(-25, 25),
        translate_percent=(-0.05, 0.05),
        p=0.5
    ),
    # 5. Perspective Variation
    A.Perspective(scale=(0.04, 0.08), keep_size=True, p=0.35),
    # 6. Shadow & Lighting Variation
    A.RandomShadow(
        shadow_roi=(0, 0.5, 1, 1),
        num_shadows_limit=(1, 2),
        shadow_dimension=5,
        shadow_intensity_range=(0.4, 0.6),
        p=0.35
    ),
    # 7. Brightness & Contrast Variation (preserves lesion pathology)
    A.RandomBrightnessContrast(
        brightness_limit=0.18,
        contrast_limit=0.18,
        p=0.5
    ),
    # 8. Blur Variation (Gaussian + Motion blur)
    A.OneOf([
        A.GaussianBlur(blur_limit=(3, 5), p=1.0),
        A.MotionBlur(blur_limit=(3, 5), p=1.0),
    ], p=0.3),
    # 9. Gaussian Noise Variation
    A.GaussNoise(std_range=(0.05, 0.2), p=0.3),
    # 10. JPEG Compression Artifacts
    A.ImageCompression(quality_range=(60, 95), p=0.35),
    # 11 & 12. Normalization + Tensor conversion
    A.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
    ToTensorV2(),
])

# VALIDATION & TEST: Deterministic Preprocessing
val_transform = A.Compose([
    A.Resize(IMAGE_SIZE, IMAGE_SIZE),
    A.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
    ToTensorV2(),
])

# ─────────────────────────────────────────────────────────────
#  ROBUST PLANT DISEASE DATASET
# ─────────────────────────────────────────────────────────────
class RobustPlantDiseaseDataset(Dataset):
    """
    Dataset supporting:
      - mode='train': realistic augmentation + background randomization
      - mode='val': deterministic preprocessing
      - mode='test_normal': deterministic preprocessing on unseen test images
      - mode='test_noisy': real-world robustness benchmark with agricultural backgrounds
    """
    def __init__(self, samples, transform=None, mode="train", bg_prob=BG_RANDOMIZE_PROB):
        self.samples   = samples   # List of (filepath_str, class_index)
        self.transform = transform
        self.mode      = mode
        self.bg_prob   = bg_prob

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        img_path, label = self.samples[idx]
        try:
            pil_img = Image.open(img_path).convert("RGB")
            img = np.array(pil_img)
        except Exception:
            img = np.zeros((IMAGE_SIZE, IMAGE_SIZE, 3), dtype=np.uint8)

        # 1. Background Randomization during Training
        if self.mode == "train" and random.random() < self.bg_prob:
            mask, is_reliable = extract_leaf_mask(img)
            if is_reliable:
                bg_type = random.choice(BACKGROUND_TYPES)
                img = replace_background(img, mask, bg_type=bg_type)

        # 2. Noisy Background Robustness Evaluation Set
        elif self.mode == "test_noisy":
            mask, is_reliable = extract_leaf_mask(img)
            if is_reliable:
                # Deterministic cyclic background assignment for consistent testing
                bg_type = BACKGROUND_TYPES[idx % len(BACKGROUND_TYPES)]
                img = replace_background(img, mask, bg_type=bg_type)

        # 3. Apply Albumentations Transform
        if self.transform:
            augmented = self.transform(image=img)
            img = augmented["image"]

        return img, label

# ─────────────────────────────────────────────────────────────
#  DATASET SCANNER
# ─────────────────────────────────────────────────────────────
def scan_dataset(dataset_dir, max_per_class=DEFAULT_MAX_PER_CLS, class_filter=None):
    dataset_dir = Path(dataset_dir)
    if not dataset_dir.exists():
        print(f"❌ Dataset directory not found: {dataset_dir}")
        sys.exit(1)

    all_dirs = sorted([
        d.name for d in dataset_dir.iterdir()
        if d.is_dir() and not d.name.startswith(".")
    ])

    if class_filter:
        if class_filter == "tomato":
            class_names = [c for c in all_dirs if c.startswith("Tomato___")]
        elif isinstance(class_filter, list):
            class_names = [c for c in all_dirs if c in class_filter]
        else:
            class_names = all_dirs
    else:
        class_names = all_dirs

    if not class_names:
        print(f"❌ No matching class folders found in: {dataset_dir}")
        sys.exit(1)

    print(f"\n📂 Dataset: {dataset_dir}")
    print(f"   Registered {len(class_names)} target classes (Max {max_per_class}/class).\n")

    all_samples = []
    class_counts = {}

    for idx, cls in enumerate(class_names):
        cls_dir = dataset_dir / cls
        images = [
            p for p in cls_dir.iterdir()
            if p.suffix in SUPPORTED_EXTS and p.is_file()
        ]
        if not images:
            print(f"   ⚠️ Skipping empty class: {cls}")
            continue

        if len(images) > max_per_class:
            images = random.sample(images, max_per_class)

        for img_path in images:
            all_samples.append((str(img_path), idx))

        class_counts[cls] = len(images)
        print(f"   [{idx:2d}] {cls:<52} {len(images):>5} images")

    print(f"\n   Total Samples Collected: {len(all_samples)}")
    return all_samples, class_names, class_counts

# ─────────────────────────────────────────────────────────────
#  STRATIFIED 3-WAY SPLIT: TRAIN / VAL / TEST
# ─────────────────────────────────────────────────────────────
def split_dataset_3way(all_samples, class_names, train_r=TRAIN_SPLIT, val_r=VAL_SPLIT, test_r=TEST_SPLIT):
    from collections import defaultdict
    cls_map = defaultdict(list)
    for sample in all_samples:
        cls_map[sample[1]].append(sample)

    train_samples, val_samples, test_samples = [], [], []
    for cls_idx, samples in cls_map.items():
        random.shuffle(samples)
        n = len(samples)
        n_val = max(1, int(n * val_r))
        n_test = max(1, int(n * test_r))

        val_samples.extend(samples[:n_val])
        test_samples.extend(samples[n_val:n_val + n_test])
        train_samples.extend(samples[n_val + n_test:])

    random.shuffle(train_samples)
    random.shuffle(val_samples)
    random.shuffle(test_samples)

    return train_samples, val_samples, test_samples

# ─────────────────────────────────────────────────────────────
#  WEIGHTED RANDOM SAMPLER
# ─────────────────────────────────────────────────────────────
def make_weighted_sampler(samples, num_classes):
    counts = np.bincount([s[1] for s in samples], minlength=num_classes).astype(float)
    counts = np.where(counts == 0, 1.0, counts)
    class_weights = 1.0 / counts
    sample_weights = [class_weights[s[1]] for s in samples]
    return WeightedRandomSampler(sample_weights, num_samples=len(samples), replacement=True)

# ─────────────────────────────────────────────────────────────
#  BUILD TIMM MODEL
# ─────────────────────────────────────────────────────────────
def build_model(num_classes, arch=MODEL_ARCH, freeze_backbone=False):
    print(f"\n🧠 Initializing backbone: {arch} (pretrained=True)")
    model = timm.create_model(arch, pretrained=True, num_classes=num_classes)
    if freeze_backbone:
        print("   ❄️ Freezing feature backbone (training classification head only)")
        for param in model.parameters():
            param.requires_grad = False
        for param in model.get_classifier().parameters():
            param.requires_grad = True
    print(f"   Output Head configured for {num_classes} classes on {DEVICE}.")
    return model.to(DEVICE)

# ─────────────────────────────────────────────────────────────
#  TRAINING LOOP STEP
# ─────────────────────────────────────────────────────────────
def train_one_epoch(model, loader, criterion, optimizer, scaler=None):
    model.train()
    total_loss, correct, total = 0.0, 0, 0

    for batch_idx, (images, labels) in enumerate(loader):
        images = images.to(DEVICE, non_blocking=True)
        labels = labels.to(DEVICE, non_blocking=True)

        optimizer.zero_grad()

        if scaler is not None and DEVICE.type == "cuda":
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

        if batch_idx % 10 == 0 or batch_idx == len(loader) - 1:
            print(f"   Batch {batch_idx+1:4d}/{len(loader)} | Loss: {loss.item():.4f}", end="\r")

    return total_loss / max(total, 1), correct / max(total, 1)

# ─────────────────────────────────────────────────────────────
#  EVALUATION FUNCTION (Deterministic)
# ─────────────────────────────────────────────────────────────
@torch.no_grad()
def evaluate_model(model, loader, criterion, class_names, split_name="Test Set"):
    model.eval()
    total_loss, correct, total = 0.0, 0, 0
    all_preds, all_labels = [], []

    for images, labels in loader:
        images = images.to(DEVICE, non_blocking=True)
        labels = labels.to(DEVICE, non_blocking=True)

        logits = model(images)
        loss = criterion(logits, labels)

        total_loss += loss.item() * images.size(0)
        preds = logits.argmax(dim=1)
        correct += (preds == labels).sum().item()
        total += images.size(0)

        all_preds.extend(preds.cpu().numpy())
        all_labels.extend(labels.cpu().numpy())

    all_labels = np.array(all_labels)
    all_preds = np.array(all_preds)

    avg_loss = total_loss / max(total, 1)
    acc = accuracy_score(all_labels, all_preds)
    prec_macro = precision_score(all_labels, all_preds, average="macro", zero_division=0)
    prec_weighted = precision_score(all_labels, all_preds, average="weighted", zero_division=0)
    rec_macro = recall_score(all_labels, all_preds, average="macro", zero_division=0)
    rec_weighted = recall_score(all_labels, all_preds, average="weighted", zero_division=0)
    f1_macro = f1_score(all_labels, all_preds, average="macro", zero_division=0)
    f1_weighted = f1_score(all_labels, all_preds, average="weighted", zero_division=0)
    cm = confusion_matrix(all_labels, all_preds, labels=list(range(len(class_names))))

    report = classification_report(
        all_labels, all_preds,
        labels=list(range(len(class_names))),
        target_names=class_names,
        output_dict=True,
        zero_division=0
    )

    metrics = {
        "split_name": split_name,
        "loss": round(float(avg_loss), 4),
        "accuracy": round(float(acc) * 100, 2),
        "precision_macro": round(float(prec_macro), 4),
        "precision_weighted": round(float(prec_weighted), 4),
        "recall_macro": round(float(rec_macro), 4),
        "recall_weighted": round(float(rec_weighted), 4),
        "f1_macro": round(float(f1_macro), 4),
        "f1_weighted": round(float(f1_weighted), 4),
        "total_samples": int(total),
        "all_preds": all_preds.tolist(),
        "all_labels": all_labels.tolist(),
        "confusion_matrix": cm.tolist(),
        "classification_report": report
    }
    return metrics

# ─────────────────────────────────────────────────────────────
#  CONFUSION MATRIX PLOT
# ─────────────────────────────────────────────────────────────
def plot_confusion_matrix(y_true, y_pred, class_names, save_path, title="Agri-AI Confusion Matrix"):
    cm = confusion_matrix(y_true, y_pred, labels=list(range(len(class_names))))
    size = max(8, min(20, len(class_names) * 0.8))
    fig, ax = plt.subplots(figsize=(size, size))
    sns.heatmap(
        cm, annot=(len(class_names) <= 15), fmt="d",
        xticklabels=class_names, yticklabels=class_names,
        cmap="YlGnBu", ax=ax, linewidths=0.5
    )
    ax.set_xlabel("Predicted Label", fontsize=10, fontweight="bold")
    ax.set_ylabel("Ground Truth", fontsize=10, fontweight="bold")
    ax.set_title(title, fontsize=12, fontweight="bold")
    plt.xticks(rotation=45, ha="right", fontsize=8)
    plt.yticks(rotation=0, fontsize=8)
    plt.tight_layout()
    plt.savefig(save_path, dpi=160)
    plt.close()
    print(f"   📊 Evaluation Matrix saved -> {save_path}")

# ─────────────────────────────────────────────────────────────
#  EXPORT TO ONNX
# ─────────────────────────────────────────────────────────────
def export_onnx(model, num_classes, save_path):
    print("\n📦 Exporting trained model to ONNX format...")
    model.eval()
    dummy_input = torch.randn(1, 3, IMAGE_SIZE, IMAGE_SIZE).to(DEVICE)

    torch.onnx.export(
        model, dummy_input, save_path,
        export_params=True,
        opset_version=18,
        do_constant_folding=True,
        input_names=["input"],
        output_names=["output"],
        dynamic_axes={
            "input": {0: "batch_size"},
            "output": {0: "batch_size"}
        }
    )
    onnx_model = onnx.load(save_path)
    onnx.checker.check_model(onnx_model)
    size_mb = Path(save_path).stat().st_size / (1024 * 1024)
    print(f"   ✅ ONNX Model exported & validated: {save_path} ({size_mb:.1f} MB)")

# ─────────────────────────────────────────────────────────────
#  MAIN EXECUTION
# ─────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="Agri-AI Robust Disease Classifier Training")
    parser.add_argument("--classes", type=str, default="tomato",
                        help="Classes to train: 'tomato', 'all', or comma-separated list")
    parser.add_argument("--epochs", type=int, default=DEFAULT_EPOCHS,
                        help="Number of training epochs")
    parser.add_argument("--max-per-class", type=int, default=DEFAULT_MAX_PER_CLS,
                        help="Maximum samples per class")
    parser.add_argument("--batch-size", type=int, default=BATCH_SIZE,
                        help="Batch size")
    parser.add_argument("--lr", type=float, default=LEARNING_RATE,
                        help="Learning rate")
    parser.add_argument("--bg-prob", type=float, default=BG_RANDOMIZE_PROB,
                        help="Background randomization probability (0.0 - 1.0)")
    parser.add_argument("--evaluate-only", action="store_true",
                        help="Only evaluate existing model on normal and noisy test sets")
    parser.add_argument("--freeze-backbone", action="store_true",
                        help="Freeze backbone for faster head-only fine-tuning")
    args = parser.parse_args()

    print("\n" + "=" * 65)
    print("  🌱 AGRI-AI — Robust Disease Classifier Engine")
    print("  Combating Background Bias via Agricultural Augmentation")
    print("=" * 65)

    # 1. Scan and register classes
    all_samples, class_names, class_counts = scan_dataset(
        DATASET_DIR, max_per_class=args.max_per_class, class_filter=args.classes
    )
    num_classes = len(class_names)

    # 2. Save labels.json for Node.js backend
    labels_path = OUTPUT_DIR / "labels.json"
    with open(labels_path, "w", encoding="utf-8") as f:
        json.dump(class_names, f, indent=2)
    print(f"🏷️  Class labels saved -> {labels_path}")

    # 3. 3-Way Stratified Split: Train (70%) / Val (15%) / Test (15%)
    train_samples, val_samples, test_samples = split_dataset_3way(all_samples, class_names)
    print(f"📊 Dataset Splits:")
    print(f"   • Train Set                : {len(train_samples):>5} samples (Augmentation + BG Randomization)")
    print(f"   • Validation Set           : {len(val_samples):>5} samples (Deterministic Preprocessing)")
    print(f"   • Normal Test Set          : {len(test_samples):>5} samples (Held-out Unseen Images)")
    print(f"   • Robustness Noisy Test Set: {len(test_samples):>5} samples (Held-out Images with Field Textures)")

    # 4. Data Loaders
    num_workers = 0 if os.name == "nt" else min(4, os.cpu_count() or 1)

    train_ds       = RobustPlantDiseaseDataset(train_samples, transform=train_transform, mode="train", bg_prob=args.bg_prob)
    val_ds         = RobustPlantDiseaseDataset(val_samples, transform=val_transform, mode="val")
    test_normal_ds = RobustPlantDiseaseDataset(test_samples, transform=val_transform, mode="test_normal")
    test_noisy_ds  = RobustPlantDiseaseDataset(test_samples, transform=val_transform, mode="test_noisy")

    sampler = make_weighted_sampler(train_samples, num_classes)
    train_loader = DataLoader(
        train_ds, batch_size=args.batch_size, sampler=sampler,
        num_workers=num_workers, pin_memory=(DEVICE.type == "cuda")
    )
    val_loader = DataLoader(
        val_ds, batch_size=args.batch_size, shuffle=False,
        num_workers=num_workers, pin_memory=(DEVICE.type == "cuda")
    )
    test_normal_loader = DataLoader(
        test_normal_ds, batch_size=args.batch_size, shuffle=False,
        num_workers=num_workers, pin_memory=(DEVICE.type == "cuda")
    )
    test_noisy_loader = DataLoader(
        test_noisy_ds, batch_size=args.batch_size, shuffle=False,
        num_workers=num_workers, pin_memory=(DEVICE.type == "cuda")
    )

    # 5. Build Model, Loss, Optimizer, Scheduler
    model     = build_model(num_classes, freeze_backbone=args.freeze_backbone)
    criterion = nn.CrossEntropyLoss(label_smoothing=0.1)
    optimizer = optim.AdamW(
        [p for p in model.parameters() if p.requires_grad],
        lr=args.lr, weight_decay=WEIGHT_DECAY
    )
    scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=max(args.epochs, 1))
    scaler    = torch.amp.GradScaler("cuda") if DEVICE.type == "cuda" else None

    best_model_path = OUTPUT_DIR / "best_model.pth"

    # 6. Training Loop (if not evaluate-only)
    if not args.evaluate_only:
        best_val_acc = 0.0
        history = {"train_loss": [], "val_loss": [], "val_acc": [], "val_f1": []}

        print(f"\n{'─'*65}")
        print(f"  Training for {args.epochs} Epochs on {DEVICE}...")
        print(f"  Background Randomization active at p={args.bg_prob:.2f}")
        print(f"{'─'*65}\n")

        for epoch in range(1, args.epochs + 1):
            t0 = time.time()

            train_loss, train_acc = train_one_epoch(model, train_loader, criterion, optimizer, scaler)
            val_metrics = evaluate_model(model, val_loader, criterion, class_names, split_name=f"Val-Epoch-{epoch}")
            val_loss = val_metrics["loss"]
            val_acc  = val_metrics["accuracy"] / 100.0
            val_f1   = val_metrics["f1_weighted"]
            scheduler.step()

            elapsed = time.time() - t0
            history["train_loss"].append(train_loss)
            history["val_loss"].append(val_loss)
            history["val_acc"].append(val_acc)
            history["val_f1"].append(val_f1)

            is_best = val_acc > best_val_acc
            marker = " 🌟 [NEW BEST]" if is_best else ""
            print(
                f"  Epoch {epoch:2d}/{args.epochs:2d} | "
                f"Train Loss: {train_loss:.4f} (Acc: {train_acc*100:.1f}%) | "
                f"Val Loss: {val_loss:.4f} | "
                f"Val Acc: {val_acc*100:.2f}% | "
                f"F1: {val_f1:.4f} ({elapsed:.1f}s){marker}"
            )

            if is_best:
                best_val_acc = val_acc
                torch.save(model.state_dict(), best_model_path)

        if best_model_path.exists():
            print(f"\n📥 Loading best model weights from: {best_model_path}")
            model.load_state_dict(torch.load(best_model_path, map_location=DEVICE))
    else:
        if best_model_path.exists():
            print(f"\n📥 [Evaluate-Only] Loading existing weights from: {best_model_path}")
            try:
                model.load_state_dict(torch.load(best_model_path, map_location=DEVICE))
            except Exception as e:
                print(f"   ⚠️ Could not load all weights ({e}). Evaluating initialized weights.")
        history = {}

    # ─────────────────────────────────────────────────────────────
    #  EXPERIMENTAL RIGOROUS EVALUATION
    # ─────────────────────────────────────────────────────────────
    print(f"\n{'='*65}")
    print("  🧪 RIGOROUS EXPERIMENTAL EVALUATION REPORT")
    print("  Benchmarking Normal vs Noisy-Background Real-World Robustness")
    print(f"{'='*65}\n")

    # A. Normal Clean Test Evaluation
    print("🔍 [1/2] Evaluating Normal Test Set (Unseen Clean Laboratory Images)...")
    normal_metrics = evaluate_model(model, test_normal_loader, criterion, class_names, split_name="Normal Test Set")

    # B. Noisy-Background Test Evaluation
    print("🌾 [2/2] Evaluating Real-World Noisy Test Set (Unseen Images with Field Backgrounds)...")
    noisy_metrics = evaluate_model(model, test_noisy_loader, criterion, class_names, split_name="Noisy Robustness Set")

    # C. Degradation & Robustness Metrics
    normal_acc = normal_metrics["accuracy"]
    noisy_acc  = noisy_metrics["accuracy"]
    delta_acc  = round(normal_acc - noisy_acc, 2)
    retention  = round((noisy_acc / max(normal_acc, 1e-5)) * 100.0, 1)

    # D. Save Plots
    cm_normal_path = OUTPUT_DIR / "confusion_matrix_normal.png"
    cm_noisy_path  = OUTPUT_DIR / "confusion_matrix_noisy.png"
    cm_legacy_path = OUTPUT_DIR / "confusion_matrix.png"

    plot_confusion_matrix(
        normal_metrics["all_labels"], normal_metrics["all_preds"],
        class_names, cm_normal_path,
        title="Agri-AI Normal Test Set Confusion Matrix"
    )
    plot_confusion_matrix(
        noisy_metrics["all_labels"], noisy_metrics["all_preds"],
        class_names, cm_noisy_path,
        title="Agri-AI Noisy-Background Robustness Confusion Matrix"
    )
    # Copy normal as legacy confusion_matrix.png
    plot_confusion_matrix(
        normal_metrics["all_labels"], normal_metrics["all_preds"],
        class_names, cm_legacy_path,
        title="Agri-AI Disease Classification Matrix"
    )

    # E. Print Comparison Table
    print("\n" + "─" * 65)
    print(f"{'Metric':<28} | {'Normal Test Set':<16} | {'Noisy Field Set':<16}")
    print("─" * 65)
    print(f"{'Accuracy':<28} | {normal_acc:>13.2f}% | {noisy_acc:>13.2f}%")
    print(f"{'Weighted F1-Score':<28} | {normal_metrics['f1_weighted']:>16.4f} | {noisy_metrics['f1_weighted']:>16.4f}")
    print(f"{'Macro F1-Score':<28} | {normal_metrics['f1_macro']:>16.4f} | {noisy_metrics['f1_macro']:>16.4f}")
    print(f"{'Weighted Precision':<28} | {normal_metrics['precision_weighted']:>16.4f} | {noisy_metrics['precision_weighted']:>16.4f}")
    print(f"{'Weighted Recall':<28} | {normal_metrics['recall_weighted']:>16.4f} | {noisy_metrics['recall_weighted']:>16.4f}")
    print("─" * 65)
    print(f"  Background Bias Degradation (Δ Acc) : {delta_acc:+.2f}%")
    print(f"  Field Robustness Retention Ratio    : {retention:.1f}%")
    print("─" * 65)

    print("\n📋 Detailed Per-Class Classification Report (Noisy-Background Set):")
    print(classification_report(
        noisy_metrics["all_labels"], noisy_metrics["all_preds"],
        target_names=class_names, zero_division=0
    ))

    # F. Save Robustness Benchmark JSON
    benchmark_data = {
        "model_architecture": MODEL_ARCH,
        "image_size": IMAGE_SIZE,
        "num_classes": num_classes,
        "class_names": class_names,
        "total_samples": len(all_samples),
        "split_counts": {
            "train": len(train_samples),
            "val": len(val_samples),
            "test_normal": len(test_samples),
            "test_noisy": len(test_samples)
        },
        "background_randomization": {
            "enabled": True,
            "probability": args.bg_prob,
            "background_types": BACKGROUND_TYPES
        },
        "normal_test_metrics": {
            "accuracy": normal_acc,
            "precision_weighted": normal_metrics["precision_weighted"],
            "precision_macro": normal_metrics["precision_macro"],
            "recall_weighted": normal_metrics["recall_weighted"],
            "recall_macro": normal_metrics["recall_macro"],
            "f1_weighted": normal_metrics["f1_weighted"],
            "f1_macro": normal_metrics["f1_macro"],
            "confusion_matrix_file": str(cm_normal_path.name)
        },
        "noisy_background_metrics": {
            "accuracy": noisy_acc,
            "precision_weighted": noisy_metrics["precision_weighted"],
            "precision_macro": noisy_metrics["precision_macro"],
            "recall_weighted": noisy_metrics["recall_weighted"],
            "recall_macro": noisy_metrics["recall_macro"],
            "f1_weighted": noisy_metrics["f1_weighted"],
            "f1_macro": noisy_metrics["f1_macro"],
            "confusion_matrix_file": str(cm_noisy_path.name)
        },
        "robustness_summary": {
            "normal_accuracy": normal_acc,
            "noisy_accuracy": noisy_acc,
            "accuracy_drop_pct": delta_acc,
            "retention_percentage": retention
        },
        "training_history": history
    }

    benchmark_path = OUTPUT_DIR / "robustness_benchmark.json"
    with open(benchmark_path, "w", encoding="utf-8") as f:
        json.dump(benchmark_data, f, indent=2)
    print(f"\n📈 Benchmark results saved -> {benchmark_path}")

    # Also save training_results.json for backward compatibility
    training_results_path = OUTPUT_DIR / "training_results.json"
    with open(training_results_path, "w", encoding="utf-8") as f:
        json.dump(benchmark_data, f, indent=2)
    print(f"📈 Training metrics saved -> {training_results_path}")

    # 7. Export Model to ONNX
    onnx_path = OUTPUT_DIR / "crop_disease_model.onnx"
    export_onnx(model, num_classes, str(onnx_path))

    print(f"\n{'='*65}")
    print("  🎉 Background-Debiased Model Trained, Benchmarked & Exported!")
    print("  ONNX model is ready for live Node.js inference.")
    print(f"{'='*65}\n")


if __name__ == "__main__":
    main()
