"""
======================================================================
  Agri-AI — Grad-CAM Explainability & Attention Auditing Module
======================================================================
  Purpose:
    Visualizes and quantifies class-discriminative feature attribution
    using Gradient-weighted Class Activation Mapping (Grad-CAM, Selvaraju et al.).

  Key Capabilities:
    1. Hook into MobileNetV3-Large final convolutional block (model.blocks[-1]).
    2. Extract spatial activation maps (7x7) and backpropagated class gradients.
    3. Generate high-resolution, normalized Grad-CAM heatmaps upsampled to 224x224.
    4. Produce the visual comparison triplet required for model audits:
         - Panel 1: Original Farmer Image
         - Panel 2: Processed Leaf (Isolated foliage via vision pipeline)
         - Panel 3: Grad-CAM Saliency Heatmap
         - Panel 4: Heatmap Overlay on Processed Leaf
    5. Compute quantitative Attention Concentration Metrics:
         - Leaf Attention Concentration Ratio (%)
         - Background Leakage Ratio (%)
         - Border Activation Ratio (%)
         - Peak Attribution Location (Inside vs Outside Leaf)

  Scientific & Diagnostic Caveat:
    Grad-CAM is an explainability and debugging tool that highlights
    regions with high gradient attribution for the predicted class.
    It does NOT prove biological or clinical causality.
======================================================================
"""

import os
import sys
import json
from pathlib import Path
import numpy as np
import cv2
from PIL import Image
import torch
import torch.nn as nn
import torch.nn.functional as F
import matplotlib
matplotlib.use("Agg")  # Non-interactive headless backend
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec

# ─────────────────────────────────────────────────────────────
#  DEFAULT PATHS & CONSTANTS
# ─────────────────────────────────────────────────────────────
CURRENT_DIR = Path(__file__).parent.resolve()
MODEL_PATH = CURRENT_DIR / "best_model.pth"
LABELS_PATH = CURRENT_DIR / "labels.json"
SEG_MODEL_PATH = CURRENT_DIR / "leaf_segmentation.onnx"

IMAGENET_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
IMAGENET_STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)


# ─────────────────────────────────────────────────────────────
#  MODEL LOADER
# ─────────────────────────────────────────────────────────────
def load_trained_model(model_path=MODEL_PATH, labels_path=LABELS_PATH, device=None):
    """
    Loads the trained MobileNetV3-Large model with frozen evaluation weights.
    Strictly preserves weights without modification.
    """
    if device is None:
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    with open(labels_path, "r", encoding="utf-8") as f:
        class_names = json.load(f)

    import timm
    model = timm.create_model("mobilenetv3_large_100", pretrained=False, num_classes=len(class_names))
    state = torch.load(str(model_path), map_location=device)
    model.load_state_dict(state)
    model.to(device)
    model.eval()

    # Ensure evaluation mode and disable weight gradients (only input activations will receive gradients)
    for param in model.parameters():
        param.requires_grad = False

    return model, class_names, device


# ─────────────────────────────────────────────────────────────
#  GRAD-CAM CORE ENGINE
# ─────────────────────────────────────────────────────────────
class GradCAM:
    """
    Grad-CAM implementation tailored for MobileNetV3 architectures.
    Hooks into the final inverted residual block (model.blocks[-1])
    to capture spatial activations and backpropagated gradients.
    """

    def __init__(self, model, target_layer=None, device=None):
        self.model = model
        self.device = device or next(model.parameters()).device

        # Default to final convolutional block for MobileNetV3
        if target_layer is None:
            if hasattr(model, "blocks") and len(model.blocks) > 0:
                self.target_layer = model.blocks[-1]
            elif hasattr(model, "conv_head"):
                self.target_layer = model.conv_head
            else:
                raise ValueError("Could not determine final convolutional layer in model.")
        else:
            self.target_layer = target_layer

        self.activations = []
        self.gradients = []
        self.hook_handles = []
        self._register_hooks()

    def _register_hooks(self):
        def forward_hook(module, inp, outp):
            self.activations.append(outp)

        def backward_hook(module, grad_in, grad_out):
            self.gradients.append(grad_out[0])

        self.hook_handles.append(self.target_layer.register_forward_hook(forward_hook))
        self.hook_handles.append(self.target_layer.register_full_backward_hook(backward_hook))

    def remove_hooks(self):
        for handle in self.hook_handles:
            handle.remove()
        self.hook_handles = []

    def generate(self, input_tensor, target_class=None):
        """
        Generates Grad-CAM heatmap for an input tensor.

        Args:
            input_tensor: torch.Tensor of shape (1, 3, 224, 224)
            target_class: int (class index) or None (uses top predicted class)

        Returns:
            dict containing:
              - heatmap: np.ndarray (224, 224) normalized in [0, 1]
              - target_class: int
              - pred_class: int
              - confidence: float (softmax probability)
              - logits: np.ndarray
        """
        self.activations.clear()
        self.gradients.clear()

        input_tensor = input_tensor.to(self.device)
        if not input_tensor.requires_grad:
            input_tensor.requires_grad = True

        self.model.zero_grad()

        # Forward pass
        logits = self.model(input_tensor)
        probs = F.softmax(logits, dim=1).detach().cpu().numpy()[0]
        pred_class = int(logits.argmax(dim=1).item())

        if target_class is None:
            target_class = pred_class

        # Target class score
        score = logits[0, target_class]

        # Backward pass
        score.backward(retain_graph=True)

        if len(self.activations) == 0 or len(self.gradients) == 0:
            raise RuntimeError("Grad-CAM hooks failed to capture activations or gradients.")

        # Extract activations and gradients
        # Shape: (C, H_feat, W_feat) e.g., (960, 7, 7)
        act = self.activations[-1].detach().cpu().numpy()[0]
        grad = self.gradients[-1].detach().cpu().numpy()[0]

        # Global Average Pooling of gradients to compute importance weights
        weights = np.mean(grad, axis=(1, 2))  # (960,)

        # Linear combination of feature maps weighted by alpha
        cam = np.zeros(act.shape[1:], dtype=np.float32)  # (7, 7)
        for k, w in enumerate(weights):
            cam += w * act[k]

        # Apply ReLU to retain only positive influences on the target class
        cam = np.maximum(cam, 0)

        # Bilinear upsampling to match input image spatial resolution (224, 224)
        target_h, target_w = input_tensor.shape[2], input_tensor.shape[3]
        if cam.max() > cam.min():
            cam = (cam - cam.min()) / (cam.max() - cam.min() + 1e-12)
        else:
            cam = np.zeros_like(cam)

        heatmap = cv2.resize(cam, (target_w, target_h), interpolation=cv2.INTER_CUBIC)
        heatmap = np.clip(heatmap, 0.0, 1.0)

        return {
            "heatmap": heatmap,
            "target_class": target_class,
            "pred_class": pred_class,
            "confidence": float(probs[pred_class]),
            "target_confidence": float(probs[target_class]),
            "logits": logits.detach().cpu().numpy()[0],
            "probs": probs
        }

    @staticmethod
    def create_overlay(image_rgb, heatmap, colormap=cv2.COLORMAP_JET, alpha=0.45):
        """
        Blends a 2D float heatmap [0, 1] onto an RGB image uint8 [0, 255].
        """
        if image_rgb.shape[:2] != heatmap.shape[:2]:
            heatmap = cv2.resize(heatmap, (image_rgb.shape[1], image_rgb.shape[0]))

        heatmap_uint8 = np.uint8(255 * np.clip(heatmap, 0.0, 1.0))
        heatmap_colored = cv2.applyColorMap(heatmap_uint8, colormap)
        heatmap_colored = cv2.cvtColor(heatmap_colored, cv2.COLOR_BGR2RGB)

        overlay = cv2.addWeighted(image_rgb, 1.0 - alpha, heatmap_colored, alpha, 0)
        return overlay, heatmap_colored


# ─────────────────────────────────────────────────────────────
#  VISION PREPROCESSING & LEAF SEGMENTATION INTEGRATION
# ─────────────────────────────────────────────────────────────
def preprocess_for_model(image_rgb, target_size=224):
    """
    Standard PyTorch normalization for MobileNetV3.
    """
    resized = cv2.resize(image_rgb, (target_size, target_size), interpolation=cv2.INTER_AREA)
    norm = (resized.astype(np.float32) / 255.0 - IMAGENET_MEAN) / IMAGENET_STD
    tensor = torch.tensor(norm, dtype=torch.float32).permute(2, 0, 1).unsqueeze(0)
    return tensor, resized


def isolate_leaf_region(image_rgb, target_size=224):
    """
    Emulates the Agri-AI Robust Vision Pipeline in Python:
      1. Uses leaf_segmentation.onnx (or morphological leaf extractor) to obtain leaf mask
      2. Crops tight bounding box around the detected leaf
      3. Suppresses non-leaf background
      4. Letterbox resizes to target_size (224x224) maintaining aspect ratio
    """
    h, w = image_rgb.shape[:2]
    mask = None

    # Try ONNX leaf segmentation first
    if SEG_MODEL_PATH.exists():
        try:
            import onnxruntime as ort
            sess = ort.InferenceSession(str(SEG_MODEL_PATH), providers=["CPUExecutionProvider"])
            inp_img = cv2.resize(image_rgb, (256, 256)).astype(np.float32) / 255.0
            inp_tensor = np.transpose(inp_img, (2, 0, 1))[np.newaxis, ...]
            pred = sess.run(None, {"input": inp_tensor})[0][0][0]
            pred_full = cv2.resize(pred, (w, h))
            mask = (pred_full > 0.45).astype(np.uint8) * 255
        except Exception:
            mask = None

    # Fallback to morphological/ExG leaf extraction
    if mask is None or np.sum(mask > 0) < (h * w * 0.03):
        hsv = cv2.cvtColor(image_rgb, cv2.COLOR_RGB2HSV)
        s = hsv[:, :, 1]
        v = hsv[:, :, 2]
        r = image_rgb[:, :, 0].astype(np.float32)
        g = image_rgb[:, :, 1].astype(np.float32)
        b = image_rgb[:, :, 2].astype(np.float32)

        exg = 2 * g - r - b
        green_foliage = (exg > 5) & (g > 30)
        chroma_tissue = (s > 30) & (v > 20) & (v < 250)
        lesion_tissue = (hsv[:, :, 0] >= 8) & (hsv[:, :, 0] <= 45) & (s > 25)

        raw_mask = (green_foliage | chroma_tissue | lesion_tissue).astype(np.uint8) * 255
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        mask = cv2.morphologyEx(raw_mask, cv2.MORPH_CLOSE, kernel)

    # Find leaf bounding box
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if contours:
        valid_contours = [c for c in contours if cv2.contourArea(c) > (h * w * 0.01)]
        if valid_contours:
            c = max(valid_contours, key=cv2.contourArea)
            bx, by, bw, bh = cv2.boundingRect(c)
            # Add 8% safety margin
            pad_x = int(bw * 0.08)
            pad_y = int(bh * 0.08)
            x1 = max(0, bx - pad_x)
            y1 = max(0, by - pad_y)
            x2 = min(w, bx + bw + pad_x)
            y2 = min(h, by + bh + pad_y)
        else:
            x1, y1, x2, y2 = 0, 0, w, h
    else:
        x1, y1, x2, y2 = 0, 0, w, h

    # Crop and apply soft background suppression
    crop_img = image_rgb[y1:y2, x1:x2]
    crop_mask = mask[y1:y2, x1:x2]

    # Masked leaf on neutral background
    neutral_bg = np.full_like(crop_img, 128)
    alpha = cv2.GaussianBlur(crop_mask.astype(np.float32) / 255.0, (5, 5), 0)[:, :, np.newaxis]
    suppressed = np.clip(crop_img * alpha + neutral_bg * (1.0 - alpha), 0, 255).astype(np.uint8)

    # Resize to target size preserving aspect ratio (letterbox contain)
    sh, sw = suppressed.shape[:2]
    scale = min(target_size / sh, target_size / sw)
    nw, nh = int(sw * scale), int(sh * scale)
    scaled_leaf = cv2.resize(suppressed, (nw, nh), interpolation=cv2.INTER_AREA)
    scaled_mask = cv2.resize(crop_mask, (nw, nh), interpolation=cv2.INTER_NEAREST)

    processed_leaf = np.full((target_size, target_size, 3), 128, dtype=np.uint8)
    final_mask = np.zeros((target_size, target_size), dtype=np.uint8)

    dx = (target_size - nw) // 2
    dy = (target_size - nh) // 2
    processed_leaf[dy:dy+nh, dx:dx+nw] = scaled_leaf
    final_mask[dy:dy+nh, dx:dx+nw] = scaled_mask

    bbox = (x1, y1, x2 - x1, y2 - y1)
    return processed_leaf, final_mask, bbox


# ─────────────────────────────────────────────────────────────
#  QUANTITATIVE ATTENTION AUDIT METRICS
# ─────────────────────────────────────────────────────────────
def evaluate_attention_concentration(heatmap, leaf_mask, border_margin_pct=0.10):
    """
    Computes quantitative spatial metrics to verify whether the model's
    attention is concentrated on disease-affected leaf tissue versus background.

    Metrics:
      1. leaf_attention_energy: Sum of heatmap activation within leaf mask.
      2. total_attention_energy: Sum of heatmap activation across entire image.
      3. leaf_concentration_ratio: leaf_energy / total_energy (Target: > 75%)
      4. background_leakage_ratio: 100% - leaf_concentration_ratio (Target: < 25%)
      5. border_leakage_ratio: Percentage of attention on outer 10% image border (Target: < 15%)
      6. peak_on_leaf: Boolean indicating if maximum attribution falls inside leaf.
      7. is_concentrated_on_leaf: Overall verdict based on multi-factor criteria.
    """
    h, w = heatmap.shape[:2]
    if leaf_mask.shape[:2] != (h, w):
        leaf_mask = cv2.resize(leaf_mask, (w, h), interpolation=cv2.INTER_NEAREST)

    binary_mask = (leaf_mask > 0).astype(np.float32)
    bg_mask = 1.0 - binary_mask

    total_energy = float(np.sum(heatmap)) + 1e-12
    leaf_energy = float(np.sum(heatmap * binary_mask))
    bg_energy = float(np.sum(heatmap * bg_mask))

    leaf_concentration = (leaf_energy / total_energy) * 100.0
    bg_leakage = (bg_energy / total_energy) * 100.0

    # Border margin mask (outer 10% on all four edges)
    border_px = int(min(h, w) * border_margin_pct)
    border_mask = np.zeros((h, w), dtype=np.float32)
    border_mask[:border_px, :] = 1.0
    border_mask[-border_px:, :] = 1.0
    border_mask[:, :border_px] = 1.0
    border_mask[:, -border_px:] = 1.0

    border_energy = float(np.sum(heatmap * border_mask))
    border_leakage = (border_energy / total_energy) * 100.0

    # Peak attribution coordinate
    min_val, max_val, min_loc, max_loc = cv2.minMaxLoc(heatmap)
    peak_x, peak_y = max_loc
    peak_on_leaf = bool(binary_mask[peak_y, peak_x] > 0)

    # Verification threshold:
    # Model is considered "concentrated on leaf" if >= 70% of energy is on leaf,
    # border leakage <= 20%, and peak attribution is on leaf tissue.
    is_concentrated = (leaf_concentration >= 70.0) and (border_leakage <= 22.0) and peak_on_leaf

    return {
        "leaf_concentration_ratio": round(leaf_concentration, 2),
        "background_leakage_ratio": round(bg_leakage, 2),
        "border_leakage_ratio": round(border_leakage, 2),
        "peak_location": {"x": int(peak_x), "y": int(peak_y)},
        "peak_on_leaf": peak_on_leaf,
        "is_concentrated_on_leaf": is_concentrated,
        "leaf_area_coverage_pct": round(float(np.mean(binary_mask)) * 100.0, 2)
    }


# ─────────────────────────────────────────────────────────────
#  VISUAL COMPARISON TRIPLET FIGURE GENERATOR
# ─────────────────────────────────────────────────────────────
def generate_comparison_figure(
    original_rgb,
    processed_leaf,
    heatmap,
    overlay,
    diagnosis_name,
    confidence,
    metrics,
    output_path,
    crop_bbox=None
):
    """
    Renders a publication-grade 4-panel visual comparison:
      - Panel 1: Original Farmer Image (with detected leaf bounding box)
      - Panel 2: Processed Leaf (Vision pipeline output sent to model)
      - Panel 3: Grad-CAM Saliency Heatmap (JET colormap)
      - Panel 4: Heatmap Overlay on Processed Leaf

    Includes an explanatory header with quantitative audit metrics and caveat banner.
    """
    fig = plt.figure(figsize=(18, 6.2), facecolor="#0e131f")

    gs = gridspec.GridSpec(1, 4, figure=fig, wspace=0.08, left=0.03, right=0.97, top=0.82, bottom=0.12)

    # 1. Panel 1: Original Image
    ax1 = fig.add_subplot(gs[0, 0])
    orig_display = original_rgb.copy()
    if crop_bbox is not None:
        bx, by, bw, bh = crop_bbox
        cv2.rectangle(orig_display, (bx, by), (bx + bw, by + bh), (34, 197, 94), 3)
    ax1.imshow(orig_display)
    ax1.set_title("1. Original Farmer Image\n(Raw Input with Background)", color="#e2e8f0", fontsize=11, fontweight="bold", pad=8)
    ax1.axis("off")

    # 2. Panel 2: Processed Leaf
    ax2 = fig.add_subplot(gs[0, 1])
    ax2.imshow(processed_leaf)
    ax2.set_title("2. Processed Leaf\n(Vision Pipeline: Crop + Debias)", color="#e2e8f0", fontsize=11, fontweight="bold", pad=8)
    ax2.axis("off")

    # 3. Panel 3: Grad-CAM Heatmap
    ax3 = fig.add_subplot(gs[0, 2])
    im3 = ax3.imshow(heatmap, cmap="jet", vmin=0.0, vmax=1.0)
    ax3.set_title("3. Grad-CAM Heatmap\n(Gradient Saliency Distribution)", color="#e2e8f0", fontsize=11, fontweight="bold", pad=8)
    ax3.axis("off")

    # 4. Panel 4: Heatmap Overlay
    ax4 = fig.add_subplot(gs[0, 3])
    ax4.imshow(overlay)
    ax4.set_title("4. Heatmap Overlay\n(Disease Lesion Attribution)", color="#e2e8f0", fontsize=11, fontweight="bold", pad=8)
    ax4.axis("off")

    # Title & Metric Header Banner
    conc = metrics["leaf_concentration_ratio"]
    bg_leak = metrics["background_leakage_ratio"]
    status_str = "LEAF-CONCENTRATED" if metrics["is_concentrated_on_leaf"] else "BACKGROUND-LEAKAGE"
    status_color = "#22c55e" if metrics["is_concentrated_on_leaf"] else "#f59e0b"

    fig.text(
        0.5, 0.94,
        f"Agri-AI Explainability Audit - {diagnosis_name.replace('___', ' ')} ({confidence * 100:.1f}% Confidence)",
        ha="center", va="center", color="#f8fafc", fontsize=15, fontweight="bold"
    )

    fig.text(
        0.5, 0.88,
        f"Attention Audit: [{status_str}]  |  Leaf Attention Concentration: {conc:.1f}%  |  Background Leakage: {bg_leak:.1f}%  |  Border Leakage: {metrics['border_leakage_ratio']:.1f}%",
        ha="center", va="center", color=status_color, fontsize=11, fontweight="bold"
    )

    # Mandatory Diagnostic / Causality Disclaimer
    fig.text(
        0.5, 0.04,
        "Explainability Note: Grad-CAM reflects class-discriminative gradient attribution in the final conv layer. It does NOT prove biological causality.",
        ha="center", va="center", color="#94a3b8", fontsize=9, style="italic"
    )

    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    plt.savefig(output_path, dpi=160, facecolor=fig.get_facecolor(), edgecolor="none")
    plt.close(fig)


# ─────────────────────────────────────────────────────────────
#  END-TO-END EXPLAINABILITY PIPELINE FUNCTION
# ─────────────────────────────────────────────────────────────
def explain_image(
    image_input,
    model=None,
    class_names=None,
    device=None,
    target_class=None,
    output_path=None
):
    """
    End-to-end explainability function:
      1. Loads image from path or accepts np.ndarray RGB
      2. Runs vision pipeline leaf isolation
      3. Computes Grad-CAM on the model's actual final conv block
      4. Evaluates attention concentration metrics
      5. Renders the visual comparison figure

    Returns dict with diagnosis, metrics, and output path.
    """
    if isinstance(image_input, (str, Path)):
        img_pil = Image.open(str(image_input)).convert("RGB")
        original_rgb = np.array(img_pil)
    elif isinstance(image_input, np.ndarray):
        original_rgb = image_input
    else:
        raise ValueError("image_input must be file path or numpy RGB array.")

    # Load model if not provided
    if model is None or class_names is None:
        model, class_names, device = load_trained_model(device=device)

    # 1. Vision Pipeline Preprocessing (Isolate Leaf)
    processed_leaf, leaf_mask, bbox = isolate_leaf_region(original_rgb, target_size=224)

    # 2. Convert to model tensor
    norm = (processed_leaf.astype(np.float32) / 255.0 - IMAGENET_MEAN) / IMAGENET_STD
    input_tensor = torch.tensor(norm, dtype=torch.float32).permute(2, 0, 1).unsqueeze(0)

    # 3. Grad-CAM Execution
    cam_engine = GradCAM(model, device=device)
    try:
        cam_result = cam_engine.generate(input_tensor, target_class=target_class)
    finally:
        cam_engine.remove_hooks()

    heatmap = cam_result["heatmap"]
    pred_idx = cam_result["pred_class"]
    confidence = cam_result["confidence"]
    diagnosis_name = class_names[pred_idx] if pred_idx < len(class_names) else f"Class_{pred_idx}"

    # 4. Generate Blended Overlay
    overlay, _ = GradCAM.create_overlay(processed_leaf, heatmap, alpha=0.48)

    # 5. Attention Concentration Audit
    metrics = evaluate_attention_concentration(heatmap, leaf_mask)

    # 6. Save Triplet Figure if path provided
    if output_path is not None:
        generate_comparison_figure(
            original_rgb=original_rgb,
            processed_leaf=processed_leaf,
            heatmap=heatmap,
            overlay=overlay,
            diagnosis_name=diagnosis_name,
            confidence=confidence,
            metrics=metrics,
            output_path=output_path,
            crop_bbox=bbox
        )

    return {
        "diagnosis": diagnosis_name,
        "predicted_class_index": pred_idx,
        "confidence": round(confidence, 4),
        "confidence_percent": round(confidence * 100.0, 2),
        "metrics": metrics,
        "heatmap": heatmap,
        "processed_leaf": processed_leaf,
        "overlay": overlay,
        "output_path": str(output_path) if output_path else None
    }
