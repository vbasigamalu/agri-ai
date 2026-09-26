/**
 * ============================================================
 * Leaf Detection & Segmentation — Independent Test Suite
 * ============================================================
 * Tests the Leaf Detection / Segmentation stage independently:
 * 1. Output schema validation ({ detected, boundingBox, mask, confidence })
 * 2. Multi-leaf support (regions array)
 * 3. Safe failure state on non-leaf images
 * 4. Isolation of leaf from noisy soil backgrounds
 * 5. End-to-end classification protection
 *
 * Run: node backend/vision/test_leaf_detection.js
 * ============================================================
 */

const sharp = require("sharp");
const path = require("path");
const fs = require("fs");
const { detectLeafRegion, initLeafSession } = require("./leafDetector");
const { runVisionPipeline } = require("./index");
const { initClassifier, classify } = require("../classifier");

async function runTests() {
    console.log("\n=======================================================");
    console.log("🌿 AGRI-AI LEAF DETECTION & SEGMENTATION TEST SUITE");
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

    // Initialize the neural segmentation session
    console.log("[Init] Loading MobileLeafNet ONNX Session...");
    const session = await initLeafSession();
    assert(session !== null, "ONNX Leaf Segmentation session initialized successfully");

    // Helper to generate color images
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

    // ─────────────────────────────────────────────────────────
    // Test 1: Real Dataset Leaf Detection
    // ─────────────────────────────────────────────────────────
    console.log("\n[Test 1] Real Dataset Leaf (Tomato Early Blight)");
    const realLeafPath = path.join(__dirname, "..", "dataset", "Tomato___Early_blight", "0012b9d2-2130-4a06-a834-b1f3af34f57e___RS_Erly.B 8389.JPG");
    if (fs.existsSync(realLeafPath)) {
        const realLeafBuf = fs.readFileSync(realLeafPath);
        const result = await detectLeafRegion(realLeafBuf);

        assert(result.detected === true, `Leaf detected (Got: ${result.detected})`);
        assert(typeof result.confidence === "number" && result.confidence >= 0 && result.confidence <= 1, `Confidence in range [0, 1] (${result.confidence})`);
        assert(result.boundingBox !== null && typeof result.boundingBox === "object", "boundingBox object present");
        assert(result.boundingBox.width > 50 && result.boundingBox.height > 50, `Valid dimensions [${result.boundingBox.width}x${result.boundingBox.height}]`);
        assert(typeof result.mask === "string" && result.mask.startsWith("data:image/png;base64,"), "Visual PNG Base64 mask generated");
        assert(Array.isArray(result.regions) && result.regions.length >= 1, `Regions array contains ${result.regions.length} region(s)`);
    }

    // ─────────────────────────────────────────────────────────
    // Test 2: Leaf with Noisy Background (Soil & Hands)
    // ─────────────────────────────────────────────────────────
    console.log("\n[Test 2] Synthetic Leaf on Noisy Soil Background");
    const width = 320;
    const height = 320;
    const noisyBuf = Buffer.alloc(width * height * 3);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 3;
            // Center 140x140 is green leaf
            if (x >= 90 && x <= 230 && y >= 90 && y <= 230) {
                noisyBuf[idx] = 42;  // R
                noisyBuf[idx + 1] = 168; // G (foliage)
                noisyBuf[idx + 2] = 52;  // B
            } else {
                // Background is brown/muddy soil
                noisyBuf[idx] = 128; // R
                noisyBuf[idx + 1] = 78;  // G
                noisyBuf[idx + 2] = 48;  // B
            }
        }
    }
    const noisyImagePng = await sharp(noisyBuf, { raw: { width, height, channels: 3 } }).png().toBuffer();
    const noisyResult = await detectLeafRegion(noisyImagePng);

    assert(noisyResult.detected === true, "Detected leaf in noisy background");
    assert(noisyResult.boundingBox.left >= 70 && noisyResult.boundingBox.left <= 110, `Leaf left bound localized: ${noisyResult.boundingBox.left}`);
    assert(noisyResult.boundingBox.top >= 70 && noisyResult.boundingBox.top <= 110, `Leaf top bound localized: ${noisyResult.boundingBox.top}`);
    assert(noisyResult.confidence > 0.5, `Good confidence on noisy background (${noisyResult.confidence})`);

    // ─────────────────────────────────────────────────────────
    // Test 3: Multiple Leaves in the Image
    // ─────────────────────────────────────────────────────────
    console.log("\n[Test 3] Multi-Leaf Image (Primary Leaf + Secondary Leaf)");
    const multiBuf = Buffer.alloc(width * height * 3);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 3;
            // Leaf 1 (Large primary leaf on left: 80x80 to 180x180)
            const isLeaf1 = (x >= 40 && x <= 140 && y >= 80 && y <= 200);
            // Leaf 2 (Smaller secondary leaf on right: 190x80 to 270x160)
            const isLeaf2 = (x >= 190 && x <= 270 && y >= 80 && y <= 160);

            if (isLeaf1 || isLeaf2) {
                multiBuf[idx] = 38;
                multiBuf[idx + 1] = 172;
                multiBuf[idx + 2] = 46;
            } else {
                multiBuf[idx] = 110;
                multiBuf[idx + 1] = 70;
                multiBuf[idx + 2] = 40;
            }
        }
    }
    const multiImagePng = await sharp(multiBuf, { raw: { width, height, channels: 3 } }).png().toBuffer();
    const multiResult = await detectLeafRegion(multiImagePng);

    assert(multiResult.detected === true, "Detected leaves in multi-leaf image");
    assert(multiResult.regions.length >= 2, `Multi-leaf regions detected: ${multiResult.regions.length} distinct leaves`);
    assert(multiResult.regions[0].areaRatio >= multiResult.regions[1].areaRatio, "Regions sorted by size (primary first)");

    // ─────────────────────────────────────────────────────────
    // Test 4: Safe Failure State on Non-Leaf Image
    // ─────────────────────────────────────────────────────────
    console.log("\n[Test 4] Safe Failure State on Non-Leaf Image (e.g. Wall / Farming Tool)");
    const blueWallBuf = await makeColorImage(256, 256, 40, 60, 180);
    const failResult = await detectLeafRegion(blueWallBuf);

    assert(failResult.detected === false, "Correctly rejected non-leaf image (detected: false)");
    assert(failResult.boundingBox === null, "boundingBox is null on failure");
    assert(failResult.reason === "no_leaf_detected", `Reason recorded: "${failResult.reason}"`);
    assert(typeof failResult.message === "string", `Helpful failure message: "${failResult.message}"`);

    // ─────────────────────────────────────────────────────────
    // Test 5: End-to-End Disease Classifier Safety
    // ─────────────────────────────────────────────────────────
    console.log("\n[Test 5] End-to-End Classifier Safety (Protected from Non-Leaf Image)");
    await initClassifier();

    // Passing the non-leaf blue wall to classify()
    const safeOutput = await classify(blueWallBuf);
    assert(safeOutput.disease === "No Plant Leaf Detected" || safeOutput.disease === "Image Quality Issue", `Classifier safely halted: "${safeOutput.disease}"`);
    assert(safeOutput.confidence === 0, `Confidence is 0% on non-leaf (${safeOutput.confidence})`);
    assert(safeOutput.allPredictions.length === 0, "No bogus disease predictions generated");

    // Passing a valid real leaf to classify()
    if (fs.existsSync(realLeafPath)) {
        const realLeafBuf = fs.readFileSync(realLeafPath);
        const validOutput = await classify(realLeafBuf);
        assert(validOutput.status === "confirmed", `Diagnosis status is confirmed: "${validOutput.status}"`);
        const confVal = validOutput.confidencePercent || (validOutput.confidence * 100);
        assert(confVal >= 50, `Calibrated confidence diagnosis: ${confVal.toFixed(1)}%`);
    }

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
    console.error("Fatal test error:", err);
    process.exit(1);
});
