"""
======================================================================
  Agri-AI — Grad-CAM Batch Evaluation & Attention Audit Tool
======================================================================
  Executes systematic explainability audits on the disease classifier:
    1. Audits model attention on key agricultural disease categories:
       - Early Blight (Target-board concentric necrotic spots)
       - Bacterial Spot (Small dark chlorotic lesions)
       - Leaf Mold (Foliar yellowing and mold patches)
       - Spider Mites (Fine stippling and damage)
       - Healthy Foliage (Uniform vegetative tissue)
       - Real-world leaf with noisy soil background
    2. Quantifies whether attention concentrates on leaf lesions
       versus background, soil, or image borders.
    3. Outputs comparison triplet figures:
       Original Image | Processed Leaf | Grad-CAM Heatmap | Overlay
    4. Writes structured summary to gradcam_evaluation_report.json.

  Run:
    python evaluate_gradcam.py --run_benchmark
    python evaluate_gradcam.py --image <path_to_image>
======================================================================
"""

import os
import sys
import json
import argparse
from pathlib import Path
import numpy as np
import cv2
from PIL import Image
import torch

# Force UTF-8 encoding on Windows console
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

from gradcam import (
    load_trained_model,
    explain_image,
    evaluate_attention_concentration,
    GradCAM,
    isolate_leaf_region,
    generate_comparison_figure,
    IMAGENET_MEAN,
    IMAGENET_STD
)

OUTPUT_DIR = Path(__file__).parent / "gradcam_outputs"
DATASET_DIR = Path(__file__).parent.parent / "dataset"
REPORT_PATH = Path(__file__).parent / "gradcam_evaluation_report.json"


def create_noisy_soil_sample(clean_leaf_path, width=320, height=320):
    """
    Creates a realistic synthetic test sample with a real diseased leaf
    placed on noisy agricultural soil background to test background debiasing.
    """
    leaf_img = Image.open(clean_leaf_path).convert("RGB")
    leaf_np = np.array(leaf_img)
    leaf_h, leaf_w = leaf_np.shape[:2]

    # Create soil background
    soil_bg = np.zeros((height, width, 3), dtype=np.uint8)
    for y in range(height):
        for x in range(width):
            noise = ((x * 31 + y * 17) % 30) - 15
            soil_bg[y, x, 0] = max(0, min(255, 115 + noise))  # Red
            soil_bg[y, x, 1] = max(0, min(255, 75 + noise))   # Green
            soil_bg[y, x, 2] = max(0, min(255, 45 + noise))   # Blue

    # Place resized leaf in center
    target_leaf_size = 180
    scaled_leaf = cv2.resize(leaf_np, (target_leaf_size, target_leaf_size))

    # Mask leaf
    hsv = cv2.cvtColor(scaled_leaf, cv2.COLOR_RGB2HSV)
    s = hsv[:, :, 1]
    v = hsv[:, :, 2]
    mask = ((s > 25) & (v > 20) & (v < 245)).astype(np.float32)[:, :, np.newaxis]
    mask = cv2.GaussianBlur(mask, (5, 5), 0)[:, :, np.newaxis]

    dy = (height - target_leaf_size) // 2
    dx = (width - target_leaf_size) // 2

    composite = soil_bg.copy()
    roi = composite[dy:dy+target_leaf_size, dx:dx+target_leaf_size].astype(np.float32)
    blended = scaled_leaf.astype(np.float32) * mask + roi * (1.0 - mask)
    composite[dy:dy+target_leaf_size, dx:dx+target_leaf_size] = np.clip(blended, 0, 255).astype(np.uint8)

    return composite


def run_explainability_benchmark():
    print("=" * 70)
    print("  [Grad-CAM] Agri-AI - Explainability & Attention Audit Benchmark")
    print("=" * 70)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    print("\n[1/4] Loading trained MobileNetV3-Large model and class labels...")
    model, class_names, device = load_trained_model()
    print(f"      Loaded model successfully on {device} ({len(class_names)} classes).")

    # Benchmark Test Cases
    test_cases = [
        {
            "category": "Tomato___Early_blight",
            "title": "Early Blight (Target-board Necrotic Lesions)",
            "output_filename": "comparison_early_blight.png"
        },
        {
            "category": "Tomato___Bacterial_spot",
            "title": "Bacterial Spot (Small Angular Brown Specks)",
            "output_filename": "comparison_bacterial_spot.png"
        },
        {
            "category": "Tomato___Leaf_Mold",
            "title": "Leaf Mold (Foliar Chlorotic & Velvet Patches)",
            "output_filename": "comparison_leaf_mold.png"
        },
        {
            "category": "Tomato___Spider_mites Two-spotted_spider_mite",
            "title": "Two-Spotted Spider Mites (Fine Foliar Stippling)",
            "output_filename": "comparison_spider_mites.png"
        },
        {
            "category": "Tomato___healthy",
            "title": "Healthy Leaf (Uniform Vegetative Tissue)",
            "output_filename": "comparison_healthy.png"
        }
    ]

    results = []
    print("\n[2/4] Generating Grad-CAM Heatmaps & Visual Triplet Comparisons...\n")

    for tc in test_cases:
        cat_dir = DATASET_DIR / tc["category"]
        if not cat_dir.exists():
            print(f"   [!] Skipping {tc['category']}: directory not found.")
            continue

        images = list(cat_dir.glob("*.JPG")) + list(cat_dir.glob("*.jpg"))
        if not images:
            print(f"   [!] Skipping {tc['category']}: no images found.")
            continue

        sample_path = images[0]
        out_fig_path = OUTPUT_DIR / tc["output_filename"]

        print(f"   * Auditing: {tc['title']}")
        print(f"     File    : {sample_path.name}")

        result = explain_image(
            image_input=sample_path,
            model=model,
            class_names=class_names,
            device=device,
            output_path=out_fig_path
        )

        m = result["metrics"]
        print(f"     Diagnosis: {result['diagnosis']} ({result['confidence_percent']}%)")
        print(f"     Attention: Leaf Concentration = {m['leaf_concentration_ratio']}%, Background Leakage = {m['background_leakage_ratio']}%, Border Leakage = {m['border_leakage_ratio']}%")
        print(f"     Verdict  : {'[PASS] Concentrated on Leaf' if m['is_concentrated_on_leaf'] else '[WARN] Potential Leakage'}")
        print(f"     Figure   : {out_fig_path.name}\n")

        results.append({
            "test_case": tc["title"],
            "category": tc["category"],
            "image_name": sample_path.name,
            "diagnosis": result["diagnosis"],
            "confidence": result["confidence"],
            "confidence_percent": result["confidence_percent"],
            "leaf_concentration_ratio": m["leaf_concentration_ratio"],
            "background_leakage_ratio": m["background_leakage_ratio"],
            "border_leakage_ratio": m["border_leakage_ratio"],
            "peak_on_leaf": m["peak_on_leaf"],
            "is_concentrated_on_leaf": m["is_concentrated_on_leaf"],
            "figure_path": str(out_fig_path)
        })

    # Test Case 6: Dedicated Noisy Background / Soil Test
    print("[3/4] Auditing Leaf on Noisy Soil Background (Background Debiasing Verification)...")
    eb_dir = DATASET_DIR / "Tomato___Early_blight"
    if eb_dir.exists():
        eb_images = list(eb_dir.glob("*.JPG"))
        if eb_images:
            noisy_sample = create_noisy_soil_sample(eb_images[0])
            out_noisy_path = OUTPUT_DIR / "comparison_noisy_soil_background.png"

            result = explain_image(
                image_input=noisy_sample,
                model=model,
                class_names=class_names,
                device=device,
                output_path=out_noisy_path
            )

            m = result["metrics"]
            print(f"     Diagnosis: {result['diagnosis']} ({result['confidence_percent']}%)")
            print(f"     Attention: Leaf Concentration = {m['leaf_concentration_ratio']}%, Background Leakage = {m['background_leakage_ratio']}%, Border Leakage = {m['border_leakage_ratio']}%")
            print(f"     Verdict  : {'[PASS] Concentrated on Leaf' if m['is_concentrated_on_leaf'] else '[WARN] Background Leakage'}")
            print(f"     Figure   : {out_noisy_path.name}\n")

            results.append({
                "test_case": "Noisy Soil Background Challenge",
                "category": "Tomato___Early_blight",
                "image_name": "synthetic_noisy_soil_composite.png",
                "diagnosis": result["diagnosis"],
                "confidence": result["confidence"],
                "confidence_percent": result["confidence_percent"],
                "leaf_concentration_ratio": m["leaf_concentration_ratio"],
                "background_leakage_ratio": m["background_leakage_ratio"],
                "border_leakage_ratio": m["border_leakage_ratio"],
                "peak_on_leaf": m["peak_on_leaf"],
                "is_concentrated_on_leaf": m["is_concentrated_on_leaf"],
                "figure_path": str(out_noisy_path)
            })

    # Compute Aggregate Benchmark Statistics
    print("[4/4] Compiling Quantitative Attention Audit Report...")
    mean_leaf_conc = float(np.mean([r["leaf_concentration_ratio"] for r in results]))
    mean_bg_leak = float(np.mean([r["background_leakage_ratio"] for r in results]))
    mean_border_leak = float(np.mean([r["border_leakage_ratio"] for r in results]))
    pass_count = sum(1 for r in results if r["is_concentrated_on_leaf"])

    summary = {
        "timestamp": "2026-09-06",
        "model_architecture": "MobileNetV3-Large (mobilenetv3_large_100)",
        "target_convolutional_block": "model.blocks[-1] (960 channels, 7x7 spatial resolution)",
        "total_test_cases": len(results),
        "passed_concentration_audit": pass_count,
        "pass_rate_percent": round((pass_count / len(results)) * 100.0, 2),
        "mean_leaf_attention_concentration_pct": round(mean_leaf_conc, 2),
        "mean_background_leakage_pct": round(mean_bg_leak, 2),
        "mean_border_leakage_pct": round(mean_border_leak, 2),
        "results": results,
        "caveat": "Grad-CAM indicates class-discriminative gradient attribution, not biological causality."
    }

    with open(REPORT_PATH, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)

    print("\n" + "-" * 70)
    print("EXPLAINABILITY AUDIT SUMMARY")
    print("-" * 70)
    print(f"Total Test Cases Evaluated       : {len(results)}")
    print(f"Cases Concentrated on Leaf Tissue: {pass_count} / {len(results)} ({summary['pass_rate_percent']}%)")
    print(f"Mean Leaf Attention Energy       : {mean_leaf_conc:.1f}%")
    print(f"Mean Background Leakage          : {mean_bg_leak:.1f}%")
    print(f"Mean Border Artifact Leakage     : {mean_border_leak:.1f}%")
    print(f"Visual Figures Saved in          : {OUTPUT_DIR}")
    print(f"Detailed Audit Report Saved to   : {REPORT_PATH}")
    print("-" * 70)
    print("Explainability Note: Grad-CAM highlights gradient attribution.")
    print("It serves as a diagnostic tool and does not claim causality.")
    print("=" * 70 + "\n")


def explain_single_image(image_path, target_class=None):
    p = Path(image_path)
    if not p.exists():
        print(f"[!] Error: Image not found at {p}")
        sys.exit(1)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = OUTPUT_DIR / f"gradcam_{p.stem}.png"

    model, class_names, device = load_trained_model()
    result = explain_image(
        image_input=p,
        model=model,
        class_names=class_names,
        device=device,
        target_class=target_class,
        output_path=out_path
    )

    m = result["metrics"]
    print("\n" + "=" * 65)
    print(f"Grad-CAM Explainability Diagnosis for: {p.name}")
    print("=" * 65)
    print(f"Diagnosis           : {result['diagnosis']}")
    print(f"Confidence          : {result['confidence_percent']}%")
    print(f"Leaf Concentration  : {m['leaf_concentration_ratio']}% (Attention on leaf tissue)")
    print(f"Background Leakage  : {m['background_leakage_ratio']}%")
    print(f"Border Leakage      : {m['border_leakage_ratio']}%")
    print(f"Peak on Leaf        : {'Yes' if m['peak_on_leaf'] else 'No'}")
    print(f"Concentration Audit : {'[PASS] Focused on leaf' if m['is_concentrated_on_leaf'] else '[WARN] High background leakage'}")
    print(f"Saved Visual Triplet: {out_path}")
    print("=" * 65 + "\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Agri-AI Grad-CAM Explainability & Attention Audit Tool")
    parser.add_argument("--image", type=str, help="Path to a single image to explain")
    parser.add_argument("--target_class", type=int, default=None, help="Target class index (optional)")
    parser.add_argument("--run_benchmark", action="store_true", help="Run the standard multi-class explainability audit")

    args = parser.parse_args()

    if args.image:
        explain_single_image(args.image, target_class=args.target_class)
    else:
        run_explainability_benchmark()
