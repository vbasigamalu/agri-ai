"use strict";
const { predictRisk } = require("./mlForecaster");
const { computeRisk } = require("./riskEngine");

const scenarios = [
    {
        name: "LOW  (cool dry, seedling)",
        weather: { temp_c: 18, humidity_pct: 35, rainfall_mm: 0, wind_kmh: 5 },
        crop: "Wheat", cropStage: "Seedling",
        pestCount: {}, diseaseHistory: []
    },
    {
        name: "MED  (warm humid, vegetative)",
        weather: { temp_c: 24, humidity_pct: 70, rainfall_mm: 4, wind_kmh: 12 },
        crop: "Cotton", cropStage: "Vegetative",
        pestCount: { aphids: 10 }, diseaseHistory: []
    },
    {
        name: "HIGH (hot wet, flowering)",
        weather: { temp_c: 26, humidity_pct: 88, rainfall_mm: 12, wind_kmh: 14, dew_point_c: 23 },
        crop: "Tomato", cropStage: "Flowering",
        pestCount: { aphids: 35, mites: 8 },
        diseaseHistory: [{ disease: "Early Blight", daysAgo: 5, severity: "Moderate" }]
    },
    {
        name: "CRIT (blight weather, fruiting)",
        weather: { temp_c: 17, humidity_pct: 95, rainfall_mm: 20, wind_kmh: 8, dew_point_c: 16 },
        crop: "Potato", cropStage: "Fruiting",
        pestCount: { bollworm: 18, armyworm: 15 },
        diseaseHistory: [
            { disease: "Late Blight",  daysAgo: 2,  severity: "Severe" },
            { disease: "Early Blight", daysAgo: 6,  severity: "Moderate" }
        ],
        previousReports: [{ type: "disease", daysAgo: 3, riskLevel: "HIGH" }]
    }
];

async function run() {
    console.log("\nScenario Comparison: XGBoost vs Rule-Based");
    console.log("=".repeat(65));
    for (const s of scenarios) {
        const ml   = await predictRisk(s);
        const rule = computeRisk(s);
        console.log("\n[" + s.name + "]");
        console.log("  XGBoost   -> Disease:" + ml.diseaseRisk.score + "% (" + ml.diseaseRisk.level + ")  Pest:" + ml.pestRisk.score + "% (" + ml.pestRisk.level + ")  Overall:" + ml.overallRisk.level + "  engine:" + ml.meta.engine);
        console.log("  Rule-Based -> Disease:" + rule.diseaseRisk.score + "% (" + rule.diseaseRisk.level + ")  Pest:" + rule.pestRisk.score + "% (" + rule.pestRisk.level + ")  Overall:" + rule.overallRisk.level);
    }
    console.log("\nAll scenarios passed.");
}

run().catch(console.error);
