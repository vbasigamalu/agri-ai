"""
train_forecaster.py
===================
Phase 2 - XGBoost Risk Forecasting Model Training
---------------------------------------------------
Generates synthetic (but agronomically realistic) training data,
trains two XGBoost classifiers:
  1. disease_risk_model  → predicts disease risk score (0-100)
  2. pest_risk_model     → predicts pest risk score (0-100)

Then saves both as JSON (xgboost native format) for portability.

Feature vector (14 features):
  [0]  temp_c
  [1]  humidity_pct
  [2]  rainfall_mm
  [3]  wind_kmh
  [4]  dew_spread         (temp - dew_point, if available; else 10)
  [5]  stage_enc          (seedling=0, vegetative=1, flowering=2, fruiting=3, harvest=4)
  [6]  disease_hist_score (weighted history severity, 0-1)
  [7]  pest_etl_ratio     (max pest count / ETL, capped at 3.0)
  [8]  prev_disease_risk  (encoded previous disease report level 0-3)
  [9]  prev_pest_risk     (encoded previous pest report level 0-3)
  [10] rainfall_x_humidity  (interaction term)
  [11] temp_humidity_diff
  [12] is_humid_warm        (humid >80% AND temp 20-30)
  [13] is_hot_dry           (temp >32 AND humidity <50)
"""

import numpy as np
import pandas as pd
from xgboost import XGBRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, r2_score
import json
import os
import sys

SEED = 42
N_SAMPLES = 12000
MODEL_DIR = os.path.dirname(os.path.abspath(__file__))

# ─────────────────────────────────────────────────────────────────────────────
# LABEL GENERATION  (rule-based engine used as oracle for synthetic labels)
# ─────────────────────────────────────────────────────────────────────────────

def rule_disease_score(temp, hum, rain, wind, dew_spread, stage_enc,
                       hist_score, prev_d_risk):
    """Mimics the rule-based engine to generate training labels."""
    # Weather match
    w = 0
    if 24 <= temp <= 29 and hum >= 80 and rain >= 5: w = max(w, 25)   # early blight
    if 10 <= temp <= 20 and hum >= 90 and rain >= 10: w = max(w, 30)  # late blight
    if 18 <= temp <= 28 and hum >= 45:                w = max(w, 20)  # powdery mildew
    if 15 <= temp <= 23 and hum >= 85 and rain >= 8:  w = max(w, 25)  # downy mildew
    if 25 <= temp <= 32 and hum >= 75 and rain >= 3:  w = max(w, 20)  # leaf spot
    if 15 <= temp <= 25 and hum >= 70 and rain >= 2:  w = max(w, 22)  # rust
    w = min(w, 40)
    # Dew bonus
    d = 0
    if dew_spread <= 2:  d = 15
    elif dew_spread <= 5: d = 8
    elif hum >= 85 and rain > 0: d = 10
    # History
    h = min(hist_score * 30, 30)
    # Reports
    r = min(prev_d_risk * 5, 15)
    raw = w + d + h + r
    # Stage multiplier
    muls = [0.6, 0.8, 1.3, 1.25, 0.5]
    raw *= muls[stage_enc] if 0 <= stage_enc <= 4 else 1.0
    return float(np.clip(raw, 0, 100))

def rule_pest_score(temp, hum, pest_etl_ratio, stage_enc, prev_p_risk):
    """Mimics the rule-based engine to generate pest training labels."""
    # ETL
    if pest_etl_ratio >= 2.0: e = 50
    elif pest_etl_ratio >= 1.0: e = 35
    elif pest_etl_ratio >= 0.75: e = 20
    elif pest_etl_ratio >= 0.5: e = 10
    elif pest_etl_ratio > 0: e = 5
    else: e = 0
    # Weather
    w = 0
    if 18 <= temp <= 28 and hum >= 60: w = max(w, 22)  # aphids
    if 28 <= temp <= 42 and hum <= 50: w = max(w, 28)  # mites
    if 22 <= temp <= 33 and hum >= 65: w = max(w, 25)  # armyworm
    if 25 <= temp <= 35 and hum >= 55: w = max(w, 20)  # bollworm
    w = min(w, 30)
    r = min(prev_p_risk * 5, 20)
    raw = e + w + r
    muls = [0.9, 1.1, 1.2, 1.15, 0.7]
    raw *= muls[stage_enc] if 0 <= stage_enc <= 4 else 1.0
    return float(np.clip(raw, 0, 100))

# ─────────────────────────────────────────────────────────────────────────────
# SYNTHETIC DATA GENERATION
# ─────────────────────────────────────────────────────────────────────────────

def generate_dataset(n=N_SAMPLES, seed=SEED):
    rng = np.random.default_rng(seed)

    temp        = rng.uniform(8,  45,  n)
    humidity    = rng.uniform(20, 100, n)
    rainfall    = rng.uniform(0,  50,  n)
    wind        = rng.uniform(0,  60,  n)
    dew_spread  = rng.uniform(0,  20,  n)   # temp - dew_point
    stage_enc   = rng.integers(0, 5,   n)   # 0-4
    hist_score  = rng.uniform(0,  1,   n)   # weighted severity 0-1
    etl_ratio   = rng.uniform(0,  3,   n)   # pest count / ETL, capped 3
    prev_d_risk = rng.integers(0, 4,   n)   # 0=NONE,1=LOW,2=MEDIUM,3=HIGH/CRITICAL
    prev_p_risk = rng.integers(0, 4,   n)

    # Interaction features
    rain_x_hum  = rainfall * humidity / 100.0
    temp_hum_diff = temp - humidity
    is_humid_warm = ((humidity > 80) & (temp >= 20) & (temp <= 30)).astype(float)
    is_hot_dry    = ((temp > 32) & (humidity < 50)).astype(float)

    # Labels (from rule oracle + calibrated noise)
    disease_labels = np.array([
        rule_disease_score(temp[i], humidity[i], rainfall[i], wind[i],
                           dew_spread[i], stage_enc[i], hist_score[i], prev_d_risk[i])
        for i in range(n)
    ])
    pest_labels = np.array([
        rule_pest_score(temp[i], humidity[i], etl_ratio[i], stage_enc[i], prev_p_risk[i])
        for i in range(n)
    ])

    # Add calibrated noise to make model generalise beyond rule-based
    disease_labels = np.clip(disease_labels + rng.normal(0, 3, n), 0, 100)
    pest_labels    = np.clip(pest_labels    + rng.normal(0, 3, n), 0, 100)

    X = np.column_stack([
        temp, humidity, rainfall, wind, dew_spread, stage_enc,
        hist_score, etl_ratio, prev_d_risk, prev_p_risk,
        rain_x_hum, temp_hum_diff, is_humid_warm, is_hot_dry
    ])

    return X, disease_labels, pest_labels

FEATURE_NAMES = [
    "temp_c", "humidity_pct", "rainfall_mm", "wind_kmh", "dew_spread",
    "stage_enc", "disease_hist_score", "pest_etl_ratio",
    "prev_disease_risk", "prev_pest_risk",
    "rainfall_x_humidity", "temp_humidity_diff",
    "is_humid_warm", "is_hot_dry"
]

# ─────────────────────────────────────────────────────────────────────────────
# TRAIN
# ─────────────────────────────────────────────────────────────────────────────

def train_model(X, y, label):
    X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.15, random_state=SEED)
    model = XGBRegressor(
        n_estimators    = 300,
        max_depth       = 6,
        learning_rate   = 0.05,
        subsample       = 0.85,
        colsample_bytree= 0.85,
        reg_alpha       = 0.1,
        reg_lambda      = 1.0,
        random_state    = SEED,
        n_jobs          = -1,
        tree_method     = "hist"
    )
    model.fit(X_tr, y_tr, eval_set=[(X_te, y_te)], verbose=False)
    preds = model.predict(X_te)
    mae = mean_absolute_error(y_te, preds)
    r2  = r2_score(y_te, preds)
    print(f"  [{label}]  MAE={mae:.2f}  R²={r2:.4f}")
    return model

def main():
    print("Generating synthetic training data...")
    X, d_labels, p_labels = generate_dataset()
    print(f"  Dataset: {X.shape[0]} samples, {X.shape[1]} features")

    print("Training Disease Risk Model...")
    disease_model = train_model(X, d_labels, "Disease")

    print("Training Pest Risk Model...")
    pest_model    = train_model(X, p_labels, "Pest")

    # Save as XGBoost JSON (cross-platform, no pickle)
    d_path = os.path.join(MODEL_DIR, "disease_risk_model.json")
    p_path = os.path.join(MODEL_DIR, "pest_risk_model.json")
    disease_model.save_model(d_path)
    pest_model.save_model(p_path)
    print(f"Models saved:")
    print(f"  {d_path}")
    print(f"  {p_path}")

    # Save feature names for validation
    meta = {
        "feature_names": FEATURE_NAMES,
        "n_features": len(FEATURE_NAMES),
        "trained_on": N_SAMPLES,
        "engine": "xgboost-phase2"
    }
    with open(os.path.join(MODEL_DIR, "forecast_model_meta.json"), "w") as f:
        json.dump(meta, f, indent=2)
    print("Meta saved: forecast_model_meta.json")
    print("Done.")

if __name__ == "__main__":
    main()
