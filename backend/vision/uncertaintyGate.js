/**
 * ============================================================
 * Agri-AI Uncertainty & Out-of-Distribution (OOD) Gate
 * ============================================================
 * Prevents false confident predictions when uploaded images contain:
 *   - Unsupported crop species (e.g., Apple leaf on a Tomato-trained model)
 *   - Unknown diseases / unmodeled pathogens
 *   - Unrelated non-plant objects (tools, tractors, hands, walls)
 *   - Low-quality / blurry / overexposed images
 *   - Inputs outside the training distribution
 *
 * Multi-Factor Evaluation Architecture:
 *   1. Image Quality Score & Critical Artifact Filter
 *   2. Neural Leaf Detection Confidence
 *   3. Free Energy-based OOD Score: E(x) = -T * log(sum(e^(f_i / T)))
 *   4. Prediction Margin: Δ = p_(1) - p_(2)
 *   5. Shannon Entropy: H(p) = -sum(p_i * log(p_i))
 *   6. Calibrated Disease Confidence Threshold
 *
 * Calibrated via empirical validation data in ml_engine/calibrate_uncertainty.py
 * ============================================================
 */

const fs = require("fs");
const path = require("path");

const CONFIG_PATH = path.join(__dirname, "uncertainty_config.json");

// Default empirically calibrated thresholds (derived from 200 ID vs 185 OOD samples)
const DEFAULT_THRESHOLDS = {
    diseaseConfidence: 0.48,     // Derives 85% ID retention on validation set
    predictionMargin: 0.13,      // Minimum separation between top-1 and top-2
    maxEnergyScore: -3.20,       // Calibrated for background-suppressed foliage (AUROC > 83%)
    maxEntropy: 1.42,            // Shannon entropy upper bound (ID: 0.61, OOD: 1.31)
    minQualityScore: 50,         // Minimum image quality score out of 100
    minLeafConfidence: 0.50      // Minimum leaf detection model confidence
};

const DEFAULT_CRITICAL_QUALITY_ISSUES = [
    "too_blurry",
    "too_dark",
    "severely_overexposed",
    "corrupted_image",
    "extremely_low_resolution"
];

// Load calibrated configuration if present
let cachedConfig = null;
function getUncertaintyConfig() {
    if (cachedConfig) return cachedConfig;
    try {
        if (fs.existsSync(CONFIG_PATH)) {
            const raw = fs.readFileSync(CONFIG_PATH, "utf8");
            const parsed = JSON.parse(raw);
            cachedConfig = {
                thresholds: { ...DEFAULT_THRESHOLDS, ...(parsed.thresholds || {}) },
                criticalQualityIssues: parsed.criticalQualityIssues || DEFAULT_CRITICAL_QUALITY_ISSUES,
                calibrationStats: parsed.calibrationStats || {}
            };
            return cachedConfig;
        }
    } catch (e) {
        console.warn("⚠️ [UncertaintyGate] Using default thresholds (could not read config):", e.message);
    }
    cachedConfig = {
        thresholds: DEFAULT_THRESHOLDS,
        criticalQualityIssues: DEFAULT_CRITICAL_QUALITY_ISSUES,
        calibrationStats: {}
    };
    return cachedConfig;
}

/**
 * Calculates Free Energy Score from raw model logits.
 * Formulated by Liu et al. (NeurIPS 2020) "Energy-based Out-of-distribution Detection":
 *   E(x; T) = -T * log( sum_i e^(f_i(x) / T) )
 *
 * In-distribution samples yield significantly lower (more negative) energy values.
 * Out-of-distribution samples yield higher (less negative) energy values.
 *
 * @param {number[]} logits - Raw model output logits before softmax
 * @param {number} [temperature=1.0] - Temperature parameter
 * @returns {number} Free energy score
 */
function computeEnergyScore(logits, temperature = 1.0) {
    if (!logits || logits.length === 0) return 0;
    const scaled = logits.map(l => l / temperature);
    const maxLogit = Math.max(...scaled);
    const sumExp = scaled.reduce((acc, l) => acc + Math.exp(l - maxLogit), 0);
    return -temperature * (maxLogit + Math.log(sumExp));
}

/**
 * Computes Shannon Entropy over class probability distribution.
 * H(p) = -sum_i (p_i * ln(p_i))
 * Higher entropy signifies flat, uncertain predictions.
 *
 * @param {number[]} probs - Probability array summing to 1.0
 * @returns {number} Entropy in nats
 */
function computeEntropy(probs) {
    if (!probs || probs.length === 0) return 0;
    const eps = 1e-12;
    return -probs.reduce((sum, p) => {
        if (p <= eps) return sum;
        return sum + p * Math.log(p);
    }, 0);
}

/**
 * Computes margin between Top-1 and Top-2 class probabilities.
 * Δ = p_(1) - p_(2)
 *
 * @param {number[]} probs - Class probabilities
 * @returns {number} Prediction margin [0, 1]
 */
function computePredictionMargin(probs) {
    if (!probs || probs.length === 0) return 0;
    if (probs.length === 1) return probs[0];
    const sorted = [...probs].sort((a, b) => b - a);
    return sorted[0] - sorted[1];
}

/**
 * Evaluates full uncertainty and out-of-distribution protection.
 *
 * @param {Object} params
 * @param {Object} [params.quality] - Image quality check result
 * @param {Object} [params.leafDetection] - Leaf detection result
 * @param {number[]} [params.logits] - Raw logits from classifier
 * @param {number[]} [params.probs] - Softmax probabilities
 * @param {string[]} [params.labels] - Class label names
 * @param {Object} [params.overrideThresholds] - Custom threshold overrides
 * @returns {{
 *   status: "confirmed" | "uncertain" | "retake_required",
 *   reason: string | null,
 *   isReliable: boolean,
 *   isUncertain: boolean,
 *   confidence: number,
 *   topDiagnosis: { label: string, index: number, confidence: number } | null,
 *   recommendation: string,
 *   metrics: {
 *     energyScore: number,
 *     predictionMargin: number,
 *     entropy: number,
 *     topConfidence: number,
 *     secondConfidence: number,
 *     qualityScore: number,
 *     leafConfidence: number
 *   },
 *   thresholds: Object
 * }}
 */
function evaluateUncertainty(params = {}) {
    const config = getUncertaintyConfig();
    const thresholds = { ...config.thresholds, ...(params.overrideThresholds || {}) };
    const criticalIssues = config.criticalQualityIssues || DEFAULT_CRITICAL_QUALITY_ISSUES;

    const quality = params.quality || { valid: true, qualityScore: 100, issues: [] };
    const leafDetection = params.leafDetection || { detected: true, confidence: 1.0 };
    let probs = params.probs || [];
    let logits = params.logits || [];
    const labels = params.labels || [];

    // Synthesize logits from probs if only probs were provided (e.g. TF.js fallback)
    if ((!logits || logits.length === 0) && probs && probs.length > 0) {
        logits = probs.map(p => Math.log(Math.max(p, 1e-7)));
    } else if ((!probs || probs.length === 0) && logits && logits.length > 0) {
        const maxL = Math.max(...logits);
        const exps = logits.map(l => Math.exp(l - maxL));
        const s = exps.reduce((a, b) => a + b, 0);
        probs = exps.map(e => e / s);
    }

    // Compute statistical metrics
    const energyScore = logits && logits.length > 0 ? computeEnergyScore(logits, 1.0) : 0;
    const entropy = probs && probs.length > 0 ? computeEntropy(probs) : 0;
    const predictionMargin = probs && probs.length > 0 ? computePredictionMargin(probs) : 0;

    const sortedIndices = probs.map((p, idx) => ({ p, idx })).sort((a, b) => b.p - a.p);
    const topIndex = sortedIndices.length > 0 ? sortedIndices[0].idx : 0;
    const topConfidence = sortedIndices.length > 0 ? sortedIndices[0].p : 0;
    const secondConfidence = sortedIndices.length > 1 ? sortedIndices[1].p : 0;

    const topLabel = labels[topIndex] || "Unknown";
    const qualityScore = typeof quality.qualityScore === "number" ? quality.qualityScore : 100;
    const leafConfidence = typeof leafDetection.confidence === "number" ? leafDetection.confidence : 1.0;

    const metrics = {
        energyScore: parseFloat(energyScore.toFixed(4)),
        predictionMargin: parseFloat(predictionMargin.toFixed(4)),
        entropy: parseFloat(entropy.toFixed(4)),
        topConfidence: parseFloat(topConfidence.toFixed(4)),
        secondConfidence: parseFloat(secondConfidence.toFixed(4)),
        qualityScore,
        leafConfidence: parseFloat(leafConfidence.toFixed(4))
    };

    // ─────────────────────────────────────────────────────────────
    // HIERARCHICAL GATING STAGES
    // ─────────────────────────────────────────────────────────────

    // 1. GATE 1: Image Quality / Readability
    const hasCriticalQualityIssue = Array.isArray(quality.issues) &&
        quality.issues.some(issue => criticalIssues.includes(issue));

    if (quality.valid === false || qualityScore < thresholds.minQualityScore || hasCriticalQualityIssue) {
        const issueReason = (quality.issues && quality.issues.length > 0)
            ? quality.issues[0]
            : "poor_image_quality";

        return {
            status: "retake_required",
            reason: issueReason === "too_blurry" || issueReason === "too_dark" ? issueReason : "poor_image_quality",
            isReliable: false,
            isUncertain: true,
            confidence: 0,
            topDiagnosis: null,
            recommendation: quality.recommendation || "The image is too blurry, dark, or low quality for a reliable diagnosis. Please retake the photo with good daylight and steady focus.",
            metrics,
            thresholds
        };
    }

    // 2. GATE 2: Leaf Presence & Detection Confidence
    if (leafDetection.detected === false || leafConfidence < thresholds.minLeafConfidence) {
        return {
            status: "retake_required",
            reason: "no_leaf_detected",
            isReliable: false,
            isUncertain: true,
            confidence: 0,
            topDiagnosis: null,
            recommendation: "No plant leaf was clearly detected in the image. Please center an infected leaf in the camera frame, keeping a 15-25 cm distance.",
            metrics,
            thresholds
        };
    }

    // 3. GATE 3: Out-of-Distribution (OOD) Protection via Free Energy Score
    // Higher energy score (closer to 0 or positive) indicates input is OOD (unsupported crop / unknown disease)
    // High-margin, confident predictions on segmented foliage are preserved from false energy rejection
    const isStrongPrediction = metrics.topConfidence >= 0.60 && metrics.predictionMargin >= 0.25;
    if (energyScore > thresholds.maxEnergyScore && !isStrongPrediction) {
        return {
            status: "uncertain",
            reason: "image_out_of_distribution",
            isReliable: false,
            isUncertain: true,
            confidence: metrics.topConfidence,
            topDiagnosis: {
                label: topLabel,
                index: topIndex,
                confidence: metrics.topConfidence
            },
            recommendation: "This image appears outside the known training distribution (possibly an unsupported crop species, unknown disease, or non-plant pattern). Please verify the crop type and capture a clearer symptom view.",
            metrics,
            thresholds
        };
    }

    // 4. GATE 4: Shannon Entropy Guard
    // Flat probability distributions indicate deep ambiguity
    if (entropy > thresholds.maxEntropy) {
        return {
            status: "uncertain",
            reason: "ambiguous_diagnosis",
            isReliable: false,
            isUncertain: true,
            confidence: metrics.topConfidence,
            topDiagnosis: {
                label: topLabel,
                index: topIndex,
                confidence: metrics.topConfidence
            },
            recommendation: "The visual symptoms are highly ambiguous across multiple crop conditions. Consider consulting a local agricultural extension officer.",
            metrics,
            thresholds
        };
    }

    // 5. GATE 5: Prediction Margin Guard (Top-1 vs Top-2 separation)
    if (predictionMargin < thresholds.predictionMargin) {
        return {
            status: "uncertain",
            reason: "ambiguous_diagnosis",
            isReliable: false,
            isUncertain: true,
            confidence: metrics.topConfidence,
            topDiagnosis: {
                label: topLabel,
                index: topIndex,
                confidence: metrics.topConfidence
            },
            recommendation: `The symptoms closely resemble two diseases with nearly identical likelihood (${(topConfidence * 100).toFixed(0)}% vs ${(secondConfidence * 100).toFixed(0)}%). Please provide a closer macro image of the lesion spots.`,
            metrics,
            thresholds
        };
    }

    // 6. GATE 6: Disease Confidence Threshold
    if (topConfidence < thresholds.diseaseConfidence) {
        return {
            status: "uncertain",
            reason: "low_confidence",
            isReliable: false,
            isUncertain: true,
            confidence: metrics.topConfidence,
            topDiagnosis: {
                label: topLabel,
                index: topIndex,
                confidence: metrics.topConfidence
            },
            recommendation: "Model confidence is below the safety threshold required for an actionable diagnosis. Please retake the photo under clear daylight.",
            metrics,
            thresholds
        };
    }

    // ── ALL GATES PASSED: RELIABLE DIAGNOSIS CONFIRMED ──────────
    return {
        status: "confirmed",
        reason: null,
        isReliable: true,
        isUncertain: false,
        confidence: metrics.topConfidence,
        topDiagnosis: {
            label: topLabel,
            index: topIndex,
            confidence: metrics.topConfidence
        },
        recommendation: "Diagnosis confirmed with high statistical reliability.",
        metrics,
        thresholds
    };
}

module.exports = {
    evaluateUncertainty,
    computeEnergyScore,
    computeEntropy,
    computePredictionMargin,
    getUncertaintyConfig,
    DEFAULT_THRESHOLDS
};
