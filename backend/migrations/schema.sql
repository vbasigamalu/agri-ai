-- =============================================================================
-- Agri-AI: Master PostgreSQL Database Schema Migration
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- 1. USERS & PROFILES
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    phone_or_email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'farmer' CHECK (role IN ('farmer', 'expert', 'officer', 'admin')),
    state VARCHAR(50) DEFAULT 'Maharashtra',
    district VARCHAR(50) NOT NULL DEFAULT 'Sangli',
    village VARCHAR(50) DEFAULT 'Miraj',
    preferred_language VARCHAR(10) DEFAULT 'mr' CHECK (preferred_language IN ('en', 'mr', 'hi')),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. FARMS & FIELD PARCELS
CREATE TABLE IF NOT EXISTS farms (
    id SERIAL PRIMARY KEY,
    farmer_id INT REFERENCES users(id) ON DELETE CASCADE,
    farm_name VARCHAR(100) DEFAULT 'Main Field',
    crop_type VARCHAR(100) NOT NULL,
    sowing_date DATE,
    geom GEOMETRY(Point, 4326),
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    district VARCHAR(50) NOT NULL,
    village VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. DIAGNOSIS CASES (Central Record)
CREATE TABLE IF NOT EXISTS cases (
    id SERIAL PRIMARY KEY,
    case_ref VARCHAR(50) UNIQUE NOT NULL, -- e.g. CASE-2026-1024
    farmer_id INT REFERENCES users(id) ON DELETE SET NULL,
    farm_id INT REFERENCES farms(id) ON DELETE SET NULL,
    farmer_name VARCHAR(100) DEFAULT 'Farmer',
    crop VARCHAR(100) NOT NULL,
    category VARCHAR(20) NOT NULL CHECK (category IN ('disease', 'pest')),
    current_status VARCHAR(30) DEFAULT 'active' CHECK (current_status IN ('active', 'under_review', 'resolved', 'closed')),
    primary_condition VARCHAR(150) NOT NULL,
    initial_confidence NUMERIC(5,2) NOT NULL,
    initial_severity VARCHAR(50) NOT NULL,
    field_latitude DOUBLE PRECISION NOT NULL,
    field_longitude DOUBLE PRECISION NOT NULL,
    district VARCHAR(100) DEFAULT 'Sangli',
    village VARCHAR(100) DEFAULT 'Miraj',
    geom GEOMETRY(Point, 4326),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 4. IMAGES (Object Storage Reference)
CREATE TABLE IF NOT EXISTS images (
    id SERIAL PRIMARY KEY,
    case_id INT REFERENCES cases(id) ON DELETE CASCADE,
    image_type VARCHAR(30) DEFAULT 'leaf_original' CHECK (image_type IN ('leaf_original', 'leaf_isolated', 'pest_trap', 'followup')),
    storage_url TEXT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size_bytes INT,
    mime_type VARCHAR(50) DEFAULT 'image/jpeg',
    quality_score INT DEFAULT 100,
    is_valid BOOLEAN DEFAULT TRUE,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 5. PREDICTIONS
CREATE TABLE IF NOT EXISTS predictions (
    id SERIAL PRIMARY KEY,
    case_id INT REFERENCES cases(id) ON DELETE CASCADE,
    image_id INT REFERENCES images(id) ON DELETE SET NULL,
    model_version VARCHAR(50) NOT NULL DEFAULT 'efficientnetv2-tomato-v1',
    predicted_label VARCHAR(150) NOT NULL,
    confidence_score NUMERIC(5,2) NOT NULL,
    severity VARCHAR(50),
    all_candidates JSONB DEFAULT '[]'::jsonb,
    vlm_consensus JSONB DEFAULT '{}'::jsonb,
    is_borderline BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 6. TREATMENTS & SPRAY RECOMMENDATIONS
CREATE TABLE IF NOT EXISTS treatments (
    id SERIAL PRIMARY KEY,
    case_id INT REFERENCES cases(id) ON DELETE CASCADE,
    spray_name VARCHAR(200) NOT NULL,
    cibrc_approved BOOLEAN DEFAULT TRUE,
    chemical_group VARCHAR(100),
    dosage_per_acre VARCHAR(100),
    dilution_water_liters INT,
    waiting_period_days INT,
    organic_alternatives TEXT[] DEFAULT '{}',
    safety_precautions TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 7. FOLLOW-UPS (Day 1 vs Day N Comparative Monitoring)
CREATE TABLE IF NOT EXISTS followups (
    id SERIAL PRIMARY KEY,
    case_id INT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    followup_number INT NOT NULL DEFAULT 1,
    scheduled_date DATE NOT NULL,
    completed_date TIMESTAMPTZ,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'overdue', 'skipped')),
    followup_image_id INT REFERENCES images(id) ON DELETE SET NULL,
    followup_prediction_id INT REFERENCES predictions(id) ON DELETE SET NULL,
    progression_status VARCHAR(20) CHECK (progression_status IN ('improving', 'stable', 'worsening', 'unclear')),
    severity_delta_percent NUMERIC(5,2),
    verdict TEXT,
    farmer_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 8. OBSERVATIONS
CREATE TABLE IF NOT EXISTS observations (
    id SERIAL PRIMARY KEY,
    followup_id INT NOT NULL REFERENCES followups(id) ON DELETE CASCADE,
    observed_leaf_count INT,
    new_lesions_present BOOLEAN DEFAULT FALSE,
    weather_impact_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 9. AGRICULTURAL KNOWLEDGE BASE
CREATE TABLE IF NOT EXISTS knowledge_base (
    id SERIAL PRIMARY KEY,
    crop VARCHAR(100) NOT NULL,
    disease_or_pest VARCHAR(150) NOT NULL,
    category VARCHAR(20) NOT NULL,
    symptoms_en TEXT NOT NULL,
    symptoms_mr TEXT NOT NULL,
    symptoms_hi TEXT NOT NULL,
    causes TEXT NOT NULL,
    rainfastness_hours INT DEFAULT 3,
    biological_treatment TEXT NOT NULL,
    chemical_treatment TEXT NOT NULL,
    cultural_prevention TEXT NOT NULL,
    favorable_weather JSONB NOT NULL DEFAULT '{}'::jsonb,
    expert_source VARCHAR(150) DEFAULT 'ICAR / Mahatma Phule Krishi Vidyapeeth (MPKV)',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 10. ALERTS & PUSH NOTIFICATIONS
CREATE TABLE IF NOT EXISTS alerts (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    alert_type VARCHAR(50) NOT NULL, -- 'disease_outbreak', 'pest_threshold', 'followup_due', 'weather_risk'
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    severity VARCHAR(20) DEFAULT 'warning',
    district VARCHAR(100) NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 11. ML EXPERIMENT TRACKING
CREATE TABLE IF NOT EXISTS ml_experiments (
    id SERIAL PRIMARY KEY,
    model_version VARCHAR(50) UNIQUE NOT NULL,
    architecture VARCHAR(100) NOT NULL,
    training_dataset_version VARCHAR(50) NOT NULL,
    total_images INT NOT NULL,
    class_count INT NOT NULL,
    epochs_trained INT NOT NULL,
    learning_rate FLOAT NOT NULL,
    val_accuracy NUMERIC(5,2) NOT NULL,
    val_precision NUMERIC(5,2) NOT NULL,
    val_recall NUMERIC(5,2) NOT NULL,
    val_f1_score NUMERIC(5,2) NOT NULL,
    confusion_matrix JSONB DEFAULT '{}'::jsonb,
    onnx_file_size_mb NUMERIC(6,2),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_cases_geom ON cases USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_cases_ref ON cases (case_ref);
CREATE INDEX IF NOT EXISTS idx_cases_status ON cases (current_status);
CREATE INDEX IF NOT EXISTS idx_followups_scheduled ON followups (scheduled_date, status);
CREATE INDEX IF NOT EXISTS idx_alerts_district ON alerts (district, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kb_lookup ON knowledge_base (crop, disease_or_pest);
