/**
 * riskEngine.js
 * Disease & Pest Risk Forecasting Engine  - Phase 1: Rule-Based
 * Phase 2: XGBoost / Random Forest (ml_forecaster.js - future)
 */
"use strict";

// DISEASE-FRIENDLY WEATHER PROFILES
const DISEASE_WEATHER_PROFILES = {
    early_blight:    { label: "Early Blight (Alternaria)",      tempRange: [24,29], humidityMin:80,  rainfallMin:5,  windMax:30,   weight:25 },
    late_blight:     { label: "Late Blight (Phytophthora)",     tempRange: [10,20], humidityMin:90,  rainfallMin:10, windMax:null, weight:30 },
    powdery_mildew:  { label: "Powdery Mildew",                 tempRange: [18,28], humidityMin:45,  rainfallMin:0,  windMax:null, weight:20 },
    downy_mildew:    { label: "Downy Mildew",                   tempRange: [15,23], humidityMin:85,  rainfallMin:8,  windMax:null, weight:25 },
    leaf_spot:       { label: "Leaf Spot (Cercospora)",         tempRange: [25,32], humidityMin:75,  rainfallMin:3,  windMax:null, weight:20 },
    rust:            { label: "Rust (Puccinia)",                tempRange: [15,25], humidityMin:70,  rainfallMin:2,  windMax:null, weight:22 }
};

// PEST-FRIENDLY WEATHER PROFILES
const PEST_WEATHER_PROFILES = {
    aphids:      { tempRange:[18,28], humidityMin:60,  weight:22 },
    mites:       { tempRange:[28,42], humidityMax:50,  weight:28 },
    armyworm:    { tempRange:[22,33], humidityMin:65,  weight:25 },
    bollworm:    { tempRange:[25,35], humidityMin:55,  weight:20 },
    stem_borer:  { tempRange:[20,30], humidityMin:70,  weight:18 },
    grasshopper: { tempRange:[30,42], humidityMax:40,  weight:15 },
    sawfly:      { tempRange:[15,25], humidityMin:60,  weight:12 },
    beetle:      { tempRange:[20,35], humidityMin:50,  weight:15 },
    mosquito:    { tempRange:[22,35], humidityMin:80,  weight:10 }
};

// STAGE MULTIPLIERS
const STAGE_DISEASE_MULTIPLIERS = { seedling:0.6, vegetative:0.8, flowering:1.3, fruiting:1.25, harvest:0.5, default:1.0 };
const STAGE_PEST_MULTIPLIERS    = { seedling:0.9, vegetative:1.1, flowering:1.2, fruiting:1.15, harvest:0.7, default:1.0 };

// ETL (Economic Threshold Levels)
const PEST_ETL = { aphids:20, mites:15, armyworm:10, bollworm:8, stem_borer:5, grasshopper:12, sawfly:10, beetle:15, mosquito:50 };

// HELPERS
function clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }
function scoreToLevel(s) {
    if (s >= 75) return "CRITICAL";
    if (s >= 55) return "HIGH";
    if (s >= 35) return "MEDIUM";
    return "LOW";
}
function normaliseStageName(raw) {
    if (!raw) return "default";
    const s = raw.toLowerCase().trim();
    if (s.includes("seed"))    return "seedling";
    if (s.includes("veg"))     return "vegetative";
    if (s.includes("flower"))  return "flowering";
    if (s.includes("fruit"))   return "fruiting";
    if (s.includes("harvest")) return "harvest";
    return "default";
}
function historyWeight(daysAgo) {
    if (daysAgo <= 2)  return 1.0;
    if (daysAgo <= 5)  return 0.8;
    if (daysAgo <= 10) return 0.5;
    if (daysAgo <= 14) return 0.25;
    return 0.0;
}
function severityToMultiplier(severity) {
    const map = { critical:1.5, severe:1.3, moderate:1.0, mild:0.6, healthy:0.0 };
    return map[(severity||"").toLowerCase()] ?? 0.5;
}

// DISEASE RISK COMPUTE
function computeDiseaseRisk(weather, cropStage, diseaseHistory, previousReports) {
    const drivers = [];
    let raw = 0;
    const temp     = weather.temp_c       ?? 25;
    const humidity = weather.humidity_pct ?? 60;
    const rainfall = weather.rainfall_mm  ?? 0;
    const dew      = weather.dew_point_c  ?? null;
    const wind     = weather.wind_kmh     ?? 15;

    // 1. Weather profile matching (max 40 pts)
    let weatherContrib = 0;
    const matchedDiseases = [];
    for (const [key, p] of Object.entries(DISEASE_WEATHER_PROFILES)) {
        const [tMin, tMax] = p.tempRange;
        const matches = [
            temp >= tMin && temp <= tMax,
            humidity >= (p.humidityMin ?? 0),
            rainfall >= (p.rainfallMin ?? 0),
            p.windMax == null || wind <= p.windMax
        ].filter(Boolean).length;
        const ratio = matches / 4;
        if (ratio >= 0.5) {
            const contrib = Math.round(p.weight * ratio);
            weatherContrib = Math.max(weatherContrib, contrib);
            matchedDiseases.push(`${p.label} (+${contrib})`);
        }
    }
    weatherContrib = Math.min(40, weatherContrib);
    raw += weatherContrib;
    if (matchedDiseases.length > 0) {
        drivers.push(`Weather favours: ${matchedDiseases.join(", ")} (+${weatherContrib} pts)`);
    } else {
        drivers.push("Current weather is not strongly disease-favourable");
    }

    // 2. Dew-point / wetness bonus (max 15 pts)
    let dewBonus = 0;
    if (dew !== null) {
        const spread = temp - dew;
        if (spread <= 2) { dewBonus = 15; drivers.push("Dew-point near air temp — high leaf wetness risk (+15 pts)"); }
        else if (spread <= 5) { dewBonus = 8; drivers.push("Moderate leaf wetness risk (+8 pts)"); }
    } else if (humidity >= 85 && rainfall > 0) {
        dewBonus = 10;
        drivers.push("High humidity + rainfall — fungal infection window (+10 pts)");
    }
    raw += dewBonus;

    // 3. Disease history (max 30 pts)
    let histContrib = 0;
    if (Array.isArray(diseaseHistory) && diseaseHistory.length > 0) {
        for (const rec of diseaseHistory) {
            const w = historyWeight(rec.daysAgo ?? 30);
            const m = severityToMultiplier(rec.severity);
            const c = Math.round(15 * w * m);
            histContrib += c;
            if (c > 0) drivers.push(`History: ${rec.disease||"disease"} (${rec.daysAgo||"?"}d ago, ${rec.severity||"unknown"} severity) (+${c} pts)`);
        }
        histContrib = Math.min(30, histContrib);
        raw += histContrib;
    }

    // 4. Previous reports (max 15 pts)
    let repContrib = 0;
    if (Array.isArray(previousReports) && previousReports.length > 0) {
        for (const rep of previousReports.filter(r => r.type==="disease"||r.type==="overall")) {
            const w = historyWeight(rep.daysAgo ?? 30);
            if (rep.riskLevel==="HIGH"||rep.riskLevel==="CRITICAL") repContrib += Math.round(15*w);
            else if (rep.riskLevel==="MEDIUM") repContrib += Math.round(8*w);
        }
        repContrib = Math.min(15, repContrib);
        if (repContrib > 0) { drivers.push(`Prior forecast reports indicate elevated risk (+${repContrib} pts)`); raw += repContrib; }
    }

    // Apply stage multiplier
    const stage = normaliseStageName(cropStage);
    const mul = STAGE_DISEASE_MULTIPLIERS[stage] ?? 1.0;
    if (mul > 1.0) drivers.push(`Crop at ${stage} stage — high disease vulnerability (x${mul})`);
    raw = Math.round(raw * mul);
    const score = clamp(raw, 0, 100);
    return { score, level: scoreToLevel(score), drivers };
}

// PEST RISK COMPUTE
function computePestRisk(weather, cropStage, pestCount, previousReports) {
    const drivers = [];
    let raw = 0;
    const temp     = weather.temp_c       ?? 25;
    const humidity = weather.humidity_pct ?? 60;

    // 1. ETL count scoring (max 50 pts)
    let etlContrib = 0;
    const activePests = [];
    if (pestCount && typeof pestCount === "object") {
        for (const [pest, count] of Object.entries(pestCount)) {
            const etl = PEST_ETL[pest.toLowerCase()] ?? 20;
            const ratio = count / etl;
            let pts = 0;
            if (ratio >= 2.0) pts = 50;
            else if (ratio >= 1.0) pts = 35;
            else if (ratio >= 0.75) pts = 20;
            else if (ratio >= 0.5)  pts = 10;
            else if (ratio > 0)     pts = 5;
            if (pts > 0) {
                etlContrib = Math.max(etlContrib, pts);
                activePests.push(pest.toLowerCase());
                drivers.push(`${pest}: count ${count} (ETL=${etl}, ratio=${ratio.toFixed(2)}) +${pts} pts`);
            }
        }
    }
    etlContrib = Math.min(50, etlContrib);
    raw += etlContrib;

    // 2. Weather suitability (max 30 pts)
    let wContrib = 0;
    const checkList = activePests.length > 0 ? activePests : Object.keys(PEST_WEATHER_PROFILES);
    for (const pest of checkList) {
        const p = PEST_WEATHER_PROFILES[pest];
        if (!p) continue;
        const [tMin, tMax] = p.tempRange;
        const tempOk  = temp >= tMin && temp <= tMax;
        const humidOk = p.humidityMin != null ? humidity >= p.humidityMin
                      : p.humidityMax != null ? humidity <= p.humidityMax : true;
        const ratio = ([tempOk, humidOk].filter(Boolean).length) / 2;
        if (ratio >= 0.5) wContrib = Math.max(wContrib, Math.round(p.weight * ratio));
    }
    wContrib = Math.min(30, wContrib);
    if (wContrib > 0) { raw += wContrib; drivers.push(`Weather favourable for pest proliferation (+${wContrib} pts)`); }

    // 3. Previous reports (max 20 pts)
    let repContrib = 0;
    if (Array.isArray(previousReports) && previousReports.length > 0) {
        for (const rep of previousReports.filter(r => r.type==="pest"||r.type==="overall")) {
            const w = historyWeight(rep.daysAgo ?? 30);
            if (rep.riskLevel==="HIGH"||rep.riskLevel==="CRITICAL") repContrib += Math.round(20*w);
            else if (rep.riskLevel==="MEDIUM") repContrib += Math.round(10*w);
        }
        repContrib = Math.min(20, repContrib);
        if (repContrib > 0) { drivers.push(`Prior pest reports elevated (+${repContrib} pts)`); raw += repContrib; }
    }

    // Apply stage multiplier
    const stage = normaliseStageName(cropStage);
    const mul = STAGE_PEST_MULTIPLIERS[stage] ?? 1.0;
    if (mul > 1.0) drivers.push(`Crop at ${stage} stage — increased pest vulnerability (x${mul})`);
    raw = Math.round(raw * mul);
    const score = clamp(raw, 0, 100);
    return { score, level: scoreToLevel(score), drivers };
}

// OVERALL RISK (disease 55% + pest 45%)
function computeOverallRisk(dr, pr) {
    const combined = Math.round(dr.score * 0.55 + pr.score * 0.45);
    const score = clamp(combined, 0, 100);
    let level = scoreToLevel(score);
    // Escalate if any sub-risk is CRITICAL
    if ((dr.level === "CRITICAL" || pr.level === "CRITICAL") && level === "MEDIUM") level = "HIGH";
    return { score, level };
}

// ADVISORY GENERATOR
function generateAdvisory(dr, pr, overall, weather, crop, cropStage, forecastDays) {
    const advisory = [];
    const stage = normaliseStageName(cropStage);
    const cropStr = crop || "crop";

    if (overall.level === "CRITICAL") {
        advisory.push(`CRITICAL ALERT: Immediate field inspection required. Both disease and pest risks are dangerously high for ${cropStr}.`);
    } else if (overall.level === "HIGH") {
        advisory.push(`HIGH RISK: Scout ${cropStr} fields within 24 hours. Preventive/curative measures should be deployed now.`);
    } else if (overall.level === "MEDIUM") {
        advisory.push(`MODERATE RISK: Monitor fields every 2-3 days over the next ${forecastDays} days. Be prepared for rapid escalation.`);
    } else {
        advisory.push(`LOW RISK: Current conditions are relatively safe. Continue routine scouting.`);
    }

    if (dr.score >= 55) {
        const hum = weather.humidity_pct ?? 60;
        const rain = weather.rainfall_mm ?? 0;
        if (hum > 80 || rain > 5) advisory.push("High humidity/rainfall: apply preventive fungicide (Mancozeb 75% WP @ 2.5 g/L or Chlorothalonil 75% WP @ 2 g/L).");
        advisory.push("Remove and destroy infected plant debris to break the disease cycle.");
    }
    if (dr.score >= 75) advisory.push("Apply curative fungicide immediately. Consult local KVK or plant health specialist.");
    if (pr.score >= 35) advisory.push("Install/check pheromone traps and sticky traps to monitor pest pressure.");
    if (pr.score >= 55) advisory.push("Apply biopesticides: Neem Oil 1500 ppm @ 5 ml/L or Beauveria bassiana @ 5 g/L at dusk.");
    if (pr.score >= 75) advisory.push("Chemical intervention required: Imidacloprid 17.8% SL @ 0.5 ml/L or Chlorpyrifos 20% EC @ 2 ml/L after ETL breach.");
    if (stage === "flowering") advisory.push("Avoid broad-spectrum insecticides during flowering to protect pollinators. Use selective/biopesticides.");
    if (stage === "seedling")  advisory.push("Seedling stage: focus on damping-off prevention (Trichoderma viride @ 4 g/kg soil drench).");
    const temp = weather.temp_c ?? 25;
    if (temp > 38) advisory.push("Extreme heat stress weakens plant immunity. Ensure adequate irrigation.");
    const wind = weather.wind_kmh ?? 15;
    if (wind > 30) advisory.push("High wind speeds can spread fungal spores. Windbreak planting recommended.");
    advisory.push(`Re-assess risk after ${forecastDays} days or next significant rainfall event.`);
    return advisory;
}

// MAIN ENTRY POINT
function computeRisk(inputs = {}) {
    const {
        weather         = {},
        crop            = "Unknown",
        cropStage       = "Vegetative",
        location        = {},
        diseaseHistory  = [],
        pestCount       = {},
        previousReports = [],
        forecastDays    = 3
    } = inputs;

    const days = clamp(parseInt(forecastDays, 10) || 3, 1, 7);
    const dr   = computeDiseaseRisk(weather, cropStage, diseaseHistory, previousReports);
    const pr   = computePestRisk(weather, cropStage, pestCount, previousReports);
    const or_  = computeOverallRisk(dr, pr);
    const advisory = generateAdvisory(dr, pr, or_, weather, crop, cropStage, days);

    return {
        diseaseRisk:  { score: dr.score, level: dr.level, drivers: dr.drivers },
        pestRisk:     { score: pr.score, level: pr.level, drivers: pr.drivers },
        overallRisk:  { score: or_.score, level: or_.level },
        advisory,
        forecast: {
            days,
            summary: `${crop||"Crop"} faces ${or_.level} risk over the next ${days} day(s). Disease: ${dr.score}% (${dr.level}), Pest: ${pr.score}% (${pr.level}).`,
            diseaseRiskSummary: `Disease Risk: ${dr.score}% (${dr.level})`,
            pestRiskSummary:    `Pest Risk: ${pr.score}% (${pr.level})`
        },
        meta: {
            engine:      "rule-based-v1",
            timestamp:   new Date().toISOString(),
            crop,
            cropStage,
            location,
            forecastDays: days
        }
    };
}

module.exports = { computeRisk };
