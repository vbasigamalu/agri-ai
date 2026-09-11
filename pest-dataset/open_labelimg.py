"""
open_labelimg.py
────────────────────────────────────────────────────────────────────
Launches LabelImg pre-configured for YOLO annotation on the pest dataset.

Usage:
  python open_labelimg.py [split] [class]

  split  : train | test     (default: train)
  class  : aphids | armyworm | beetle | bollworm | grasshopper |
           mites | mosquito | sawfly | stem_borer | all
           (default: all — opens the full split folder)

Examples:
  python open_labelimg.py                    # opens pest/train/
  python open_labelimg.py train aphids       # opens pest/train/aphids/
  python open_labelimg.py train armyworm     # opens pest/train/armyworm/

How to annotate in LabelImg (YOLO mode):
  1. Press W  → draw a bounding box around the pest
  2. Select the class name from the popup list
  3. Press Ctrl+S to save (creates a .txt file next to the image)
  4. Press D  → next image
  5. Press A  → previous image
  6. Press Ctrl+Shift+S → save all

Keyboard shortcuts:
  W          Draw rectangle box
  D / A      Next / Previous image
  Ctrl+S     Save current annotation
  Del        Delete selected box
  Ctrl+Z     Undo
────────────────────────────────────────────────────────────────────
"""

import sys
import os
import subprocess

BASE = os.path.dirname(os.path.abspath(__file__))
CLASSES_FILE = os.path.join(BASE, "classes.txt")

CLASSES = [
    "aphids", "armyworm", "beetle", "bollworm", "grasshopper",
    "mites", "mosquito", "sawfly", "stem_borer"
]

split = sys.argv[1] if len(sys.argv) > 1 else "train"
cls   = sys.argv[2] if len(sys.argv) > 2 else "all"

if split not in ("train", "test"):
    print(f"Invalid split '{split}'. Use: train | test")
    sys.exit(1)

if cls == "all":
    image_dir = os.path.join(BASE, "pest", split)
else:
    if cls not in CLASSES:
        print(f"Invalid class '{cls}'. Choose from: {', '.join(CLASSES)}")
        sys.exit(1)
    image_dir = os.path.join(BASE, "pest", split, cls)

# Save output labels in same folder as images (YOLO standard)
save_dir = image_dir

print(f"\n🔍 Opening LabelImg")
print(f"   Split     : {split}")
print(f"   Class     : {cls}")
print(f"   Image dir : {image_dir}")
print(f"   Save dir  : {save_dir}")
print(f"   Classes   : {CLASSES_FILE}")
print(f"\n📌 Tip: Press W to draw a box, Ctrl+S to save, D for next image\n")

# Launch LabelImg: labelImg [image_dir] [predefined_classes_file] [save_dir]
subprocess.run([
    "labelImg",
    image_dir,
    CLASSES_FILE,
    save_dir
])
