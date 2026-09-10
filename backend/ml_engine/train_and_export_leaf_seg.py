"""
======================================================================
 Agri-AI — Fast Train & Export MobileLeafNet Segmentation Model (ONNX)
======================================================================
 Pre-loads samples in memory for instant high-speed training on CPU.
 Trains 3 epochs and exports verified ONNX model.
======================================================================
"""

import os
import sys
import time
import random
from pathlib import Path

# Force UTF-8 stdout
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

import numpy as np
from PIL import Image
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import TensorDataset, DataLoader
import onnx

# ── Model Architecture ─────────────────────────────────────────
class ConvBlock(nn.Module):
    def __init__(self, in_c, out_c):
        super().__init__()
        self.conv = nn.Sequential(
            nn.Conv2d(in_c, out_c, kernel_size=3, padding=1, bias=False),
            nn.BatchNorm2d(out_c),
            nn.ReLU(inplace=True),
            nn.Conv2d(out_c, out_c, kernel_size=3, padding=1, groups=out_c, bias=False),
            nn.BatchNorm2d(out_c),
            nn.ReLU(inplace=True),
            nn.Conv2d(out_c, out_c, kernel_size=1, bias=False),
            nn.BatchNorm2d(out_c),
            nn.ReLU(inplace=True),
        )

    def forward(self, x):
        return self.conv(x)

class MobileLeafNet(nn.Module):
    def __init__(self):
        super().__init__()
        self.e1 = ConvBlock(3, 16)
        self.pool1 = nn.MaxPool2d(2, 2)    # 256 -> 128

        self.e2 = ConvBlock(16, 32)
        self.pool2 = nn.MaxPool2d(2, 2)    # 128 -> 64

        self.e3 = ConvBlock(32, 64)
        self.pool3 = nn.MaxPool2d(2, 2)    # 64 -> 32

        self.b = ConvBlock(64, 96)

        self.up3 = nn.Upsample(scale_factor=2, mode="bilinear", align_corners=True) # 32 -> 64
        self.d3 = ConvBlock(96 + 64, 64)

        self.up2 = nn.Upsample(scale_factor=2, mode="bilinear", align_corners=True) # 64 -> 128
        self.d2 = ConvBlock(64 + 32, 32)

        self.up1 = nn.Upsample(scale_factor=2, mode="bilinear", align_corners=True) # 128 -> 256
        self.d1 = ConvBlock(32 + 16, 16)

        self.out = nn.Sequential(
            nn.Conv2d(16, 1, kernel_size=1),
            nn.Sigmoid()
        )

    def forward(self, x):
        s1 = self.e1(x)
        p1 = self.pool1(s1)
        s2 = self.e2(p1)
        p2 = self.pool2(s2)
        s3 = self.e3(p2)
        p3 = self.pool3(s3)

        b = self.b(p3)

        u3 = self.up3(b)
        c3 = torch.cat([u3, s3], dim=1)
        d3 = self.d3(c3)

        u2 = self.up2(d3)
        c2 = torch.cat([u2, s2], dim=1)
        d2 = self.d2(c2)

        u1 = self.up1(d2)
        c1 = torch.cat([u1, s1], dim=1)
        d1 = self.d1(c1)

        return self.out(d1)

def train_and_export():
    print("=" * 65, flush=True)
    print("🌿 Agri-AI — Fast MobileLeafNet Training & ONNX Export", flush=True)
    print("=" * 65, flush=True)

    dataset_root = Path(__file__).parent.parent / "dataset"
    classes = ["Tomato___Early_blight", "Tomato___healthy", "Pepper,_bell___healthy"]

    samples = []
    for c in classes:
        c_dir = dataset_root / c
        if c_dir.exists():
            files = list(c_dir.glob("*.JPG")) + list(c_dir.glob("*.jpg"))
            samples.extend(files[:12])

    print(f"📂 Pre-loading {len(samples)} leaf images into RAM...", flush=True)
    size = 256
    mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
    std = np.array([0.229, 0.224, 0.225], dtype=np.float32)

    X_list = []
    Y_list = []

    for p in samples:
        try:
            img = Image.open(p).convert("RGB").resize((size, size))
            arr = np.array(img)

            # Extract ground-truth leaf mask
            r, g, b = arr[:,:,0].astype(float), arr[:,:,1].astype(float), arr[:,:,2].astype(float)
            exg = 2 * g - r - b
            mask = ((exg > 8) & (g > 35) | (g > 55) & (r > 55) & (b < 120) & (g >= 0.75 * r)).astype(np.float32)

            # 1. Plain image sample
            norm1 = (arr.astype(np.float32) / 255.0 - mean) / std
            X_list.append(norm1.transpose(2, 0, 1))
            Y_list.append(np.expand_dims(mask, 0))

            # 2. Composite onto synthetic brown soil background
            bg_soil = np.stack([
                np.random.randint(95, 135, (size, size)),
                np.random.randint(65, 90, (size, size)),
                np.random.randint(35, 60, (size, size))
            ], axis=2).astype(np.uint8)

            m_3d = np.expand_dims(mask, axis=2)
            comp = (arr * m_3d + bg_soil * (1 - m_3d)).astype(np.uint8)
            norm2 = (comp.astype(np.float32) / 255.0 - mean) / std
            X_list.append(norm2.transpose(2, 0, 1))
            Y_list.append(np.expand_dims(mask, 0))

        except Exception as e:
            continue

    # Add 5 pure non-leaf background samples (all zeros mask)
    for _ in range(5):
        # Soil non-leaf
        soil = np.stack([
            np.random.randint(100, 140, (size, size)),
            np.random.randint(70, 95, (size, size)),
            np.random.randint(40, 65, (size, size))
        ], axis=2).astype(np.float32) / 255.0
        X_list.append(((soil - mean) / std).transpose(2, 0, 1))
        Y_list.append(np.zeros((1, size, size), dtype=np.float32))

        # Blue wall / tool non-leaf
        wall = np.stack([
            np.random.randint(30, 70, (size, size)),
            np.random.randint(60, 90, (size, size)),
            np.random.randint(150, 210, (size, size))
        ], axis=2).astype(np.float32) / 255.0
        X_list.append(((wall - mean) / std).transpose(2, 0, 1))
        Y_list.append(np.zeros((1, size, size), dtype=np.float32))

    X_t = torch.tensor(np.array(X_list), dtype=torch.float32)
    Y_t = torch.tensor(np.array(Y_list), dtype=torch.float32)
    print(f"📊 Training Tensor Ready: {X_t.shape} ({len(X_t)} samples)", flush=True)

    loader = DataLoader(TensorDataset(X_t, Y_t), batch_size=12, shuffle=True)
    model = MobileLeafNet()
    optimizer = optim.AdamW(model.parameters(), lr=1.5e-3, weight_decay=1e-4)
    bce = nn.BCELoss()

    EPOCHS = 6
    print(f"🚀 Training {EPOCHS} epochs on CPU...", flush=True)
    t0 = time.time()

    for ep in range(1, EPOCHS + 1):
        model.train()
        loss_sum = 0.0
        for bx, by in loader:
            optimizer.zero_grad()
            pred = model(bx)
            loss = bce(pred, by)
            loss.backward()
            optimizer.step()
            loss_sum += loss.item() * len(bx)
        avg = loss_sum / len(X_t)
        print(f"  Epoch [{ep}/{EPOCHS}] - BCE Loss: {avg:.4f}", flush=True)

    print(f"✅ Training complete in {time.time() - t0:.1f}s!", flush=True)

    # Export to ONNX
    model.eval()
    dummy = torch.randn(1, 3, 256, 256)
    out_p = Path(__file__).parent / "leaf_segmentation.onnx"

    print(f"📦 Exporting to {out_p.name}...", flush=True)
    torch.onnx.export(
        model,
        dummy,
        str(out_p),
        export_params=True,
        opset_version=18,
        do_constant_folding=True,
        input_names=["input"],
        output_names=["mask"],
        dynamic_axes={"input": {0: "batch_size"}, "mask": {0: "batch_size"}}
    )

    onnx_m = onnx.load(str(out_p))
    onnx.checker.check_model(onnx_m)
    sz = os.path.getsize(str(out_p)) / (1024 * 1024)
    print(f"🎉 Model exported successfully! Size: {sz:.2f} MB", flush=True)
    print("=" * 65 + "\n", flush=True)

if __name__ == "__main__":
    train_and_export()
