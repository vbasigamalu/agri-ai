/**
 * forecastRoutes.js
 * Routes for the Disease & Pest Risk Forecasting Engine
 *
 * POST /api/forecast/risk         → Phase 2: XGBoost  (falls back to Phase 1 rule-based)
 * GET  /api/forecast/risk/demo    → Pre-loaded demo with Tomato / Flowering / Pune
 * GET  /api/forecast/status       → Reports which engine is active
 * POST /api/forecast/risk/rule    → Force Phase 1 rule-based only
 */
"use strict";
const express          = require("express");
const router           = express.Router();
const { predictRisk, mlModelsAvailable } = require("../forecasting/mlForecaster");
const { computeRisk }                    = require("../forecasting/riskEngine");

// ─── Status endpoint ────────────────────────────────────────────────────────
router.get("/status", (req, res) => {
    const ml = mlModelsAvailable();
    res.json({
        success:       true,
        activeEngine:  ml ? "xgboost-v1" : "rule-based-v1 (fallback)",
        mlReady:       ml,
        phase1Ready:   true,
        note: ml
            ? "XGBoost Phase 2 engine is active."
            : "XGBoost models not found. Run: python backend/forecasting/train_forecaster.py"
    });
});

// ─── Main forecast endpoint (Phase 2: XGBoost + Phase 1 fallback) ──────────
router.post("/risk", async (req, res) => {
    try {
        const inputs = req.body || {};
        const result = await predictRisk(inputs);
        return res.json({ success: true, ...result });
    } catch (err) {
        console.error("[ForecastAPI] Error:", err);
        return res.status(500).json({ success: false, error: err.message });
    }
});

// ─── Force rule-based only (for comparison / debugging) ─────────────────────
router.post("/risk/rule", (req, res) => {
    try {
        const inputs = req.body || {};
        const result = computeRisk(inputs);
        result.meta.engine = "rule-based-v1 (forced)";
        return res.json({ success: true, ...result });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

// ─── Demo endpoint ───────────────────────────────────────────────────────────
const DEMO_INPUTS = {
    weather: { temp_c: 26, humidity_pct: 88, rainfall_mm: 12, wind_kmh: 14, dew_point_c: 23 },
    crop:      "Tomato",
    cropStage: "Flowering",
    location:  { district: "Pune", state: "Maharashtra" },
    diseaseHistory: [
        { disease: "Early Blight", daysAgo: 5,  severity: "Moderate" },
        { disease: "Leaf Spot",    daysAgo: 12, severity: "Mild" }
    ],
    pestCount: { aphids: 35, mites: 8 },
    previousReports: [{ type: "disease", daysAgo: 4, riskLevel: "MEDIUM" }],
    forecastDays: 3
};

router.get("/risk/demo", async (req, res) => {
    try {
        const result = await predictRisk(DEMO_INPUTS);
        return res.json({ success: true, demo: true, ...result });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
