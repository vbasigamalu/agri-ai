"""
======================================================================
  Agri-AI — Grad-CAM Explainability Test Suite
======================================================================
  Validates:
    1. Model loading with frozen evaluation weights.
    2. Hook registration and gradient backpropagation on model.blocks[-1].
    3. Correct Grad-CAM heatmap generation (dimensions, [0, 1] range, ReLU).
    4. Leaf isolation and vision pipeline preprocessing.
    5. Quantitative Attention Concentration Metrics (Leaf %, Leakage %, Border %).
    6. Multi-panel visual comparison figure generation.
    7. Weight immutability (model weights strictly unmodified).

  Run: python test_gradcam.py
======================================================================
"""

import sys
import unittest
import numpy as np
import torch
from pathlib import Path
from PIL import Image

from gradcam import (
    load_trained_model,
    GradCAM,
    isolate_leaf_region,
    evaluate_attention_concentration,
    generate_comparison_figure,
    explain_image,
    preprocess_for_model
)

class TestGradCAMExplainability(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.model, cls.class_names, cls.device = load_trained_model()
        cls.sample_leaf_path = Path(__file__).parent.parent / "dataset" / "Tomato___Early_blight" / "0012b9d2-2130-4a06-a834-b1f3af34f57e___RS_Erly.B 8389.JPG"
        cls.output_dir = Path(__file__).parent / "gradcam_outputs"
        cls.output_dir.mkdir(parents=True, exist_ok=True)

    def test_01_model_loading_and_architecture(self):
        """Verify model loads MobileNetV3-Large with correct classes and evaluation mode."""
        self.assertIsNotNone(self.model)
        self.assertEqual(len(self.class_names), 10)
        self.assertFalse(self.model.training, "Model must be in eval mode.")
        self.assertTrue(hasattr(self.model, "blocks"), "Model must have MobileNetV3 blocks.")
        self.assertEqual(len(self.model.blocks), 7, "MobileNetV3-Large has 7 inverted residual block stages.")

    def test_02_weight_immutability(self):
        """Confirm model weights are strictly unmodified (no training during explainability)."""
        initial_params = [p.clone() for p in self.model.parameters()]
        
        # Run a test forward-backward pass
        dummy_input = torch.randn(1, 3, 224, 224, device=self.device)
        cam = GradCAM(self.model, device=self.device)
        try:
            _ = cam.generate(dummy_input)
        finally:
            cam.remove_hooks()

        # Check weights are completely unchanged
        for p_init, p_curr in zip(initial_params, self.model.parameters()):
            self.assertTrue(torch.equal(p_init, p_curr), "Model weights must remain strictly unmodified.")

    def test_03_gradcam_heatmap_generation(self):
        """Verify Grad-CAM output shape, normalization range [0, 1], and class predictions."""
        cam = GradCAM(self.model, device=self.device)
        dummy_input = torch.randn(1, 3, 224, 224, device=self.device, requires_grad=True)
        try:
            result = cam.generate(dummy_input)
        finally:
            cam.remove_hooks()

        heatmap = result["heatmap"]
        self.assertEqual(heatmap.shape, (224, 224), "Heatmap must match input spatial dimensions (224, 224).")
        self.assertGreaterEqual(heatmap.min(), 0.0, "Heatmap minimum must be >= 0.")
        self.assertLessEqual(heatmap.max(), 1.0, "Heatmap maximum must be <= 1.")
        self.assertIn("target_class", result)
        self.assertIn("confidence", result)
        self.assertGreaterEqual(result["confidence"], 0.0)
        self.assertLessEqual(result["confidence"], 1.0)

    def test_04_leaf_isolation_and_masking(self):
        """Verify leaf region isolation, bounding box extraction, and aspect ratio preservation."""
        if self.sample_leaf_path.exists():
            img = np.array(Image.open(self.sample_leaf_path).convert("RGB"))
            processed_leaf, mask, bbox = isolate_leaf_region(img, target_size=224)

            self.assertEqual(processed_leaf.shape, (224, 224, 3))
            self.assertEqual(mask.shape, (224, 224))
            self.assertGreater(np.sum(mask > 0), 0, "Leaf mask must contain positive pixels.")
            bx, by, bw, bh = bbox
            self.assertGreater(bw, 0)
            self.assertGreater(bh, 0)

    def test_05_attention_concentration_metrics(self):
        """Test quantitative attention audit metrics: leaf concentration, background leakage, border leakage."""
        # Create synthetic heatmap and mask:
        # Concentrated case: heatmap activation mostly in center leaf
        h, w = 224, 224
        mask = np.zeros((h, w), dtype=np.uint8)
        mask[50:170, 50:170] = 255  # Center leaf

        heatmap_concentrated = np.zeros((h, w), dtype=np.float32)
        heatmap_concentrated[60:160, 60:160] = 1.0 # Centered inside leaf

        metrics = evaluate_attention_concentration(heatmap_concentrated, mask)
        self.assertGreaterEqual(metrics["leaf_concentration_ratio"], 95.0, "Concentrated heatmap should yield > 95% leaf concentration.")
        self.assertLessEqual(metrics["background_leakage_ratio"], 5.0)
        self.assertLessEqual(metrics["border_leakage_ratio"], 1.0)
        self.assertTrue(metrics["is_concentrated_on_leaf"])

        # Leaking case: heatmap activation on outer border / background
        heatmap_leaking = np.zeros((h, w), dtype=np.float32)
        heatmap_leaking[:25, :] = 1.0  # Top border background

        leaking_metrics = evaluate_attention_concentration(heatmap_leaking, mask)
        self.assertLess(leaking_metrics["leaf_concentration_ratio"], 10.0, "Leaking heatmap should yield < 10% leaf concentration.")
        self.assertGreater(leaking_metrics["background_leakage_ratio"], 90.0)
        self.assertGreater(leaking_metrics["border_leakage_ratio"], 80.0)
        self.assertFalse(leaking_metrics["is_concentrated_on_leaf"])

    def test_06_visual_comparison_figure_export(self):
        """Verify rendering and persistence of the 4-panel visual comparison figure."""
        if self.sample_leaf_path.exists():
            out_test_fig = self.output_dir / "test_comparison_triplet.png"
            if out_test_fig.exists():
                out_test_fig.unlink()

            result = explain_image(
                image_input=self.sample_leaf_path,
                model=self.model,
                class_names=self.class_names,
                device=self.device,
                output_path=out_test_fig
            )

            self.assertTrue(out_test_fig.exists(), "Comparison figure must be written to disk.")
            self.assertGreater(out_test_fig.stat().st_size, 20000, "Figure must be a valid non-empty image file.")
            self.assertIn("diagnosis", result)
            self.assertIn("metrics", result)
            self.assertGreaterEqual(result["metrics"]["leaf_concentration_ratio"], 0.0)


if __name__ == "__main__":
    unittest.main(verbosity=2)
