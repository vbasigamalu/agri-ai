/**
 * ============================================================
 * Agri-AI Uncertainty & Out-of-Distribution (OOD) Test Suite
 * ============================================================
 * Validates the practical uncertainty mechanism:
 *   1. Disease confidence threshold
 *   2. Prediction margin between top classes
 *   3. Image quality score & critical artifacts
 *   4. Leaf detection confidence
 *   5. Free Energy-based OOD score & Shannon entropy
 *
 * Expected statuses:
 *   - "confirmed"       (In-distribution leaf, high confidence, reliable)
 *   - "uncertain"       (Out-of-distribution crop, ambiguous diagnosis, low confidence)
 *   - "retake_required" (Poor image quality, no leaf detected)
 *
 * Run: node backend/vision/test_uncertainty_protection.js
 * ============================================================
 */

const path = require("path");
const fs = require("fs");
const sharp = require("sharp");
const { initClassifier, classify } = require("../classifier");
const {
    evaluateUncertainty,
    computeEnergyScore,
    computeEntropy,
    computePredictionMargin,
    getUncertaintyConfig
} = require("./uncertaintyGate");

async function runTests() {
    console.log("\n=================================================================");
    console.log("🛡️  AGRI-AI UNCERTAINTY & OOD PROTECTION LAYER TEST SUITE");
    console.log("=================================================================\n");

    let totalTests = 0;
    let passedTests = 0;

    function assert(condition, message) {
        totalTests++;
        if (condition) {
            console.log(`  ✅ PASS: ${message}`);
            passedTests++;
        } else {
            console.error(`  ❌ FAIL: ${message}`);
        }
    }

    // ─────────────────────────────────────────────────────────────
    // PART 1: Mathematical Unit Tests for OOD & Statistical Metrics
    // ─────────────────────────────────────────────────────────────
    console.log("[Part 1] Mathematical & Metric Unit Tests");

    // 1.1 Free Energy Score computation
    const inDistLogits = [7.5, 2.1, 1.0, 0.5, 0.2, 0.1, 0.0, 0.0, 0.0, 0.0];
    const oodLogits = [1.2, 1.1, 1.0, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3];
    const inDistEnergy = computeEnergyScore(inDistLogits, 1.0);
    const oodEnergy = computeEnergyScore(oodLogits, 1.0);

    assert(inDistEnergy < oodEnergy, `In-Distribution energy (${inDistEnergy.toFixed(2)}) < OOD energy (${oodEnergy.toFixed(2)})`);
    assert(computeEnergyScore([0, 0]) === -Math.log(2), `Free energy of [0, 0] equals -ln(2) = ${-Math.log(2).toFixed(4)}`);

    // 1.2 Shannon Entropy
    const confidentProbs = [0.95, 0.05];
    const flatProbs = [0.5, 0.5];
    const lowEntropy = computeEntropy(confidentProbs);
    const highEntropy = computeEntropy(flatProbs);
    assert(lowEntropy < highEntropy, `Confident entropy (${lowEntropy.toFixed(3)}) < Flat entropy (${highEntropy.toFixed(3)})`);

    // 1.3 Prediction Margin
    const margin = computePredictionMargin([0.75, 0.20, 0.05]);
    assert(Math.abs(margin - 0.55) < 1e-4, `Prediction margin correct: 0.75 - 0.20 = ${margin.toFixed(2)}`);

    // 1.4 Threshold config loading
    const config = getUncertaintyConfig();
    assert(config && config.thresholds, "Calibrated uncertainty configuration loaded successfully");
    assert(typeof config.thresholds.diseaseConfidence === "number", `Calibrated diseaseConfidence: ${config.thresholds.diseaseConfidence}`);
    assert(typeof config.thresholds.maxEnergyScore === "number", `Calibrated maxEnergyScore: ${config.thresholds.maxEnergyScore}`);
    assert(typeof config.thresholds.predictionMargin === "number", `Calibrated predictionMargin: ${config.thresholds.predictionMargin}`);

    // ─────────────────────────────────────────────────────────────
    // PART 2: Uncertainty Evaluation Logic Gate Tests
    // ─────────────────────────────────────────────────────────────
    console.log("\n[Part 2] Hierarchical Gating Decision Logic Tests");

    // 2.1 Gate: Confirmed when all signals pass
    const confirmedEval = evaluateUncertainty({
        quality: { valid: true, qualityScore: 92, issues: [] },
        leafDetection: { detected: true, confidence: 0.88 },
        logits: [6.8, 2.0, 1.1, 0.5, 0.2, 0.1, 0.0, 0.0, 0.0, 0.0],
        labels: ["Tomato___Early_blight", "Tomato___Late_blight", "Tomato___healthy"]
    });
    assert(confirmedEval.status === "confirmed", `All checks pass -> status: "confirmed" (Got: "${confirmedEval.status}")`);
    assert(confirmedEval.reason === null, "Confirmed diagnosis has null reason");
    assert(confirmedEval.isReliable === true, "isReliable is true on confirmed");
    assert(confirmedEval.isUncertain === false, "isUncertain is false on confirmed");

    // 2.2 Gate: Out-of-Distribution Energy Threshold Trigger
    const oodEval = evaluateUncertainty({
        quality: { valid: true, qualityScore: 85, issues: [] },
        leafDetection: { detected: true, confidence: 0.78 },
        logits: [1.2, 1.1, 1.0, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3], // High energy (-3.11 > -3.82 threshold)
        labels: ["Tomato___Early_blight", "Tomato___Late_blight", "Tomato___healthy"]
    });
    assert(oodEval.status === "uncertain", `High energy score -> status: "uncertain" (Got: "${oodEval.status}")`);
    assert(oodEval.reason === "image_out_of_distribution", `Reason is "image_out_of_distribution" (Got: "${oodEval.reason}")`);
    assert(oodEval.isReliable === false, "isReliable is false on OOD");

    // 2.3 Gate: Ambiguous Prediction Margin Trigger
    const ambiguousEval = evaluateUncertainty({
        quality: { valid: true, qualityScore: 85, issues: [] },
        leafDetection: { detected: true, confidence: 0.80 },
        // High confidence top two but virtually tied: margin = 0.03 < 0.13
        probs: [0.49, 0.46, 0.05],
        labels: ["Tomato___Early_blight", "Tomato___Late_blight", "Tomato___healthy"],
        overrideThresholds: { maxEnergyScore: 10.0 } // bypass energy to test margin
    });
    assert(ambiguousEval.status === "uncertain", `Narrow margin -> status: "uncertain" (Got: "${ambiguousEval.status}")`);
    assert(ambiguousEval.reason === "ambiguous_diagnosis", `Reason is "ambiguous_diagnosis" (Got: "${ambiguousEval.reason}")`);

    // 2.4 Gate: Poor Image Quality Trigger
    const qualityEval = evaluateUncertainty({
        quality: { valid: false, qualityScore: 28, issues: ["too_blurry", "too_dark"], recommendation: "Retake in sunlight" },
        leafDetection: { detected: true, confidence: 0.75 },
        logits: inDistLogits,
        labels: ["Tomato___Early_blight"]
    });
    assert(qualityEval.status === "retake_required", `Poor quality -> status: "retake_required" (Got: "${qualityEval.status}")`);
    assert(qualityEval.reason === "too_blurry" || qualityEval.reason === "poor_image_quality", `Reason indicates quality issue (Got: "${qualityEval.reason}")`);
    assert(qualityEval.confidence === 0, `Confidence is 0 on retake_required (Got: ${qualityEval.confidence})`);

    // 2.5 Gate: Leaf Not Detected Trigger
    const noLeafEval = evaluateUncertainty({
        quality: { valid: true, qualityScore: 85, issues: [] },
        leafDetection: { detected: false, confidence: 0.15 },
        logits: inDistLogits,
        labels: ["Tomato___Early_blight"]
    });
    assert(noLeafEval.status === "retake_required", `No leaf detected -> status: "retake_required" (Got: "${noLeafEval.status}")`);
    assert(noLeafEval.reason === "no_leaf_detected", `Reason is "no_leaf_detected" (Got: "${noLeafEval.reason}")`);

    // ─────────────────────────────────────────────────────────────
    // PART 3: End-to-End Image Pipeline Integration Tests
    // ─────────────────────────────────────────────────────────────
    console.log("\n[Part 3] End-to-End Pipeline Inference Tests");
    await initClassifier();

    // 3.1 Valid In-Distribution Tomato Leaf
    console.log("\n  [Test 3.1] In-Distribution Tomato Leaf Diagnosis:");
    const tomatoLeafPath = path.join(__dirname, "..", "dataset", "Tomato___Early_blight", "0012b9d2-2130-4a06-a834-b1f3af34f57e___RS_Erly.B 8389.JPG");
    if (fs.existsSync(tomatoLeafPath)) {
        const tomatoBuf = fs.readFileSync(tomatoLeafPath);
        const result = await classify(tomatoBuf);

        assert(result.status === "confirmed", `Status is "confirmed" on valid tomato leaf (Got: "${result.status}")`);
        assert(result.reason === null, `Reason is null on confirmed diagnosis (Got: ${result.reason})`);
        assert(result.isReliable === true, "isReliable is true");
        assert(typeof result.disease === "string" && result.disease.toLowerCase().includes("blight"), `Disease diagnosed: "${result.disease}"`);
        assert(result.confidence > 0.48, `Confidence (${result.confidence}) exceeds calibrated threshold (0.48)`);
        assert(result.uncertaintyMetrics !== null, "uncertaintyMetrics attached to confirmed result");
        assert(result.uncertaintyMetrics.energyScore !== null, `Energy score reported: ${result.uncertaintyMetrics.energyScore}`);
        assert(result.uncertaintyMetrics.predictionMargin > 0.13, `Prediction margin (${(result.uncertaintyMetrics.predictionMargin * 100).toFixed(1)}%) exceeds threshold (13%)`);
    }

    // 3.2 Out-of-Distribution Unsupported Crop (Apple Leaf against Tomato Model)
    console.log("\n  [Test 3.2] Out-of-Distribution Crop Protection (Apple Scab on Tomato Model):");
    const appleScabPath = path.join(__dirname, "..", "dataset", "Apple___Apple_scab", "00075aa8-d81a-4184-8541-b692b78d398a___FREC_Scab 3335.JPG");
    if (fs.existsSync(appleScabPath)) {
        const appleBuf = fs.readFileSync(appleScabPath);
        const oodResult = await classify(appleBuf);

        assert(oodResult.status === "uncertain", `Unsupported crop rejected as "uncertain" (Got: "${oodResult.status}")`);
        assert(oodResult.reason === "image_out_of_distribution" || oodResult.reason === "ambiguous_diagnosis" || oodResult.reason === "low_confidence", `Reason indicates uncertainty (Got: "${oodResult.reason}")`);
        assert(oodResult.isReliable === false, "isReliable is false on unsupported crop");
        assert(oodResult.disease.includes("Uncertain"), `Protected disease string: "${oodResult.disease}"`);
    }

    // 3.2b Out-of-Distribution Pattern (Synthetic Non-Agricultural Texture)
    console.log("\n  [Test 3.2b] Out-of-Distribution Pattern Detection (Synthetic Frequency Pattern):");
    const width = 256, height = 256;
    const oodPatternBuf = Buffer.alloc(width * height * 3);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 3;
            const c = ((Math.floor(x / 16) + Math.floor(y / 16)) % 2 === 0) ? 140 : 80;
            oodPatternBuf[idx] = c;
            oodPatternBuf[idx + 1] = c + 40;
            oodPatternBuf[idx + 2] = c;
        }
    }
    const oodPatternPng = await sharp(oodPatternBuf, { raw: { width, height, channels: 3 } }).png().toBuffer();
    const patternResult = await classify(oodPatternPng);

    assert(patternResult.status === "uncertain", `OOD texture triggers status: "uncertain" (Got: "${patternResult.status}")`);
    assert(patternResult.reason === "image_out_of_distribution", `Energy Gate catches OOD pattern: "${patternResult.reason}"`);
    assert(patternResult.isReliable === false, "isReliable is false for OOD pattern");

    // 3.3 Unrelated Non-Plant Object (Tractor / Red Metal Sheet)
    console.log("\n  [Test 3.3] Unrelated Object Protection (Red Metal Sheet):");
    const nonPlantBuf = Buffer.alloc(256 * 256 * 3);
    for (let i = 0; i < 256 * 256; i++) {
        nonPlantBuf[i * 3]     = 210; // Red
        nonPlantBuf[i * 3 + 1] = 30;  // Green
        nonPlantBuf[i * 3 + 2] = 30;  // Blue
    }
    const nonPlantPng = await sharp(nonPlantBuf, { raw: { width: 256, height: 256, channels: 3 } }).png().toBuffer();
    const nonPlantResult = await classify(nonPlantPng);

    assert(nonPlantResult.status === "retake_required" || nonPlantResult.status === "uncertain",
        `Non-plant object rejected (Status: "${nonPlantResult.status}")`);
    assert(nonPlantResult.isReliable === false, "isReliable is false on non-plant object");
    assert(nonPlantResult.confidence === 0, `Confidence is 0 on non-plant rejection (Got: ${nonPlantResult.confidence})`);

    // 3.4 Severely Degraded / Blurry Image
    console.log("\n  [Test 3.4] Degraded Image Protection (Severe Blur):");
    const blurryBuf = await sharp({
        create: { width: 256, height: 256, channels: 3, background: { r: 100, g: 100, b: 100 } }
    }).png().toBuffer();
    const blurryResult = await classify(blurryBuf);

    assert(blurryResult.status === "retake_required", `Severe blur triggers status: "retake_required" (Got: "${blurryResult.status}")`);
    assert(blurryResult.reason === "poor_image_quality" || blurryResult.reason === "too_blurry", `Reason indicates poor quality (Got: "${blurryResult.reason}")`);
    assert(blurryResult.confidence === 0, `Confidence is 0 on poor quality (Got: ${blurryResult.confidence})`);

    console.log("\n=================================================================");
    console.log(`📊 TEST SUITE COMPLETE: ${passedTests} / ${totalTests} PASSED`);
    console.log("=================================================================\n");

    if (passedTests === totalTests) {
        process.exit(0);
    } else {
        process.exit(1);
    }
}

runTests().catch(err => {
    console.error("Test execution failed:", err);
    process.exit(1);
});
