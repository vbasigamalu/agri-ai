/**
 * ============================================================
 * Agri-AI Robust Vision Pipeline — Modular Entry Point
 * ============================================================
 * Orchestrates the multi-stage visual preprocessing pipeline:
 *
 *   Farmer Image
 *        ↓
 *   1. Image Quality Check           (qualityCheck.js)
 *        ↓
 *   2. Leaf Detection / Saliency     (leafDetector.js)
 *        ↓
 *   3. Background Suppression        (backgroundSuppressor.js)
 *        ↓
 *   4. Crop + Resize + Normalize     (preprocessor.js)
 *        ↓
 *   Clean Normalized Tensor → Sent to Disease Classifier
 *
 * Guarantees:
 * - Asynchronous & non-blocking execution
 * - Zero hardcoded paths
 * - Graceful fallback on edge cases (ensuring classifier never crashes)
 * ============================================================
 */

const { checkImageQuality } = require("./qualityCheck");
const { detectLeafRegion } = require("./leafDetector");
const { suppressBackground } = require("./backgroundSuppressor");
const { prepareModelInput } = require("./preprocessor");

/**
 * Runs the end-to-end vision pipeline on an incoming image buffer.
 *
 * @param {Buffer} imageBuffer - Raw image upload from farmer
 * @param {Object} [options] - Pipeline options
 * @param {boolean} [options.enableQualityCheck=true]
 * @param {boolean} [options.enableDetection=true]
 * @param {boolean} [options.enableSuppression=true]
 * @param {number} [options.targetSize=224]
 * @param {string} [options.layout="CHW"]
 * @returns {Promise<{
 *   tensorData: Float32Array,
 *   tensorShape: number[],
 *   quality: { pass: boolean, warnings: string[], metrics: Object },
 *   leafDetection: { hasPlantContent: boolean, confidence: number, boundingBox: Object, detectorType: string },
 *   suppression: { wasSuppressed: boolean, cropBox: Object | null },
 *   processedBuffer: Buffer,
 *   pipelineExecutionTimeMs: number
 * }>}
 */
async function runVisionPipeline(imageBuffer, options = {}) {
    const startTime = Date.now();

    const {
        enableQualityCheck = true,
        enableDetection = true,
        enableSuppression = true,
        targetSize = 224,
        layout = "CHW"
    } = options;

    let qualityResult = { valid: true, qualityScore: 100, issues: [], recommendation: "", metrics: {} };
    let detectionResult = { hasPlantContent: true, confidence: 1.0, boundingBox: null, detectorType: "passthrough" };
    let suppressionResult = { wasSuppressed: false, cropBox: null, processedBuffer: imageBuffer };

    try {
        // Stage 1: Quality Check
        if (enableQualityCheck) {
            qualityResult = await checkImageQuality(imageBuffer);
            if (!qualityResult.valid) {
                return {
                    tensorData: null,
                    tensorShape: null,
                    quality: qualityResult,
                    leafDetection: { detected: false, confidence: 0, boundingBox: null, regions: [] },
                    suppression: { wasSuppressed: false, cropBox: null, isUncertain: true, suppressionMode: "quality_rejected" },
                    processedBuffer: null,
                    pipelineExecutionTimeMs: Date.now() - startTime,
                    safeFailure: true,
                    status: "retake_required",
                    isUncertain: true,
                    reason: "image_quality_failed",
                    message: qualityResult.recommendation || "The image quality is too low for reliable disease diagnosis."
                };
            }
        }

        // Stage 2: Leaf Detection & Neural Segmentation
        if (enableDetection) {
            detectionResult = await detectLeafRegion(imageBuffer);
            
            // 🛡️ Safe Failure Gate: If no reliable leaf detected, halt pipeline early
            if (detectionResult.detected === false) {
                return {
                    tensorData: null,
                    tensorShape: null,
                    quality: qualityResult,
                    leafDetection: detectionResult,
                    suppression: { wasSuppressed: false, cropBox: null, isUncertain: true, suppressionMode: "leaf_not_detected" },
                    processedBuffer: null,
                    pipelineExecutionTimeMs: Date.now() - startTime,
                    safeFailure: true,
                    status: "retake_required",
                    isUncertain: true,
                    reason: detectionResult.reason || "no_leaf_detected",
                    message: detectionResult.message || "No reliable plant leaf detected in the image. Please center an infected leaf in the frame."
                };
            }
        }

        // Stage 3: Background Suppression (Tight Crop & Masked Leaf)
        if (enableSuppression && detectionResult.boundingBox) {
            suppressionResult = await suppressBackground(imageBuffer, detectionResult, {
                targetSize,
                uncertaintyThreshold: options.uncertaintyThreshold || 0.55,
                marginRatio: options.marginRatio || 0.08,
                persist: options.persist !== undefined ? options.persist : true,
                activeOutput: options.activeOutput || "masked",
                verboseLogging: options.verboseLogging !== undefined ? options.verboseLogging : true
            });
        }

        // Stage 4: Crop, Resize & Normalize
        const tensorBuffer = suppressionResult.processedBuffer || imageBuffer;
        const modelInput = await prepareModelInput(tensorBuffer, { targetSize, layout, fit: "contain" });

        const elapsedTime = Date.now() - startTime;

        return {
            tensorData: modelInput.floatData,
            tensorShape: modelInput.tensorShape,
            quality: qualityResult,
            leafDetection: detectionResult,
            suppression: {
                wasSuppressed: suppressionResult.wasSuppressed,
                isUncertain: suppressionResult.isUncertain || false,
                uncertaintyReason: suppressionResult.uncertaintyReason || null,
                suppressionMode: suppressionResult.suppressionMode || "passthrough",
                cropBox: suppressionResult.cropBox,
                tightCropBuffer: suppressionResult.tightCropBuffer,
                maskedBuffer: suppressionResult.maskedBuffer,
                storage: suppressionResult.storage,
                comparison: suppressionResult.comparison
            },
            processedBuffer: tensorBuffer,
            pipelineExecutionTimeMs: elapsedTime
        };

    } catch (pipelineErr) {
        // 🛡️ Controlled Uncertainty Gate: Never silently fall back to an unreliable prediction
        console.warn("⚠️ [Vision Pipeline] Preprocessing stage failed, returning controlled uncertainty response:", pipelineErr.message);

        return {
            tensorData: null,
            tensorShape: null,
            quality: qualityResult,
            leafDetection: detectionResult,
            suppression: {
                wasSuppressed: false,
                isUncertain: true,
                uncertaintyReason: pipelineErr.message,
                suppressionMode: "failed",
                cropBox: null
            },
            processedBuffer: null,
            pipelineExecutionTimeMs: Date.now() - startTime,
            safeFailure: true,
            status: "uncertain",
            isUncertain: true,
            reason: "preprocessing_failed",
            message: `Visual preprocessing could not isolate the leaf: ${pipelineErr.message}. Please retake the photo.`
        };
    }
}

const {
    evaluateUncertainty,
    computeEnergyScore,
    computeEntropy,
    computePredictionMargin,
    getUncertaintyConfig
} = require("./uncertaintyGate");

const {
    filterCandidateLeaves,
    cropAndPreprocessLeaf,
    aggregateMultiLeafPredictions
} = require("./multiLeafAggregator");

const {
    estimateDiseaseSeverity
} = require("./severityEstimator");

module.exports = {
    runVisionPipeline,
    checkImageQuality,
    detectLeafRegion,
    suppressBackground,
    prepareModelInput,
    evaluateUncertainty,
    computeEnergyScore,
    computeEntropy,
    computePredictionMargin,
    getUncertaintyConfig,
    filterCandidateLeaves,
    cropAndPreprocessLeaf,
    aggregateMultiLeafPredictions,
    estimateDiseaseSeverity
};

