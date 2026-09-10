"""
======================================================================
  Agri-AI — Empirical Uncertainty & OOD Threshold Calibration Engine
======================================================================
  Evaluates In-Distribution (ID) vs Out-of-Distribution (OOD) data to
  determine sensible, data-backed thresholds for:
    1. Disease Confidence Threshold (Top-1 Softmax)
    2. Prediction Margin (Top-1 - Top-2 Difference)
    3. Energy-Based OOD Score (-log sum exp(logits))
    4. Prediction Entropy (-sum p * log p)
    5. Image Quality & Leaf Detection Baselines

  Outputs:
    - backend/vision/uncertainty_config.json (Loaded by Node.js backend)
    - backend/ml_engine/uncertainty_calibration.json (Detailed report)
======================================================================
"""

import os
import sys
import json
import random
import functools
from pathlib import Path
import numpy as np
from PIL import Image

# Force UTF-8 on Windows
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

print = functools.partial(print, flush=True)

import onnxruntime as ort
from sklearn.metrics import roc_auc_score, roc_curve

DATASET_DIR = Path(__file__).parent.parent / "dataset"
ML_DIR = Path(__file__).parent
CONFIG_OUT = Path(__file__).parent.parent / "vision" / "uncertainty_config.json"
REPORT_OUT = ML_DIR / "uncertainty_calibration.json"

ONNX_PATH = ML_DIR / "crop_disease_model.onnx"
LABELS_PATH = ML_DIR / "labels.json"

IMAGE_SIZE = 224
IMAGENET_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
IMAGENET_STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)

def grab_sample_files(dir_path, max_count=20):
    files = []
    try:
        with os.scandir(dir_path) as it:
            for entry in it:
                if entry.is_file() and entry.name.lower().endswith((".jpg", ".jpeg", ".png")):
                    files.append(entry.path)
                    if len(files) >= max_count:
                        break
    except Exception:
        pass
    return files

def preprocess_image(pil_img):
    img = pil_img.convert("RGB").resize((IMAGE_SIZE, IMAGE_SIZE), Image.Resampling.BILINEAR)
    arr = np.array(img).astype(np.float32) / 255.0
    norm = (arr - IMAGENET_MEAN) / IMAGENET_STD
    return norm.transpose(2, 0, 1)[None, ...].astype(np.float32)

def extract_features(sess, input_name, img_path):
    try:
        pil_img = Image.open(img_path)
        tensor = preprocess_image(pil_img)
        logits = sess.run(None, {input_name: tensor})[0][0]

        # 1. Softmax Probabilities
        exp_logits = np.exp(logits - np.max(logits))
        probs = exp_logits / np.sum(exp_logits)
        sorted_probs = np.sort(probs)[::-1]

        top1 = float(sorted_probs[0])
        top2 = float(sorted_probs[1]) if len(sorted_probs) > 1 else 0.0
        margin = float(top1 - top2)

        # 2. Free Energy Score (Helmholtz free energy: -T * log(sum(exp(f_i / T))))
        T = 1.0
        energy = -float(T * np.log(np.sum(np.exp(logits / T)) + 1e-12))

        # 3. Entropy
        entropy = -float(np.sum(probs * np.log(probs + 1e-12)))

        return {
            "valid": True,
            "top1_confidence": top1,
            "margin": margin,
            "energy": energy,
            "entropy": entropy
        }
    except Exception as e:
        return {"valid": False, "error": str(e)}

def run_calibration():
    print("=" * 65)
    print("  🧪 Agri-AI — Uncertainty & OOD Threshold Calibration")
    print("=" * 65)

    if not ONNX_PATH.exists():
        print(f"❌ ONNX model not found: {ONNX_PATH}")
        sys.exit(1)

    with open(LABELS_PATH, "r", encoding="utf-8") as f:
        class_names = json.load(f)
    print(f"Loaded {len(class_names)} in-distribution classes (Tomato specialist).")

    sess = ort.InferenceSession(str(ONNX_PATH))
    input_name = sess.get_inputs()[0].name

    # 1. In-Distribution (ID) Samples: Tomato validation images
    id_samples = []
    print("\n📂 Scanning In-Distribution (Tomato) samples...")
    for cls in class_names:
        cls_dir = DATASET_DIR / cls
        if cls_dir.exists():
            sampled = grab_sample_files(cls_dir, max_count=20)
            id_samples.extend(sampled)

    print(f"   Collected {len(id_samples)} In-Distribution validation samples.")

    # 2. Out-of-Distribution (OOD) Samples:
    # A. Unsupported crops from dataset (Apple, Corn, Grape, Potato, Pepper)
    ood_crop_classes = [
        "Apple___Apple_scab", "Apple___Black_rot",
        "Corn_(maize)___Common_rust_", "Corn_(maize)___Northern_Leaf_Blight",
        "Grape___Black_rot", "Grape___Esca_(Black_Measles)",
        "Potato___Early_blight", "Potato___Late_blight",
        "Pepper,_bell___Bacterial_spot"
    ]
    ood_samples = []
    print("\n📂 Scanning Out-of-Distribution (Unsupported Crop) samples...")
    for cls in ood_crop_classes:
        cls_dir = DATASET_DIR / cls
        if cls_dir.exists():
            sampled = grab_sample_files(cls_dir, max_count=15)
            ood_samples.extend(sampled)

    print(f"   Collected {len(ood_samples)} OOD unsupported crop samples.")

    # B. Non-leaf / Synthetic OOD samples
    print("   Generating synthetic non-leaf OOD samples (textured noise, solid colors, patterns)...")
    synthetic_ood_data = []
    for _ in range(50):
        # Noise or plain patterns
        if random.random() < 0.5:
            arr = np.random.randint(0, 255, (224, 224, 3), dtype=np.uint8)
        else:
            base_col = np.random.randint(30, 220, (3,))
            arr = np.full((224, 224, 3), base_col, dtype=np.uint8)
            arr = np.clip(arr + np.random.normal(0, 20, (224, 224, 3)), 0, 255).astype(np.uint8)
        
        norm = ((arr.astype(np.float32) / 255.0) - IMAGENET_MEAN) / IMAGENET_STD
        tensor = norm.transpose(2, 0, 1)[None, ...].astype(np.float32)
        logits = sess.run(None, {input_name: tensor})[0][0]
        
        exp_logits = np.exp(logits - np.max(logits))
        probs = exp_logits / np.sum(exp_logits)
        sorted_probs = np.sort(probs)[::-1]
        
        top1 = float(sorted_probs[0])
        top2 = float(sorted_probs[1]) if len(sorted_probs) > 1 else 0.0
        margin = float(top1 - top2)
        energy = -float(np.log(np.sum(np.exp(logits)) + 1e-12))
        entropy = -float(np.sum(probs * np.log(probs + 1e-12)))

        synthetic_ood_data.append({
            "top1_confidence": top1,
            "margin": margin,
            "energy": energy,
            "entropy": entropy
        })

    # 3. Extract metrics for ID and OOD
    print("\n⚡ Computing metrics on In-Distribution validation data...")
    id_data = []
    for p in id_samples:
        feat = extract_features(sess, input_name, p)
        if feat["valid"]:
            id_data.append(feat)

    print("⚡ Computing metrics on Out-of-Distribution crop data...")
    ood_data = []
    for p in ood_samples:
        feat = extract_features(sess, input_name, p)
        if feat["valid"]:
            ood_data.append(feat)

    ood_all = ood_data + synthetic_ood_data

    # 4. Statistical Distributions
    id_top1 = [d["top1_confidence"] for d in id_data]
    ood_top1 = [d["top1_confidence"] for d in ood_all]

    id_margins = [d["margin"] for d in id_data]
    ood_margins = [d["margin"] for d in ood_all]

    id_energy = [d["energy"] for d in id_data]
    ood_energy = [d["energy"] for d in ood_all]

    id_entropy = [d["entropy"] for d in id_data]
    ood_entropy = [d["entropy"] for d in ood_all]

    print("\n" + "─" * 65)
    print("📊 EMPIRICAL DISTRIBUTION COMPARISON")
    print("─" * 65)
    print(f"Metric              | ID Mean ± Std       | OOD Mean ± Std")
    print("─" * 65)
    print(f"Top-1 Confidence    | {np.mean(id_top1):.3f} ± {np.std(id_top1):.3f}     | {np.mean(ood_top1):.3f} ± {np.std(ood_top1):.3f}")
    print(f"Prediction Margin   | {np.mean(id_margins):.3f} ± {np.std(id_margins):.3f}     | {np.mean(ood_margins):.3f} ± {np.std(ood_margins):.3f}")
    print(f"Energy Score        | {np.mean(id_energy):.3f} ± {np.std(id_energy):.3f}    | {np.mean(ood_energy):.3f} ± {np.std(ood_energy):.3f}")
    print(f"Entropy             | {np.mean(id_entropy):.3f} ± {np.std(id_entropy):.3f}     | {np.mean(ood_entropy):.3f} ± {np.std(ood_entropy):.3f}")
    print("─" * 65)

    # 5. Determine AUROC for each metric
    # In binary classification: ID = 1, OOD = 0
    y_true = [1] * len(id_data) + [0] * len(ood_all)

    auroc_top1 = roc_auc_score(y_true, id_top1 + ood_top1)
    auroc_margin = roc_auc_score(y_true, id_margins + ood_margins)
    auroc_energy = roc_auc_score(y_true, [-e for e in (id_energy + ood_energy)])
    auroc_entropy = roc_auc_score(y_true, [-h for h in (id_entropy + ood_entropy)])

    print("\n🎯 OUT-OF-DISTRIBUTION SEPARATION POWER (AUROC):")
    print(f"   • Energy-Based Score AUROC : {auroc_energy * 100:.2f}%")
    print(f"   • Prediction Margin AUROC  : {auroc_margin * 100:.2f}%")
    print(f"   • Top-1 Confidence AUROC   : {auroc_top1 * 100:.2f}%")
    print(f"   • Entropy AUROC            : {auroc_entropy * 100:.2f}%")

    # 6. Calibrate Sensible Thresholds
    # In-distribution 8th-percentile for confidence and margin
    conf_threshold = round(float(np.percentile(id_top1, 8)), 2)
    margin_threshold = round(float(np.percentile(id_margins, 8)), 2)
    energy_threshold = round(float(np.percentile(id_energy, 92)), 2)
    entropy_threshold = round(float(np.percentile(id_entropy, 92)), 2)

    # Safe operational bounds
    conf_threshold = max(0.48, min(conf_threshold, 0.65))
    margin_threshold = max(0.12, min(margin_threshold, 0.25))
    energy_threshold = min(-3.80, max(energy_threshold, -5.50))
    entropy_threshold = max(1.20, min(entropy_threshold, 1.65))

    id_accepted = sum(
        1 for d in id_data
        if d["top1_confidence"] >= conf_threshold and d["margin"] >= margin_threshold and d["energy"] <= energy_threshold
    )
    ood_rejected = sum(
        1 for d in ood_all
        if not (d["top1_confidence"] >= conf_threshold and d["margin"] >= margin_threshold and d["energy"] <= energy_threshold)
    )

    tpr = (id_accepted / len(id_data)) * 100.0
    tnr = (ood_rejected / len(ood_all)) * 100.0

    print(f"\n🛡️ CALIBRATED MULTI-GATE PROTECTION PERFORMANCE:")
    print(f"   • Minimum Top-1 Confidence Threshold : {conf_threshold * 100:.1f}%")
    print(f"   • Minimum Prediction Margin Threshold: {margin_threshold * 100:.1f}%")
    print(f"   • Maximum Energy Score Threshold     : {energy_threshold:.2f}")
    print(f"   • Maximum Entropy Threshold          : {entropy_threshold:.2f}")
    print(f"   • In-Distribution Retention Rate     : {tpr:.1f}% (ID True Positives)")
    print(f"   • Out-of-Distribution Rejection Rate : {tnr:.1f}% (OOD True Negatives)")

    # 7. Write runtime config for Node.js
    config = {
        "calibrated": True,
        "modelType": "MobileNetV3-Large-ONNX",
        "thresholds": {
            "diseaseConfidence": conf_threshold,
            "predictionMargin": margin_threshold,
            "maxEnergyScore": energy_threshold,
            "maxEntropy": entropy_threshold,
            "minQualityScore": 50,
            "minLeafConfidence": 0.50
        },
        "criticalQualityIssues": [
            "too_blurry",
            "too_dark",
            "severely_overexposed",
            "corrupted_image",
            "extremely_low_resolution"
        ],
        "calibrationStats": {
            "numInDistributionSamples": len(id_data),
            "numOodSamples": len(ood_all),
            "idRetentionRate": round(tpr, 2),
            "oodRejectionRate": round(tnr, 2),
            "energyAuroc": round(float(auroc_energy), 4),
            "marginAuroc": round(float(auroc_margin), 4),
            "top1Auroc": round(float(auroc_top1), 4)
        }
    }

    CONFIG_OUT.parent.mkdir(parents=True, exist_ok=True)
    with open(CONFIG_OUT, "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2)
    print(f"\n💾 Runtime uncertainty config saved -> {CONFIG_OUT}")

    with open(REPORT_OUT, "w", encoding="utf-8") as f:
        json.dump({
            "config": config,
            "id_stats": {
                "top1_mean": float(np.mean(id_top1)), "top1_std": float(np.std(id_top1)),
                "margin_mean": float(np.mean(id_margins)), "margin_std": float(np.std(id_margins)),
                "energy_mean": float(np.mean(id_energy)), "energy_std": float(np.std(id_energy)),
                "entropy_mean": float(np.mean(id_entropy)), "entropy_std": float(np.std(id_entropy)),
            },
            "ood_stats": {
                "top1_mean": float(np.mean(ood_top1)), "top1_std": float(np.std(ood_top1)),
                "margin_mean": float(np.mean(ood_margins)), "margin_std": float(np.std(ood_margins)),
                "energy_mean": float(np.mean(ood_energy)), "energy_std": float(np.std(ood_energy)),
                "entropy_mean": float(np.mean(ood_entropy)), "entropy_std": float(np.std(ood_entropy)),
            }
        }, f, indent=2)
    print(f"📈 Detailed calibration metrics saved -> {REPORT_OUT}")
    print("=" * 65 + "\n")

if __name__ == "__main__":
    run_calibration()
