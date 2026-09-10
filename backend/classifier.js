// 🚀 [Agri-AI] HYBRID INFERENCE ENGINE
// Supports two inference backends:
//   1. ONNX Runtime (onnxruntime-node) — used when ml_engine/crop_disease_model.onnx exists
//   2. TensorFlow.js WASM              — legacy fallback (original pipeline)
// No other files were modified.

process.stdout.write("\n🚀 [Agri-AI] Ignition system powering up...\n");

let tf = null;
let model = null;
let mobilenet = null;
let modelReady = false;
let labels = [];

// ─── ONNX Runtime state ──────────────────────────────────────
let ort = null;
let ortSession = null;
let usingOnnx = false;

const fs = require("fs");
const path = require("path");
const { getDiseaseInfo, getModelLabels } = require("./cropDatabase");
const {
    runVisionPipeline,
    prepareModelInput,
    evaluateUncertainty,
    filterCandidateLeaves,
    cropAndPreprocessLeaf,
    aggregateMultiLeafPredictions,
    estimateDiseaseSeverity
} = require("./vision");

const MODEL_DIR = path.join(__dirname, "crop-disease-model");
const ML_DIR = path.join(__dirname, "ml_engine");
const ONNX_MODEL = path.join(ML_DIR, "crop_disease_model.onnx");
const ONNX_LABELS = path.join(ML_DIR, "labels.json");

// FORCE LOG HELPER
function logStep(msg) {
    process.stdout.write(`🚀 [Agri-AI] ${msg}\n`);
}

// ─────────────────────────────────────────────────────────────
//  ONNX BACKEND  (PyTorch-exported model via ml_engine/)
// ─────────────────────────────────────────────────────────────
async function initOnnxBackend() {
    logStep("Checking for PyTorch ONNX model (ml_engine/crop_disease_model.onnx)...");

    if (!fs.existsSync(ONNX_MODEL)) {
        logStep("ONNX model not found — falling back to TensorFlow.js backend.");
        return false;
    }

    try {
        ort = require("onnxruntime-node");
    } catch (e) {
        logStep(`onnxruntime-node not installed. Run: npm install onnxruntime-node`);
        logStep("Falling back to TF.js backend.");
        return false;
    }

    try {
        ortSession = await ort.InferenceSession.create(ONNX_MODEL, {
            executionProviders: ["cpu"],   // GPU (cuda/dml) can be added here if available
            graphOptimizationLevel: "all"
        });

        // Load labels from ml_engine first, then crop-disease-model, then cropDatabase
        if (fs.existsSync(ONNX_LABELS)) {
            labels = JSON.parse(fs.readFileSync(ONNX_LABELS, "utf8"));
        } else if (fs.existsSync(path.join(MODEL_DIR, "labels.json"))) {
            labels = JSON.parse(fs.readFileSync(path.join(MODEL_DIR, "labels.json"), "utf8"));
        } else {
            labels = getModelLabels();
        }

        usingOnnx = true;
        modelReady = true;
        logStep(`✅ PyTorch ONNX Engine READY — ${labels.length} classes loaded.`);
        return true;
    } catch (err) {
        logStep(`ONNX session creation failed: ${err.message}`);
        logStep("Falling back to TF.js backend.");
        return false;
    }
}

// ─────────────────────────────────────────────────────────────
//  TF.JS BACKEND  (original MobileNetV2 pipeline — untouched)
// ─────────────────────────────────────────────────────────────
async function initTfjsBackend() {
    logStep("Calibrating WASM High-Performance Engine...");
    tf = require("@tensorflow/tfjs");
    const wasm = require("@tensorflow/tfjs-backend-wasm");

    // 🛡️ ABSOLUTE BINARY MAP: Essential for Windows stability
    const wasmDist = path.join(__dirname, 'node_modules', '@tensorflow', 'tfjs-backend-wasm', 'dist');
    wasm.setWasmPaths({
        'tfjs-backend-wasm.wasm': path.join(wasmDist, 'tfjs-backend-wasm.wasm'),
        'tfjs-backend-wasm-simd.wasm': path.join(wasmDist, 'tfjs-backend-wasm-simd.wasm'),
        'tfjs-backend-wasm-threaded.wasm': path.join(wasmDist, 'tfjs-backend-wasm-threaded.wasm'),
        'tfjs-backend-wasm-threaded-simd.wasm': path.join(wasmDist, 'tfjs-backend-wasm-threaded-simd.wasm'),
    });

    await tf.setBackend('wasm');
    await tf.ready();
    logStep(`Engine Signal: WASM CORE ⚡ (Active on ${tf.getBackend()})`);

    logStep("[1.5/5] Hooking into Core MobileNet Backbone...");
    const MOBILENET_DIR = path.join(__dirname, "mobilenet_v2");
    const MOBILENET_LOCAL = path.join(MOBILENET_DIR, "model.json");
    const MOBILENET_URL = "https://tfhub.dev/google/tfjs-model/imagenet/mobilenet_v2_100_224/feature_vector/3/default/1";

    const loadLocalModel = async (modelPath) => {
        const modelDir = path.dirname(modelPath);
        return {
            load: async () => {
                const modelJson = JSON.parse(fs.readFileSync(modelPath, "utf8"));
                const weightManifest = modelJson.weightsManifest;
                const weightDataList = [];
                for (const entry of weightManifest) {
                    for (const weightPath of entry.paths) {
                        const fullPath = path.join(modelDir, weightPath);
                        weightDataList.push(fs.readFileSync(fullPath));
                    }
                }
                const combinedWeights = Buffer.concat(weightDataList);
                return {
                    modelTopology: modelJson.modelTopology,
                    weightSpecs: weightManifest[0].weights,
                    weightData: combinedWeights.buffer.slice(
                        combinedWeights.byteOffset,
                        combinedWeights.byteOffset + combinedWeights.byteLength
                    ),
                    format: modelJson.format,
                    generatedBy: modelJson.generatedBy,
                    convertedBy: modelJson.convertedBy
                };
            }
        };
    };

    try {
        if (fs.existsSync(MOBILENET_LOCAL)) {
            mobilenet = await tf.loadGraphModel(await loadLocalModel(MOBILENET_LOCAL));
            logStep("Backbone loaded from LOCAL disk ⚡ (Offline Mode)");
        } else {
            logStep("Local backbone not found. Downloading from TFHub...");
            mobilenet = await tf.loadGraphModel(MOBILENET_URL, { fromTFHub: true });
            logStep("Backbone downloaded from TFHub ✅");
        }
    } catch (fetchErr) {
        logStep(`⚠️  MobileNet load error: ${fetchErr.message}`);
    }

    const modelJsonPath = path.join(MODEL_DIR, "model.json");
    if (fs.existsSync(modelJsonPath)) {
        let modelJson = JSON.parse(fs.readFileSync(modelJsonPath, "utf8"));

        logStep("[2/5] Translating Modern Topology...");
        const deepTranslate = (obj) => {
            if (!obj || typeof obj !== 'object') return;
            if (Array.isArray(obj)) { obj.forEach(deepTranslate); return; }
            if (obj.class_name === "InputLayer" && obj.config && obj.config.batch_shape) {
                obj.config.batchInputShape = obj.config.batch_shape;
            }
            if (obj.inbound_nodes && Array.isArray(obj.inbound_nodes)) {
                obj.inbound_nodes = obj.inbound_nodes.map(node => {
                    if (!Array.isArray(node) && typeof node === 'object' && node.args) {
                        const args = Array.isArray(node.args) ? node.args : [node.args];
                        return args.map(arg => (arg && arg.config && arg.config.keras_history) ? arg.config.keras_history : arg);
                    }
                    return node;
                });
            }
            Object.values(obj).forEach(deepTranslate);
        };
        deepTranslate(modelJson.modelTopology);

        logStep("[3/5] Loading Weights (Buffered isolation)...");
        const shards = modelJson.weightsManifest[0].paths.map(p => fs.readFileSync(path.join(MODEL_DIR, p)));
        const combined = Buffer.concat(shards);
        const weightData = new Uint8Array(combined).slice().buffer;
        shards.length = 0;

        logStep("[4/5] Stacking Neural Layers...");
        model = await tf.loadLayersModel({
            load: async () => ({
                modelTopology: modelJson.modelTopology,
                weightSpecs: modelJson.weightsManifest[0].weights,
                weightData: weightData
            })
        });

        modelJson = null;

        // Load labels
        const labelsJsonPath = path.join(MODEL_DIR, "labels.json");
        if (fs.existsSync(labelsJsonPath)) {
            labels = JSON.parse(fs.readFileSync(labelsJsonPath, "utf8"));
        } else {
            labels = getModelLabels();
        }

        if (model && mobilenet) {
            modelReady = true;
            logStep("[5/5] AI NEURAL ENGINE READY (TF.js WASM)");
        } else {
            logStep("[5/5] Engine partially loaded. Standby.");
        }
    } else {
        logStep("⚠️  Warning: Local model files missing in 'crop-disease-model' folder.");
    }

    setTimeout(() => {
        if (model && mobilenet && tf) {
            tf.tidy(() => {
                const img = tf.zeros([1, 224, 224, 3]);
                const features = mobilenet.predict(img);
                model.predict(features).dispose();
            });
            logStep("Final Diagnostic: Performance Tuned.");
        }
    }, 500);
}

// ─────────────────────────────────────────────────────────────
//  INIT — try ONNX first, fall back to TF.js
// ─────────────────────────────────────────────────────────────
async function initClassifier() {
    if (modelReady) return;
    logStep("Ignition Seq: unblocking main thread...");

    try {
        const onnxReady = await initOnnxBackend();
        if (!onnxReady) {
            await initTfjsBackend();
        }
    } catch (err) {
        logStep(`CRITICAL STARTUP ERROR: ${err.message}`);
    }
}

// ─────────────
// ────────────────────────────────────────────────
//  CLASSIFY  — image buffer → disease info object
//  Output schema is identical regardless of which backend runs.
// ─────────────────────────────────────────────────────────────
async function classify(imageBuffer) {
    if (!modelReady) throw new Error("AI is warming up.");

    if (usingOnnx) {
        return classifyOnnx(imageBuffer);
    } else {
        return classifyTfjs(imageBuffer);
    }
}

// ── ONNX inference with Integrated Robust Vision Pipeline ─────
async function classifyOnnx(imageBuffer) {
    if (!ortSession) throw new Error("ONNX session not initialized.");

    console.log("\n======================================================================");
    console.log("🌾 [Agri-AI] End-to-End Robust Vision Pipeline Execution");
    console.log("======================================================================");

    // 🌿 Stages 1-4: Quality Check → Leaf Detection → Background Suppression → Normalization
    const vision = await runVisionPipeline(imageBuffer, {
        targetSize: 224,
        layout: "CHW",
        verboseLogging: false
    });

    // ── Stage 1 Log ─────────────────────────────────────────────
    console.log(`[Stage 1/5] 🔍 Image Quality Check:`);
    console.log(`  • Status:        ${vision.quality.valid ? "✅ PASSED" : "❌ FAILED"} (Score: ${vision.quality.qualityScore}/100)`);
    if (vision.quality.issues && vision.quality.issues.length > 0) {
        console.log(`  • Issues:        [${vision.quality.issues.join(", ")}]`);
    }

    // ── Stage 2 Log ─────────────────────────────────────────────
    console.log(`[Stage 2/5] 🌿 Leaf Detection & Segmentation:`);
    console.log(`  • Status:        ${vision.leafDetection.detected ? "✅ Leaf Detected" : "❌ No Leaf Detected"}`);
    console.log(`  • Confidence:    ${(vision.leafDetection.confidence * 100).toFixed(1)}% (Model: ${vision.leafDetection.modelType || "MobileLeafNet-ONNX"})`);
    if (vision.leafDetection.boundingBox) {
        const b = vision.leafDetection.boundingBox;
        console.log(`  • Bounding Box:  [left: ${b.left}, top: ${b.top}, w: ${b.width}, h: ${b.height}]`);
    }

    // ── Controlled Uncertainty Gate ──────────────────────────────
    // If quality failed, leaf not detected, or preprocessing threw an error:
    // DO NOT silently fall back to an unreliable prediction. Return controlled uncertainty response.
    if (vision.safeFailure) {
        const isQualityFail = vision.reason === "image_quality_failed";
        const isNoLeaf = vision.reason === "no_leaf_detected" || (!vision.leafDetection || !vision.leafDetection.detected);
        const isPreprocessingFail = vision.reason === "preprocessing_failed";

        let failureStatus = "uncertain";
        let failureReason = vision.reason || "uncertain";
        let fallbackDisease = "No Plant Leaf Detected";

        if (isQualityFail) {
            failureStatus = "retake_required";
            failureReason = "poor_image_quality";
            fallbackDisease = "Image Quality Issue";
        } else if (isNoLeaf) {
            failureStatus = "retake_required";
            failureReason = "no_leaf_detected";
            fallbackDisease = "No Plant Leaf Detected";
        } else if (isPreprocessingFail) {
            failureStatus = "uncertain";
            failureReason = "preprocessing_failed";
            fallbackDisease = "Uncertain - Preprocessing Error";
        }

        console.log(`⚠️ [Pipeline Halt] ${fallbackDisease}: ${vision.message}`);
        console.log(`  • Status:        ${failureStatus}`);
        console.log(`  • Reason:        ${failureReason}`);
        console.log(`  • Action:        Disease classifier bypassed to prevent unreliable diagnosis.`);
        console.log("======================================================================\n");

        return {
            status: failureStatus,
            crop: "Unknown",
            disease: fallbackDisease,
            confidence: 0,
            confidencePercent: 0,
            label: "uncertain",
            affectedLeaves: "0/0",
            multiLeafAnalysis: {
                isMultiLeaf: false,
                totalLeavesDetected: (vision.leafDetection && vision.leafDetection.regions) ? vision.leafDetection.regions.length : 0,
                validLeavesCount: 0,
                discardedLeavesCount: 0,
                affectedLeavesCount: 0,
                affectedLeavesRatio: "0/0",
                prevalencePercent: 0,
                infectionStatus: "uncertain",
                leafPredictions: []
            },
            isUncertain: true,
            isReliable: false,
            reason: failureReason,
            message: vision.message,
            imageQuality: {
                valid: vision.quality.valid,
                qualityScore: vision.quality.qualityScore,
                issues: vision.quality.issues || [],
                recommendation: vision.quality.recommendation || ""
            },
            leafDetection: {
                detected: vision.leafDetection.detected || false,
                confidence: vision.leafDetection.confidence || 0,
                boundingBox: vision.leafDetection.boundingBox || null,
                regions: vision.leafDetection.regions || [],
                modelType: vision.leafDetection.modelType || "MobileLeafNet-ONNX"
            },
            preprocessing: {
                wasSuppressed: vision.suppression.wasSuppressed || false,
                isUncertain: true,
                uncertaintyReason: vision.suppression.uncertaintyReason || vision.message,
                suppressionMode: vision.suppression.suppressionMode || "failed",
                cropBox: vision.suppression.cropBox || null,
                targetSize: 224,
                storage: vision.suppression.storage || null,
                comparison: vision.suppression.comparison || null
            },
            causedBy: "Vision Pipeline Gate",
            severity: "Uncertain",
            symptoms: vision.quality.issues && vision.quality.issues.length > 0
                ? vision.quality.issues.map(iss => `Issue: ${iss.replace(/_/g, " ")}`)
                : ["Could not isolate recognizable crop leaf foliage from the background."],
            advice: [vision.message || "Please take a photo with the diseased leaf centered in the frame."],
            prevention: [
                "Ensure the camera is focused on the crop leaf symptoms.",
                "Avoid framing only background soil, hands, or farming tools.",
                "Maintain 15-25 cm distance from the leaf in bright natural daylight."
            ],
            spray: "N/A",
            spray_action_time: "N/A",
            spray_quantity: "N/A",
            allPredictions: [],
            backend: "onnx",
            uncertaintyMetrics: {
                energyScore: null,
                predictionMargin: null,
                entropy: null,
                topConfidence: 0,
                secondConfidence: 0,
                qualityScore: vision.quality.qualityScore,
                leafConfidence: vision.leafDetection.confidence || 0
            },
            visionMetrics: {
                qualityIssues: vision.quality.issues || [],
                hasPlantContent: false,
                wasSuppressed: false,
                isUncertain: true,
                suppressionMode: vision.suppression.suppressionMode || "failed",
                cropBox: null,
                storage: vision.suppression.storage || null,
                processingTimeMs: vision.pipelineExecutionTimeMs
            }
        };
    }

    // ── Stage 3 Log ─────────────────────────────────────────────
    console.log(`[Stage 3/5] 🍃 Background Suppression:`);
    console.log(`  • Status:        ${vision.suppression.wasSuppressed ? "✅ Active" : "Bypassed"}`);
    console.log(`  • Mode:          ${vision.suppression.suppressionMode || "full_segmentation"}`);
    console.log(`  • Uncertainty:   ${vision.suppression.isUncertain ? "⚠️ YES (" + vision.suppression.uncertaintyReason + ")" : "✅ NO (High Confidence)"}`);

    // ── Stage 4 Log ─────────────────────────────────────────────
    console.log(`[Stage 4/5] 📐 Crop + Resize + Normalize:`);
    console.log(`  • Tensor Shape:  [${vision.tensorShape.join(", ")}] (CHW layout)`);
    console.log(`  • Resizing:      224 x 224 px (Aspect ratio preserved via letterbox contain)`);

    // ── Multi-Leaf Pipeline Evaluation ──────────────────────────
    const detectedRegions = vision.leafDetection && Array.isArray(vision.leafDetection.regions)
        ? vision.leafDetection.regions
        : [];

    if (detectedRegions.length >= 2) {
        const candidateFilter = filterCandidateLeaves(detectedRegions);

        // 🛡️ Uncertainty Check: If multiple leaves are detected, but all are too small or low-confidence
        if (candidateFilter.allTooSmallOrLowConfidence) {
            console.log(`⚠️ [Pipeline Halt] Uncertain: Multiple leaves detected (${detectedRegions.length}), but all are too small or low-confidence.`);
            console.log(`  • Action: Disease classifier bypassed to prevent misleading diagnosis.`);
            console.log("======================================================================\n");

            return {
                status: "uncertain",
                reason: "leaves_too_small_or_low_confidence",
                isReliable: false,
                isUncertain: true,
                crop: "Unknown",
                disease: "Uncertain - Leaves Too Small or Low Confidence",
                confidence: 0,
                confidencePercent: 0,
                label: "uncertain",
                affectedLeaves: "0/0",
                message: "Multiple leaf candidates were detected, but they are too small or low-confidence for reliable diagnosis. Please capture a closer photo focusing on clear plant foliage.",
                advice: ["Please hold the camera closer (15-25 cm) and focus on an individual, clear diseased leaf."],
                symptoms: ["Detected leaf regions did not meet minimum size (1.5% frame) or detection confidence thresholds."],
                prevention: ["Capture high-resolution photos in good lighting."],
                spray: "N/A",
                spray_action_time: "N/A",
                spray_quantity: "N/A",
                imageQuality: {
                    valid: vision.quality.valid,
                    qualityScore: vision.quality.qualityScore,
                    issues: vision.quality.issues || [],
                    recommendation: vision.quality.recommendation || ""
                },
                leafDetection: vision.leafDetection,
                preprocessing: vision.suppression,
                multiLeafAnalysis: {
                    isMultiLeaf: true,
                    totalLeavesDetected: detectedRegions.length,
                    validLeavesCount: 0,
                    discardedLeavesCount: candidateFilter.discardedLeaves.length,
                    affectedLeavesCount: 0,
                    affectedLeavesRatio: "0/0",
                    prevalencePercent: 0,
                    infectionStatus: "uncertain",
                    discardedLeaves: candidateFilter.discardedLeaves,
                    leafPredictions: []
                },
                allPredictions: [],
                backend: "onnx",
                visionMetrics: {
                    qualityWarnings: vision.quality.warnings || [],
                    hasPlantContent: vision.leafDetection.hasPlantContent,
                    wasSuppressed: vision.suppression.wasSuppressed,
                    isUncertain: true,
                    suppressionMode: "multi_leaf_uncertainty",
                    cropBox: null,
                    storage: vision.suppression.storage,
                    processingTimeMs: vision.pipelineExecutionTimeMs
                }
            };
        }

        // Genuine Multi-Leaf Case (>= 2 qualified leaves)
        if (candidateFilter.validLeaves.length >= 2) {
            console.log(`[Stage 5/5] 🔬 Multi-Leaf Disease Inference (${candidateFilter.validLeaves.length} valid leaves):`);
            const leafPredictions = [];

            for (const leaf of candidateFilter.validLeaves) {
                const leafCrop = await cropAndPreprocessLeaf(imageBuffer, leaf.boundingBox, {
                    targetSize: 224,
                    layout: "CHW"
                });

                const leafInputTensor = new ort.Tensor("float32", leafCrop.tensorData, leafCrop.tensorShape);
                const leafResults = await ortSession.run({ input: leafInputTensor });

                const leafLogits = Array.from(leafResults.output.data);
                const leafMaxLogit = Math.max(...leafLogits);
                const leafExpScores = leafLogits.map(v => Math.exp(v - leafMaxLogit));
                const leafSumExp = leafExpScores.reduce((a, b) => a + b, 0);
                const leafProbs = leafExpScores.map(v => v / leafSumExp);

                const leafMaxIndex = leafProbs.indexOf(Math.max(...leafProbs));
                const leafLabelKey = labels[leafMaxIndex];
                const leafInfo = getDiseaseInfo(leafLabelKey);
                const leafCropName = leafLabelKey.includes("___") ? leafLabelKey.split("___")[0].replace(/_/g, " ") : "Crop";
                const leafDiseaseName = leafInfo ? leafInfo.displayName : leafLabelKey;
                const leafConf = parseFloat(leafProbs[leafMaxIndex].toFixed(4));
                const leafConfPct = parseFloat((leafProbs[leafMaxIndex] * 100).toFixed(1));

                const isHealthy = leafLabelKey.toLowerCase().includes("healthy") || leafDiseaseName.toLowerCase().includes("healthy");

                const leafGate = evaluateUncertainty({
                    quality: vision.quality,
                    leafDetection: { detected: true, confidence: leaf.confidence },
                    logits: leafLogits,
                    probs: leafProbs,
                    labels
                });

                leafPredictions.push({
                    leafId: leaf.id,
                    crop: leafCropName,
                    disease: leafDiseaseName,
                    label: leafLabelKey,
                    confidence: leafConf,
                    confidencePercent: leafConfPct,
                    isHealthy,
                    boundingBox: leaf.boundingBox,
                    areaRatio: leaf.areaRatio,
                    uncertaintyGate: leafGate
                });

                console.log(`  🌿 Leaf ${leaf.id}: ${leafDiseaseName} (${leafConfPct}%) [${isHealthy ? "HEALTHY" : "AFFECTED"}] (Box: [${leaf.boundingBox.left}, ${leaf.boundingBox.top}, ${leaf.boundingBox.width}, ${leaf.boundingBox.height}])`);
            }

            const multiLeafAgg = aggregateMultiLeafPredictions(leafPredictions);
            console.log(`\n  📊 Multi-Leaf Aggregation Result:`);
            console.log(`    • Disease:          ${multiLeafAgg.disease}`);
            console.log(`    • Affected Leaves:  ${multiLeafAgg.affectedLeaves} (${multiLeafAgg.prevalencePercent}% prevalence)`);
            console.log(`    • Status:           ${multiLeafAgg.status}`);
            console.log(`    • Aggregated Conf:  ${multiLeafAgg.confidencePercent}% (calculated over affected foliage)`);
            console.log(`    • Strategy:         ${multiLeafAgg.aggregationMethod} (preserves lesion certainty, avoids dilution)`);
            console.log("======================================================================\n");

            const dominantLeaf = leafPredictions.find(l => l.disease === multiLeafAgg.disease) || leafPredictions[0];
            const dominantLabel = dominantLeaf ? dominantLeaf.label : labels[0];
            const info = getDiseaseInfo(dominantLabel);

            const finalAdvice = info ? info.treatment : [multiLeafAgg.aggregationRationale];
            const finalSymptoms = info ? info.symptoms : [`Pathogen detected on ${multiLeafAgg.affectedLeaves} leaves.`];
            const finalPrevention = info ? info.prevention : [];
            const finalSpray = info && info.spray ? info.spray.name : "N/A";
            const finalSprayTiming = info && info.spray ? info.spray.timing : "N/A";
            const finalSprayQty = info && info.spray ? info.spray.quantity : "N/A";

            // ── Vision-Based Multi-Leaf Severity Estimation ───────────
            const isMultiHealthy = multiLeafAgg.status === "healthy";
            const multiSeverityEval = await estimateDiseaseSeverity(vision.processedBuffer || imageBuffer, {
                label: dominantLabel,
                diseaseName: multiLeafAgg.disease,
                isHealthy: isMultiHealthy
            });
            const multiSeverityString = isMultiHealthy
                ? "Healthy (0% Area Damaged)"
                : multiSeverityEval.visualSummary;

            return {
                status: multiLeafAgg.status,
                infectionStatus: multiLeafAgg.status,
                reason: multiLeafAgg.reason || null,
                isReliable: multiLeafAgg.isReliable,
                isUncertain: multiLeafAgg.isUncertain,
                crop: multiLeafAgg.crop,
                disease: multiLeafAgg.disease,
                confidence: multiLeafAgg.confidence,
                confidencePercent: multiLeafAgg.confidencePercent,
                affectedLeaves: multiLeafAgg.affectedLeaves,
                label: dominantLabel,
                multiLeafAnalysis: {
                    isMultiLeaf: true,
                    totalLeavesDetected: detectedRegions.length,
                    validLeavesCount: candidateFilter.validLeaves.length,
                    discardedLeavesCount: candidateFilter.discardedLeaves.length,
                    affectedLeavesCount: multiLeafAgg.multiLeafSummary.affectedLeaves,
                    affectedLeavesRatio: multiLeafAgg.affectedLeaves,
                    prevalencePercent: multiLeafAgg.prevalencePercent,
                    infectionStatus: multiLeafAgg.status,
                    dominantDisease: multiLeafAgg.disease,
                    mixedInfection: multiLeafAgg.multiLeafSummary.mixedInfection,
                    coOccurringDiseases: multiLeafAgg.multiLeafSummary.coOccurringDiseases || [],
                    aggregationMethod: multiLeafAgg.aggregationMethod,
                    aggregationRationale: multiLeafAgg.aggregationRationale,
                    leafPredictions: multiLeafAgg.multiLeafSummary.leafDetails
                },
                imageQuality: {
                    valid: vision.quality.valid,
                    qualityScore: vision.quality.qualityScore,
                    issues: vision.quality.issues || [],
                    recommendation: vision.quality.recommendation || ""
                },
                leafDetection: vision.leafDetection,
                preprocessing: vision.suppression,
                causedBy: info ? info.causedBy : "Crop Pathogen",
                severity: multiSeverityString,
                severityMetrics: multiSeverityEval,
                affectedAreaPercent: multiSeverityEval.affectedAreaPercent,
                symptoms: finalSymptoms,
                advice: finalAdvice,
                prevention: finalPrevention,
                spray: finalSpray,
                spray_action_time: finalSprayTiming,
                spray_quantity: finalSprayQty,
                allPredictions: leafPredictions.map(p => ({
                    label: p.label,
                    disease: p.disease,
                    confidence: p.confidence,
                    confidencePercent: p.confidencePercent
                })),
                backend: "onnx",
                visionMetrics: {
                    qualityWarnings: vision.quality.warnings || [],
                    hasPlantContent: vision.leafDetection.hasPlantContent,
                    wasSuppressed: vision.suppression.wasSuppressed,
                    isUncertain: multiLeafAgg.isUncertain,
                    suppressionMode: vision.suppression.suppressionMode || "multi_leaf_segmentation",
                    cropBox: vision.suppression.cropBox,
                    storage: vision.suppression.storage,
                    processingTimeMs: vision.pipelineExecutionTimeMs
                }
            };
        }
    }

    // ── Stage 5: Single Leaf Disease Model Inference ────────────
    console.log(`[Stage 5/5] 🔬 Disease Model Inference:`);
    const inputTensor = new ort.Tensor("float32", vision.tensorData, vision.tensorShape);
    const feeds = { input: inputTensor };
    const results = await ortSession.run(feeds);

    // Softmax probabilities
    const logits = Array.from(results.output.data);
    const maxLogit = Math.max(...logits);
    const expScores = logits.map(v => Math.exp(v - maxLogit));
    const sumExp = expScores.reduce((a, b) => a + b, 0);
    const probs = expScores.map(v => v / sumExp);

    const maxIndex = probs.indexOf(Math.max(...probs));
    const labelKey = labels[maxIndex];
    const info = getDiseaseInfo(labelKey);

    // Extract crop name from label (e.g. "Tomato___Early_blight" -> "Tomato")
    const cropName = labelKey.includes("___")
        ? labelKey.split("___")[0].replace(/_/g, " ")
        : "Crop";

    const diseaseName = info ? info.displayName : labelKey;
    const confidenceFraction = parseFloat(probs[maxIndex].toFixed(4));
    const confidencePercent = parseFloat((probs[maxIndex] * 100).toFixed(1));

    // ── Uncertainty & OOD Protection Gate Evaluation ─────────────
    const gateResult = evaluateUncertainty({
        quality: vision.quality,
        leafDetection: vision.leafDetection,
        logits,
        probs,
        labels
    });

    const isConfirmed = gateResult.status === "confirmed";
    const status = gateResult.status;
    const reason = gateResult.reason;

    // Formulate final disease presentation based on uncertainty gate
    let finalDisease = diseaseName;
    let finalCrop = cropName;
    let finalAdvice = info ? info.treatment : [];
    let finalSymptoms = info ? info.symptoms : [];
    let finalPrevention = info ? info.prevention : [];
    let finalSpray = info && info.spray ? info.spray.name : "N/A";
    let finalSprayTiming = info && info.spray ? info.spray.timing : "N/A";
    let finalSprayQty = info && info.spray ? info.spray.quantity : "N/A";

    if (!isConfirmed) {
        if (status === "uncertain") {
            if (reason === "image_out_of_distribution") {
                finalDisease = "Uncertain - Out of Distribution";
                finalCrop = "Unknown";
            } else if (reason === "ambiguous_diagnosis") {
                finalDisease = "Uncertain - Ambiguous Symptoms";
            } else {
                finalDisease = "Uncertain - Low Confidence";
            }
            finalAdvice = [gateResult.recommendation];
            finalSymptoms = [`Prediction unconfirmed due to ${reason ? reason.replace(/_/g, " ") : "statistical uncertainty"}. Closest match: ${diseaseName} (${confidencePercent}%).`];
            finalPrevention = [
                "Verify that the crop photographed is supported by Agri-AI.",
                "Capture high-resolution images in natural daylight without glare.",
                "Ensure disease lesions are centered and sharply focused."
            ];
            finalSpray = "N/A (Action deferred pending reliable identification)";
            finalSprayTiming = "N/A";
            finalSprayQty = "N/A";
        } else if (status === "retake_required") {
            finalDisease = reason === "poor_image_quality" ? "Image Quality Issue" : "No Plant Leaf Detected";
            finalCrop = "Unknown";
            finalAdvice = [gateResult.recommendation];
            finalSymptoms = [`Image failed verification: ${reason ? reason.replace(/_/g, " ") : "unreliable quality"}.`];
            finalPrevention = ["Please retake the photo with the leaf centered and in focus."];
            finalSpray = "N/A";
            finalSprayTiming = "N/A";
            finalSprayQty = "N/A";
        }
    }

    // ── Vision-Based Disease Severity Estimation ──────────────────
    const isHealthyDiagnosis = labelKey.toLowerCase().includes("healthy") || diseaseName.toLowerCase().includes("healthy");
    const severityEval = await estimateDiseaseSeverity(vision.processedBuffer || imageBuffer, {
        label: labelKey,
        diseaseName,
        isHealthy: isHealthyDiagnosis
    });

    const finalSeverityString = status === "retake_required"
        ? "N/A"
        : (isConfirmed ? severityEval.visualSummary : `${severityEval.visualSummary} (Uncertain)`);

    console.log(`  • Model Engine:         PyTorch ONNX (crop_disease_model.onnx)`);
    console.log(`  • Vision Severity:      ${severityEval.visualSummary} [${severityEval.stage}]`);
    console.log(`  • Uncertainty Gate:     [${status.toUpperCase()}] ${reason ? `(Reason: ${reason})` : "(All Safety Checks Passed)"}`);
    console.log(`  • Free Energy Score:    ${gateResult.metrics.energyScore} (Max Safe Threshold: ${gateResult.thresholds.maxEnergyScore})`);
    console.log(`  • Prediction Margin:    ${(gateResult.metrics.predictionMargin * 100).toFixed(1)}% (Min Threshold: ${(gateResult.thresholds.predictionMargin * 100).toFixed(1)}%)`);
    console.log(`  • Shannon Entropy:      ${gateResult.metrics.entropy} (Max Threshold: ${gateResult.thresholds.maxEntropy})`);
    console.log(`  • Raw Top Diagnosis:    ${diseaseName} (${confidencePercent}% / ${confidenceFraction})`);
    console.log(`  • Final Status Result:  ${status} -> ${finalDisease}`);
    console.log(`  • Total Latency:        ${vision.pipelineExecutionTimeMs} ms`);
    console.log("======================================================================\n");

    return {
        status: status,
        reason: reason,
        isReliable: isConfirmed,
        isUncertain: !isConfirmed,
        crop: finalCrop,
        disease: finalDisease,
        closestMatch: {
            disease: diseaseName,
            crop: cropName,
            confidence: confidencePercent
        },
        rawDisease: diseaseName,
        confidence: status === "retake_required" ? 0 : confidenceFraction,
        confidencePercent: status === "retake_required" ? 0 : confidencePercent,
        affectedLeaves: (labelKey.toLowerCase().includes("healthy") || diseaseName.toLowerCase().includes("healthy")) ? "0/1" : "1/1",
        multiLeafAnalysis: {
            isMultiLeaf: false,
            totalLeavesDetected: detectedRegions.length || 1,
            validLeavesCount: 1,
            discardedLeavesCount: 0,
            affectedLeavesCount: (labelKey.toLowerCase().includes("healthy") || diseaseName.toLowerCase().includes("healthy")) ? 0 : 1,
            affectedLeavesRatio: (labelKey.toLowerCase().includes("healthy") || diseaseName.toLowerCase().includes("healthy")) ? "0/1" : "1/1",
            prevalencePercent: (labelKey.toLowerCase().includes("healthy") || diseaseName.toLowerCase().includes("healthy")) ? 0 : 100,
            infectionStatus: (labelKey.toLowerCase().includes("healthy") || diseaseName.toLowerCase().includes("healthy")) ? "unaffected" : "affected",
            leafPredictions: [{
                leafId: 1,
                crop: finalCrop,
                disease: finalDisease,
                confidence: confidenceFraction,
                confidencePercent: confidencePercent,
                isHealthy: (labelKey.toLowerCase().includes("healthy") || diseaseName.toLowerCase().includes("healthy")),
                boundingBox: vision.leafDetection.boundingBox
            }]
        },
        uncertaintyMetrics: gateResult.metrics,
        uncertaintyThresholds: gateResult.thresholds,
        imageQuality: {
            valid: vision.quality.valid,
            qualityScore: vision.quality.qualityScore,
            issues: vision.quality.issues || [],
            recommendation: vision.quality.recommendation || ""
        },
        leafDetection: {
            detected: vision.leafDetection.detected,
            confidence: vision.leafDetection.confidence,
            boundingBox: vision.leafDetection.boundingBox,
            regions: vision.leafDetection.regions || [],
            modelType: vision.leafDetection.modelType || "MobileLeafNet-ONNX"
        },
        preprocessing: {
            wasSuppressed: vision.suppression.wasSuppressed,
            isUncertain: vision.suppression.isUncertain || !isConfirmed,
            uncertaintyReason: vision.suppression.uncertaintyReason || reason,
            suppressionMode: vision.suppression.suppressionMode || "passthrough",
            cropBox: vision.suppression.cropBox,
            targetSize: 224,
            storage: vision.suppression.storage,
            comparison: vision.suppression.comparison
        },
        label: isConfirmed ? labelKey : "uncertain",
        causedBy: isConfirmed && info ? info.causedBy : (reason ? `Uncertainty Gate (${reason})` : "Unknown"),
        severity: finalSeverityString,
        severityMetrics: severityEval,
        affectedAreaPercent: severityEval.affectedAreaPercent,
        symptoms: finalSymptoms,
        advice: finalAdvice,
        prevention: finalPrevention,
        spray: finalSpray,
        spray_action_time: finalSprayTiming,
        spray_quantity: finalSprayQty,
        allPredictions: probs
            .map((v, i) => ({
                label: labels[i],
                confidence: parseFloat(v.toFixed(4)),
                confidencePercent: parseFloat((v * 100).toFixed(1))
            }))
            .sort((a, b) => b.confidence - a.confidence)
            .slice(0, 3),
        backend: "onnx",
        visionMetrics: {
            qualityWarnings: vision.quality.warnings || [],
            hasPlantContent: vision.leafDetection.hasPlantContent,
            wasSuppressed: vision.suppression.wasSuppressed,
            isUncertain: !isConfirmed,
            suppressionMode: vision.suppression.suppressionMode || "passthrough",
            cropBox: vision.suppression.cropBox,
            storage: vision.suppression.storage,
            processingTimeMs: vision.pipelineExecutionTimeMs
        }
    };
}

// ── TF.js inference (original — untouched logic) ──────────────
async function classifyTfjs(imageBuffer) {
    if (!model || !mobilenet) throw new Error("AI is warming up.");
    const dataLoader = require("./dataLoader");
    const tensor = await dataLoader.bufferToTensor(imageBuffer);
    try {
        const input = tensor.expandDims(0);
        const features = mobilenet.predict(input);
        const prediction = model.predict(features);
        const output = await prediction.data();
        prediction.dispose(); features.dispose(); input.dispose(); tensor.dispose();

        const outputArr = Array.from(output);
        const maxIndex = outputArr.indexOf(Math.max(...outputArr));
        const info = getDiseaseInfo(labels[maxIndex]);

        // Evaluate uncertainty protection gate
        const gateResult = evaluateUncertainty({
            probs: outputArr,
            labels: labels
        });
        const isConfirmed = gateResult.status === "confirmed";
        const status = gateResult.status;
        const reason = gateResult.reason;

        const diseaseName = isConfirmed
            ? (info ? info.displayName : labels[maxIndex])
            : (reason === "image_out_of_distribution"
                ? "Uncertain - Out of Distribution"
                : (reason === "ambiguous_diagnosis" ? "Uncertain - Ambiguous Symptoms" : "Uncertain - Low Confidence"));

        const cropName = labels[maxIndex] && labels[maxIndex].includes("___")
            ? labels[maxIndex].split("___")[0].replace(/_/g, " ")
            : "Crop";

        return {
            status: status,
            reason: reason,
            isReliable: isConfirmed,
            isUncertain: !isConfirmed,
            crop: (isConfirmed || reason !== "image_out_of_distribution") ? cropName : "Unknown",
            disease: diseaseName,
            label: isConfirmed ? labels[maxIndex] : "uncertain",
            confidence: parseFloat((outputArr[maxIndex] * 100).toFixed(1)),
            confidenceFraction: parseFloat(outputArr[maxIndex].toFixed(4)),
            uncertaintyMetrics: gateResult.metrics,
            causedBy: info ? info.causedBy : "Unknown",
            severity: info ? info.severity : "Moderate",
            symptoms: isConfirmed && info ? info.symptoms : [`Prediction status: ${status} (${reason || "unconfirmed"}).`],
            advice: isConfirmed && info ? info.treatment : [gateResult.recommendation],
            prevention: info ? info.prevention : [],
            spray: isConfirmed && info && info.spray ? info.spray.name : "N/A",
            spray_action_time: isConfirmed && info && info.spray ? info.spray.timing : "N/A",
            spray_quantity: isConfirmed && info && info.spray ? info.spray.quantity : "N/A",
            allPredictions: outputArr
                .map((v, i) => ({ label: labels[i], confidence: parseFloat((v * 100).toFixed(1)) }))
                .sort((a, b) => b.confidence - a.confidence)
                .slice(0, 3),
            backend: "tfjs"
        };
    } catch (err) { if (tensor) tensor.dispose(); throw err; }
}

/**
 * 🔬 Baseline Direct Classifier (No Vision Pipeline, No Quality Check, No OOD Gate)
 * Takes raw image, resizes directly to 224x224, runs ONNX inference, and returns argmax.
 * Used for objective ablation and robustness benchmarking.
 */
async function classifyBaseline(imageBuffer) {
    if (!modelReady) {
        throw new Error("Model is not initialized. Call initClassifier() first.");
    }

    if (usingOnnx && ortSession) {
        const { floatData, tensorShape } = await prepareModelInput(imageBuffer, {
            targetSize: 224,
            layout: "CHW",
            fit: "fill"
        });

        const inputTensor = new ort.Tensor("float32", floatData, tensorShape);
        const results = await ortSession.run({ input: inputTensor });

        const logits = Array.from(results.output.data);
        const maxLogit = Math.max(...logits);
        const expScores = logits.map(v => Math.exp(v - maxLogit));
        const sumExp = expScores.reduce((a, b) => a + b, 0);
        const probs = expScores.map(v => v / sumExp);

        const maxIndex = probs.indexOf(Math.max(...probs));
        const labelKey = labels[maxIndex];
        const info = getDiseaseInfo(labelKey);

        return {
            label: labelKey,
            disease: info ? info.displayName : labelKey,
            predictedIndex: maxIndex,
            confidence: parseFloat(probs[maxIndex].toFixed(4)),
            confidencePercent: parseFloat((probs[maxIndex] * 100).toFixed(1)),
            isRejected: false,
            status: "confirmed"
        };
    } else {
        // TF.js fallback
        const dataLoader = require("./dataLoader");
        const tensor = await dataLoader.bufferToTensor(imageBuffer);
        try {
            const input = tensor.expandDims(0);
            const features = mobilenet.predict(input);
            const prediction = model.predict(features);
            const output = await prediction.data();
            prediction.dispose(); features.dispose(); input.dispose(); tensor.dispose();

            const outputArr = Array.from(output);
            const maxIndex = outputArr.indexOf(Math.max(...outputArr));
            const labelKey = labels[maxIndex];
            const info = getDiseaseInfo(labelKey);

            return {
                label: labelKey,
                disease: info ? info.displayName : labelKey,
                predictedIndex: maxIndex,
                confidence: parseFloat(outputArr[maxIndex].toFixed(4)),
                confidencePercent: parseFloat((outputArr[maxIndex] * 100).toFixed(1)),
                isRejected: false,
                status: "confirmed"
            };
        } catch (err) {
            if (tensor) tensor.dispose();
            throw err;
        }
    }
}

function isReady() { return modelReady; }
module.exports = { initClassifier, classify, classifyBaseline, isReady };
