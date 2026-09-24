/**
 * mlForecaster.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Phase 2: XGBoost-Powered Risk Forecaster
 *
 * Bridges Node.js → Python (XGBoost) via child_process.
 * Spawns predict_forecaster.py, pipes JSON inputs, reads JSON output.
 *
 * Falls back to rule-based engine automatically if:
 *   - Python / XGBoost models not available
 *   - Model files missing
 *   - Subprocess errors
 *
 * Exported API: predictRisk(inputs) → Promise<forecastResult>
 */
"use strict";

const { spawn }      = require("child_process");
const path           = require("path");
const fs             = require("fs");
const { computeRisk } = require("./riskEngine"); // Phase 1 fallback

const FORECASTING_DIR  = path.join(__dirname);
const PREDICT_SCRIPT   = path.join(FORECASTING_DIR, "predict_forecaster.py");
const DISEASE_MODEL    = path.join(FORECASTING_DIR, "disease_risk_model.json");
const PEST_MODEL       = path.join(FORECASTING_DIR, "pest_risk_model.json");

/** Check that all required model files exist */
function mlModelsAvailable() {
    return fs.existsSync(PREDICT_SCRIPT) &&
           fs.existsSync(DISEASE_MODEL) &&
           fs.existsSync(PEST_MODEL);
}

/**
 * Call the Python XGBoost predictor via stdin/stdout.
 * @param {object} inputs  - same schema as computeRisk()
 * @returns {Promise<{disease_score, pest_score, disease_level, pest_level, engine}>}
 */
function callPythonPredictor(inputs) {
    return new Promise((resolve, reject) => {
        const py = spawn("python", [PREDICT_SCRIPT], {
            cwd: FORECASTING_DIR,
            timeout: 15000
        });

        let stdout = "";
        let stderr = "";

        py.stdout.on("data", chunk => { stdout += chunk.toString(); });
        py.stderr.on("data", chunk => { stderr += chunk.toString(); });

        py.on("close", code => {
            if (code !== 0) {
                return reject(new Error(`Python exited ${code}: ${stderr.slice(0, 300)}`));
            }
            try {
                const result = JSON.parse(stdout.trim());
                if (result.error) return reject(new Error(result.error));
                resolve(result);
            } catch (e) {
                reject(new Error(`JSON parse failed: ${stdout.slice(0, 200)}`));
            }
        });

        py.on("error", err => reject(err));

        // Send inputs as JSON to stdin
        py.stdin.write(JSON.stringify(inputs));
        py.stdin.end();
    });
}

/**
 * Build the full forecast response object from ML scores.
 * Reuses the advisory and summary logic from riskEngine but replaces scores.
 */
function buildMLResult(mlScores, inputs) {
    const { computeRisk: _r } = require("./riskEngine");

    // Get full rule-based result first (for advisory/drivers structure)
    const ruleResult = _r(inputs);

    function scoreToLevel(s) {
        if (s >= 75) return "CRITICAL";
        if (s >= 55) return "HIGH";
        if (s >= 35) return "MEDIUM";
        return "LOW";
    }

    const dScore = Math.round(mlScores.disease_score);
    const pScore = Math.round(mlScores.pest_score);
    const dLevel = scoreToLevel(dScore);
    const pLevel = scoreToLevel(pScore);

    // Combined overall (55% disease + 45% pest)
    const oScore = Math.round(dScore * 0.55 + pScore * 0.45);
    let   oLevel = scoreToLevel(oScore);
    if ((dLevel === "CRITICAL" || pLevel === "CRITICAL") && oLevel === "MEDIUM") oLevel = "HIGH";

    const days    = inputs.forecastDays || 3;
    const crop    = inputs.crop || "Crop";

    // ML drivers — explain what the model picked up
    const dDrivers = [
        `[XGBoost] Predicted disease risk: ${dScore}% (${dLevel})`,
        ...ruleResult.diseaseRisk.drivers.slice(0, 3).map(d => `[Rule context] ${d}`)
    ];
    const pDrivers = [
        `[XGBoost] Predicted pest risk: ${pScore}% (${pLevel})`,
        ...ruleResult.pestRisk.drivers.slice(0, 3).map(d => `[Rule context] ${d}`)
    ];

    return {
        diseaseRisk:  { score: dScore, level: dLevel, drivers: dDrivers },
        pestRisk:     { score: pScore, level: pLevel, drivers: pDrivers },
        overallRisk:  { score: oScore, level: oLevel },
        advisory:     ruleResult.advisory,   // advisory logic stays rule-based (interpretable)
        forecast: {
            days,
            summary: `${crop} faces ${oLevel} risk over the next ${days} day(s). Disease: ${dScore}% (${dLevel}), Pest: ${pScore}% (${pLevel}).`,
            diseaseRiskSummary: `Disease Risk: ${dScore}% (${dLevel})`,
            pestRiskSummary:    `Pest Risk: ${pScore}% (${pLevel})`
        },
        meta: {
            engine:       "xgboost-v1",
            fallback:     false,
            timestamp:    new Date().toISOString(),
            crop:         inputs.crop || "Unknown",
            cropStage:    inputs.cropStage || "Vegetative",
            location:     inputs.location || {},
            forecastDays: days
        }
    };
}

/**
 * Main export: predictRisk(inputs)
 * Tries XGBoost first; falls back to rule-based on any error.
 *
 * @param {object} inputs
 * @returns {Promise<forecastResult>}
 */
async function predictRisk(inputs = {}) {
    if (!mlModelsAvailable()) {
        console.warn("[mlForecaster] Models not found — using rule-based fallback");
        const result = computeRisk(inputs);
        result.meta.engine   = "rule-based-v1";
        result.meta.fallback = true;
        result.meta.fallbackReason = "XGBoost models not trained yet. Run: python forecasting/train_forecaster.py";
        return result;
    }

    try {
        const mlScores = await callPythonPredictor(inputs);
        return buildMLResult(mlScores, inputs);
    } catch (err) {
        console.warn("[mlForecaster] XGBoost failed, falling back to rule-based:", err.message);
        const result = computeRisk(inputs);
        result.meta.engine        = "rule-based-v1";
        result.meta.fallback      = true;
        result.meta.fallbackReason = err.message;
        return result;
    }
}

module.exports = { predictRisk, mlModelsAvailable };
