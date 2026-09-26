/**
 * routes/pestRoutes.js
 * ─────────────────────────────────────────────────────────────────────────────
 * REST API Endpoints for Pest Monitoring & Advisory
 * ─────────────────────────────────────────────────────────────────────────────
 */

const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");
const { PestLog } = require("../models");
const localPestStore = require("../localPestStore");
const { detectPest } = require("../pestDetector");
const { PEST_DATABASE, evaluateInfestation, forecastPestTrajectory } = require("../pestDatabase");
const { optionalAuth } = require("../middleware/auth");
const { recordSpatialReport } = require("../spatial");
const { enqueueCase } = require("../expert");

// Configure storage for uploaded pest trap images
const uploadDir = path.join(__dirname, "../../uploads/pests");
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname) || ".jpg";
        cb(null, "pest-" + uniqueSuffix + ext);
    }
});

const upload = multer({ storage });

/**
 * @route   POST /api/pest/detect
 * @desc    Upload pest photo & optional manual trap count -> identify pest & evaluate ETL severity
 */
router.post("/detect", optionalAuth, upload.single("image"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: "Please upload or capture an image of the pest or trap."
            });
        }

        const trapCount = parseInt(req.body.trapCount, 10) || 0;
        const crop = req.body.crop || "General Crop";
        const farmerName = (req.user && req.user.name) || req.body.farmerName || "Anonymous Farmer";
        const userId = (req.user && req.user.id) || req.body.userId || "guest";

        // Parse earlier days history
        let earlierDays = [];
        if (req.body.earlierDaysCounts) {
            try {
                earlierDays = typeof req.body.earlierDaysCounts === "string" 
                    ? JSON.parse(req.body.earlierDaysCounts) 
                    : req.body.earlierDaysCounts;
            } catch (e) {
                earlierDays = [];
            }
        }
        
        if (req.body.past3DaysCount !== undefined && req.body.past3DaysCount !== "") {
            const c3 = parseInt(req.body.past3DaysCount, 10);
            if (!isNaN(c3)) earlierDays.push({ daysAgo: 3, count: c3 });
        }
        if (req.body.past7DaysCount !== undefined && req.body.past7DaysCount !== "") {
            const c7 = parseInt(req.body.past7DaysCount, 10);
            if (!isNaN(c7)) earlierDays.push({ daysAgo: 7, count: c7 });
        }

        // Read buffer from disk for detector
        const buffer = fs.readFileSync(req.file.path);
        const detection = await detectPest(buffer, req.file.originalname);
        const pestId = detection.pestId;
        const pestInfo = PEST_DATABASE[pestId] || PEST_DATABASE.aphids;

        // Evaluate ETL & Severity
        const evalResult = evaluateInfestation(pestId, trapCount);

        // Run Outbreak Risk Forecasting
        const forecast = forecastPestTrajectory(pestId, trapCount, earlierDays);

        // Relative image url
        const imageUrl = `/uploads/pests/${path.basename(req.file.path)}`;

        // Automatically save record if requested or user is logged in
        let savedLog = null;
        const logPayload = {
            userId,
            farmerName,
            crop,
            pestName: pestInfo.name,
            pestId: pestInfo.id,
            scientificName: pestInfo.scientificName,
            confidence: detection.confidence,
            trapCount,
            economicThreshold: evalResult.threshold,
            severity: evalResult.severity,
            isEtlExceeded: evalResult.isEtlExceeded,
            earlierDaysCounts: earlierDays,
            forecast,
            chemicalControl: pestInfo.chemicalControl,
            biologicalControl: pestInfo.biologicalControl,
            preventiveMeasures: pestInfo.prevention,
            imagePath: imageUrl
        };

        if (mongoose.connection && mongoose.connection.readyState === 1) {
            try {
                savedLog = await PestLog.create(logPayload);
            } catch (dbErr) {
                console.warn("Could not save PestLog to MongoDB, falling back to local storage:", dbErr.message);
                savedLog = localPestStore.saveLog(logPayload);
            }
        } else {
            savedLog = localPestStore.saveLog(logPayload);
        }

        // Non-blocking PostGIS Spatial Outbreak Synchronizer
        const lat = parseFloat(req.body.lat) || (req.user && req.user.latitude) || null;
        const lon = parseFloat(req.body.lon) || (req.user && req.user.longitude) || null;

        if (lat && lon) {
            recordSpatialReport({
                farmerId: req.user ? req.user.id : null,
                farmerName: req.user ? req.user.name : (req.body.farmerName || "Farmer"),
                reportType: "pest",
                crop: crop || "Crop",
                disease: null,
                pest: pestInfo.name,
                severity: evalResult.severity || "Moderate",
                confidence: detection.confidence || 0.88,
                latitude: lat,
                longitude: lon,
                district: req.user ? req.user.district : (req.body.district || ""),
                village: req.user ? req.user.village : (req.body.village || ""),
                spray: pestInfo.chemicalControl || "N/A",
                notes: `Pest trap scan. Trap count: ${trapCount}. ETL Exceeded: ${evalResult.isEtlExceeded ? "YES" : "NO"}.`
            }).then(() => {
                console.log(`   🗺️ [PostGIS] Recorded pest outbreak [${pestInfo.name}] at [${lat.toFixed(2)}, ${lon.toFixed(2)}]`);
            }).catch(spErr => {
                console.warn("   ⚠️ PostGIS pest sync notice:", spErr.message);
            });
        }

        // ── Human-in-the-Loop Expert Validation Subsystem Synchronization ──
        let enqueuedCaseRef = null;
        const pestConfidence = detection.confidence || 0.65;
        const confPercent = parseFloat((pestConfidence * 100).toFixed(1));
        const shouldEnqueueExpert = pestConfidence < 0.75 || evalResult.isEtlExceeded || req.body.escalateToExpert === "true";

        if (shouldEnqueueExpert) {
            try {
                const enqueued = await enqueueCase({
                    category: "pest",
                    crop: crop || "Tomato",
                    aiDisease: `${pestInfo.name} (${pestInfo.scientificName || ""})`,
                    aiConfidence: confPercent,
                    aiSeverity: `${evalResult.severity} (Trap count: ${trapCount}, ETL: ${evalResult.isEtlExceeded ? "Exceeded" : "Normal"})`,
                    aiStatus: pestConfidence < 0.75 ? "uncertain" : "confirmed",
                    symptoms: pestInfo.symptoms || [`Pest infestation detected on ${crop}`],
                    vlmEvidence: {
                        pestId: pestInfo.id,
                        trapCount,
                        etlStatus: evalResult.severity,
                        morphologySummary: `${pestInfo.name} scouting report. Trap count: ${trapCount}.`
                    },
                    imageUrl: imageUrl,
                    imageName: path.basename(req.file.path),
                    farmerId: req.user ? req.user.id : null,
                    farmerName: farmerName,
                    district: (req.user && req.user.district) || req.body.district || "Sangli",
                    village: (req.user && req.user.village) || req.body.village || "Field",
                    latitude: lat || 16.8524,
                    longitude: lon || 74.5815
                });
                enqueuedCaseRef = enqueued.case_number;
                console.log(`   👨‍🔬 [Expert Queue] Enqueued Pest Case [${enqueuedCaseRef}] for ${pestInfo.name} (${confPercent}%)`);
            } catch (eqErr) {
                console.warn("   ⚠️ Expert pest enqueue notice:", eqErr.message);
            }
        }

        return res.json({
            success: true,
            pest: {
                id: pestInfo.id,
                name: pestInfo.name,
                scientificName: pestInfo.scientificName,
                vernacular: pestInfo.vernacular,
                confidence: detection.confidence,
                description: pestInfo.description,
                isRealModel: detection.isRealModel
            },
            infestation: {
                trapCount,
                threshold: evalResult.threshold,
                unit: pestInfo.etl.unit,
                etlGuidance: pestInfo.etl.guidance,
                severity: evalResult.severity,
                isEtlExceeded: evalResult.isEtlExceeded,
                statusColor: evalResult.statusColor,
                summaryText: evalResult.summaryText
            },
            forecast,
            recommendations: {
                symptoms: pestInfo.symptoms,
                biologicalControl: pestInfo.biologicalControl,
                chemicalControl: pestInfo.chemicalControl,
                prevention: pestInfo.prevention
            },
            expertValidation: {
                enqueued: !!enqueuedCaseRef,
                caseNumber: enqueuedCaseRef,
                confidencePercent: confPercent,
                isBorderline: pestConfidence < 0.75
            },
            logId: savedLog ? savedLog._id : null,
            imageUrl
        });

    } catch (err) {
        console.error("Pest detection endpoint error:", err);
        return res.status(500).json({
            success: false,
            error: "Failed to analyze pest image: " + err.message
        });
    }
});

/**
 * @route   GET /api/pest/history
 * @desc    Get historical pest monitoring reports for farmer
 */
router.get("/history", optionalAuth, async (req, res) => {
    try {
        const userId = (req.user && req.user.id) || req.query.userId;
        const filter = userId && userId !== "guest" ? { userId } : {};

        if (mongoose.connection && mongoose.connection.readyState === 1) {
            try {
                const logs = await PestLog.find(filter).sort({ timestamp: -1 }).limit(30);
                return res.json({
                    success: true,
                    count: logs.length,
                    logs
                });
            } catch (dbErr) {
                console.warn("MongoDB query failed, falling back to local logs:", dbErr.message);
            }
        }

        const localLogs = localPestStore.getLogs(filter);
        return res.json({
            success: true,
            count: localLogs.length,
            logs: localLogs,
            isLocalFallback: true
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            error: "Failed to fetch pest history: " + err.message
        });
    }
});

/**
 * @route   POST /api/pest/forecast-simulate
 * @desc    Simulate/recalculate outbreak risk forecast on the fly given pestId and history
 */
router.post("/forecast-simulate", (req, res) => {
    try {
        const pestId = (req.body.pestId || "aphids").toLowerCase();
        const trapCount = parseInt(req.body.trapCount, 10) || 0;
        
        let earlierDays = [];
        if (req.body.earlierDaysCounts) {
            try {
                earlierDays = typeof req.body.earlierDaysCounts === "string" 
                    ? JSON.parse(req.body.earlierDaysCounts) 
                    : req.body.earlierDaysCounts;
            } catch (e) {
                earlierDays = [];
            }
        }
        if (req.body.past3DaysCount !== undefined && req.body.past3DaysCount !== "") {
            const c3 = parseInt(req.body.past3DaysCount, 10);
            if (!isNaN(c3)) earlierDays.push({ daysAgo: 3, count: c3 });
        }
        if (req.body.past7DaysCount !== undefined && req.body.past7DaysCount !== "") {
            const c7 = parseInt(req.body.past7DaysCount, 10);
            if (!isNaN(c7)) earlierDays.push({ daysAgo: 7, count: c7 });
        }

        const pestInfo = PEST_DATABASE[pestId] || PEST_DATABASE.aphids;
        const evalResult = evaluateInfestation(pestId, trapCount);
        const forecast = forecastPestTrajectory(pestId, trapCount, earlierDays);

        return res.json({
            success: true,
            pest: {
                id: pestInfo.id,
                name: pestInfo.name,
                vernacular: pestInfo.vernacular
            },
            infestation: {
                trapCount,
                threshold: evalResult.threshold,
                unit: pestInfo.etl.unit,
                severity: evalResult.severity,
                isEtlExceeded: evalResult.isEtlExceeded,
                statusColor: evalResult.statusColor,
                summaryText: evalResult.summaryText
            },
            forecast
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            error: "Failed to simulate forecast: " + err.message
        });
    }
});

/**
 * @route   GET /api/pest/all
 * @desc    Get all 9 pests and their IPM management guide
 */
router.get("/all", (req, res) => {
    return res.json({
        success: true,
        pests: Object.values(PEST_DATABASE)
    });
});

module.exports = router;
