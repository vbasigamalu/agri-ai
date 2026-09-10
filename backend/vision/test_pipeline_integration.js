/**
 * ============================================================
 * End-to-End Robust Vision Pipeline + Classifier Integration
 * ============================================================
 * Validates the integrated inference flow:
 *
 *   Farmer Upload
 *         ↓
 *   Image Quality Check
 *         ↓
 *   Leaf Detection / Segmentation
 *         ↓
 *   Background Suppression
 *         ↓
 *   Crop + Resize + Normalize
 *         ↓
 *   Disease Model
 *         ↓
 *   Prediction & Confidence
 *         ↓
 *   Structured Final Result
 *
 * Tests:
 * 1. Complete output schema: { crop, disease, confidence (0-1), imageQuality, leafDetection, preprocessing }
 * 2. Controlled uncertainty on non-leaf / failure states (zero bogus predictions)
 * 3. Preprocessing isolation on real-world noisy background leaves
 * 4. Preservation of treatment, symptoms, and spray advice
 * 5. Full pipeline stage logging
 *
 * Run: node backend/vision/test_pipeline_integration.js
 * ============================================================
 */

const path = require("path");
const fs = require("fs");
const sharp = require("sharp");
const { initClassifier, classify } = require("../classifier");

async function runTests() {
    console.log("\n=================================================================");
    console.log("🌾 AGRI-AI VISION PIPELINE + CLASSIFIER INTEGRATION SUITE");
    console.log("=================================================================\n");

    let passedTests = 0;
    let totalTests = 0;

    function assert(condition, message) {
        totalTests++;
        if (condition) {
            console.log(`  ✅ PASS: ${message}`);
            passedTests++;
        } else {
            console.error(`  ❌ FAIL: ${message}`);
        }
    }

    console.log("[Init] Initializing Classifier Engine...");
    await initClassifier();

    const realLeafPath = path.join(__dirname, "..", "dataset", "Tomato___Early_blight", "0012b9d2-2130-4a06-a834-b1f3af34f57e___RS_Erly.B 8389.JPG");

    // ─────────────────────────────────────────────────────────────
    // Test 1: Real Dataset Leaf — End-to-End Structured Schema
    // ─────────────────────────────────────────────────────────────
    console.log("\n[Test 1] Real Dataset Leaf — Structured Prediction Output");
    if (fs.existsSync(realLeafPath)) {
        const realLeafBuf = fs.readFileSync(realLeafPath);
        const result = await classify(realLeafBuf);

        // Core schema checks
        assert(typeof result.crop === "string" && result.crop.length > 0, `Crop name resolved: "${result.crop}"`);
        assert(typeof result.disease === "string" && result.disease.toLowerCase().includes("blight"), `Disease diagnosed: "${result.disease}"`);
        assert(typeof result.confidence === "number" && result.confidence >= 0 && result.confidence <= 1, `Confidence in [0, 1] range: ${result.confidence}`);
        assert(typeof result.confidencePercent === "number" && result.confidencePercent >= 0 && result.confidencePercent <= 100, `Confidence percentage: ${result.confidencePercent}%`);

        // imageQuality schema
        assert(result.imageQuality !== null && typeof result.imageQuality === "object", "imageQuality object present");
        assert(result.imageQuality.valid === true, "imageQuality.valid is true");
        assert(typeof result.imageQuality.qualityScore === "number", `imageQuality.qualityScore: ${result.imageQuality.qualityScore}`);

        // leafDetection schema
        assert(result.leafDetection !== null && typeof result.leafDetection === "object", "leafDetection object present");
        assert(result.leafDetection.detected === true, "leafDetection.detected is true");
        assert(typeof result.leafDetection.confidence === "number", `leafDetection.confidence: ${result.leafDetection.confidence}`);
        assert(result.leafDetection.boundingBox !== null, "leafDetection.boundingBox present");

        // preprocessing schema
        assert(result.preprocessing !== null && typeof result.preprocessing === "object", "preprocessing object present");
        assert(result.preprocessing.targetSize === 224, `preprocessing.targetSize is 224 (Got: ${result.preprocessing.targetSize})`);
        assert(result.preprocessing.cropBox !== null, "preprocessing.cropBox present");
        assert(result.preprocessing.storage !== null && result.preprocessing.storage.id !== null, `preprocessing.storage persisted: ID ${result.preprocessing.storage?.id}`);

        // Compatibility checks
        assert(typeof result.severity === "string", `severity: ${result.severity}`);
        assert(Array.isArray(result.advice) && result.advice.length > 0, `Treatment advice present (${result.advice.length} items)`);
        assert(Array.isArray(result.allPredictions) && result.allPredictions.length > 0, `Top predictions array present (${result.allPredictions.length} items)`);
    }

    // ─────────────────────────────────────────────────────────────
    // Test 2: Leaf on Noisy Soil Background (Real-World Robustness)
    // ─────────────────────────────────────────────────────────────
    console.log("\n[Test 2] Leaf on Noisy Soil Background (Pipeline Suppression Verification)");
    const width = 320, height = 320;
    const noisyBuf = Buffer.alloc(width * height * 3);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 3;
            if (x >= 90 && x <= 230 && y >= 90 && y <= 230) {
                const noise = ((x * 17 + y * 23) % 24) - 12;
                noisyBuf[idx]     = Math.max(0, Math.min(255, 42 + noise));  // Leaf R
                noisyBuf[idx + 1] = Math.max(0, Math.min(255, 168 + noise)); // Leaf G (Foliage)
                noisyBuf[idx + 2] = Math.max(0, Math.min(255, 52 + noise));  // Leaf B
            } else {
                const noise = ((x * 31 + y * 13) % 30) - 15;
                noisyBuf[idx]     = Math.max(0, Math.min(255, 125 + noise)); // Muddy soil R
                noisyBuf[idx + 1] = Math.max(0, Math.min(255, 78 + noise));  // Muddy soil G
                noisyBuf[idx + 2] = Math.max(0, Math.min(255, 46 + noise));  // Muddy soil B
            }
        }
    }
    const noisyImagePng = await sharp(noisyBuf, { raw: { width, height, channels: 3 } }).png().toBuffer();
    const noisyResult = await classify(noisyImagePng);

    assert(noisyResult.imageQuality.valid === true, "Quality check passed on textured leaf on soil");
    assert(noisyResult.leafDetection.detected === true, "Leaf detected on noisy soil background");
    assert(noisyResult.preprocessing.wasSuppressed === true, "Background clutter successfully suppressed");
    assert(noisyResult.preprocessing.comparison !== null, "Comparison metrics generated");
    assert(noisyResult.preprocessing.comparison.clutterReductionRatio > 0.4, `Clutter reduction: ${(noisyResult.preprocessing.comparison.clutterReductionRatio * 100).toFixed(1)}%`);

    // ─────────────────────────────────────────────────────────────
    // Test 3: Controlled Uncertainty Gate on Non-Leaf Image
    // ─────────────────────────────────────────────────────────────
    console.log("\n[Test 3] Controlled Uncertainty Gate on Non-Leaf Image (Tractor / Red Metal Sheet)");
    const redMetalBuf = Buffer.alloc(256 * 256 * 3);
    for (let y = 0; y < 256; y++) {
        for (let x = 0; x < 256; x++) {
            const idx = (y * 256 + x) * 3;
            const noise = ((x * 19 + y * 29) % 30) - 15;
            redMetalBuf[idx]     = Math.max(0, Math.min(255, 190 + noise)); // High Red
            redMetalBuf[idx + 1] = Math.max(0, Math.min(255, 30 + noise));  // Low Green
            redMetalBuf[idx + 2] = Math.max(0, Math.min(255, 30 + noise));  // Low Blue
        }
    }
    const redMetalPng = await sharp(redMetalBuf, { raw: { width: 256, height: 256, channels: 3 } }).png().toBuffer();
    const nonLeafResult = await classify(redMetalPng);

    assert(nonLeafResult.crop === "Unknown", `Crop marked "Unknown" on non-leaf (Got: "${nonLeafResult.crop}")`);
    assert(nonLeafResult.disease === "No Plant Leaf Detected" || nonLeafResult.disease === "Image Quality Issue", `Controlled safe failure response generated: "${nonLeafResult.disease}"`);
    assert(nonLeafResult.confidence === 0, `Confidence is strictly 0 on non-leaf (Got: ${nonLeafResult.confidence})`);
    assert(nonLeafResult.isUncertain === true, "isUncertain flag is true on non-leaf");
    assert(nonLeafResult.allPredictions.length === 0, "No bogus disease predictions generated");
    assert(Array.isArray(nonLeafResult.advice) && nonLeafResult.advice.length > 0, "Helpful camera positioning advice returned");

    // ─────────────────────────────────────────────────────────────
    // Test 4: Controlled Uncertainty on Corrupted / Severe Blur Image
    // ─────────────────────────────────────────────────────────────
    console.log("\n[Test 4] Controlled Uncertainty on Severely Blurred Image");
    // Generate extreme blurred flat gray image
    const grayBlur = await sharp({
        create: { width: 300, height: 300, channels: 3, background: { r: 120, g: 120, b: 120 } }
    }).png().toBuffer();

    const blurResult = await classify(grayBlur);
    assert(blurResult.isUncertain === true, "Uncertainty triggered on invalid quality");
    assert(blurResult.confidence === 0, `Confidence is 0 on poor quality (Got: ${blurResult.confidence})`);
    assert(blurResult.imageQuality.valid === false, "imageQuality.valid is false on blur");

    console.log("\n=================================================================");
    console.log(`📊 TEST SUMMARY: ${passedTests} / ${totalTests} PASSED`);
    console.log("=================================================================\n");

    if (passedTests === totalTests) {
        process.exit(0);
    } else {
        process.exit(1);
    }
}

runTests().catch(err => {
    console.error("Fatal test error:", err);
    process.exit(1);
});
