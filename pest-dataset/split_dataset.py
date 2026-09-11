"""
split_dataset.py
─────────────────────────────────────────────────────────────────────────────
Step 3 of the Pest Monitoring Pipeline: Train / Val / Test Split

Splits the cleaned dataset into:
- 70% Train
- 15% Validation
- 15% Test

Stratified equally across all 9 pest classes, with zero leakage.
Supports both:
1. Detection mode (pairs .jpg/.png with .txt YOLO labels)
2. Classification mode (organizes images by class folder for YOLO-cls)

Also automatically generates `dataset.yaml` for YOLO / RT-DETR training!
─────────────────────────────────────────────────────────────────────────────
"""

import os
import random
import shutil
from collections import defaultdict

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CLEANED_DIR = os.path.join(BASE_DIR, "cleaned")
SPLIT_DIR = os.path.join(BASE_DIR, "split")
YAML_PATH = os.path.join(BASE_DIR, "pest.yaml")

CLASSES = [
    "aphids", "armyworm", "beetle", "bollworm", "grasshopper",
    "mites", "mosquito", "sawfly", "stem_borer"
]

TRAIN_RATIO = 0.70
VAL_RATIO   = 0.15
TEST_RATIO  = 0.15

def split_dataset(seed=42):
    random.seed(seed)
    print("=" * 65)
    print("🌱 AGRI-AI: PEST DATASET STRATIFIED SPLITTER")
    print("=" * 65)
    print(f"📁 Source Cleaned: {CLEANED_DIR}")
    print(f"📁 Destination   : {SPLIT_DIR}")
    print(f"⚖️  Split Ratios  : Train {int(TRAIN_RATIO*100)}% | Val {int(VAL_RATIO*100)}% | Test {int(TEST_RATIO*100)}%")
    print("-" * 65)

    if not os.path.exists(CLEANED_DIR):
        print(f"❌ Cleaned directory '{CLEANED_DIR}' not found. Run clean_dataset.py first!")
        return

    # Check if we have .txt annotation files (Detection) or just images (Classification)
    has_labels = False
    for root, _, files in os.walk(CLEANED_DIR):
        if any(f.endswith(".txt") for f in files):
            has_labels = True
            break

    mode = "Detection (Images + YOLO .txt Labels)" if has_labels else "Classification (Class-folder hierarchy)"
    print(f"🏷️  Dataset Mode Detected: {mode}")

    # Reset/prepare split directory
    if os.path.exists(SPLIT_DIR):
        shutil.rmtree(SPLIT_DIR)

    for split in ["train", "val", "test"]:
        if has_labels:
            os.makedirs(os.path.join(SPLIT_DIR, split, "images"), exist_ok=True)
            os.makedirs(os.path.join(SPLIT_DIR, split, "labels"), exist_ok=True)
        else:
            for cls in CLASSES:
                os.makedirs(os.path.join(SPLIT_DIR, split, cls), exist_ok=True)

    stats = defaultdict(lambda: {"train": 0, "val": 0, "test": 0, "total": 0})

    for cls in CLASSES:
        cls_dir = os.path.join(CLEANED_DIR, cls)
        if not os.path.isdir(cls_dir):
            continue

        images = [f for f in os.listdir(cls_dir) if f.lower().endswith((".jpg", ".jpeg", ".png", ".bmp", ".webp"))]
        images.sort()
        random.shuffle(images)

        n = len(images)
        n_train = int(n * TRAIN_RATIO)
        n_val = int(n * VAL_RATIO)
        # Remainder goes to test
        n_test = n - n_train - n_val

        train_imgs = images[:n_train]
        val_imgs = images[n_train:n_train + n_val]
        test_imgs = images[n_train + n_val:]

        split_map = {
            "train": train_imgs,
            "val": val_imgs,
            "test": test_imgs
        }

        for split_name, img_list in split_map.items():
            for img_name in img_list:
                src_img = os.path.join(cls_dir, img_name)

                if has_labels:
                    # Detection mode
                    base_stem = os.path.splitext(img_name)[0]
                    dst_img = os.path.join(SPLIT_DIR, split_name, "images", img_name)
                    shutil.copy2(src_img, dst_img)

                    src_lbl = os.path.join(cls_dir, f"{base_stem}.txt")
                    dst_lbl = os.path.join(SPLIT_DIR, split_name, "labels", f"{base_stem}.txt")
                    if os.path.exists(src_lbl):
                        shutil.copy2(src_lbl, dst_lbl)
                    else:
                        # Empty label file for background/unannotated
                        open(dst_lbl, "w").close()
                else:
                    # Classification mode
                    dst_img = os.path.join(SPLIT_DIR, split_name, cls, img_name)
                    shutil.copy2(src_img, dst_img)

                stats[cls][split_name] += 1
            stats[cls]["total"] = n

    print("\n📊 SPLIT SUMMARY:")
    print(f"{'Class Name':<15} | {'Train':<8} | {'Val':<8} | {'Test':<8} | {'Total Clean':<10}")
    print("-" * 65)
    total_train = total_val = total_test = total_all = 0
    for cls in CLASSES:
        s = stats[cls]
        print(f"{cls:<15} | {s['train']:<8} | {s['val']:<8} | {s['test']:<8} | {s['total']:<10}")
        total_train += s["train"]
        total_val += s["val"]
        total_test += s["test"]
        total_all += s["total"]
    print("-" * 65)
    print(f"{'TOTAL':<15} | {total_train:<8} | {total_val:<8} | {total_test:<8} | {total_all:<10}")

    # Generate pest.yaml for YOLO training
    yaml_content = f"""# YOLOv8 / RT-DETR Dataset Configuration for Agri-AI Pest Monitoring
path: {SPLIT_DIR.replace('\\\\', '/')}
train: train/images
val: val/images
test: test/images

# Number of classes
nc: {len(CLASSES)}

# Class names
names:
"""
    for idx, cls in enumerate(CLASSES):
        yaml_content += f"  {idx}: {cls}\n"

    with open(YAML_PATH, "w") as f:
        f.write(yaml_content)

    print("\n📄 Generated YOLO Dataset Configuration:")
    print(f"   {YAML_PATH}")
    print("=" * 65)
    print("✅ Split complete and ready for training!")

if __name__ == "__main__":
    split_dataset()
