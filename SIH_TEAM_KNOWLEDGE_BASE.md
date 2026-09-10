# 🌱 Agri-AI — Smart India Hackathon (SIH) Team Knowledge Base

> **Read this before touching any code.**
> This is the single source of truth for every team member joining the project.
> It explains what is built, what tech is used and WHY, how each feature works internally,
> and what still needs to be done according to the SIH problem statement.

---

## Table of Contents

1.  Project Goal and SIH Problem Statement
2.  Architecture Overview
3.  Repository Structure
4.  Feature 1 - User Authentication and Profile System
5.  Feature 2 - Image Quality Gate
6.  Feature 3 - Leaf Detection and Neural Segmentation
7.  Feature 4 - Background Suppression
8.  Feature 5 - Crop Disease Classifier (Core AI)
9.  Feature 6 - Background Bias Reduction (Training Augmentation)
10. Feature 7 - OOD Uncertainty Gate
11. Feature 8 - Grad-CAM Explainability
12. Feature 9 - Multi-Leaf Canopy Analysis
13. Feature 10 - Disease Knowledge Base (38 Classes)
14. Feature 11 - Weather Integration and Spray Safety
15. Feature 12 - AI Chat Assistant (Groq LLM)
16. Feature 13 - Full Production API (POST /analyze)
17. Feature 14 - Scan History (MongoDB)
18. Feature 15 - Robustness Evaluation Framework
19. Frontend UI
20. Database Architecture (Dual DB)
21. Complete Tech Stack Map
22. What Is NOT Yet Built (SIH Gaps)
23. Development Workflow and Rules
24. Environment Variables Guide
25. Running the Project Locally

---

## 1. Project Goal and SIH Problem Statement

SIH Theme: Agriculture and Rural Development
Goal: AI-powered crop disease detection tool accessible to Indian farmers.

### Requirement vs Status

| Requirement                                               | Status      |
|-----------------------------------------------------------|-------------|
| Upload crop leaf image and detect disease                 | DONE        |
| Identify disease name and causative agent                 | DONE        |
| Suggest treatment spray and prevention                    | DONE        |
| Work in real-world conditions (noisy bg, multiple leaves) | DONE        |
| Confidence scoring - no overconfident wrong predictions   | DONE        |
| Farmer-friendly UI in local language                      | PARTIAL     |
| Weather-aware recommendations                             | DONE        |
| History of past scans                                     | DONE        |
| Chatbot for follow-up questions                           | DONE        |
| Government scheme recommendations                         | PARTIAL     |
| Offline / low-connectivity support                        | NOT BUILT   |
| Multi-language support (Hindi, Marathi, etc.)             | NOT BUILT   |
| Voice-input support                                       | NOT BUILT   |
| Geo-tagged disease outbreak heatmap                       | NOT BUILT   |
| Expert/agronomist escalation system                       | NOT BUILT   |
| Market price integration                                  | NOT BUILT   |

---

## 2. Architecture Overview

    FARMER DEVICE
       Browser  <->  frontend/index.html
           |
           | HTTP (Fetch API)
           v
    backend/server.js  (Node.js 24 + Express 5)
       |
       +-- POST /analyze    --> classifier.js (8-stage pipeline)
       +-- POST /chat       --> Groq LLM API
       +-- GET  /history    --> MongoDB
       +-- GET  /api/geocode --> Nominatim (OpenStreetMap)
       +-- POST /api/auth   --> PostgreSQL
           |
           v
    ROBUST VISION PIPELINE
       qualityCheck.js          Stage 1: Image filter
       leafDetector.js          Stage 2: ONNX leaf model
       backgroundSuppressor.js  Stage 3: Sharp masking
       preprocessor.js          Stage 4: normalize + CHW tensor
       classifier.js            Stage 5: ONNX disease model
       uncertaintyGate.js       Stage 6: OOD gating
       multiLeafAggregator.js   Stage 7: consensus logic
           |
           v
    ML MODEL LAYER
       crop_disease_model.onnx   MobileNetV3-Large (disease)
       leaf_segmentation.onnx    MobileLeafNet (leaf finder)
       labels.json               10 tomato class names
       uncertainty_config.json   Calibrated OOD thresholds
           |
           v
    STORAGE LAYER
       MongoDB    -- Scan history, chat sessions, govt schemes
       PostgreSQL -- User accounts, farmer profiles

---

## 3. Repository Structure

    agri-ai/
    +-- frontend/
    |   +-- index.html          Single-page app entry point
    |   +-- style.css           UI styles
    |   +-- script.js           All frontend logic
    |
    +-- SIH_TEAM_KNOWLEDGE_BASE.md   <-- YOU ARE HERE
    |
    +-- backend/
        +-- server.js           Express server + all API routes
        +-- classifier.js       AI pipeline orchestrator (MOST IMPORTANT FILE)
        +-- cropDatabase.js     38-class disease knowledge base
        +-- models.js           MongoDB Mongoose schemas
        +-- postgres.js         PostgreSQL connection pool
        +-- dbHelper.js         MongoDB connection helper
        +-- dataLoader.js       Dataset loading utility
        +-- train.js            TF.js training script (legacy, kept for reference)
        +-- package.json
        +-- .env                Secret keys - NEVER COMMIT
        |
        +-- routes/
        |   +-- auth.js         /api/auth/* endpoints (register, login, me, profile)
        |
        +-- middleware/
        |   +-- auth.js         JWT verify middleware (authenticateToken, optionalAuth)
        |
        +-- vision/                        THE ROBUST VISION PIPELINE
        |   +-- index.js                   Pipeline entry point (re-exports)
        |   +-- qualityCheck.js            Image quality analysis
        |   +-- leafDetector.js            ONNX-based leaf localization
        |   +-- backgroundSuppressor.js    Leaf isolation and masking
        |   +-- preprocessor.js            Resize/normalize/CHW tensor
        |   +-- uncertaintyGate.js         Free Energy OOD gate
        |   +-- multiLeafAggregator.js     Multi-leaf consensus
        |   +-- storage.js                 Scan artifact persistence
        |   +-- robustnessEvaluator.js     12-category benchmark
        |   +-- uncertainty_config.json    Calibrated thresholds
        |   +-- test_api_endpoint.js       71 API tests
        |   +-- test_multi_leaf.js         55 multi-leaf tests
        |   +-- test_pipeline_integration.js  32 integration tests
        |   +-- test_uncertainty_protection.js 43 uncertainty tests
        |   +-- test_background_suppression.js
        |   +-- test_leaf_detection.js
        |
        +-- ml_engine/                     PYTHON ML TOOLS
            +-- train.py                   Main PyTorch training script
            +-- colab_train_tomato.py      Google Colab training (use this for GPU)
            +-- export_onnx.py             PyTorch to ONNX export
            +-- export_leaf_model.py       Leaf model ONNX export
            +-- train_and_export_leaf_seg.py  Train + export leaf model
            +-- background_randomizer.py   Training augmentation
            +-- gradcam.py                 Grad-CAM implementation
            +-- evaluate_gradcam.py        Grad-CAM batch evaluation
            +-- calibrate_uncertainty.py   OOD threshold calibration
            +-- crop_disease_model.onnx    Disease classifier weights
            +-- crop_disease_model.onnx.data  Large weight shard (keeps .onnx small)
            +-- leaf_segmentation.onnx     Leaf detector weights
            +-- leaf_segmentation.onnx.data
            +-- labels.json               10 tomato class names
            +-- best_model.pth            PyTorch weights (source for ONNX export)
            +-- requirements.txt          Python dependencies
            +-- uncertainty_config.json   Calibration output
            +-- robustness_benchmark_12cat.json  Benchmark results

---

## 4. Feature 1 - User Authentication and Profile System

### What It Does
Farmers create an account (phone or email + password), log in, and have scan history tied to
their identity. Stores village, district, state, preferred language.

### Tech Stack

| Technology        | Why We Used It                                                            |
|-------------------|---------------------------------------------------------------------------|
| PostgreSQL (pg)   | Relational DB. Unique constraint on phone/email. Best for auth + profiles.|
| bcryptjs          | One-way password hashing (salt rounds=10). Never store plain passwords.   |
| jsonwebtoken JWT  | Stateless auth token. 7-day expiry. No server session memory needed.      |
| Express Router    | Modular route mounting at /api/auth/*                                     |

### How It Is Implemented

    POST /api/auth/register
      1. Validate: name required, phone/email required, password >= 6 chars
      2. Check uniqueness: SELECT WHERE LOWER(phone_or_email) = $1
      3. Hash password: bcrypt.genSalt(10) then bcrypt.hash(password, salt)
      4. Insert: INSERT INTO users ... RETURNING id, name, ...
      5. Sign JWT: jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
      6. Return: { token, user }

    POST /api/auth/login
      1. Fetch user by phone_or_email (LOWER comparison)
      2. bcrypt.compare(plainPassword, stored_hash)
      3. Delete user.password_hash before returning
      4. Sign and return JWT

    GET /api/auth/me
      authenticateToken middleware decodes JWT from "Authorization: Bearer <token>"
      Fetches fresh user row from PostgreSQL by req.user.id

    PUT /api/auth/profile
      COALESCE($1, name) pattern: only updates fields that were actually sent

### Key Files
- backend/routes/auth.js       (all 4 routes)
- backend/middleware/auth.js   (authenticateToken, optionalAuth)
- backend/postgres.js          (pool management, auto-creates users table on startup)

### Team Notes
- optionalAuth is used on /analyze and /history: guests can use app but scans are anonymous
- If PostgreSQL is offline the server still starts (auth features fail gracefully with a message)
- users table auto-created with CREATE TABLE IF NOT EXISTS - no migrations needed for dev
- JWT_SECRET must be a long random string. Generate with:
    node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
- CHANGE JWT_SECRET before any real deployment

---

## 5. Feature 2 - Image Quality Gate

### What It Does
Validates the uploaded photo is good enough for AI analysis BEFORE wasting compute.
Returns actionable guidance to the farmer if rejected.

### Tech Stack

| Technology         | Why We Used It                                                         |
|--------------------|------------------------------------------------------------------------|
| Sharp (Node.js)    | Fastest Node.js image processing. Decodes buffers, extracts pixel stats|
| Laplacian Variance | Well-established blur detection from CV community. No extra model.     |

### Checks Performed

| Check              | Metric                        | Threshold    | Failure Code              |
|--------------------|-------------------------------|--------------|---------------------------|
| Decode validity    | Try/catch Sharp decode        | Must succeed | corrupted_image            |
| Minimum resolution | width x height                | >= 50x50 px  | extremely_low_resolution   |
| Blur detection     | Laplacian variance grayscale  | >= 50        | too_blurry                |
| Darkness           | Mean pixel intensity          | >= 30        | too_dark                  |
| Overexposure       | Mean pixel intensity          | <= 240       | severely_overexposed       |
| Contrast           | Std deviation of intensity    | >= 10        | insufficient_contrast      |

### How Laplacian Variance Works (the blur detector)
Laplacian is the second spatial derivative of pixel intensity.
A sharp image has strong edges (high-frequency info) so Laplacian values are large and their
variance is high. A blurry image has smoothed edges so variance is low.
Threshold of 50 was tuned empirically on real farmer phone camera samples.

### Quality Score
    qualityScore = 100 - (numIssues x penaltyWeight)
Score 0-100. Reported in API response. Stored in MongoDB. Fed into OOD gate.

### Why This Approach Is Best
Simple rules with mathematical foundations. No extra ML model needed. Runs in under 5ms.
Easy to tune thresholds without retraining the disease model.

### Key File
- backend/vision/qualityCheck.js

### Team Notes
- If valid: false with a critical issue, pipeline STOPS HERE. No disease prediction attempted.
- qualityScore >= 50 is one of the six signals in the OOD Uncertainty Gate (Feature 7).

---

## 6. Feature 3 - Leaf Detection and Neural Segmentation

### What It Does
Locates leaf region(s) in the uploaded photo using a trained neural network.
Returns bounding boxes and segmentation regions so downstream stages know where the leaf is.

### Why NOT Simple Color Thresholding
Green pixel thresholding (hue 60-140 degrees) fails on:
- Yellow/brown diseased leaves (they are not green)
- Green farm backgrounds (grass, vegetation look like leaves)
- Shadows making leaves appear dark
A trained neural model learns leaf SHAPE, TEXTURE, and CONTEXT - not just color.

### Architecture: MobileLeafNet (Custom)

    Input: 224x224 RGB image
      -> MobileNetV3-Small backbone (pretrained on ImageNet)
      -> Feature Pyramid head
      -> Bounding box regression + segmentation mask
      -> Output: { bbox, mask, confidence }

Why MobileNetV3-Small specifically:
- Very small (~900KB ONNX) -> fast inference on CPU, no GPU required
- Good accuracy for leaf shapes (simpler than full object detection)
- Runs in Node.js via onnxruntime-node WITHOUT a Python subprocess

### Tech Stack

| Technology        | Why We Used It                                                          |
|-------------------|-------------------------------------------------------------------------|
| PyTorch           | Flexible for custom lightweight architectures. Used to train MobileLeafNet|
| timm library      | Pre-trained MobileNetV3 backbone. Saves weeks of training from scratch. |
| ONNX format       | Cross-platform model format. Train in Python, run in Node.js.           |
| onnxruntime-node  | Microsoft official ONNX runtime. Fast native Node.js bindings.          |
| Sharp             | Resizes input image to 224x224 before feeding model.                   |

### Confidence Modes

| Leaf Confidence | Mode                      | What Happens                                  |
|-----------------|---------------------------|-----------------------------------------------|
| >= 55%          | full_segmentation         | Background masked, leaf cropped tightly        |
| 30% - 55%       | conservative_uncertainty  | Crop with padding, uncertainty flagged         |
| < 30%           | passthrough               | Original image used, high uncertainty reported |

### Key Files
- backend/vision/leafDetector.js            (inference wrapper)
- backend/ml_engine/leaf_segmentation.onnx  (trained model weights)
- backend/ml_engine/leaf_segmentation.onnx.data
- backend/ml_engine/train_and_export_leaf_seg.py  (training + export)
- backend/ml_engine/export_leaf_model.py    (ONNX export only)

---

## 7. Feature 4 - Background Suppression

### What It Does
Uses the leaf bounding box from Feature 3 to isolate the leaf from its background
BEFORE disease classification. Prevents the disease model from reading background patterns.

### Why It Matters
A model trained on clean white-background lab images associates white backgrounds with
healthy leaves. A farmer photo on red soil would fool this model. Background suppression
forces the model to see ONLY the leaf, regardless of what is behind it.

### How It Is Implemented

    Step 1: Receive leaf bounding box from leafDetector
    Step 2: Crop the leaf region (Sharp .extract())
    Step 3: Apply segmentation mask - set non-leaf pixels to neutral gray (SVG composite)
    Step 4: Resize to 224x224 using LETTERBOX - aspect ratio preserved
    Step 5: Output: { suppressedBuffer, boundingBox, mode }

What is Letterbox resize?
    Instead of stretching the image to 224x224 (which distorts the leaf shape),
    we add neutral gray bars on the sides or top/bottom (like a TV pillarbox).
    A stretched tomato leaf looks different from a real one, confusing the model.
    Letterbox preserves the true shape of the leaf.

### Tech Stack

| Technology           | Why We Used It                                                    |
|----------------------|-------------------------------------------------------------------|
| Sharp                | .extract() for crop, .composite() for SVG mask, .extend() for bars|
| SVG mask compositing | Non-destructive alpha masking. Sharp supports SVG overlays natively|

### Key Files
- backend/vision/backgroundSuppressor.js
- backend/vision/preprocessor.js    (normalize to [1,3,224,224] CHW tensor)
- backend/vision/storage.js         (stores original + processed pair for audit)

### Team Notes
- Original uploaded image is NEVER overwritten
- storage.js keeps both original and processed for Grad-CAM comparison
- Three suppression modes exist based on leaf detection confidence

---

## 8. Feature 5 - Crop Disease Classifier (Core AI)

### Current Scope: 10 Tomato Disease Classes

| Class | Disease Name                         |
|-------|--------------------------------------|
| 0     | Tomato Bacterial Spot                |
| 1     | Tomato Early Blight                  |
| 2     | Tomato Late Blight                   |
| 3     | Tomato Leaf Mold                     |
| 4     | Tomato Septoria Leaf Spot            |
| 5     | Tomato Spider Mites (Two-spotted)    |
| 6     | Tomato Target Spot                   |
| 7     | Tomato Yellow Leaf Curl Virus        |
| 8     | Tomato Mosaic Virus                  |
| 9     | Tomato Healthy                       |

### Architecture: MobileNetV3-Large (ONNX)

    Input: Float32 tensor [1, 3, 224, 224]  (Batch=1, Channels=3, H=224, W=224)
      -> MobileNetV3-Large backbone (ImageNet pretrained weights)
      -> Global Average Pooling
      -> Fully Connected layer (1280 -> 10)
      -> Output: Logits [1, 10]
      -> Softmax (applied in classifier.js)
      -> Probabilities [0..1] for each of 10 classes

Normalization applied BEFORE inference (ImageNet standard):
    pixel_normalized = (pixel_raw / 255.0 - mean) / std
    mean = [0.485, 0.456, 0.406]  (for R, G, B channels)
    std  = [0.229, 0.224, 0.225]  (for R, G, B channels)

### Why MobileNetV3-Large

| Model            | Accuracy on PlantVillage | Size  | CPU Speed | Verdict  |
|------------------|--------------------------|-------|-----------|----------|
| MobileNetV3-Large| ~92%                     | 17 MB | Fast      | CHOSEN   |
| ResNet50         | ~93%                     | 98 MB | Slow      | Too heavy|
| EfficientNet-B4  | ~94%                     | 74 MB | Moderate  | Too heavy|
| MobileNetV2      | ~89%                     | 14 MB | Fast      | Worse acc|

MobileNetV3-Large gives the best accuracy/size/speed tradeoff for CPU deployment.

### Full Inference Flow in Code

    classifier.js: classify(imageBuffer)
      |
      +-- Stage 1: qualityCheck.js
      |       -> if invalid quality: return { status: 'retake_required' }
      |
      +-- Stage 2: leafDetector.js (ONNX)
      |       -> detect leaf region, return bbox + confidence
      |
      +-- Stage 3: backgroundSuppressor.js
      |       -> isolate leaf, letterbox resize
      |
      +-- Stage 4: preprocessor.js
      |       -> Float32 CHW tensor [1,3,224,224]
      |
      +-- Stage 5: onnxruntime session.run()
      |       -> Logits [1,10] -> softmax -> probabilities
      |
      +-- Stage 6: uncertaintyGate.js
      |       -> Free Energy, Entropy, Margin, Quality, LeafConf checks
      |       -> return status: confirmed / uncertain / retake_required
      |
      +-- Stage 7: cropDatabase.js
      |       -> getDiseaseInfo(label) -> symptoms, treatment, spray, prevention
      |
      +-- Return structured result to server.js

### Tech Stack

| Technology            | Why We Used It                                             |
|-----------------------|------------------------------------------------------------|
| PyTorch               | Training framework. mobilenet_v3_large(pretrained=True)    |
| ONNX Runtime Node.js  | Runs exported model in Node.js, near-native CPU speed      |
| TF.js (fallback)      | @tensorflow/tfjs-node backup if ONNX runtime fails         |
| timm                  | Better pretrained weights than torchvision defaults        |

### Key Files
- backend/classifier.js                        (master orchestrator - READ THIS)
- backend/ml_engine/crop_disease_model.onnx    (disease model weights)
- backend/ml_engine/crop_disease_model.onnx.data (large weight shard - both files needed)
- backend/ml_engine/best_model.pth             (PyTorch source weights)
- backend/ml_engine/train.py                   (training script)
- backend/ml_engine/export_onnx.py             (PyTorch to ONNX conversion)

### Team Notes
- Do NOT touch model weights unless doing a full formal retraining cycle
- .onnx and .onnx.data are ONE MODEL split into two files. Both must exist together.
- For GPU training: use backend/ml_engine/colab_train_tomato.py on Google Colab (free)

---

## 9. Feature 6 - Background Bias Reduction (Training Augmentation)

### The Problem We Solved
PlantVillage dataset uses clean lab photos with white or black backgrounds.
A model trained on this learns: "white background + spotted leaf = disease"
It MEMORIZES background patterns instead of learning actual disease symptoms.
This fails completely on real farm photos.

### Solution: Albumentations Augmentation Pipeline (Applied During Training)

Geometric transforms:
    RandomResizedCrop(224, 224, scale=(0.6, 1.0))    random zoom crop
    HorizontalFlip(p=0.5)                            random mirror
    ShiftScaleRotate(shift=0.1, scale=0.2, rot=15, p=0.7)  position variation
    Perspective(scale=(0.05, 0.15), p=0.4)           viewing angle variation

Color transforms:
    RandomBrightnessContrast(0.3, 0.3, p=0.7)        lighting variation
    HueSaturationValue(hue=20, sat=30, val=20, p=0.5) color shifts

Noise and blur:
    GaussNoise(var_limit=(10,50), p=0.4)              sensor noise
    MotionBlur or GaussianBlur(blur_limit=7, p=0.4)   camera shake / focus
    ImageCompression(quality=60-95, p=0.3)            phone JPEG artifacts
    RandomShadow(p=0.3)                               farm shadow simulation

Background Randomization (when reliable leaf mask is available):
    Replace background with one of: soil, green grass, farm field, vegetation, neutral texture
    The disease LABEL does NOT change after background replacement.
    Only the background changes - the leaf and its disease patterns remain unchanged.

### Why Albumentations (not torchvision transforms)
- 10-50x faster than PIL-based transforms
- GPU-accelerated for large-scale training
- More variety of agricultural-relevant transforms
- Composable and easy to add/remove transforms

### Tech Stack

| Technology        | Why We Used It                                               |
|-------------------|--------------------------------------------------------------|
| Albumentations    | Fastest Python augmentation. Battle-tested in CV competitions|
| PyTorch DataLoader| On-the-fly augmentation (not pre-stored, saves disk space)  |
| OpenCV            | Background mask compositing                                  |
| timm              | Better pretrained weights than torchvision defaults          |

### Key Files
- backend/ml_engine/train.py                (full training loop with augmentation)
- backend/ml_engine/background_randomizer.py (background swap utility)
- backend/ml_engine/colab_train_tomato.py   (Colab-ready training script with GPU)

---

## 10. Feature 7 - OOD Uncertainty Gate

### The Problem We Solved
A standard softmax classifier ALWAYS outputs a disease name even if you show it a photo of a car.
It will say "Early Blight" with 78% confidence when looking at a piece of red cloth.
This is called OVERCONFIDENT OOD (Out-of-Distribution) behavior.
For farmers who trust the app, this is dangerous.

### Our Multi-Signal Safety Gate

All SIX signals must PASS for a prediction to be "confirmed".
If ANY signal fails, prediction is marked "uncertain".

| Signal             | What It Measures                         | Pass Threshold | AUROC  |
|--------------------|------------------------------------------|----------------|--------|
| Free Energy Score  | E = -T * log Sum(exp(logit/T))           | <= -4.1        | 0.8317 |
| Disease Confidence | Max softmax probability                  | >= 0.48        | 0.8011 |
| Shannon Entropy    | -Sum(p * log(p))                         | <= 1.42        | --     |
| Prediction Margin  | top-1 probability minus top-2 probability| >= 0.13        | 0.7772 |
| Quality Score      | From Feature 2 quality check             | >= 50          | --     |
| Leaf Confidence    | From Feature 3 leaf detector             | >= 0.50        | --     |

### Why Free Energy Scoring (The Main OOD Method)

Formula: E(x) = -T * log SUM_c exp(f_c(x) / T)
Where T = temperature = 1.0, f_c(x) = logit for class c

Intuition:
- If the model RECOGNIZES the image (in-distribution), logits will be large for one class
- This makes the log-sum-exp term large, so E(x) is very NEGATIVE (low energy)
- If the model does NOT recognize the image (OOD), logits are small and flat
- Log-sum-exp is small, so E(x) is LESS NEGATIVE (high energy)
- Threshold: if E(x) <= -4.1 the image is in-distribution, otherwise OOD

Free Energy AUROC = 0.8317 vs Top-1 Confidence AUROC = 0.8011
Free Energy won so it is the primary gate.

### Threshold Calibration (Important)
Thresholds were NOT guessed. They were determined by running calibrate_uncertainty.py
on 200 in-distribution samples and 185 OOD samples from validation data.
Results saved in uncertainty_calibration.json.

IF YOU RETRAIN THE MODEL you MUST re-run:
    python backend/ml_engine/calibrate_uncertainty.py
    Update backend/vision/uncertainty_config.json with new thresholds.
Otherwise the OOD gate will be miscalibrated for the new model.

### Calibration Stats (Current Model)
    In-distribution retention rate: 84.5% (we keep 84.5% of valid disease images)
    OOD rejection rate:             57.84% (we reject 57.84% of non-plant images)
    Energy AUROC:                   0.8317
    Note: These numbers improve significantly with more OOD training samples

### Output Status Values
    "confirmed"       - All 6 gates passed. Prediction is reliable.
    "uncertain"       - One or more gates failed. Show uncertainty to farmer.
    "retake_required" - Image quality too poor to even evaluate.

### Key Files
- backend/vision/uncertaintyGate.js           (gate logic in Node.js)
- backend/vision/uncertainty_config.json      (calibrated thresholds - update after retraining)
- backend/ml_engine/calibrate_uncertainty.py  (calibration script)
- backend/ml_engine/uncertainty_calibration.json (calibration stats/report)

---

## 11. Feature 8 - Grad-CAM Explainability

### What It Does
Generates a heatmap showing WHICH PIXELS the model looked at to make its prediction.
Purpose: Verify the model attends to disease lesions on the leaf, not soil/hands/image borders.

### Why This Is Needed
Without explainability, the model is a black box. We cannot tell if it predicts "Early Blight"
because of the leaf lesions or because of the soil color in the corner.
Grad-CAM makes the model's attention visible.

### How Grad-CAM Works (Algorithm)

    Step 1: Forward pass -> compute class logits
    Step 2: Select the score for the predicted class
    Step 3: Backpropagate gradient to the LAST CONVOLUTIONAL LAYER
    Step 4: Global-average-pool the gradients across spatial dims
            -> This gives importance weights alpha_k per channel k
    Step 5: Weighted sum: CAM = ReLU( Sum_k(alpha_k * A_k) )
            where A_k are the feature activation maps
    Step 6: Upsample CAM from feature map size to input image size (224x224)
    Step 7: Apply JET colormap (blue = low attention, red = high attention)
    Step 8: Overlay heatmap on original image (transparent alpha blend)

Why Grad-CAM++ (torchcam) vs vanilla Grad-CAM:
- Vanilla Grad-CAM uses global avg of gradients: unstable when one pixel dominates
- Grad-CAM++ uses second-order gradients: more stable and accurate heatmaps

### Attention Quality Metrics

| Metric              | Ideal Value | What It Means                              |
|---------------------|-------------|--------------------------------------------|
| Leaf Overlap Ratio  | > 75%       | Most attention is on the leaf, not bg      |
| Background Bleed    | < 20%       | Little attention on soil/hands/border      |
| Center Concentration| High        | Attention focuses on lesion center         |

### Tech Stack

| Technology        | Why We Used It                                                  |
|-------------------|-----------------------------------------------------------------|
| PyTorch hook API  | Register hooks on features[-1] to extract gradients/activations |
| torchcam library  | Grad-CAM++ variant. More stable than vanilla Grad-CAM.          |
| OpenCV            | cv2.applyColorMap(COLORMAP_JET) for heatmap coloring            |
| Matplotlib        | Side-by-side comparison figure: original / leaf / heatmap       |

### CRITICAL NOTE FOR TEAM
Grad-CAM runs in PYTHON, NOT Node.js.
It is a DEBUGGING and VALIDATION tool for the development team.
It is NOT a user-facing feature. Do NOT try to add it to the production API.
Grad-CAM does NOT prove causality. It shows correlation between pixels and prediction.
Use it to CHECK the model is looking at leaves. Do not use it to PROVE the model is correct.

To use: python backend/ml_engine/evaluate_gradcam.py

### Key Files
- backend/ml_engine/gradcam.py              (Grad-CAM implementation)
- backend/ml_engine/evaluate_gradcam.py     (batch evaluation script)
- backend/ml_engine/test_gradcam.py         (unit tests)
- backend/ml_engine/gradcam_outputs/        (output heatmap images folder)
- backend/ml_engine/gradcam_evaluation_report.json  (per-image metrics)

---

## 12. Feature 9 - Multi-Leaf Canopy Analysis

### The Problem
Real farm photos contain multiple leaves. A single-leaf pipeline would:
- Pick an arbitrary leaf, possibly a healthy one
- Miss diseased leaves that are not the primary subject
- Report "healthy" when 2 out of 3 leaves have disease

### Solution: Per-Leaf Classification + Pathology-Weighted Consensus

    Image
      |
      +-- leafDetector.js: segment N leaf regions
      |
      +-- For each leaf with area > minimum threshold:
      |     +-- backgroundSuppressor.js
      |     +-- preprocessor.js
      |     +-- classify() -> { disease, confidence }
      |
      +-- multiLeafAggregator.js -> final consensus result

### Why NOT a Simple Average (Important Design Decision)

Simple average of all leaf confidences DILUTES the signal.
Example scenario: 2 diseased leaves (91%, 88%) + 1 healthy leaf (97%)
A simple average of class probabilities would blend healthy with diseased.
The healthy leaf confidence of 97% would suppress the disease signal.

Pathology-weighted approach:
    Step 1: Group leaves by predicted disease class
    Step 2: If ONE disease appears in >= 50% of confident leaves -> report that disease
    Step 3: Compute MEAN confidence over affected leaves ONLY (healthy leaves excluded)
    Step 4: If multiple diseases with similar counts -> report the highest severity one
    Step 5: If all leaves are low-confidence (< 0.4) -> return "uncertain"
    Step 6: Report: { disease, affectedLeaves: "2/3", status: "likely affected" }

Why this is correct:
    A farmer with 2 diseased leaves out of 3 has EARLY-STAGE INFECTION.
    This is exactly when treatment is most effective and critical to report.
    Pathology weighting ensures any significant disease presence is reported
    even when some leaves appear healthy.

### Key Files
- backend/vision/multiLeafAggregator.js      (aggregation logic)
- backend/vision/test_multi_leaf.js          (55 test cases, all passing)

---

## 13. Feature 10 - Disease Knowledge Base (38 Classes)

### What It Does
Converts raw AI label (e.g. "Tomato___Early_blight") into full actionable agricultural advice.
This is called AFTER the model makes a prediction.

### Contents Per Disease Entry

    {
      plant: "Tomato",
      displayName: "Early Blight",
      scientificName: "Alternaria solani",
      causedBy: "Fungus",
      severity: "Major",   // Healthy / Minor / Moderate / Major / Critical
      symptoms: [
        "Brown spots with concentric rings (target board pattern)",
        "Yellowing of lower leaves first",
        ...
      ],
      treatment: [
        "Remove and destroy affected leaves immediately",
        ...
      ],
      spray: {
        name: "Mancozeb 75% WP",
        quantity: "2.5g per Litre of water",
        timing: "Every 7-10 days during humid weather",
        interval: "7 days",
        safety: "Wear gloves and mask. Do not apply 7 days before harvest."
      },
      prevention: [
        "Crop rotation every 2 years",
        "Avoid overhead irrigation - use drip irrigation",
        ...
      ]
    }

### Coverage: 38 PlantVillage Classes
Apple (4), Blueberry (1), Cherry (2), Corn (4), Grape (4), Orange (1),
Peach (2), Bell Pepper (2), Potato (3), Raspberry (1), Soybean (1),
Squash (1), Strawberry (2), Tomato (10)

### Key File
- backend/cropDatabase.js

### Why Plain JavaScript Object (No Database Query)
Zero latency. Works offline. No network dependency.
The knowledge base must be available even without internet connection.
It is a fixed, curated dataset that does not need dynamic querying.

### Key Functions
- getDiseaseInfo(label)              -> main lookup, returns full disease object
- searchByKeyword(keyword)           -> fuzzy search used by chat assistant
- getSpraySafetyCheck(temp, hum, wind) -> spray safety warnings based on weather

---

## 14. Feature 11 - Weather Integration and Spray Safety

### What It Does
1. Fetches real-time weather at farmer GPS coordinates
2. Displays current conditions (temp, humidity, wind) in the UI
3. Checks if it is safe to spray pesticide RIGHT NOW
4. Adds weather-aware advice to the disease analysis response

### Spray Safety Rules

| Weather Condition  | Warning Message                                          |
|--------------------|----------------------------------------------------------|
| Wind > 20 km/h     | Spraying not recommended - spray drift risk              |
| Temperature > 35C  | Apply in early morning or evening to avoid evaporation   |
| Humidity < 40%     | Spray may dry too fast - increase water volume           |
| Rain expected      | Wait for dry conditions - rain will wash spray away      |

### Tech Stack

| Technology            | Why We Used It                                              |
|-----------------------|-------------------------------------------------------------|
| OpenWeatherMap API    | Free tier. Real-time weather by lat/lon. Simple REST API.   |
| Nominatim (OSM)       | Reverse geocoding GPS -> district/village name. Completely free.|
| Axios                 | HTTP client with AbortController timeout (4 second limit)   |

### Critical Implementation Detail: Parallel Fetch

    // In server.js - weather and AI run at the SAME TIME
    const aiPromise = classify(req.file.buffer);   // starts AI immediately
    const weatherRes = await axios.get(weatherUrl, { signal: controller.signal });
    const result = await aiPromise;               // wait for AI when done

    If weather fetch takes more than 4 seconds it is cancelled (AbortController).
    Default weather values are used: temp=25C, humidity=55%, wind=5 km/h
    AI analysis is NEVER blocked or delayed by weather fetch.

---

## 15. Feature 12 - AI Chat Assistant (Groq LLM)

### What It Does
After disease diagnosis, farmer can ask follow-up questions in natural language:
    "How long until my tomatoes recover?"
    "Can I spray Mancozeb during rain?"
    "What is the best alternative to this fungicide?"
    "Explain Early Blight in Marathi"

### Tech Stack

| Technology              | Why We Used It                                           |
|-------------------------|----------------------------------------------------------|
| Groq API                | Ultra-fast LLM inference (hundreds of tokens/second). Free tier. |
| openai/gpt-oss-20b      | Default model. Good agricultural knowledge. Switchable.  |
| Context window management| Last 10 messages (5 exchanges) trimmed to avoid token overflow |

### How It Is Implemented

    Frontend sends: { question, history, language }
      |
      Server builds messages array:
      [
        { role: "system",    content: "You are Agri-AI expert. Respond in Marathi." },
        { role: "user",      content: "[previous question]" },    // last 10 messages
        { role: "assistant", content: "[previous answer]" },
        { role: "user",      content: "[current question]" }
      ]
      |
      POST to api.groq.com/openai/v1/chat/completions
        model: "openai/gpt-oss-20b"
        max_tokens: 500
        temperature: 0.7
      |
      Clean out <think> tokens (some models produce reasoning tokens)
      Return { answer: "..." }

### Team Notes
- Chat is STATELESS. History is sent from the frontend every request.
- ChatSession MongoDB model exists but not currently wired (future persistence feature).
- Groq API key is FREE at console.groq.com
- Switch model by changing GROQ_MODEL in backend/.env

---

## 16. Feature 13 - Full Production API (POST /analyze)

### Single endpoint that runs the complete 8-stage pipeline.

    Stage 1: Upload Validation
             MIME type check: allowlist is jpeg, jpg, png, webp, bmp, tiff
             File size check: must be < 25MB
             Non-empty buffer check
             -> Errors: missing_image_file, unsupported_media_type, file_too_large

    Stage 2: Image Quality Analysis (qualityCheck.js)
             Returns: { qualityScore, issues, valid, recommendation }

    Stage 3: Leaf Detection (leafDetector.js - ONNX)
             Returns: { detected, confidence, boundingBox, regions }

    Stage 4: Background Suppression (backgroundSuppressor.js)
             Returns: { suppressedBuffer, mode }

    Stage 5: Disease Inference (ONNX session.run())
             Input: Float32 [1,3,224,224] tensor
             Returns: logits -> softmax -> { label, confidence, allPredictions }

    Stage 6: OOD Uncertainty Gate (uncertaintyGate.js)
             Returns: { status: confirmed/uncertain/retake_required, metrics, reason }

    Stage 7: Knowledge Enrichment (cropDatabase.js)
             Returns: { symptoms, treatment, spray, prevention, causedBy, severity }

    Stage 8: MongoDB Persist (Non-blocking background save)
             analysis.save().catch(...)   <-- no await, never blocks response

### Full API Response Schema

    {
      "success": true,
      "status": "confirmed",
      "crop": "Tomato",
      "disease": "Tomato Early Blight",
      "confidence": 0.8317,
      "severity": "Major",
      "imageQuality": {
        "score": 92, "issues": [], "valid": true, "recommendation": ""
      },
      "leafAnalysis": {
        "detected": true, "confidence": 0.83,
        "leafCount": 2, "boundingBox": { "left":42,"top":36,"width":162,"height":220 }
      },
      "prediction": {
        "disease": "Tomato Early Blight", "confidence": 0.8317,
        "confidencePercent": 83.2, "crop": "Tomato",
        "severity": "Major",
        "allPredictions": [
          {"label": "Tomato___Early_blight", "confidence": 0.8317},
          {"label": "Tomato___Late_blight",  "confidence": 0.1021},
          ...
        ]
      },
      "uncertainty": {
        "flagged": false, "reason": null,
        "metrics": { "freeEnergy": -5.2, "entropy": 0.87, "margin": 0.73 }
      },
      "symptoms": ["Brown spots with concentric rings", ...],
      "treatment": ["Remove affected leaves", ...],
      "spray": "Mancozeb 75% WP",
      "spray_quantity": "2.5g per Litre of water",
      "spray_action_time": "Every 7-10 days during humid weather",
      "sprayWarnings": [],
      "advice": [...],
      "prevention": [...],
      "causedBy": "Fungus",
      "temperature": 28,
      "humidity": 65,
      "wind": 12.4,
      "alert": "Weather: 28C, Clouds.",
      "affectedLeaves": "2/3",
      "multiLeafAnalysis": { ... },
      "timestamp": "2026-09-09T12:53:34Z"
    }

### Security Implementation
- No raw stack traces in any response (all caught and sanitized with a human-readable message)
- No file system paths exposed (no __dirname, no req.file.path in responses)
- No database credentials in responses
- File size hard limit: 25MB enforced before any processing
- MIME type allowlist enforced (rejects PDF, exe, etc.)

---

## 17. Feature 14 - Scan History (MongoDB)

### What It Does
Every successful scan is saved to MongoDB asynchronously and can be retrieved as a history list.

### MongoDB Analysis Schema (backend/models.js)
Fields:
    userId, farmerName, crop, diseaseName, confidence, severity, causedBy
    temperature, humidity, wind
    latitude, longitude, district, village
    spray, sprayWarnings, advice, prevention, alert
    timestamp, imageName

### API
    GET /history
    - Authenticated users: returns their own last 25 scans (filtered by userId)
    - Guests: returns all anonymous scans (no userId filter)

### Tech Stack

| Technology | Why We Used It                                                         |
|------------|------------------------------------------------------------------------|
| MongoDB    | Flexible schema. Disease response structure may evolve with new fields.|
| Mongoose   | Schema validation + Promise-based queries + model definitions          |

### Team Notes
- Scan saves are NON-BLOCKING: analysis.save().catch(errHandler) without await
  This means MongoDB lag NEVER slows down the API response to the farmer.
- History is NOT saved for "retake_required" status (no useful medical data to store)
- MongoDB is optional: if MONGODB_URI is missing or DB is offline, only scan history fails.
  Disease detection, auth, chat all continue to work.

---

## 18. Feature 15 - Robustness Evaluation Framework

### Purpose
Objectively measure Baseline Model vs Robust Vision Pipeline across 12 real-world failure
categories. Prevents claiming improvements without evidence. Results are reproducible.

### 12 Test Categories and How Synthetic Images Are Created

| # | Category              | Synthesis Method                                    |
|---|-----------------------|-----------------------------------------------------|
| 1 | Clean images          | Raw dataset images with no modification             |
| 2 | Noisy background      | High-frequency checkerboard composited behind leaf  |
| 3 | Soil background       | Brown grain texture + leaf mask composite           |
| 4 | Multiple leaves       | Two leaves composited on dual-region canvas         |
| 5 | Different lighting    | Sharp brightness modulated x0.5 and x1.5           |
| 6 | Blur                  | Sharp blur(sigma=4.0) and blur(sigma=7.0)          |
| 7 | Shadows               | SVG diagonal polygon overlay at 75% opacity         |
| 8 | Low resolution        | Downsample to 48x48 then upsample (nearest-neighbor)|
| 9 | Partial leaf          | Crop 50% of leaf width + dark padding               |
| 10| Unrelated objects     | Solid red/blue/grey buffers, checkerboard, wood-grain|
| 11| Unsupported crop      | Real Apple/Corn/Grape/Pepper dataset images          |
| 12| Unknown disease       | Color inversion, hue shift +-180 deg, saturation x2.5|

### Benchmark Results (180 samples total, 360 inferences: baseline + robust)

| Metric                    | Baseline  | Robust Pipeline | Net Change |
|---------------------------|-----------|-----------------|------------|
| Overall Reliability       | 42.22%    | 55.00%          | +12.78%    |
| OOD Crop Rejection        | 0%        | 100%            | +100%      |
| Non-Plant Rejection       | 0%        | 80%             | +80%       |
| Partial Leaf Accuracy     | 20%       | 87.50%          | +67.5%     |
| Noisy Background Accuracy | 40%       | 66.67%          | +26.67%    |
| Multi-Leaf Accuracy       | 13.33%    | 75%             | +61.67%    |
| Low-Resolution Accuracy   | 86.67%    | 91.67%          | +5%        |

### Key Files
- backend/vision/robustnessEvaluator.js                  (evaluation framework)
- backend/ml_engine/robustness_benchmark_12cat.json       (benchmark results)

---

## 19. Frontend UI

### Stack and Why

| Technology         | Why                                                             |
|--------------------|-----------------------------------------------------------------|
| Vanilla HTML/CSS/JS| No build step, no framework overhead. Works on low-end phones. |
| Fetch API          | Native browser HTTP. No extra library needed.                  |
| Navigator.geolocation | GPS coordinates for weather fetch                           |
| MediaDevices API   | Camera capture for mobile users (no app install needed)        |

### Files
- frontend/index.html   (app shell, modals, sections, navigation)
- frontend/style.css    (responsive styles, dark theme, animations)
- frontend/script.js    (all logic: upload, display results, chat, auth, history)

### Current UI Features
- Image upload via file picker or direct camera capture
- Real-time disease result display (disease name, confidence percentage, severity badge)
- Spray advice and weather alert panel
- AI chatbot panel with conversation history
- Scan history list (last 25 scans from MongoDB)
- Login/Register modal
- Language selector (structure ready, full translation not yet implemented)

---

## 20. Database Architecture (Dual DB)

### Why Two Databases?

| Database   | Used For                     | Why That Database                                     |
|------------|------------------------------|-------------------------------------------------------|
| PostgreSQL | User accounts, profiles      | Relational integrity. UNIQUE constraint on phone/email. ACID transactions. |
| MongoDB    | Scan history, chat, schemes  | Flexible document schema. Disease fields may evolve. Horizontal scaling. |

### PostgreSQL: users table schema

    id              SERIAL PRIMARY KEY
    name            VARCHAR(100) NOT NULL
    phone_or_email  VARCHAR(100) UNIQUE NOT NULL
    password_hash   VARCHAR(255) NOT NULL
    role            VARCHAR(20)  DEFAULT 'farmer'
    state           VARCHAR(50)  DEFAULT 'Maharashtra'
    district        VARCHAR(50)
    village         VARCHAR(50)
    preferred_language VARCHAR(10) DEFAULT 'mr'
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP

Table auto-created on server startup via CREATE TABLE IF NOT EXISTS.
No migration files needed for development.

### MongoDB Collections

    analyses      - Scan records (Analysis schema in models.js)
    chatsessions  - Chat message history (ChatSession schema in models.js)
    schemes       - Government schemes (Scheme schema in models.js)
                    NOTE: Schema exists and is complete, but data is EMPTY.
                    This needs to be seeded for GAP 6 (Government Scheme Integration).

---

## 21. Complete Tech Stack Map

| Layer              | Technology                  | Version | Purpose                              |
|--------------------|-----------------------------|---------|--------------------------------------|
| Runtime            | Node.js                     | 24.x    | Backend server                       |
| Web Framework      | Express                     | 5.2.x   | REST API, routing, middleware        |
| Upload             | Multer                      | 2.1.x   | Memory-storage multipart handling    |
| Image Processing   | Sharp                       | 0.33.x  | Decode, resize, crop, mask, normalize|
| ONNX Inference     | onnxruntime-node            | 1.29.x  | MobileNetV3 + MobileLeafNet          |
| TF.js (fallback)   | @tensorflow/tfjs-node       | 4.22.x  | Backup inference engine              |
| HTTP Client        | Axios                       | 1.13.x  | Weather API, Groq API calls          |
| Auth               | jsonwebtoken                | 9.0.x   | Stateless JWT tokens                 |
| Password Hashing   | bcryptjs                    | 3.0.x   | Secure password hashing              |
| Relational DB      | PostgreSQL + pg             | 8.23.x  | User accounts and profiles           |
| Document DB        | MongoDB + Mongoose          | 9.4.x   | Scan history and chat sessions       |
| Env Config         | dotenv                      | 17.x    | Environment variable management      |
| ML Training        | PyTorch                     | 2.x     | Model training                       |
| Augmentation       | Albumentations              | 1.x     | Training-time image augmentation     |
| Model Export       | torch.onnx                  | built-in| PyTorch to ONNX conversion           |
| Pretrained Weights | timm                        | 0.9.x   | MobileNetV3 backbone weights         |
| Explainability     | torchcam                    | 0.4.x   | Grad-CAM++ implementation            |
| Visualization      | Matplotlib, OpenCV          | latest  | Heatmap generation                   |
| LLM API            | Groq                        | latest  | Chat assistant inference             |
| Geocoding          | Nominatim (OpenStreetMap)   | --      | GPS to village/district name         |
| Weather            | OpenWeatherMap              | --      | Real-time weather by coordinates     |
| Frontend           | Vanilla HTML/CSS/JS         | --      | No framework, instant load           |

---

## 22. What Is NOT Yet Built (SIH Gaps)

These features are required by the SIH problem statement but are NOT yet implemented.
Every team member must know these exist as pending work.

### GAP 1 - MULTI-LANGUAGE SUPPORT (Priority: HIGH - SIH judges will test this)

Current state:
- Language selector UI element exists in frontend
- Only switches the Groq LLM response language (GROQ prompt says "Respond in X")
- All UI labels, disease names, spray instructions are in English only

What to build:
- Translation JSON files: one file per language (mr for Marathi, hi for Hindi minimum)
    { "scan_button": "स्कॅन करा", "disease_label": "रोगाचे नाव", ... }
- i18n.js utility: loads correct JSON on language change, swaps all UI text strings
- Pre-translate all 38 disease entries in cropDatabase.js (do NOT use LLM for accuracy)
- Language preference stored in user profile (preferred_language field in PostgreSQL)

Tech recommendation: Custom JSON key-value system (simpler than i18next for this project)
Files to create: frontend/translations/mr.json, frontend/translations/hi.json, frontend/i18n.js

---

### GAP 2 - VOICE INPUT SUPPORT (Priority: HIGH)

Current state: Not implemented at all.

What to build:
- Browser SpeechRecognition API integration in the chat panel
- Works natively in Chrome on Android (no library or API key needed)
- Language should match the selected UI language
- Microphone button that activates recording, stops on silence

Tech: window.SpeechRecognition (or window.webkitSpeechRecognition for Chrome)
No external library needed. Free. Works on 95% of Android smartphones.
For iOS (Safari) or low-end devices: fallback to Whisper API or Google STT.

Files to create/modify: frontend/script.js (add voice input to chat section)

---

### GAP 3 - OFFLINE / LOW-CONNECTIVITY MODE (Priority: HIGH - core SIH requirement)

Current state: Completely online. ALL features require server + internet connection.
Rural Indian farmers often have poor or zero connectivity.

What to build:
- Export crop_disease_model.onnx to TF.js layers format:
    python backend/ml_engine/export_tfjs.py
- Bundle TF.js model with frontend (serve from same Express server)
- Service Worker (sw.js): cache app shell, TF.js model, cropDatabase.js on first load
- Offline inference: @tensorflow/tfjs in-browser with @tensorflow/tfjs-backend-wasm
- IndexedDB: queue scan results locally when offline, sync to MongoDB when online
- Offline chatbot: use cropDatabase.js knowledge directly (no LLM needed for basic Q&A)

Tech: Workbox library for Service Worker management, @tensorflow/tfjs-backend-wasm
Files to create: frontend/sw.js, frontend/offline_db.js, backend/ml_engine/export_tfjs.py

---

### GAP 4 - GEO-TAGGED DISEASE OUTBREAK HEATMAP (Priority: MEDIUM)

Current state:
- latitude and longitude are stored in EVERY MongoDB Analysis record
- No visualization exists for this data

What to build:
- Admin dashboard page (separate route, admin-only JWT role check)
- MongoDB aggregation pipeline: $group by district, $sum disease counts
    db.analyses.aggregate([
      { $group: { _id: "$district", count: { $sum: 1 }, diseases: { $push: "$diseaseName" } } }
    ])
- India district map with disease incidence heatmap using Leaflet.js
  - GeoJSON boundaries: india-districts.geojson (available from datameet GitHub)
  - Color intensity = number of cases in district
- Time range selector to see outbreaks over weeks/months

Tech: Leaflet.js (open source map library), D3.js (color scale), MongoDB aggregation
Files to create: frontend/admin.html, backend/routes/admin.js

---

### GAP 5 - EXPERT/AGRONOMIST ESCALATION (Priority: MEDIUM)

Current state:
- Uncertainty gate correctly detects when a prediction is unreliable (status: "uncertain")
- No escalation path exists after uncertainty is detected

What to build:
- "Ask an Expert" button visible ONLY when status === "uncertain" in the UI
- Form: photo + description of problem + farmer contact number
- Backend route: POST /api/escalate (saves to MongoDB EscalationRequest collection)
- Agronomist portal: separate login with role: "agronomist", view open requests
- Notification: when agronomist responds, send WhatsApp or SMS to farmer
- Close loop: farmer receives expert advice through the app

Tech: Twilio API for WhatsApp (free trial available), nodemailer for email fallback
Files to create: backend/routes/escalation.js, frontend/expert_request.html

---

### GAP 6 - GOVERNMENT SCHEME INTEGRATION (Priority: HIGH - mentioned in SIH problem statement)

Current state:
- Scheme Mongoose schema exists in backend/models.js with complete field definitions:
    id, name, category, state, target, summary, benefits, eligibility, keyHighlights, officialUrl, applyUrl
- schemes MongoDB collection EXISTS but is COMPLETELY EMPTY
- No recommendation logic exists anywhere

What to build:
- Data seeding script: seed_schemes.js
  Populate with: PM-Kisan, PMFBY (crop insurance), PM Fasal Bima Yojana, NFSA, state-level schemes
  Data available from: https://data.gov.in (India Open Government Data Portal)
- scheme_recommender.js: function that takes { crop, disease, state } and returns matching schemes
    Example: crop="Tomato", disease="Early Blight", state="Maharashtra"
    -> Returns: PMFBY (crop insurance), Maharashtra state spray subsidy scheme
- POST /analyze response: add "schemes": [{ name, summary, applyUrl }] field
- UI component: collapsible "Government Help" section after each scan

Files to create: backend/scripts/seed_schemes.js, backend/vision/scheme_recommender.js

---

### GAP 7 - MARKET PRICE INTEGRATION (Priority: MEDIUM)

Current state: Not implemented.

What to build:
- Agmarknet API integration (India commodity prices by state and district)
- After scan, show: "Current mandi price for Tomato in Maharashtra: Rs. 18-24/kg"
- This helps farmer decide: sell now or treat and hold crop
- Daily price cache: store in MongoDB with TTL index (auto-expire after 24 hours)

API: https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070
     (Agmarknet market price dataset - requires data.gov.in API key, free registration)
Files to create: backend/routes/market.js, backend/scripts/price_cache.js

---

### GAP 8 - MULTI-CROP MODEL EXPANSION (Priority: HIGH - SIH expects multiple crops)

Current state:
- Disease classifier: ONLY 10 tomato classes (labels.json)
- Disease knowledge base: 38 classes across 14 crops (cropDatabase.js is ready)
- The gap: model does not match the knowledge base

Priority crops for expansion:

| Crop     | Why Priority                          | Common Diseases                           |
|----------|---------------------------------------|-------------------------------------------|
| Wheat    | Largest area crop in India            | Rust, Powdery Mildew, Smut               |
| Rice     | Most consumed food crop               | Blast, Brown Spot, Bacterial Leaf Blight  |
| Cotton   | Major Kharif cash crop                | Bollworm, Leaf Curl, Alternaria           |
| Potato   | Already in cropDatabase.js            | Early Blight, Late Blight                 |
| Groundnut| Major Kharif crop in AP, Gujarat      | Early Leaf Spot, Late Leaf Spot           |

What to build:
- Option A: Train SEPARATE models per crop (simpler, lower cross-crop confusion)
- Option B: Train ONE multi-crop model with crop selector input
- Extend labels.json with new crop class names
- Extend classifier.js to accept crop parameter for multi-model routing
- Add crop selector to frontend UI (dropdown before photo upload)

Data: PlantVillage dataset already has images for all 14 crops.
Download from: https://github.com/spMohanty/PlantVillage-Dataset

---

### GAP 9 - MARATHI/HINDI DISEASE DATABASE LOCALIZATION (Priority: HIGH)

Current state: ALL disease data in cropDatabase.js is in English only.

What to build:
- Add Marathi and Hindi translations for ALL 38 disease entries
- New fields in each entry: displayName_mr, symptoms_mr, treatment_mr, spray_mr, prevention_mr
- getDiseaseInfo(label, language) function updated to return correct language
- Lookup uses preferred_language from authenticated user profile

Files to modify: backend/cropDatabase.js (add translated fields - only ADD, do not remove English)

---

### GAP 10 - FRONTEND HISTORY AND PROFILE POLISH (Priority: LOW)

Current state:
- Scan history list is functional but minimal (just a list of past results)
- No dedicated profile page

What to build:
- Full profile page: name, village, district, language preference, total scan count, join date
- History page: pagination (not just last 25), filter by crop/disease/date range, search
- Export feature: Download history as PDF report
    Useful when farmer shows past disease history to bank/insurance agent for loan/claim

Tech: jsPDF or html2pdf.js for PDF export

---

## 23. Development Workflow and Rules

### THE GOLDEN RULE
    Do not rewrite or touch any existing file unless explicitly asked.
    First inspect the existing code, then implement only the requested module,
    test it, and report exactly which files were changed.

### Rules Every Team Member Must Follow

1. READ BEFORE WRITING
   Use cat or view the file before modifying it.
   Understand what the existing code does before adding anything.

2. NEVER COMMIT .env
   backend/.env contains database passwords, API keys, and JWT secrets.
   It is already in .gitignore. Never override this. Never paste .env contents in chat.

3. NEVER TOUCH MODEL WEIGHTS
   Files: best_model.pth, crop_disease_model.onnx, crop_disease_model.onnx.data,
          leaf_segmentation.onnx, leaf_segmentation.onnx.data
   Only touch these if you are doing a complete formal retraining cycle.

4. TEST BEFORE COMMITTING
   Run the relevant test suite after any change:
       node backend/vision/test_api_endpoint.js
       node backend/vision/test_multi_leaf.js
       node backend/vision/test_pipeline_integration.js
       node backend/vision/test_uncertainty_protection.js
   All 201 tests must pass.

5. NO STACK TRACES TO USERS
   All catch blocks in server.js must return a sanitized human-readable error message.
   Never return err.stack or err.message directly without sanitization.

6. NEW FEATURES GO IN NEW FILES
   Do not append new logic to existing files unless it is a small targeted addition.
   Create a new file and require it where needed.

7. KEEP DUAL-DB SEPARATION
   User data (auth, profiles) -> PostgreSQL only
   Scan history, chat, schemes -> MongoDB only
   Never mix them.

### Current Test Status (All Passing)
    test_api_endpoint.js              71 / 71  passing
    test_multi_leaf.js                55 / 55  passing
    test_pipeline_integration.js      32 / 32  passing
    test_uncertainty_protection.js    43 / 43  passing
    Total:                           201 / 201 passing

---

## 24. Environment Variables Guide

File: backend/.env
CRITICAL: This file must NEVER be committed to git.

    # Required: MongoDB (for scan history)
    MONGODB_URI=mongodb://localhost:27017/agri_ai
    # OR for MongoDB Atlas:
    MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/agri_ai

    # Required: PostgreSQL (for user auth)
    # Option A: Full connection string
    DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/agri_ai
    # Option B: Individual fields
    PG_USER=postgres
    PG_HOST=localhost
    PG_DATABASE=agri_ai
    PG_PASSWORD=yourpassword
    PG_PORT=5432

    # Required: Weather advice (free at openweathermap.org)
    OPENWEATHER_API_KEY=your_key_here

    # Required: AI Chat (free at console.groq.com)
    GROQ_API_KEY=your_key_here
    GROQ_MODEL=openai/gpt-oss-20b

    # Required: JWT secret (generate a random 64-char string)
    JWT_SECRET=your_random_64_char_string_here
    # Generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

    # Optional: Server port (default is 5000)
    PORT=5000

### Where to Get Keys
- OPENWEATHER_API_KEY: Register free at openweathermap.org, go to API Keys section
- GROQ_API_KEY:        Register free at console.groq.com, create API key
- MONGODB_URI:         Use MongoDB Atlas free tier (512 MB) or local MongoDB
- DATABASE_URL:        Use Supabase free tier or Railway free tier or local PostgreSQL

---

## 25. Running the Project Locally

### Prerequisites
- Node.js 18 or higher (recommend Node.js 24)
- Python 3.10 or higher with pip (for ML scripts only - not needed for running the app)
- MongoDB: running locally at localhost:27017 OR use MongoDB Atlas URI
- PostgreSQL: running locally at localhost:5432 OR use Supabase/Railway URI

### Quick Start

    Step 1: Clone the repo
        git clone <your-repo-url>
        cd agri-ai

    Step 2: Install backend dependencies
        cd backend
        npm install

    Step 3: Create backend/.env file
        Copy the template from Section 24 above and fill in your values.

    Step 4: Start the server
        npm start
        OR
        node server.js

    Step 5: Open the app
        The server runs at http://localhost:5000
        Express automatically serves the frontend at this URL.
        Open http://localhost:5000 in your browser.

### Python Setup (for ML scripts and Grad-CAM - NOT needed just to run the app)

    cd backend/ml_engine
    pip install -r requirements.txt

### Training on Google Colab (Recommended - free GPU, much faster than CPU)

    Step 1: Upload backend/ml_engine/Agri_AI_Tomato_Colab.ipynb to Google Colab
    Step 2: Enable GPU in Colab: Runtime -> Change runtime type -> GPU
    Step 3: Follow COLAB_GUIDE.md for step-by-step instructions
    Step 4: After training, download best_model.pth from Colab
    Step 5: Run: python backend/ml_engine/export_onnx.py
            This converts best_model.pth to crop_disease_model.onnx
    Step 6: Replace the existing .onnx and .onnx.data files in backend/ml_engine/
    Step 7: Re-run calibrate_uncertainty.py to update OOD thresholds
    Step 8: Restart the Node.js server

---

Document created: 2026-09-09
Team: Agri-AI SIH Development Team
Contact team lead before making changes to any existing file.
