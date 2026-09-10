/**
 * ============================================================
 * Background Suppression & Leaf Isolation — Test Suite
 * ============================================================
 * Tests the Background Suppression stage independently:
 * 1. Output 1: Tight leaf crop using detected bounding box
 * 2. Output 2: Masked leaf image using segmentation mask
 * 3. Aspect-ratio preservation (zero geometric distortion)
 * 4. Resizing to exact disease model dimension (224x224)
 * 5. Low-confidence uncertainty state (conservative handling)
 * 6. Non-destructive storage (original kept, processed & metadata stored)
 * 7. Original vs processed comparison audit
 *
 * Run: node backend/vision/test_background_suppression.js
 * ============================================================
 */

const sharp = require("sharp");
const path = require("path");
const fs = require("fs");
const { suppressBackground } = require("./backgroundSuppressor");
const { detectLeafRegion, initLeafSession } = require("./leafDetector");
const { runVisionPipeline } = require("./index");

async function runTests() {
    console.log("\n=================================================================");
    console.log("🍃 AGRI-AI BACKGROUND SUPPRESSION & LEAF ISOLATION TEST SUITE");
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

    // Initialize ONNX leaf session
    console.log("[Init] Loading MobileLeafNet ONNX Session...");
    await initLeafSession();

    // ─────────────────────────────────────────────────────────────
    // Helper: Create synthetic image with soil background + green leaf
    // ─────────────────────────────────────────────────────────────
    async function createSyntheticLeafOnSoil(width = 320, height = 320) {
        const raw = Buffer.alloc(width * height * 3);
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 3;
                // Center 140x140 area is green foliage
                if (x >= 90 && x <= 230 && y >= 90 && y <= 230) {
                    raw[idx]     = 38;  // R
                    raw[idx + 1] = 165; // G (foliage)
                    raw[idx + 2] = 45;  // B
                } else {
                    // Background is brown muddy soil
                    raw[idx]     = 135; // R
                    raw[idx + 1] = 85;  // G
                    raw[idx + 2] = 45;  // B
                }
            }
        }
        return sharp(raw, { raw: { width, height, channels: 3 } }).png().toBuffer();
    }

    // ─────────────────────────────────────────────────────────────
    // Test 1: Tight Leaf Crop (Output 1)
    // ─────────────────────────────────────────────────────────────
    console.log("\n[Test 1] Tight Leaf Crop using Detected Bounding Box");
    const testImage = await createSyntheticLeafOnSoil(320, 320);
    const detection = await detectLeafRegion(testImage);
    assert(detection.detected === true, "Leaf successfully detected in synthetic image");

    const suppression = await suppressBackground(testImage, detection, {
        targetSize: 224,
        persist: true,
        verboseLogging: false
    });

    assert(suppression.wasSuppressed === true, "Background suppression active");
    assert(suppression.tightCropBuffer !== null && Buffer.isBuffer(suppression.tightCropBuffer), "Tight crop buffer generated (Output 1)");

    const cropMeta = await sharp(suppression.tightCropBuffer).metadata();
    assert(cropMeta.width === 224 && cropMeta.height === 224, `Tight crop resized to exact model input: [${cropMeta.width} x ${cropMeta.height}]`);

    // ─────────────────────────────────────────────────────────────
    // Test 2: Masked Leaf Image using Segmentation Mask (Output 2)
    // ─────────────────────────────────────────────────────────────
    console.log("\n[Test 2] Masked Leaf Image using Segmentation Mask");
    assert(suppression.maskedBuffer !== null && Buffer.isBuffer(suppression.maskedBuffer), "Masked buffer generated (Output 2)");

    const maskedMeta = await sharp(suppression.maskedBuffer).metadata();
    assert(maskedMeta.width === 224 && maskedMeta.height === 224, `Masked image resized to exact model input: [${maskedMeta.width} x ${maskedMeta.height}]`);

    // Inspect pixel values: Corner padding should be neutral dark (0,0,0) while center has foliage
    const { data: maskedPixels } = await sharp(suppression.maskedBuffer).raw().toBuffer({ resolveWithObject: true });
    const cornerR = maskedPixels[0];
    const cornerG = maskedPixels[1];
    const cornerB = maskedPixels[2];
    assert(cornerR === 0 && cornerG === 0 && cornerB === 0, `Background clutter suppressed to neutral black at corner: [R:${cornerR}, G:${cornerG}, B:${cornerB}]`);

    // Center pixel should be leaf foliage (green channel high)
    const centerIdx = (112 * 224 + 112) * 3;
    const centerG = maskedPixels[centerIdx + 1];
    assert(centerG > 50, `Leaf foliage preserved inside mask at center: [G:${centerG}]`);

    // ─────────────────────────────────────────────────────────────
    // Test 3: Zero Geometric Distortion (Preserving Aspect Ratio)
    // ─────────────────────────────────────────────────────────────
    console.log("\n[Test 3] Aspect-Ratio Preservation (Zero Distortion on Asymmetric Input)");
    // Non-square 400x200 image (2:1 aspect ratio)
    const wideImage = await createSyntheticLeafOnSoil(400, 200);
    const wideDetection = await detectLeafRegion(wideImage);
    const wideSuppression = await suppressBackground(wideImage, wideDetection, {
        targetSize: 224,
        persist: false,
        verboseLogging: false
    });

    const wideMeta = await sharp(wideSuppression.processedBuffer).metadata();
    assert(wideMeta.width === 224 && wideMeta.height === 224, "Asymmetric input resized to 224x224 via letterboxing");
    assert(wideSuppression.comparison.aspectRatioPreserved === true, "Aspect ratio preserved flag is true");

    // ─────────────────────────────────────────────────────────────
    // Test 4: Low Confidence Uncertainty State
    // ─────────────────────────────────────────────────────────────
    console.log("\n[Test 4] Low Confidence Uncertainty State (< 0.55)");
    const lowConfDetection = {
        detected: true,
        confidence: 0.42, // Under 0.55 threshold
        boundingBox: { left: 80, top: 80, width: 140, height: 140 },
        modelType: "MobileLeafNet-ONNX"
    };

    const uncertainSuppression = await suppressBackground(testImage, lowConfDetection, {
        uncertaintyThreshold: 0.55,
        persist: false,
        verboseLogging: false
    });

    assert(uncertainSuppression.isUncertain === true, "Uncertainty state activated on low confidence (0.42 < 0.55)");
    assert(uncertainSuppression.suppressionMode === "conservative_uncertainty", `Mode set to conservative_uncertainty (Got: "${uncertainSuppression.suppressionMode}")`);
    assert(typeof uncertainSuppression.uncertaintyReason === "string" && uncertainSuppression.uncertaintyReason.includes("Low segmentation confidence"), "Uncertainty reason logged with confidence info");
    assert(uncertainSuppression.cropBox.width >= 140, "Conservative crop margin applied to prevent clipping");

    // ─────────────────────────────────────────────────────────────
    // Test 5: Non-Destructive Storage (Original Kept + Processed & Metadata Stored)
    // ─────────────────────────────────────────────────────────────
    console.log("\n[Test 5] Non-Destructive Storage Audit");
    const originalCopy = Buffer.from(testImage);
    const storedSuppression = await suppressBackground(testImage, detection, {
        persist: true,
        verboseLogging: true
    });

    // Verify original image in memory is 100% unaltered
    assert(Buffer.compare(testImage, originalCopy) === 0, "Original uploaded buffer in RAM was NOT mutated");

    // Verify files on disk
    assert(storedSuppression.storage !== null && storedSuppression.storage.id !== null, "Storage ID assigned");
    assert(fs.existsSync(storedSuppression.storage.originalPath), `Original image persisted to: ${storedSuppression.storage.originalPath}`);
    assert(fs.existsSync(storedSuppression.storage.tightCropPath), `Tight crop persisted to: ${storedSuppression.storage.tightCropPath}`);
    assert(fs.existsSync(storedSuppression.storage.maskedPath), `Masked image persisted to: ${storedSuppression.storage.maskedPath}`);
    assert(fs.existsSync(storedSuppression.storage.metadataPath), `Metadata JSON persisted to: ${storedSuppression.storage.metadataPath}`);

    const savedMeta = JSON.parse(fs.readFileSync(storedSuppression.storage.metadataPath, "utf8"));
    assert(savedMeta.id === storedSuppression.storage.id, "Saved metadata matches storage ID");
    assert(savedMeta.confidence > 0, `Saved metadata contains confidence: ${savedMeta.confidence}`);
    assert(savedMeta.cropBox !== null, "Saved metadata contains cropBox");

    // ─────────────────────────────────────────────────────────────
    // Test 6: Original vs Processed Comparison Metrics
    // ─────────────────────────────────────────────────────────────
    console.log("\n[Test 6] Comparison Metrics Structure");
    const comp = storedSuppression.comparison;
    assert(comp.original.width === 320 && comp.original.height === 320, `Original dimensions recorded: [${comp.original.width} x ${comp.original.height}]`);
    assert(comp.processed.width === 224 && comp.processed.height === 224, `Processed dimensions recorded: [${comp.processed.width} x ${comp.processed.height}]`);
    assert(comp.clutterReductionRatio > 0, `Clutter reduction calculated: ${(comp.clutterReductionRatio * 100).toFixed(1)}%`);

    // ─────────────────────────────────────────────────────────────
    // Test 7: Real Dataset Leaf End-to-End Pipeline
    // ─────────────────────────────────────────────────────────────
    console.log("\n[Test 7] Real Dataset Leaf through Full Pipeline");
    const realLeafPath = path.join(__dirname, "..", "dataset", "Tomato___Early_blight", "0012b9d2-2130-4a06-a834-b1f3af34f57e___RS_Erly.B 8389.JPG");
    if (fs.existsSync(realLeafPath)) {
        const realLeafBuf = fs.readFileSync(realLeafPath);
        const pipelineOutput = await runVisionPipeline(realLeafBuf, {
            targetSize: 224,
            layout: "CHW",
            persist: true,
            verboseLogging: false
        });

        assert(pipelineOutput.quality.valid === true, "Quality check passed");
        assert(pipelineOutput.leafDetection.detected === true, "Real leaf detected");
        assert(pipelineOutput.suppression.wasSuppressed === true, "Suppression applied");
        assert(pipelineOutput.suppression.tightCropBuffer !== null, "Pipeline tight crop ready");
        assert(pipelineOutput.suppression.maskedBuffer !== null, "Pipeline masked leaf ready");
        assert(pipelineOutput.tensorData.length === 3 * 224 * 224, `Direct 224x224 tensor prepared: ${pipelineOutput.tensorData.length} floats`);
    }

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
