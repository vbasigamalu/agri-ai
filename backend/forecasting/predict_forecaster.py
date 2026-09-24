"""
predict_forecaster.py
======================
Phase 2 - XGBoost Inference Script
------------------------------------
Called by mlForecaster.js via child_process.
Reads a JSON payload from stdin, returns JSON result to stdout.

stdin  -> JSON string with feature dict
stdout -> JSON string with { disease_score, pest_score, engine, features_used }
"""
import sys
import json
import os
import numpy as np

MODEL_DIR = os.path.dirname(os.path.abspath(__file__))

def load_models():
    from xgboost import XGBRegressor
    d_model = XGBRegressor()
    d_model.load_model(os.path.join(MODEL_DIR, "disease_risk_model.json"))
    p_model = XGBRegressor()
    p_model.load_model(os.path.join(MODEL_DIR, "pest_risk_model.json"))
    return d_model, p_model

STAGE_MAP = {
    "seedling":   0,
    "vegetative": 1,
    "flowering":  2,
    "fruiting":   3,
    "harvest":    4,
    "default":    1
}

RISK_LEVEL_MAP = {
    "NONE": 0, "LOW": 1, "MEDIUM": 2, "HIGH": 3, "CRITICAL": 3
}

def normalise_stage(raw):
    if not raw:
        return 1
    s = raw.lower().strip()
    if "seed"    in s: return 0
    if "veg"     in s: return 1
    if "flower"  in s: return 2
    if "fruit"   in s: return 3
    if "harvest" in s: return 4
    return 1

def compute_hist_score(disease_history):
    """Convert disease history list to weighted 0-1 score."""
    if not disease_history:
        return 0.0
    SEV_MAP = {"critical": 1.0, "severe": 0.8, "moderate": 0.5, "mild": 0.2, "healthy": 0.0}
    DECAY   = {2: 1.0, 5: 0.8, 10: 0.5, 14: 0.25}
    total = 0.0
    for rec in disease_history:
        days = rec.get("daysAgo", 30)
        sev  = SEV_MAP.get((rec.get("severity") or "").lower(), 0.3)
        if days <= 2:   w = 1.0
        elif days <= 5: w = 0.8
        elif days <= 10: w = 0.5
        elif days <= 14: w = 0.25
        else: w = 0.0
        total += w * sev
    return min(total, 1.0)

PEST_ETL = {
    "aphids": 20, "mites": 15, "armyworm": 10, "bollworm": 8,
    "stem_borer": 5, "grasshopper": 12, "sawfly": 10, "beetle": 15, "mosquito": 50
}

def compute_etl_ratio(pest_count):
    """Max count / ETL across all pests, capped at 3."""
    if not pest_count:
        return 0.0
    ratios = []
    for pest, count in pest_count.items():
        etl = PEST_ETL.get(pest.lower(), 20)
        ratios.append(count / etl)
    return min(max(ratios) if ratios else 0.0, 3.0)

def prev_risk_enc(previous_reports, rtype):
    """Max risk level from previous reports of given type."""
    best = 0
    for rep in (previous_reports or []):
        if rep.get("type") in (rtype, "overall"):
            enc = RISK_LEVEL_MAP.get((rep.get("riskLevel") or "").upper(), 0)
            best = max(best, enc)
    return best

def build_feature_vector(payload):
    w            = payload.get("weather", {})
    temp         = float(w.get("temp_c", 25))
    humidity     = float(w.get("humidity_pct", 60))
    rainfall     = float(w.get("rainfall_mm", 0))
    wind         = float(w.get("wind_kmh", 15))
    dew_point    = w.get("dew_point_c", None)
    dew_spread   = (temp - float(dew_point)) if dew_point is not None else 10.0

    stage_enc    = normalise_stage(payload.get("cropStage", "Vegetative"))
    hist_score   = compute_hist_score(payload.get("diseaseHistory", []))
    etl_ratio    = compute_etl_ratio(payload.get("pestCount", {}))
    prev_d_risk  = prev_risk_enc(payload.get("previousReports", []), "disease")
    prev_p_risk  = prev_risk_enc(payload.get("previousReports", []), "pest")

    rain_x_hum      = rainfall * humidity / 100.0
    temp_hum_diff   = temp - humidity
    is_humid_warm   = float(humidity > 80 and 20 <= temp <= 30)
    is_hot_dry      = float(temp > 32 and humidity < 50)

    features = [
        temp, humidity, rainfall, wind, dew_spread,
        stage_enc, hist_score, etl_ratio,
        prev_d_risk, prev_p_risk,
        rain_x_hum, temp_hum_diff, is_humid_warm, is_hot_dry
    ]
    return np.array(features, dtype=np.float64).reshape(1, -1)

def score_to_level(score):
    if score >= 75: return "CRITICAL"
    if score >= 55: return "HIGH"
    if score >= 35: return "MEDIUM"
    return "LOW"

def main():
    raw = sys.stdin.read().strip()
    if not raw:
        print(json.dumps({"error": "No input received"}))
        sys.exit(1)

    try:
        payload = json.loads(raw)
    except Exception as e:
        print(json.dumps({"error": f"JSON parse error: {str(e)}"}))
        sys.exit(1)

    try:
        d_model, p_model = load_models()
    except Exception as e:
        print(json.dumps({"error": f"Model load error: {str(e)}"}))
        sys.exit(1)

    try:
        X = build_feature_vector(payload)
        disease_score = float(np.clip(d_model.predict(X)[0], 0, 100))
        pest_score    = float(np.clip(p_model.predict(X)[0], 0, 100))

        result = {
            "disease_score": round(disease_score, 1),
            "pest_score":    round(pest_score,    1),
            "disease_level": score_to_level(disease_score),
            "pest_level":    score_to_level(pest_score),
            "engine":        "xgboost-v1",
            "features_used": 14
        }
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"error": f"Prediction error: {str(e)}"}))
        sys.exit(1)

if __name__ == "__main__":
    main()
