/**
 * ============================================================
 * Agri-AI Backend API Endpoint End-to-End Test Suite
 * ============================================================
 * Tests the complete robust image-analysis pipeline exposed
 * through the existing backend endpoint: POST /analyze
 *
 * Validates:
 *   1. Upload validation (missing file, invalid MIME, file size limit)
 *   2. Image quality analysis (scores, issues, warnings)
 *   3. Leaf detection/segmentation (foliage detection, bounding box, count)
 *   4. Background suppression & letterboxing
 *   5. Disease prediction (ONNX inference, crop & disease classification)
 *   6. Confidence / OOD evaluation (Free Energy, margin, Shannon entropy)
 *   7. Severity lookup (from database or uncertainty fallback)
 *   8. Final structured response matching exact specification
 *   9. Safe structured response for uncertain/retake cases
 *  10. Zero stack trace or sensitive info leakage
 *
 * Run: node backend/vision/test_api_endpoint.js
 * ============================================================
 */

const path = require("path");
const fs = require("fs");
const http = require("http");
const sharp = require("sharp");
const app = require("../server");
const { initClassifier } = require("../classifier");

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

async function runTestSuite() {
    console.log("\n=================================================================");
    console.log("🚀  AGRI-AI BACKEND API ENDPOINT (POST /analyze) TEST SUITE");
    console.log("=================================================================\n");

    // 1. Warm up the classifier
    console.log("[Setup] Warming up AI inference engine...");
    await initClassifier();

    // 2. Start an ephemeral HTTP server on a random available port
    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = server.address().port;
    const baseUrl = `http://127.0.0.1:${port}`;
    console.log(`[Setup] Ephemeral test server active at ${baseUrl}\n`);

    try {
        // ─────────────────────────────────────────────────────────────
        // TEST 1: Upload Validation - Missing Image File
        // ─────────────────────────────────────────────────────────────
        console.log("-----------------------------------------------------------------");
        console.log("[Test 1] Upload Validation: Missing Image File");
        console.log("-----------------------------------------------------------------");
        {
            const fd = new FormData();
            fd.append("lat", "28.6139");
            fd.append("lon", "77.2090");

            const res = await fetch(`${baseUrl}/analyze`, {
                method: "POST",
                body: fd
            });

            const body = await res.json();
            assert(res.status === 400, `HTTP status is 400 Bad Request (Got: ${res.status})`);
            assert(body.success === false, "success is false");
            assert(body.status === "rejected", `status is "rejected" (Got: "${body.status}")`);
            assert(body.reason === "missing_image_file", `reason is "missing_image_file" (Got: "${body.reason}")`);
            assert(body.confidence === 0, "confidence is 0");
            assert(body.imageQuality && body.imageQuality.valid === false, "imageQuality.valid is false");
            assert(body.leafAnalysis && body.leafAnalysis.detected === false, "leafAnalysis.detected is false");
            assert(body.prediction && body.prediction.confidence === 0, "prediction.confidence is 0");
            assert(body.uncertainty && body.uncertainty.flagged === true, "uncertainty.flagged is true");
            assert(body.uncertainty && body.uncertainty.reason === "missing_image_file", "uncertainty.reason is 'missing_image_file'");
            assert(!body.stack, "No stack trace leaked to client");
        }

        // ─────────────────────────────────────────────────────────────
        // TEST 2: Upload Validation - Unsupported MIME Type (e.g. text/plain)
        // ─────────────────────────────────────────────────────────────
        console.log("\n-----------------------------------------------------------------");
        console.log("[Test 2] Upload Validation: Unsupported Media Type (Text File)");
        console.log("-----------------------------------------------------------------");
        {
            const textBlob = new Blob(["This is not a photo."], { type: "text/plain" });
            const fd = new FormData();
            fd.append("image", textBlob, "notes.txt");

            const res = await fetch(`${baseUrl}/analyze`, {
                method: "POST",
                body: fd
            });

            const body = await res.json();
            assert(res.status === 400, `HTTP status is 400 Bad Request (Got: ${res.status})`);
            assert(body.success === false, "success is false");
            assert(body.status === "rejected", `status is "rejected" (Got: "${body.status}")`);
            assert(body.reason === "unsupported_media_type", `reason is "unsupported_media_type" (Got: "${body.reason}")`);
            assert(body.uncertainty && body.uncertainty.flagged === true, "uncertainty.flagged is true");
            assert(body.imageQuality && body.imageQuality.issues.includes("unsupported_media_type"), "issues contains unsupported_media_type");
            assert(!body.stack, "No stack trace leaked to client");
        }

        // ─────────────────────────────────────────────────────────────
        // TEST 3: Upload Validation - File Too Large (> 25MB)
        // ─────────────────────────────────────────────────────────────
        console.log("\n-----------------------------------------------------------------");
        console.log("[Test 3] Upload Validation: File Size Exceeds 25MB Limit");
        console.log("-----------------------------------------------------------------");
        {
            // Allocate a buffer > 25MB
            const hugeBufferSize = 25.5 * 1024 * 1024;
            const hugeBuf = Buffer.alloc(hugeBufferSize);
            const hugeBlob = new Blob([hugeBuf], { type: "image/jpeg" });
            const fd = new FormData();
            fd.append("image", hugeBlob, "giant_photo.jpg");

            const res = await fetch(`${baseUrl}/analyze`, {
                method: "POST",
                body: fd
            });

            const body = await res.json();
            assert(res.status === 400, `HTTP status is 400 Bad Request (Got: ${res.status})`);
            assert(body.success === false, "success is false");
            assert(body.status === "rejected", `status is "rejected" (Got: "${body.status}")`);
            assert(body.reason === "file_too_large", `reason is "file_too_large" (Got: "${body.reason}")`);
            assert(body.uncertainty && body.uncertainty.flagged === true, "uncertainty.flagged is true");
            assert(!body.stack, "No stack trace leaked to client");
        }

        // ─────────────────────────────────────────────────────────────
        // TEST 4: Full Robust Pipeline - Confirmed Real Dataset Leaf Image
        // ─────────────────────────────────────────────────────────────
        console.log("\n-----------------------------------------------------------------");
        console.log("[Test 4] Complete Robust Pipeline: Confirmed Real Tomato Leaf Image");
        console.log("-----------------------------------------------------------------");
        {
            const tomatoPath = path.join(__dirname, "..", "dataset", "Tomato___Early_blight", "0012b9d2-2130-4a06-a834-b1f3af34f57e___RS_Erly.B 8389.JPG");
            assert(fs.existsSync(tomatoPath), `Test dataset image exists: ${path.basename(tomatoPath)}`);

            const tomatoBytes = fs.readFileSync(tomatoPath);
            const imgBlob = new Blob([tomatoBytes], { type: "image/jpeg" });
            const fd = new FormData();
            fd.append("image", imgBlob, "sample_tomato_early_blight.jpg");
            fd.append("lat", "28.6139");
            fd.append("lon", "77.2090");

            const res = await fetch(`${baseUrl}/analyze`, {
                method: "POST",
                body: fd
            });

            const body = await res.json();

            console.log("  [API Response Schema Verification]");
            console.log(`   • success:       ${body.success}`);
            console.log(`   • status:        ${body.status}`);
            console.log(`   • crop:          ${body.crop}`);
            console.log(`   • disease:       ${body.disease}`);
            console.log(`   • confidence:    ${body.confidence}`);
            console.log(`   • severity:      ${body.severity}`);
            console.log(`   • imageQuality:  score=${body.imageQuality?.score}, issues=[${body.imageQuality?.issues?.join(", ")}]`);
            console.log(`   • leafAnalysis:  detected=${body.leafAnalysis?.detected}, confidence=${body.leafAnalysis?.confidence}, count=${body.leafAnalysis?.leafCount}`);
            console.log(`   • prediction:    disease="${body.prediction?.disease}", confidence=${body.prediction?.confidence}`);
            console.log(`   • uncertainty:   flagged=${body.uncertainty?.flagged}, reason=${body.uncertainty?.reason}`);

            // 1. Overall endpoint success & status
            assert(res.status === 200, `HTTP status is 200 OK (Got: ${res.status})`);
            assert(body.success === true, "success is true");
            assert(body.status === "confirmed", `status is "confirmed" (Got: "${body.status}")`);
            assert(body.crop === "Tomato", `crop correctly identified as "Tomato" (Got: "${body.crop}")`);
            assert(typeof body.disease === "string" && body.disease.toLowerCase().includes("blight"), `disease contains "blight" (Got: "${body.disease}")`);

            // 2. Confidence is normalized float (0.0 - 1.0)
            assert(typeof body.confidence === "number" && body.confidence >= 0 && body.confidence <= 1, `confidence is normalized float in [0, 1] (Got: ${body.confidence})`);
            assert(body.confidence >= 0.48, `confidence (${body.confidence}) exceeds calibrated threshold (0.48)`);

            // 3. Image quality section
            assert(typeof body.imageQuality === "object" && body.imageQuality !== null, "imageQuality object present");
            assert(typeof body.imageQuality.score === "number" && body.imageQuality.score >= 0 && body.imageQuality.score <= 100, `imageQuality.score is in [0, 100] (Got: ${body.imageQuality.score})`);
            assert(Array.isArray(body.imageQuality.issues), "imageQuality.issues is an array");
            assert(body.imageQuality.issues.length === 0, "No critical quality issues on clean image");

            // 4. Leaf analysis section
            assert(typeof body.leafAnalysis === "object" && body.leafAnalysis !== null, "leafAnalysis object present");
            assert(body.leafAnalysis.detected === true, "leafAnalysis.detected is true");
            assert(typeof body.leafAnalysis.confidence === "number" && body.leafAnalysis.confidence > 0, `leafAnalysis.confidence is positive float (Got: ${body.leafAnalysis.confidence})`);
            assert(typeof body.leafAnalysis.leafCount === "number" && body.leafAnalysis.leafCount >= 1, `leafAnalysis.leafCount is >= 1 (Got: ${body.leafAnalysis.leafCount})`);

            // 5. Prediction section
            assert(typeof body.prediction === "object" && body.prediction !== null, "prediction object present");
            assert(body.prediction.disease === body.disease, "prediction.disease matches top-level disease");
            assert(body.prediction.confidence === body.confidence, "prediction.confidence matches top-level confidence");

            // 6. Uncertainty section
            assert(typeof body.uncertainty === "object" && body.uncertainty !== null, "uncertainty object present");
            assert(body.uncertainty.flagged === false, "uncertainty.flagged is false for confirmed image");
            assert(body.uncertainty.reason === null, "uncertainty.reason is null for confirmed image");

            // 7. Severity & Database fields
            assert(typeof body.severity === "string" && body.severity.length > 0, `severity is present (Got: "${body.severity}")`);
            assert(Array.isArray(body.symptoms) && body.symptoms.length > 0, "symptoms array populated");
            assert(Array.isArray(body.advice) && body.advice.length > 0, "advice array populated");
            assert(typeof body.spray === "string", "spray recommendation provided");

            // 8. Security & Sanitization
            assert(!body.stack, "No internal stack trace leaked to client");
        }

        // ─────────────────────────────────────────────────────────────
        // TEST 5: Image Quality Failure - Severely Degraded / Blurry Image
        // ─────────────────────────────────────────────────────────────
        console.log("\n-----------------------------------------------------------------");
        console.log("[Test 5] Image Quality Failure: Severely Blurry / Low Contrast Image");
        console.log("-----------------------------------------------------------------");
        {
            // Create a 256x256 solid gray image (no contrast, blur score = 0)
            const blurryPng = await sharp({
                create: {
                    width: 256,
                    height: 256,
                    channels: 3,
                    background: { r: 120, g: 120, b: 120 }
                }
            }).png().toBuffer();

            const blurryBlob = new Blob([blurryPng], { type: "image/png" });
            const fd = new FormData();
            fd.append("image", blurryBlob, "blurry_image.png");

            const res = await fetch(`${baseUrl}/analyze`, {
                method: "POST",
                body: fd
            });

            const body = await res.json();
            assert(res.status === 200, `HTTP status is 200 OK (Graceful handled: ${res.status})`);
            assert(body.success === true, "success is true (analysis executed safely)");
            assert(body.status === "retake_required" || body.status === "uncertain", `status flagged as retake_required or uncertain (Got: "${body.status}")`);
            assert(body.uncertainty && body.uncertainty.flagged === true, "uncertainty.flagged is true");
            assert(body.uncertainty && body.uncertainty.reason !== null, `uncertainty.reason reported (Got: "${body.uncertainty.reason}")`);
            assert(body.imageQuality && (body.imageQuality.score < 70 || body.imageQuality.issues.length > 0), "imageQuality issues detected");
            assert(body.confidence === 0 || body.confidence < 0.5, `Unreliable confidence safely zeroed or bounded (Got: ${body.confidence})`);
            assert(!body.stack, "No stack trace leaked to client");
        }

        // ─────────────────────────────────────────────────────────────
        // TEST 6: Non-Plant / Out-of-Distribution Image Protection
        // ─────────────────────────────────────────────────────────────
        console.log("\n-----------------------------------------------------------------");
        console.log("[Test 6] Out-of-Distribution / Non-Plant Object Protection (Blue Surface)");
        console.log("-----------------------------------------------------------------");
        {
            // Create a pure solid blue image (0 leaf content)
            const blueBuf = Buffer.alloc(256 * 256 * 3);
            for (let i = 0; i < 256 * 256; i++) {
                blueBuf[i * 3]     = 20;  // R
                blueBuf[i * 3 + 1] = 40;  // G
                blueBuf[i * 3 + 2] = 220; // B
            }
            const bluePng = await sharp(blueBuf, { raw: { width: 256, height: 256, channels: 3 } }).png().toBuffer();
            const blueBlob = new Blob([bluePng], { type: "image/png" });
            const fd = new FormData();
            fd.append("image", blueBlob, "blue_surface.png");

            const res = await fetch(`${baseUrl}/analyze`, {
                method: "POST",
                body: fd
            });

            const body = await res.json();
            assert(res.status === 200, `HTTP status is 200 OK (Got: ${res.status})`);
            assert(body.success === true, "success is true (gracefully handled)");
            assert(body.status === "retake_required" || body.status === "uncertain", `status is retake_required or uncertain (Got: "${body.status}")`);
            assert(body.uncertainty && body.uncertainty.flagged === true, "uncertainty.flagged is true");
            assert(body.leafAnalysis && body.leafAnalysis.detected === false, "leafAnalysis.detected is false for blue surface");
            assert(body.confidence === 0, `confidence is 0 on non-plant rejection (Got: ${body.confidence})`);
            assert(!body.stack, "No stack trace leaked to client");
        }

        // ─────────────────────────────────────────────────────────────
        // TEST 7: Security & Information Sanitization Audit
        // ─────────────────────────────────────────────────────────────
        console.log("\n-----------------------------------------------------------------");
        console.log("[Test 7] Security Audit: Verifying No Stack Traces or Sensitive Paths");
        console.log("-----------------------------------------------------------------");
        {
            // Send invalid corrupt image bytes
            const corruptBlob = new Blob([Buffer.from("NOT_AN_IMAGE_CORRUPTED_BYTES")], { type: "image/jpeg" });
            const fd = new FormData();
            fd.append("image", corruptBlob, "corrupt.jpg");

            const res = await fetch(`${baseUrl}/analyze`, {
                method: "POST",
                body: fd
            });

            const body = await res.json();
            const rawJson = JSON.stringify(body);

            assert(!rawJson.includes("at Object.<anonymous>"), "Does not contain Node.js stack trace indicators");
            assert(!rawJson.includes("node_modules"), "Does not contain node_modules paths");
            assert(!rawJson.includes("C:\\Users\\"), "Does not contain local Windows user paths");
            assert(!rawJson.includes("password"), "Does not contain sensitive database credentials");
            assert(body.uncertainty && body.uncertainty.flagged === true, "Uncertainty properly flagged on corrupted file");
        }

    } finally {
        server.close();
        console.log("\n[Cleanup] Ephemeral test server closed.");
    }

    // ── Summary Report ───────────────────────────────────────────
    console.log("\n=================================================================");
    console.log(`🏁 API ENDPOINT TEST RESULTS: ${passedTests}/${totalTests} TESTS PASSED`);
    console.log("=================================================================\n");

    if (passedTests === totalTests) {
        console.log("🎉 ALL API ENDPOINT TESTS PASSED SUCCESSFULLY!\n");
        process.exit(0);
    } else {
        console.error(`❌ ${totalTests - passedTests} TESTS FAILED.`);
        process.exit(1);
    }
}

runTestSuite().catch(err => {
    console.error("💥 Unhandled Test Error:", err);
    process.exit(1);
});
