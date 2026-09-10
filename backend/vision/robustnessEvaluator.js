/**
 * =====================================================================
 * Agri-AI Dedicated Robustness Evaluation Pipeline
 * =====================================================================
 * Systematically evaluates and compares:
 *   1. BASELINE MODEL        (Raw image -> Direct 224x224 Resize -> ONNX forward pass)
 *   2. ROBUST VISION PIPELINE (Quality Gate -> Leaf Detector -> Background Suppression ->
 *                             Letterbox Contain -> ONNX -> Free Energy OOD Gate)
 *
 * 12 Rigorous Test Categories:
 *    1. Clean images
 *    2. Noisy background
 *    3. Soil background
 *    4. Multiple leaves
 *    5. Different lighting
 *    6. Blur
 *    7. Shadows
 *    8. Low resolution
 *    9. Partial leaf
 *   10. Unrelated / non-leaf images
 *   11. Unsupported crop
 *   12. Unknown / uncertain disease
 *
 * Metrics Computed for Each Category & Model:
 *   - Total samples
 *   - Rejection / Uncertainty rate (%)
 *   - Accuracy (Selective on accepted & Strict on total)
 *   - Precision (Macro & Weighted)
 *   - Recall (Macro & Weighted)
 *   - F1 Score (Macro & Weighted)
 *   - Performance Delta (Improvement vs Degradation analysis)
 *
 * Run: node backend/vision/robustnessEvaluator.js
 * =====================================================================
 */

const path = require("path");
const fs = require("fs");
const sharp = require("sharp");
const { initClassifier, classify, classifyBaseline } = require("../classifier");

// ── Configuration ────────────────────────────────────────────────────
const DATASET_DIR = path.join(__dirname, "..", "dataset");
const LABELS_FILE = path.join(__dirname, "..", "ml_engine", "labels.json");
const SAMPLES_PER_CATEGORY = 15; // 15 samples x 12 categories = 180 images (360 inferences total)

// Read labels
const LABELS = JSON.parse(fs.readFileSync(LABELS_FILE, "utf8"));
const NUM_CLASSES = LABELS.length;

// Class directory mapping
const TOMATO_CLASSES = [
    "Tomato___Bacterial_spot",
    "Tomato___Early_blight",
    "Tomato___Late_blight",
    "Tomato___Leaf_Mold",
    "Tomato___Septoria_leaf_spot",
    "Tomato___Spider_mites Two-spotted_spider_mite",
    "Tomato___Target_Spot",
    "Tomato___Tomato_Yellow_Leaf_Curl_Virus",
    "Tomato___Tomato_mosaic_virus",
    "Tomato___healthy"
];

const UNSUPPORTED_CROP_CLASSES = [
    "Apple___Apple_scab",
    "Apple___Black_rot",
    "Corn_(maize)___Common_rust_",
    "Grape___Black_rot",
    "Pepper,_bell___Bacterial_spot"
];

// Helper to get image files for a class
function getClassImages(className) {
    const classDir = path.join(DATASET_DIR, className);
    if (!fs.existsSync(classDir)) return [];
    return fs.readdirSync(classDir)
        .filter(f => /\.(jpe?g|png)$/i.test(f))
        .map(f => path.join(classDir, f));
}

// ─────────────────────────────────────────────────────────────────────
// 1. Synthetic & Transform Image Generators
// ─────────────────────────────────────────────────────────────────────

// Category 2: Noisy background composite
async function generateNoisyBackground(leafBuffer) {
    const width = 384, height = 384;
    // High-frequency synthetic colored checkerboard/clutter
    const noiseRaw = Buffer.alloc(width * height * 3);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 3;
            const checker = ((Math.floor(x / 16) + Math.floor(y / 16)) % 2 === 0);
            noiseRaw[idx]     = checker ? 220 : 60;   // R
            noiseRaw[idx + 1] = checker ? 70  : 190;  // G
            noiseRaw[idx + 2] = (x * y) % 255;        // B
        }
    }
    const noiseBg = await sharp(noiseRaw, { raw: { width, height, channels: 3 } }).png().toBuffer();
    const leafOverlay = await sharp(leafBuffer).resize(240, 240, { fit: "inside" }).png().toBuffer();
    return await sharp(noiseBg)
        .composite([{ input: leafOverlay, top: 72, left: 72 }])
        .jpeg({ quality: 90 })
        .toBuffer();
}

// Category 3: Agricultural soil background composite
async function generateSoilBackground(leafBuffer) {
    const width = 384, height = 384;
    // Textured dark agricultural soil
    const soilRaw = Buffer.alloc(width * height * 3);
    for (let i = 0; i < width * height; i++) {
        const grain = ((i * 37) % 31) - 15;
        soilRaw[i * 3]     = Math.min(255, Math.max(0, 105 + grain)); // Brown R
        soilRaw[i * 3 + 1] = Math.min(255, Math.max(0, 72  + grain)); // Soil G
        soilRaw[i * 3 + 2] = Math.min(255, Math.max(0, 42  + grain)); // Earth B
    }
    const soilBg = await sharp(soilRaw, { raw: { width, height, channels: 3 } }).png().toBuffer();
    const leafOverlay = await sharp(leafBuffer).resize(250, 250, { fit: "inside" }).png().toBuffer();
    return await sharp(soilBg)
        .composite([{ input: leafOverlay, top: 67, left: 67 }])
        .jpeg({ quality: 90 })
        .toBuffer();
}

// Category 4: Multi-leaf composite (two leaves in different quadrants)
async function generateMultiLeafScene(leafBufferA, leafBufferB) {
    const width = 420, height = 420;
    const canvas = await sharp({
        create: { width, height, channels: 3, background: { r: 50, g: 45, b: 40 } }
    }).png().toBuffer();

    const leafA = await sharp(leafBufferA).resize(175, 175, { fit: "inside" }).png().toBuffer();
    const leafB = await sharp(leafBufferB).resize(175, 175, { fit: "inside" }).png().toBuffer();

    return await sharp(canvas)
        .composite([
            { input: leafA, top: 25, left: 25 },
            { input: leafB, top: 220, left: 220 }
        ])
        .jpeg({ quality: 90 })
        .toBuffer();
}

// Category 5: Different lighting conditions
async function generateLightingVariation(leafBuffer, variantIndex) {
    const s = sharp(leafBuffer);
    const mode = variantIndex % 3;
    if (mode === 0) {
        // Harsh overexposure / direct midday sun
        return await s.modulate({ brightness: 1.50, saturation: 0.85 }).jpeg().toBuffer();
    } else if (mode === 1) {
        // Deep canopy shadow / underexposed
        return await s.modulate({ brightness: 0.50, saturation: 1.10 }).jpeg().toBuffer();
    } else {
        // Golden hour / sunset color temperature shift
        return await s.tint({ r: 255, g: 215, b: 165 }).jpeg().toBuffer();
    }
}

// Category 6: Motion & optical blur
async function generateBlurVariation(leafBuffer, variantIndex) {
    const sigma = (variantIndex % 2 === 0) ? 4.0 : 7.0;
    return await sharp(leafBuffer).blur(sigma).jpeg().toBuffer();
}

// Category 7: Harsh diagonal shadow
async function generateShadowVariation(leafBuffer) {
    const metadata = await sharp(leafBuffer).metadata();
    const w = metadata.width || 256;
    const h = metadata.height || 256;

    // Dark semi-transparent diagonal polygon overlay (attenuates 70% light)
    const shadowSvg = Buffer.from(`
        <svg width="${w}" height="${h}">
            <polygon points="0,0 ${w},${h} 0,${h}" fill="black" fill-opacity="0.75" />
        </svg>
    `);

    return await sharp(leafBuffer)
        .composite([{ input: shadowSvg, top: 0, left: 0 }])
        .jpeg({ quality: 90 })
        .toBuffer();
}

// Category 8: Low resolution / pixelation (extreme sensor compression)
async function generateLowResolution(leafBuffer) {
    const metadata = await sharp(leafBuffer).metadata();
    const origW = metadata.width || 256;
    const origH = metadata.height || 256;

    // Downsample to 48x48, then upsample back with nearest neighbor
    return await sharp(leafBuffer)
        .resize(48, 48, { kernel: "nearest" })
        .resize(origW, origH, { kernel: "nearest" })
        .jpeg({ quality: 40 })
        .toBuffer();
}

// Category 9: Partial leaf crop (edge of camera frame)
async function generatePartialLeaf(leafBuffer) {
    const metadata = await sharp(leafBuffer).metadata();
    const origW = metadata.width || 256;
    const origH = metadata.height || 256;
    const cropW = Math.max(50, Math.floor(origW * 0.50));

    // Crop left half of the leaf, then pad remaining canvas with neutral background
    return await sharp(leafBuffer)
        .extract({ left: 0, top: 0, width: cropW, height: origH })
        .extend({
            right: origW - cropW,
            background: { r: 35, g: 35, b: 35 }
        })
        .jpeg({ quality: 90 })
        .toBuffer();
}

// Category 10: Non-plant / Unrelated objects (Tractor metal, plastic, wood, concrete)
async function generateNonPlantSample(index) {
    const width = 256, height = 256;
    const type = index % 5;
    if (type === 0) {
        // Red painted tractor chassis metal
        return await sharp({
            create: { width, height, channels: 3, background: { r: 215, g: 35, b: 35 } }
        }).jpeg().toBuffer();
    } else if (type === 1) {
        // Blue irrigation bucket / plastic
        return await sharp({
            create: { width, height, channels: 3, background: { r: 25, g: 85, b: 220 } }
        }).jpeg().toBuffer();
    } else if (type === 2) {
        // Concrete wall / cement floor
        return await sharp({
            create: { width, height, channels: 3, background: { r: 155, g: 155, b: 155 } }
        }).jpeg().toBuffer();
    } else if (type === 3) {
        // Checkerboard / mechanical tile pattern
        const buf = Buffer.alloc(width * height * 3);
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 3;
                const c = ((Math.floor(x / 16) + Math.floor(y / 16)) % 2 === 0) ? 230 : 40;
                buf[idx] = c; buf[idx + 1] = c; buf[idx + 2] = c;
            }
        }
        return await sharp(buf, { raw: { width, height, channels: 3 } }).jpeg().toBuffer();
    } else {
        // Wood grain / workbench surface
        const buf = Buffer.alloc(width * height * 3);
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 3;
                const grain = (Math.sin(y / 4) * 20) + ((x * 13) % 15);
                buf[idx]     = Math.min(255, Math.max(0, 145 + grain));
                buf[idx + 1] = Math.min(255, Math.max(0, 95  + grain));
                buf[idx + 2] = Math.min(255, Math.max(0, 50  + grain));
            }
        }
        return await sharp(buf, { raw: { width, height, channels: 3 } }).jpeg().toBuffer();
    }
}

// Category 12: Unknown / Uncertain disease (Anomalous pathology, color inversion, blend)
async function generateUnknownDiseaseSample(leafBuffer, index) {
    const mode = index % 3;
    if (mode === 0) {
        // Color-negative inversion (severe spectral distortion)
        return await sharp(leafBuffer).negate({ alpha: false }).jpeg().toBuffer();
    } else if (mode === 1) {
        // Psychedelic high-frequency color perturbation
        return await sharp(leafBuffer)
            .tint({ r: 255, g: 50, b: 240 })
            .modulate({ saturation: 2.5 })
            .jpeg()
            .toBuffer();
    } else {
        // Extreme color shift / hue inversion anomaly
        return await sharp(leafBuffer).modulate({ hue: 180, saturation: 2.0 }).jpeg().toBuffer();
    }
}

// ─────────────────────────────────────────────────────────────────────
// 2. Multi-Class Metric Calculation Engine
// ─────────────────────────────────────────────────────────────────────

/**
 * Computes precision, recall, F1, accuracy, and rejection rates.
 *
 * @param {Array<{ groundTruth: number, predicted: number, isRejected: boolean }>} samples
 * @param {boolean} isOodCategory - True if this category represents negative/OOD samples
 */
function computeCategoryMetrics(samples, isOodCategory) {
    const total = samples.length;
    if (total === 0) {
        return {
            total: 0,
            rejectionRate: 0,
            accuracy: 0,
            selectiveAccuracy: 0,
            precisionMacro: 0,
            recallMacro: 0,
            f1Macro: 0,
            f1Weighted: 0
        };
    }

    const rejectedCount = samples.filter(s => s.isRejected).length;
    const rejectionRate = parseFloat(((rejectedCount / total) * 100).toFixed(2));
    const acceptedCount = total - rejectedCount;

    // ── Case A: Out-of-Distribution / Non-Plant / Unsupported Crop ──
    // The ground truth is "NOT a supported tomato disease".
    // Safe Rejection = True Negative (Correct action)
    // Confident Disease Diagnosis = False Positive (Hazardous hallucination)
    if (isOodCategory) {
        // Specificity / Safe Rejection Rate = Correct handling
        const correctRejections = rejectedCount;
        const accuracy = parseFloat(((correctRejections / total) * 100).toFixed(2));
        const recall = parseFloat((correctRejections / total).toFixed(4));
        const precision = correctRejections > 0 ? 1.0 : 0.0;
        const f1 = (precision + recall > 0)
            ? parseFloat(((2 * precision * recall) / (precision + recall)).toFixed(4))
            : 0;

        return {
            total,
            acceptedCount,
            rejectedCount,
            rejectionRate,
            accuracy,           // Specificity (% successfully rejected)
            selectiveAccuracy: 0, // N/A for OOD
            precisionMacro: precision,
            recallMacro: recall,
            f1Macro: f1,
            f1Weighted: f1,
            isOod: true
        };
    }

    // ── Case B: In-Distribution Tomato Disease Images ───────────────
    // Multi-class metrics (10 tomato classes)
    const acceptedSamples = samples.filter(s => !s.isRejected);
    let correctCount = 0;

    // Confusion Matrix: [trueClass][predClass]
    const cm = Array.from({ length: NUM_CLASSES }, () => Array(NUM_CLASSES).fill(0));
    const classSupport = Array(NUM_CLASSES).fill(0);

    for (const s of samples) {
        if (s.groundTruth >= 0 && s.groundTruth < NUM_CLASSES) {
            classSupport[s.groundTruth]++;
        }
    }

    for (const s of acceptedSamples) {
        if (s.groundTruth >= 0 && s.predicted >= 0 && s.groundTruth < NUM_CLASSES && s.predicted < NUM_CLASSES) {
            cm[s.groundTruth][s.predicted]++;
            if (s.groundTruth === s.predicted) {
                correctCount++;
            }
        }
    }

    // Selective Accuracy (accuracy over accepted cases only)
    const selectiveAccuracy = acceptedCount > 0
        ? parseFloat(((correctCount / acceptedCount) * 100).toFixed(2))
        : 0;

    // Strict Accuracy (correct accepted / total samples, penalizing unclassified)
    const strictAccuracy = parseFloat(((correctCount / total) * 100).toFixed(2));

    // Per-class precision, recall, f1
    let precisionSum = 0, recallSum = 0, f1Sum = 0;
    let weightedPrecisionSum = 0, weightedRecallSum = 0, weightedF1Sum = 0;
    let activeClasses = 0;

    for (let c = 0; c < NUM_CLASSES; c++) {
        const support = classSupport[c];
        if (support === 0) continue;
        activeClasses++;

        const tp = cm[c][c];
        let fp = 0;
        for (let r = 0; r < NUM_CLASSES; r++) {
            if (r !== c) fp += cm[r][c];
        }
        let fn = 0;
        for (let col = 0; col < NUM_CLASSES; col++) {
            if (col !== c) fn += cm[c][col];
        }

        const prec = (tp + fp > 0) ? tp / (tp + fp) : 0;
        const rec = (tp + fn > 0) ? tp / (tp + fn) : 0;
        const f1 = (prec + rec > 0) ? (2 * prec * rec) / (prec + rec) : 0;

        precisionSum += prec;
        recallSum += rec;
        f1Sum += f1;

        weightedPrecisionSum += prec * support;
        weightedRecallSum += rec * support;
        weightedF1Sum += f1 * support;
    }

    const precisionMacro = activeClasses > 0 ? parseFloat((precisionSum / activeClasses).toFixed(4)) : 0;
    const recallMacro = activeClasses > 0 ? parseFloat((recallSum / activeClasses).toFixed(4)) : 0;
    const f1Macro = activeClasses > 0 ? parseFloat((f1Sum / activeClasses).toFixed(4)) : 0;

    const f1Weighted = total > 0 ? parseFloat((weightedF1Sum / total).toFixed(4)) : 0;
    const precisionWeighted = total > 0 ? parseFloat((weightedPrecisionSum / total).toFixed(4)) : 0;
    const recallWeighted = total > 0 ? parseFloat((weightedRecallSum / total).toFixed(4)) : 0;

    return {
        total,
        acceptedCount,
        rejectedCount,
        rejectionRate,
        accuracy: strictAccuracy,
        selectiveAccuracy,
        precisionMacro,
        recallMacro,
        f1Macro,
        precisionWeighted,
        recallWeighted,
        f1Weighted,
        isOod: false
    };
}

// ─────────────────────────────────────────────────────────────────────
// 3. Evaluation Orchestrator
// ─────────────────────────────────────────────────────────────────────

async function runRobustnessEvaluation() {
    console.log("\n=======================================================================");
    console.log("🌾  AGRI-AI DEDICATED MODEL ROBUSTNESS EVALUATION PIPELINE");
    console.log("=======================================================================");
    console.log(`Evaluator Configuration:`);
    console.log(` • Categories:           12 rigorous test distributions`);
    console.log(` • Samples per Category: ${SAMPLES_PER_CATEGORY}`);
    console.log(` • Total Test Images:    ${SAMPLES_PER_CATEGORY * 12} unique scenarios`);
    console.log(` • Inferences:           ${SAMPLES_PER_CATEGORY * 12 * 2} forward passes (Baseline vs Robust Pipeline)`);
    console.log("=======================================================================\n");

    // Initialize Classifier
    console.log("[Phase 1/3] Initializing Neural Inference Engines...");
    await initClassifier();
    console.log("✅ Models and inference weights ready.\n");

    // Pre-cache candidate images for each tomato class
    const classImagePool = {};
    for (let c = 0; c < TOMATO_CLASSES.length; c++) {
        const cName = TOMATO_CLASSES[c];
        const imgs = getClassImages(cName);
        if (imgs.length === 0) {
            throw new Error(`Missing dataset directory or images for class: ${cName}`);
        }
        classImagePool[c] = imgs;
    }

    // Pre-cache candidate images for unsupported crops
    const unsupportedImagePool = [];
    for (const uName of UNSUPPORTED_CROP_CLASSES) {
        const imgs = getClassImages(uName);
        unsupportedImagePool.push(...imgs);
    }
    if (unsupportedImagePool.length === 0) {
        console.warn("⚠️ Warning: No unsupported crop images found in dataset. Synthesizing OOD leaves.");
    }

    // Define 12 Evaluation Categories
    const CATEGORIES = [
        { id: 1,  name: "Clean images",              isOod: false },
        { id: 2,  name: "Noisy background",          isOod: false },
        { id: 3,  name: "Soil background",           isOod: false },
        { id: 4,  name: "Multiple leaves",           isOod: false },
        { id: 5,  name: "Different lighting",        isOod: false },
        { id: 6,  name: "Blur",                      isOod: false },
        { id: 7,  name: "Shadows",                   isOod: false },
        { id: 8,  name: "Low resolution",            isOod: false },
        { id: 9,  name: "Partial leaf",              isOod: false },
        { id: 10, name: "Unrelated/non-leaf images", isOod: true  },
        { id: 11, name: "Unsupported crop",          isOod: true  },
        { id: 12, name: "Unknown/uncertain disease", isOod: true  }
    ];

    console.log("[Phase 2/3] Executing 12-Category Robustness Benchmark...\n");

    const categoryReports = [];

    for (const cat of CATEGORIES) {
        process.stdout.write(`  ▶ Evaluating Category ${cat.id}/12: [${cat.name}]... `);
        const startTime = Date.now();

        const baselineResults = [];
        const robustResults = [];

        for (let i = 0; i < SAMPLES_PER_CATEGORY; i++) {
            let testBuffer = null;
            let groundTruthClass = -1;

            if (!cat.isOod) {
                // In-distribution categories: select balanced tomato classes
                groundTruthClass = i % NUM_CLASSES;
                const pool = classImagePool[groundTruthClass];
                const imgPath = pool[i % pool.length];
                const rawBuf = fs.readFileSync(imgPath);

                switch (cat.id) {
                    case 1: // Clean images
                        testBuffer = rawBuf;
                        break;
                    case 2: // Noisy background
                        testBuffer = await generateNoisyBackground(rawBuf);
                        break;
                    case 3: // Soil background
                        testBuffer = await generateSoilBackground(rawBuf);
                        break;
                    case 4: // Multiple leaves
                        {
                            const otherClass = (groundTruthClass + 3) % NUM_CLASSES;
                            const otherPool = classImagePool[otherClass];
                            const otherBuf = fs.readFileSync(otherPool[i % otherPool.length]);
                            testBuffer = await generateMultiLeafScene(rawBuf, otherBuf);
                        }
                        break;
                    case 5: // Different lighting
                        testBuffer = await generateLightingVariation(rawBuf, i);
                        break;
                    case 6: // Blur
                        testBuffer = await generateBlurVariation(rawBuf, i);
                        break;
                    case 7: // Shadows
                        testBuffer = await generateShadowVariation(rawBuf);
                        break;
                    case 8: // Low resolution
                        testBuffer = await generateLowResolution(rawBuf);
                        break;
                    case 9: // Partial leaf
                        testBuffer = await generatePartialLeaf(rawBuf);
                        break;
                }
            } else {
                // Out-of-distribution / Negative categories:
                groundTruthClass = -1; // Negative ground truth

                switch (cat.id) {
                    case 10: // Unrelated/non-leaf
                        testBuffer = await generateNonPlantSample(i);
                        break;
                    case 11: // Unsupported crop (Apple, Corn, Grape, Pepper)
                        if (unsupportedImagePool.length > 0) {
                            const uPath = unsupportedImagePool[i % unsupportedImagePool.length];
                            testBuffer = fs.readFileSync(uPath);
                        } else {
                            testBuffer = await generateNonPlantSample(i + 10);
                        }
                        break;
                    case 12: // Unknown/uncertain disease
                        {
                            const seedPool = classImagePool[i % NUM_CLASSES];
                            const rawBuf = fs.readFileSync(seedPool[i % seedPool.length]);
                            testBuffer = await generateUnknownDiseaseSample(rawBuf, i);
                        }
                        break;
                }
            }

            // ── 1. Run Baseline Model ────────────────────────────
            const baselinePred = await classifyBaseline(testBuffer);
            const baselinePredIndex = LABELS.indexOf(baselinePred.label);
            baselineResults.push({
                groundTruth: groundTruthClass,
                predicted: baselinePredIndex,
                isRejected: false, // Baseline never rejects
                confidence: baselinePred.confidence
            });

            // ── 2. Run Robust Vision Pipeline ───────────────────
            const robustPred = await classify(testBuffer);
            const robustPredIndex = LABELS.indexOf(robustPred.label);
            const isRejected = (robustPred.status === "retake_required" || robustPred.status === "uncertain");

            robustResults.push({
                groundTruth: groundTruthClass,
                predicted: isRejected ? -1 : robustPredIndex,
                isRejected: isRejected,
                confidence: robustPred.confidence,
                status: robustPred.status,
                reason: robustPred.reason
            });
        }

        const latency = Date.now() - startTime;

        // Compute metrics
        const baselineMetrics = computeCategoryMetrics(baselineResults, cat.isOod);
        const robustMetrics = computeCategoryMetrics(robustResults, cat.isOod);

        // Performance Deltas
        const accDelta = parseFloat((robustMetrics.accuracy - baselineMetrics.accuracy).toFixed(2));
        const f1Delta = parseFloat((robustMetrics.f1Weighted - baselineMetrics.f1Weighted).toFixed(4));
        const rejDelta = parseFloat((robustMetrics.rejectionRate - baselineMetrics.rejectionRate).toFixed(2));

        let verdict = "⚖️ NEUTRAL";
        if (cat.isOod) {
            // In OOD categories, high rejection / accuracy is superior
            verdict = (robustMetrics.accuracy >= baselineMetrics.accuracy + 20) ? "🚀 HIGHLY IMPROVED" : "⚖️ COMPARABLE";
        } else {
            if (robustMetrics.selectiveAccuracy > baselineMetrics.accuracy || accDelta > 0 || (robustMetrics.selectiveAccuracy >= baselineMetrics.accuracy && robustMetrics.rejectionRate > 0)) {
                verdict = "🚀 IMPROVED";
            } else if (accDelta < -15) {
                verdict = "🔻 DEGRADED";
            } else {
                verdict = "⚖️ PRESERVED";
            }
        }

        categoryReports.push({
            id: cat.id,
            name: cat.name,
            isOod: cat.isOod,
            baseline: baselineMetrics,
            robust: robustMetrics,
            delta: {
                accuracy: accDelta,
                f1: f1Delta,
                rejectionRate: rejDelta
            },
            verdict,
            latencyMs: latency
        });

        console.log(`Done (${latency}ms) — Verdict: ${verdict}`);
    }

    console.log("\n[Phase 3/3] Generating Comprehensive Comparison Report...\n");

    // ─────────────────────────────────────────────────────────────────
    // 4. Output Formatted Results Table
    // ─────────────────────────────────────────────────────────────────
    console.log("========================================================================================================================");
    console.log("                                    BENCHMARK RESULTS: BASELINE vs ROBUST VISION PIPELINE                               ");
    console.log("========================================================================================================================");
    console.log(
        "Category".padEnd(28) + " | " +
        "Baseline Acc".padEnd(12) + " | " +
        "Robust Acc".padEnd(11) + " | " +
        "Baseline F1".padEnd(11) + " | " +
        "Robust F1".padEnd(9) + " | " +
        "Robust Rej%".padEnd(11) + " | " +
        "Verdict"
    );
    console.log("-".repeat(120));

    let overallBaselineCorrect = 0;
    let overallRobustCorrect = 0;
    let totalSamplesCount = 0;

    for (const r of categoryReports) {
        const bAccStr = `${r.baseline.accuracy}%`.padEnd(12);
        const rAccStr = (r.isOod ? `${r.robust.accuracy}%` : `${r.robust.selectiveAccuracy}% (${r.robust.accuracy}%)`).padEnd(11);
        const bF1Str = `${r.baseline.f1Weighted}`.padEnd(11);
        const rF1Str = `${r.robust.f1Weighted}`.padEnd(9);
        const rRejStr = `${r.robust.rejectionRate}%`.padEnd(11);

        console.log(
            r.name.padEnd(28) + " | " +
            bAccStr + " | " +
            rAccStr + " | " +
            bF1Str + " | " +
            rF1Str + " | " +
            rRejStr + " | " +
            r.verdict
        );

        totalSamplesCount += r.baseline.total;
        if (r.isOod) {
            overallBaselineCorrect += r.baseline.rejectedCount; // 0 for baseline
            overallRobustCorrect += r.robust.rejectedCount;     // Safe rejections
        } else {
            overallBaselineCorrect += Math.round((r.baseline.accuracy / 100) * r.baseline.total);
            overallRobustCorrect += Math.round((r.robust.accuracy / 100) * r.robust.total);
        }
    }
    console.log("========================================================================================================================\n");

    const overallBaselineScore = parseFloat(((overallBaselineCorrect / totalSamplesCount) * 100).toFixed(2));
    const overallRobustScore = parseFloat(((overallRobustCorrect / totalSamplesCount) * 100).toFixed(2));

    console.log(`📊 OVERALL BENCHMARK METRICS across all 180 test evaluations:`);
    console.log(` • Baseline Direct Model Overall Reliability:    ${overallBaselineScore}% (${overallBaselineCorrect}/${totalSamplesCount})`);
    console.log(` • Robust Vision Pipeline Overall Reliability:   ${overallRobustScore}% (${overallRobustCorrect}/${totalSamplesCount})`);
    console.log(` • Net Reliability Gain:                         +${(overallRobustScore - overallBaselineScore).toFixed(2)}%\n`);

    // ─────────────────────────────────────────────────────────────────
    // 5. Persist JSON Report for System Verification
    // ─────────────────────────────────────────────────────────────────
    const jsonReportPath = path.join(__dirname, "robustness_report.json");
    const jsonOutput = {
        timestamp: new Date().toISOString(),
        totalSamples: totalSamplesCount,
        samplesPerCategory: SAMPLES_PER_CATEGORY,
        numCategories: 12,
        overallSummary: {
            baselineReliabilityPercent: overallBaselineScore,
            robustReliabilityPercent: overallRobustScore,
            netGainPercent: parseFloat((overallRobustScore - overallBaselineScore).toFixed(2))
        },
        categoryReports
    };
    fs.writeFileSync(jsonReportPath, JSON.stringify(jsonOutput, null, 2), "utf8");
    console.log(`📄 Saved comprehensive JSON results to: ${jsonReportPath}\n`);

    return jsonOutput;
}

// Execute if run as script
if (require.main === module) {
    runRobustnessEvaluation()
        .then(() => {
            console.log("🎉 Robustness Evaluation Pipeline execution complete.");
            process.exit(0);
        })
        .catch(err => {
            console.error("💥 Robustness Evaluation Pipeline failed:", err);
            process.exit(1);
        });
}

module.exports = {
    runRobustnessEvaluation,
    computeCategoryMetrics
};
