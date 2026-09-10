/**
 * ============================================================
 * Vision Pipeline — Comprehensive Verification Suite
 * ============================================================
 * Tests each modular stage independently and end-to-end,
 * with extensive testing of the Image Quality Check module.
 *
 * Run: node backend/vision/test_pipeline.js
 * ============================================================
 */

const sharp = require("sharp");
const path = require("path");
const fs = require("fs");
const {
    runVisionPipeline,
    checkImageQuality,
    detectLeafRegion,
    suppressBackground,
    prepareModelInput
} = require("./index");

async function runTests() {
    console.log("\n=======================================================");
    console.log("🧪 AGRI-AI ROBUST VISION PIPELINE — VERIFICATION SUITE");
    console.log("=======================================================\n");

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

    // ─────────────────────────────────────────────────────────
    // Helper: Create synthetic image buffers
    // ─────────────────────────────────────────────────────────
    async function makeColorImage(w, h, r, g, b) {
        return sharp({
            create: {
                width: w,
                height: h,
                channels: 3,
                background: { r, g, b }
            }
        }).png().toBuffer();
    }

    // 1. Synthetic leaf with brown soil background (300x300)
    const width = 300;
    const height = 300;
    const syntheticBuffer = Buffer.alloc(width * height * 3);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 3;
            // Center 120x120 is green leaf with realistic texture
            if (x >= 90 && x <= 210 && y >= 90 && y <= 210) {
                const noise = ((x * 17 + y * 23) % 20) - 10;
                syntheticBuffer[idx]     = Math.max(0, Math.min(255, 45 + noise));  // R
                syntheticBuffer[idx + 1] = Math.max(0, Math.min(255, 165 + noise)); // G
                syntheticBuffer[idx + 2] = Math.max(0, Math.min(255, 55 + noise));  // B
            } else {
                // Background is brown soil
                const noise = ((x * 31 + y * 13) % 30) - 15;
                syntheticBuffer[idx]     = Math.max(0, Math.min(255, 115 + noise)); // R
                syntheticBuffer[idx + 1] = Math.max(0, Math.min(255, 75 + noise));  // G
                syntheticBuffer[idx + 2] = Math.max(0, Math.min(255, 45 + noise));  // B
            }
        }
    }
    const testLeafOnSoil = await sharp(syntheticBuffer, { raw: { width, height, channels: 3 } })
        .png()
        .toBuffer();

    console.log("─── STAGE 1: IMAGE QUALITY CHECK SPECIFICATION ───");

    // Test 1: Valid leaf image on noisy soil background (MUST PASS)
    console.log("\n[Test 1] Quality Check on Leaf Image with Soil Background (Noisy background must NOT be rejected)");
    const qualityGood = await checkImageQuality(testLeafOnSoil);
    assert(qualityGood.valid === true, `Valid flag is true (Got: ${qualityGood.valid})`);
    assert(qualityGood.qualityScore >= 60, `High quality score (Got: ${qualityGood.qualityScore})`);
    assert(Array.isArray(qualityGood.issues), "issues is an Array");
    assert(typeof qualityGood.recommendation === "string", "recommendation is a string");
    assert(qualityGood.metrics.width === 300, `Detected width: ${qualityGood.metrics.width}`);
    assert(qualityGood.metrics.plantRatio > 0.05, `Detected foliage presence: ${(qualityGood.metrics.plantRatio * 100).toFixed(1)}%`);

    // Test 2: Real dataset leaf verification
    console.log("\n[Test 2] Quality Check on Real Dataset Leaf");
    const realLeafPath = path.join(__dirname, "..", "dataset", "Tomato___Early_blight", "0012b9d2-2130-4a06-a834-b1f3af34f57e___RS_Erly.B 8389.JPG");
    if (fs.existsSync(realLeafPath)) {
        const realLeafBuf = fs.readFileSync(realLeafPath);
        const qualityReal = await checkImageQuality(realLeafBuf);
        assert(qualityReal.valid === true, `Real leaf image validated (Score: ${qualityReal.qualityScore})`);
        assert(qualityReal.issues.length === 0, `Zero quality issues on good leaf (Issues: ${qualityReal.issues.join(", ")})`);
    }

    // Test 3: Extreme darkness / pitch black image
    console.log("\n[Test 3] Quality Check: Extreme Darkness");
    const darkBuf = await makeColorImage(250, 250, 5, 5, 5);
    const qualityDark = await checkImageQuality(darkBuf);
    assert(qualityDark.valid === false, "Extreme darkness rejected (valid: false)");
    assert(qualityDark.issues.includes("extreme_darkness") || qualityDark.issues.includes("too_dark"), `Identified darkness issue: [${qualityDark.issues.join(", ")}]`);
    assert(qualityDark.recommendation.toLowerCase().includes("dark") || qualityDark.recommendation.toLowerCase().includes("lighting"), `Helpful recommendation generated: "${qualityDark.recommendation}"`);

    // Test 4: Extreme overexposure / white blowout
    console.log("\n[Test 4] Quality Check: Extreme Overexposure");
    const brightBuf = await makeColorImage(250, 250, 254, 254, 254);
    const qualityBright = await checkImageQuality(brightBuf);
    assert(qualityBright.valid === false, "Overexposure rejected (valid: false)");
    assert(qualityBright.issues.includes("extreme_overexposure") || qualityBright.issues.includes("overexposed"), `Identified overexposure issue: [${qualityBright.issues.join(", ")}]`);
    assert(qualityBright.recommendation.toLowerCase().includes("overexposed") || qualityBright.recommendation.toLowerCase().includes("flash"), `Helpful recommendation generated: "${qualityBright.recommendation}"`);

    // Test 5: Extremely small image (<100px)
    console.log("\n[Test 5] Quality Check: Extremely Small Image");
    const tinyBuf = await makeColorImage(48, 48, 50, 150, 50);
    const qualityTiny = await checkImageQuality(tinyBuf);
    assert(qualityTiny.valid === false, "Tiny image rejected (valid: false)");
    assert(qualityTiny.issues.includes("extremely_small"), `Identified small image issue: [${qualityTiny.issues.join(", ")}]`);

    // Test 6: Severe blur detection
    console.log("\n[Test 6] Quality Check: Severe Blur (Variance of Laplacian)");
    const blurryBuf = await sharp(testLeafOnSoil)
        .blur(18) // Heavy Gaussian blur
        .toBuffer();
    const qualityBlur = await checkImageQuality(blurryBuf);
    assert(qualityBlur.valid === false, "Severely blurred image rejected (valid: false)");
    assert(qualityBlur.issues.includes("too_blurry"), `Identified blur issue: [${qualityBlur.issues.join(", ")}]`);
    assert(qualityBlur.recommendation.toLowerCase().includes("blur") || qualityBlur.recommendation.toLowerCase().includes("steady"), `Helpful recommendation generated: "${qualityBlur.recommendation}"`);

    // Test 7: Corrupted / invalid image buffer
    console.log("\n[Test 7] Quality Check: Corrupted Image");
    const corruptBuf = Buffer.from("CORRUPT_NOT_AN_IMAGE_HEADER_DATA_STREAM");
    const qualityCorrupt = await checkImageQuality(corruptBuf);
    assert(qualityCorrupt.valid === false, "Corrupted buffer rejected (valid: false)");
    assert(qualityCorrupt.issues.includes("corrupted_image"), `Identified corruption issue: [${qualityCorrupt.issues.join(", ")}]`);

    // Test 8: Non-plant image (plain blue concrete/wall)
    console.log("\n[Test 8] Quality Check: No Plant / Foliage Detected");
    const blueWallBuf = await makeColorImage(250, 250, 30, 70, 190);
    const qualityNonPlant = await checkImageQuality(blueWallBuf);
    assert(qualityNonPlant.valid === false, "Non-plant image rejected (valid: false)");
    assert(qualityNonPlant.issues.includes("no_plant_detected"), `Identified non-plant issue: [${qualityNonPlant.issues.join(", ")}]`);

    console.log("\n─── STAGES 2-4: PIPELINE & CLASSIFIER INTEGRATION ───");

    // Test 9: Leaf Saliency
    console.log("\n[Test 9] Leaf Saliency ROI Detection");
    const detection = await detectLeafRegion(testLeafOnSoil);
    assert(detection.hasPlantContent === true, "Detected plant content in leaf on soil");
    assert(detection.boundingBox !== null, "Bounding box calculated");

    // Test 10: Background Suppression
    console.log("\n[Test 10] Background Suppression (Padded Crop)");
    const suppression = await suppressBackground(testLeafOnSoil, detection);
    assert(suppression.wasSuppressed === true, "Background suppression active");
    assert(suppression.cropBox !== null, `Generated padded crop: [w:${suppression.cropBox.width}, h:${suppression.cropBox.height}]`);

    // Test 11: Normalization & Preprocessing
    console.log("\n[Test 11] Crop, Resize & Normalize to Tensor");
    const modelInput = await prepareModelInput(suppression.processedBuffer, { targetSize: 224, layout: "CHW" });
    assert(modelInput.floatData.length === 1 * 3 * 224 * 224, "Correct Float32 tensor length (150,528)");

    // Test 12: End-to-end Pipeline
    console.log("\n[Test 12] End-to-end Pipeline Execution");
    const pipelineRes = await runVisionPipeline(testLeafOnSoil);
    assert(pipelineRes.quality.valid === true, "Pipeline quality passed");
    assert(pipelineRes.tensorData instanceof Float32Array, "Clean Float32 tensor returned");
    assert(pipelineRes.pipelineExecutionTimeMs > 0, `Tracked execution time: ${pipelineRes.pipelineExecutionTimeMs} ms`);

    console.log("\n=======================================================");
    console.log(`📊 TEST SUMMARY: ${passedTests} / ${totalTests} PASSED`);
    console.log("=======================================================\n");

    if (passedTests === totalTests) {
        process.exit(0);
    } else {
        process.exit(1);
    }
}

runTests().catch(err => {
    console.error("Test execution fatal error:", err);
    process.exit(1);
});
