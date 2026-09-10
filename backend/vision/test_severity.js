const fs = require("fs");
const path = require("path");
const assert = require("assert");
const { classify, initClassifier } = require("../classifier");
const { estimateDiseaseSeverity } = require("./severityEstimator");

async function runSeverityTestSuite() {
    console.log("=================================================================");
    console.log("🔬 TESTING VISION-BASED DISEASE SEVERITY ESTIMATION");
    console.log("=================================================================");

    await initClassifier();

    const datasetDir = path.join(__dirname, "..", "dataset");

    // Test 1: Healthy Tomato Leaf
    console.log("\n[Test 1] Healthy Leaf Severity:");
    const healthyDir = path.join(datasetDir, "Tomato___healthy");
    const healthyFiles = fs.readdirSync(healthyDir).filter(f => f.endsWith(".JPG") || f.endsWith(".jpg"));
    const healthyBuf = fs.readFileSync(path.join(healthyDir, healthyFiles[0]));
    const healthyResult = await classify(healthyBuf);

    console.log(`  • Disease:          ${healthyResult.disease}`);
    console.log(`  • Vision Severity:  ${healthyResult.severity}`);
    if (healthyResult.severityMetrics) {
        console.log(`  • Affected Area %:  ${healthyResult.severityMetrics.affectedAreaPercent}%`);
        console.log(`  • Stage:            ${healthyResult.severityMetrics.stage}`);
        console.log(`  • Action Advice:    ${healthyResult.severityMetrics.actionAdvice}`);
    }
    assert(healthyResult.severity.toLowerCase().includes("healthy") || healthyResult.severity.toLowerCase().includes("mild"), "Healthy leaf has Healthy/Mild severity");

    // Test 2: Early Blight Leaf
    console.log("\n[Test 2] Early Blight Lesion Severity:");
    const earlyBlightDir = path.join(datasetDir, "Tomato___Early_blight");
    const ebFiles = fs.readdirSync(earlyBlightDir).filter(f => f.endsWith(".JPG") || f.endsWith(".jpg"));
    const ebBuf = fs.readFileSync(path.join(earlyBlightDir, ebFiles[0]));
    const ebResult = await classify(ebBuf);

    console.log(`  • Disease:          ${ebResult.disease}`);
    console.log(`  • Vision Severity:  ${ebResult.severity}`);
    if (ebResult.severityMetrics) {
        console.log(`  • Affected Area %:  ${ebResult.severityMetrics.affectedAreaPercent}%`);
        console.log(`  • Stage:            ${ebResult.severityMetrics.stage}`);
        console.log(`  • Damage Level:     ${ebResult.severityMetrics.damageScale.level} / ${ebResult.severityMetrics.damageScale.maxLevel}`);
        console.log(`  • Action Advice:    ${ebResult.severityMetrics.actionAdvice}`);
    }
    assert(typeof ebResult.severity === "string", "Severity is string");
    assert(ebResult.severityMetrics !== undefined, "severityMetrics attached");
    assert(typeof ebResult.severityMetrics.affectedAreaPercent === "number", "affectedAreaPercent is numeric");

    // Test 3: Late Blight Leaf
    console.log("\n[Test 3] Late Blight Lesion Severity:");
    const lateBlightDir = path.join(datasetDir, "Tomato___Late_blight");
    const lbFiles = fs.readdirSync(lateBlightDir).filter(f => f.endsWith(".JPG") || f.endsWith(".jpg"));
    const lbBuf = fs.readFileSync(path.join(lateBlightDir, lbFiles[0]));
    const lbResult = await classify(lbBuf);

    console.log(`  • Disease:          ${lbResult.disease}`);
    console.log(`  • Vision Severity:  ${lbResult.severity}`);
    if (lbResult.severityMetrics) {
        console.log(`  • Affected Area %:  ${lbResult.severityMetrics.affectedAreaPercent}%`);
        console.log(`  • Stage:            ${lbResult.severityMetrics.stage}`);
        console.log(`  • Action Advice:    ${lbResult.severityMetrics.actionAdvice}`);
    }
    assert(typeof lbResult.severityMetrics.affectedAreaPercent === "number", "Late blight affectedAreaPercent is numeric");

    console.log("\n=================================================================");
    console.log("✅ ALL SEVERITY ESTIMATION TESTS PASSED SUCCESSFULLY!");
    console.log("=================================================================");
}

runSeverityTestSuite().catch(err => {
    console.error("❌ Test failed:", err);
    process.exit(1);
});
