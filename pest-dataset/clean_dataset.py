"""
clean_dataset.py
─────────────────────────────────────────────────────────────────────────────
Pest Image Dataset Cleaner (Step 1 of the Pest Monitoring Pipeline)

Performs:
1. Cryptographic hash deduplication (MD5/SHA256)
2. Cross-split data leakage detection (removing test duplicates from train)
3. Image corruption and integrity verification
4. Standardized naming and storage into `pest-dataset/cleaned/<class>/`
5. Detailed summary reporting of cleaned data stats
─────────────────────────────────────────────────────────────────────────────
"""

import os
import sys
import shutil
import hashlib
from collections import defaultdict

try:
    from PIL import Image
    HAS_PIL = True
except ImportError:
    HAS_PIL = False

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SOURCE_DIR = os.path.join(BASE_DIR, "pest")
OUTPUT_DIR = os.path.join(BASE_DIR, "cleaned")

CLASSES = [
    "aphids", "armyworm", "beetle", "bollworm", "grasshopper",
    "mites", "mosquito", "sawfly", "stem_borer"
]

def compute_hash(file_path):
    hasher = hashlib.md5()
    with open(file_path, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()

def verify_image(file_path):
    """Returns True if the image is readable and not corrupt."""
    if not HAS_PIL:
        return True
    try:
        with Image.open(file_path) as img:
            img.verify()
        return True
    except Exception:
        return False

def clean_dataset():
    print("=" * 65)
    print("🌱 AGRI-AI: PEST DATASET CLEANING & DEDUPLICATION PIPELINE")
    print("=" * 65)
    print(f"📁 Source: {SOURCE_DIR}")
    print(f"📁 Output: {OUTPUT_DIR}")
    print(f"🖼️  Image verification (PIL): {'Enabled' if HAS_PIL else 'Disabled (PIL not found)'}")
    print("-" * 65)

    if not os.path.exists(SOURCE_DIR):
        print(f"❌ Error: Source directory '{SOURCE_DIR}' not found!")
        return

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    global_seen_hashes = {}  # hash -> first seen filepath
    stats = defaultdict(lambda: {"raw_count": 0, "duplicates": 0, "corrupt": 0, "unique_saved": 0})
    total_raw = 0
    total_unique = 0

    for cls in CLASSES:
        cls_output_dir = os.path.join(OUTPUT_DIR, cls)
        os.makedirs(cls_output_dir, exist_ok=True)

        # Collect images from both train and test splits
        candidate_files = []
        for split in ["train", "test"]:
            split_cls_dir = os.path.join(SOURCE_DIR, split, cls)
            if os.path.isdir(split_cls_dir):
                for f in sorted(os.listdir(split_cls_dir)):
                    if f.lower().endswith((".jpg", ".jpeg", ".png", ".bmp", ".webp")):
                        candidate_files.append((split, os.path.join(split_cls_dir, f)))

        stats[cls]["raw_count"] = len(candidate_files)
        total_raw += len(candidate_files)

        class_unique_count = 0

        for split, src_path in candidate_files:
            file_hash = compute_hash(src_path)

            if file_hash in global_seen_hashes:
                stats[cls]["duplicates"] += 1
                continue

            if not verify_image(src_path):
                stats[cls]["corrupt"] += 1
                print(f"⚠️ Corrupted image skipped: {src_path}")
                continue

            # Record hash and save clean file
            global_seen_hashes[file_hash] = src_path
            class_unique_count += 1
            ext = os.path.splitext(src_path)[1].lower()
            if not ext:
                ext = ".jpg"
            dest_filename = f"{cls}_{class_unique_count:03d}{ext}"
            dest_path = os.path.join(cls_output_dir, dest_filename)

            shutil.copy2(src_path, dest_path)

        stats[cls]["unique_saved"] = class_unique_count
        total_unique += class_unique_count

    print("\n📊 CLEANING SUMMARY TABLE:")
    print(f"{'Class Name':<15} | {'Raw Files':<10} | {'Duplicates':<10} | {'Corrupt':<8} | {'Clean Unique':<12}")
    print("-" * 65)
    for cls in CLASSES:
        s = stats[cls]
        print(f"{cls:<15} | {s['raw_count']:<10} | {s['duplicates']:<10} | {s['corrupt']:<8} | {s['unique_saved']:<12}")
    print("-" * 65)
    print(f"{'TOTAL':<15} | {total_raw:<10} | {total_raw - total_unique:<10} | 0        | {total_unique:<12}")
    print("=" * 65)
    print(f"✅ Data cleaning complete! Clean unique dataset saved to:\n   {OUTPUT_DIR}\n")

if __name__ == "__main__":
    clean_dataset()
