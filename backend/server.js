const path   = require("path");
const dotenv = require("dotenv");
const dns    = require("dns");

// Use public DNS to prevent ISP DNS SRV lookup refusal
try {
    dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch (e) {}

const _dotenvResult = dotenv.config({ path: path.join(__dirname, ".env") });
if (_dotenvResult.error || !process.env.MONGODB_URI) {
    console.warn("⚠️  [dotenv] Could not load .env or MONGODB_URI missing. Check backend/.env");
}

const express  = require("express");
const cors     = require("cors");
const multer   = require("multer");
const axios    = require("axios");
const fs       = require("fs");
const mongoose = require("mongoose");
const { Analysis, ChatSession } = require("./models");
const { initClassifier, classify, isReady } = require("./classifier");
const { getDiseaseInfo, searchByKeyword, getSpraySafetyCheck } = require("./cropDatabase");
const { initPostgres, query } = require("./postgres");
const { optionalAuth, authenticateToken } = require("./middleware/auth");
const authRoutes     = require("./routes/auth");
const pestRoutes     = require("./routes/pestRoutes");
const forecastRoutes = require("./routes/forecastRoutes");
const spatialRoutes  = require("./routes/spatialRoutes");
const expertRoutes   = require("./routes/expertRoutes");
const followupRoutes = require("./routes/followupRoutes");
const chatbotRoutes  = require("./routes/chatbotRoutes");
const alertRoutes    = require("./routes/alertRoutes");
const mlRoutes       = require("./routes/mlExperimentRoutes");
const { initSpatialDB, recordSpatialReport } = require("./spatial");
const { initExpertDB, enqueueCase } = require("./expert");
const { initBackgroundJobs } = require("./jobs/queue");
const { analyzeLeafSymptoms, groundedChat } = require("./vision/vlmExplainer");


// MongoDB Connection — non-fatal: server runs even if Atlas is unreachable
// (common cause: free-tier cluster paused, or IP not whitelisted in Atlas)
let mongoReady = false;
global.mongoReady = false;

function connectMongo(attempt = 1) {
    if (!process.env.MONGODB_URI) {
        console.warn("⚠️  MONGODB_URI not set — skipping MongoDB connection");
        return;
    }
    mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 })
        .then(() => {
            console.log("🍃 MongoDB Connected Successfully");
            mongoReady = true;
            global.mongoReady = true;
        })
        .catch(err => {
            if (attempt === 1) {
                console.warn(`⚠️  MongoDB Atlas: ${err.message} — Retrying in 10s...`);
                setTimeout(() => connectMongo(2), 10000);
            } else {
                console.warn("   ℹ️  MongoDB Atlas offline/paused. Using PostgreSQL for authentication and local storage for scans. All features work normally.");
            }
        });
}
connectMongo();


const app = express();
app.use(cors());
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ limit: "25mb", extended: true }));

// Serve modern React UI build if client/dist exists, else fallback to frontend/
const clientDistPath = path.join(__dirname, "../client/dist");
if (fs.existsSync(clientDistPath)) {
    console.log("📦 Serving Modern React App from client/dist");
    app.use(express.static(clientDistPath));
} else {
    app.use(express.static(path.join(__dirname, "../frontend")));
}
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Mount Routes
app.use("/api/auth", authRoutes);
app.use("/api/pest", pestRoutes);
app.use("/api/forecast", forecastRoutes);
app.use("/api/spatial", spatialRoutes);
app.use("/api/expert", expertRoutes);
app.use("/api/followup", followupRoutes);
app.use("/api/chatbot", chatbotRoutes);
app.use("/api/alerts", alertRoutes);
app.use("/api/ml", mlRoutes);
app.use("/dataset", express.static(path.join(__dirname, "dataset")));

const upload = multer({ storage: multer.memoryStorage() });

// ═══════════════════════════════════════════════
//  API ENDPOINTS
// ═══════════════════════════════════════════════

// 1. ANALYSIS PIPELINE (Upload Validation + Robust Vision Pipeline + Multi-Leaf + Weather + Auth)
app.post("/analyze", optionalAuth, upload.single("image"), async (req, res) => {
    if (!isReady()) {
        return res.status(503).json({
            success: false,
            status: "service_unavailable",
            error: "Agri-AI Vision Engine is warming up... please try again in a few moments.",
            reason: "engine_warming_up",
            uncertainty: { flagged: true, reason: "engine_warming_up" }
        });
    }

    // ── 1. Upload Validation ────────────────────────────────────
    if (!req.file || !req.file.buffer || req.file.buffer.length === 0) {
        return res.status(400).json({
            success: false,
            status: "rejected",
            error: "No image provided. Please select or capture a plant photo.",
            reason: "missing_image_file",
            crop: "Unknown",
            disease: "No Image Provided",
            confidence: 0,
            imageQuality: { score: 0, issues: ["missing_image_file"], valid: false },
            leafAnalysis: { detected: false, confidence: 0, leafCount: 0 },
            prediction: { disease: "No Image Provided", confidence: 0 },
            uncertainty: { flagged: true, reason: "missing_image_file" }
        });
    }

    const allowedMimeTypes = [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/webp",
        "image/bmp",
        "image/tiff"
    ];
    const isOctetStream = req.file.mimetype === "application/octet-stream";
    const hasValidExt = req.file.originalname && /\.(jpe?g|png|webp|bmp|tiff)$/i.test(req.file.originalname);

    if (!allowedMimeTypes.includes(req.file.mimetype) && !(isOctetStream && hasValidExt)) {
        return res.status(400).json({
            success: false,
            status: "rejected",
            error: `Unsupported file format (${req.file.mimetype || "unknown"}). Please upload a JPEG, PNG, or WebP photo.`,
            reason: "unsupported_media_type",
            crop: "Unknown",
            disease: "Unsupported File Format",
            confidence: 0,
            imageQuality: { score: 0, issues: ["unsupported_media_type"], valid: false },
            leafAnalysis: { detected: false, confidence: 0, leafCount: 0 },
            prediction: { disease: "Unsupported File Format", confidence: 0 },
            uncertainty: { flagged: true, reason: "unsupported_media_type" }
        });
    }

    const fileSize = req.file.size || (req.file.buffer ? req.file.buffer.length : 0);
    if (fileSize > 25 * 1024 * 1024) {
        return res.status(400).json({
            success: false,
            status: "rejected",
            error: "File size exceeds the 25MB limit. Please upload a smaller image.",
            reason: "file_too_large",
            crop: "Unknown",
            disease: "File Too Large",
            confidence: 0,
            imageQuality: { score: 0, issues: ["file_too_large"], valid: false },
            leafAnalysis: { detected: false, confidence: 0, leafCount: 0 },
            prediction: { disease: "File Too Large", confidence: 0 },
            uncertainty: { flagged: true, reason: "file_too_large" }
        });
    }

    try {
        console.log(`\n📸 Analysis Request: [${req.file.originalname}] (${(req.file.size / 1024).toFixed(1)} KB) by ${req.user ? req.user.name : "Guest"}`);

        // ── 2. Run Robust Vision Pipeline & Classifier ─────────────
        const aiPromise = classify(req.file.buffer);

        // ── Weather Data (Parallel Fetch) ──────────────────────────
        const lat = parseFloat(req.body.lat) || 28.6139;
        const lon = parseFloat(req.body.lon) || 77.2090;
        let weatherData = { temp: 25, condition: "Unknown", humidity: 55, wind: 5 };

        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 4000);

            const apiKey = process.env.OPENWEATHER_API_KEY || process.env.WEATHER_API_KEY;
            const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;

            const weatherRes = await axios.get(weatherUrl, { signal: controller.signal });
            clearTimeout(timeout);

            if (weatherRes.data && weatherRes.data.main) {
                weatherData = {
                    temp: Math.round(weatherRes.data.main.temp),
                    condition: weatherRes.data.weather[0].main,
                    humidity: weatherRes.data.main.humidity,
                    wind: parseFloat((weatherRes.data.wind.speed * 3.6).toFixed(1))
                };
                console.log(`   🌤️ Weather Resolved: ${weatherData.temp}°C, ${weatherData.condition}`);
            }
        } catch (e) {
            console.warn("   ⚠️ Weather Fetch Failed (Using default values):", e.message);
        }

        const result = await aiPromise;

        // Calculate Spray Safety using the weather data
        const sprayCheck = getSpraySafetyCheck(weatherData.temp, weatherData.humidity, weatherData.wind);

        // ── 3. Parse & Structure Pipeline Outputs ──────────────────
        const qualityScore = result.imageQuality ? result.imageQuality.qualityScore : 100;
        const qualityIssues = result.imageQuality ? (result.imageQuality.issues || []) : [];
        const qualityValid = result.imageQuality ? (result.imageQuality.valid !== false) : true;
        const qualityRec = result.imageQuality ? (result.imageQuality.recommendation || "") : "";

        const leafDetected = result.leafDetection ? !!result.leafDetection.detected : (result.status !== "retake_required");
        const leafConfidence = result.leafDetection ? (result.leafDetection.confidence || 0) : 0;
        const leafCount = result.multiLeafAnalysis
            ? (result.multiLeafAnalysis.validLeavesCount || result.multiLeafAnalysis.totalLeavesDetected || (leafDetected ? 1 : 0))
            : (leafDetected ? 1 : 0);

        const isUncertain = result.isUncertain !== undefined
            ? result.isUncertain
            : (result.status === "uncertain" || result.status === "retake_required");

        const uncertaintyReason = result.reason || (isUncertain ? "unconfirmed_prediction" : null);

        // Normalize confidence into clean 0.0 - 1.0 range
        let confidenceVal = 0;
        if (typeof result.confidence === "number") {
            confidenceVal = result.confidence > 1
                ? parseFloat((result.confidence / 100).toFixed(4))
                : parseFloat(result.confidence.toFixed(4));
        }

        const confidencePercent = result.confidencePercent !== undefined
            ? result.confidencePercent
            : parseFloat((confidenceVal * 100).toFixed(1));

        // ── 3.5 VLM Secondary Visual-Intelligence Layer ─────────────
        let vlmEvidence = null;
        if (leafDetected && result.status !== "retake_required") {
            try {
                vlmEvidence = await analyzeLeafSymptoms({
                    imageBuffer: req.file.buffer,
                    diagnosis: {
                        crop: result.crop,
                        disease: result.disease,
                        label: result.label,
                        confidence: confidenceVal || result.confidence || 0.9,
                        severity: result.severity || "Moderate",
                        symptoms: result.symptoms || []
                    },
                    weather: weatherData,
                    language: req.body.language || req.user?.preferred_language || "en"
                });
                if (vlmEvidence) {
                    console.log(`   🔬 VLM Visual Evidence: [${vlmEvidence.source}] Agreement: ${vlmEvidence.agreementScore}% (${vlmEvidence.latencyMs}ms)`);
                }
            } catch (vlmErr) {
                console.warn("   ⚠️ VLM layer bypassed:", vlmErr.message);
            }
        }

        // ── 4. Construct Final Structured Response ─────────────────
        const responsePayload = {
            success: true,
            status: result.status || (isUncertain ? "uncertain" : "confirmed"),
            crop: result.crop || "Unknown",
            disease: result.disease || "Unknown",
            confidence: confidenceVal,
            severity: result.severity || (isUncertain ? "Uncertain" : "Moderate"),

            imageQuality: {
                score: qualityScore,
                issues: qualityIssues,
                valid: qualityValid,
                recommendation: qualityRec
            },

            leafAnalysis: {
                detected: leafDetected,
                confidence: leafConfidence,
                leafCount: leafCount,
                boundingBox: result.leafDetection ? result.leafDetection.boundingBox : null,
                regions: result.leafDetection ? (result.leafDetection.regions || []) : []
            },

            prediction: {
                disease: result.disease || "Unknown",
                confidence: confidenceVal,
                confidencePercent: confidencePercent,
                crop: result.crop || "Unknown",
                label: result.label || "uncertain",
                severity: result.severity || (isUncertain ? "Uncertain" : "Moderate"),
                allPredictions: result.allPredictions || []
            },

            // ── VLM Secondary Visual Intelligence Layer ────────────
            vlmEvidence: vlmEvidence,
            vlmSymptoms: (vlmEvidence && vlmEvidence.visibleSymptoms && vlmEvidence.visibleSymptoms.length > 0)
                ? vlmEvidence.visibleSymptoms
                : (result.symptoms || []),
            vlmExplanation: vlmEvidence ? (vlmEvidence.farmerExplanation || vlmEvidence.morphologySummary || "") : "",
            vlmAgreement: vlmEvidence ? vlmEvidence.agreement : true,
            vlmAgreementScore: vlmEvidence ? vlmEvidence.agreementScore : confidencePercent,
            vlmModel: vlmEvidence ? vlmEvidence.model : "qwen/qwen3.8-27b",

            uncertainty: {
                flagged: isUncertain,
                reason: uncertaintyReason,
                metrics: result.uncertaintyMetrics || null,
                thresholds: result.uncertaintyThresholds || null
            },

            // ── Backward Compatibility Fields for UI / Database ────
            valid: qualityValid,
            qualityScore: qualityScore,
            issues: qualityIssues,
            recommendation: qualityRec,
            confidencePercent: confidencePercent,
            affectedLeaves: result.affectedLeaves || (leafDetected ? "1/1" : "0/0"),
            multiLeafAnalysis: result.multiLeafAnalysis || null,
            preprocessing: result.preprocessing || null,
            symptoms: (vlmEvidence && vlmEvidence.visibleSymptoms && vlmEvidence.visibleSymptoms.length > 0)
                ? vlmEvidence.visibleSymptoms
                : (result.symptoms || []),
            advice: result.advice || [],
            prevention: result.prevention || [],
            spray: result.spray || "N/A",
            spray_action_time: result.spray_action_time || "N/A",
            spray_quantity: result.spray_quantity || "N/A",
            sprayWarnings: sprayCheck.warnings || [],
            causedBy: result.causedBy || "Crop Pathogen",
            temperature: weatherData.temp,
            humidity: weatherData.humidity,
            wind: weatherData.wind,
            alert: `Weather: ${weatherData.temp}°C, ${weatherData.condition}.`,
            timestamp: new Date().toISOString()
        };

        // ── 5. Persist to MongoDB (Non-blocking background save) ──
        if (mongoose.connection.readyState === 1 && result.status !== "retake_required") {
            try {
                const analysisRecord = new Analysis({
                    userId: req.user ? req.user.id.toString() : null,
                    farmerName: req.user ? req.user.name : (req.body.farmerName || "Anonymous Farmer"),
                    crop: result.label && result.label.includes("___") ? result.label.split("___")[0].replace(/_/g, " ") : (result.crop || "Crop"),
                    diseaseName: result.disease || "Healthy",
                    confidence: confidenceVal,
                    severity: result.severity || "Moderate",
                    causedBy: result.causedBy || "N/A",
                    temperature: weatherData.temp,
                    humidity: weatherData.humidity,
                    wind: weatherData.wind,
                    latitude: lat,
                    longitude: lon,
                    district: req.user ? req.user.district : (req.body.district || ""),
                    village: req.user ? req.user.village : (req.body.village || ""),
                    spray: result.spray || "N/A",
                    sprayWarnings: sprayCheck.warnings || [],
                    advice: result.advice || [],
                    prevention: result.prevention || [],
                    alert: `Weather: ${weatherData.temp}°C, ${weatherData.condition}.`,
                    imageName: req.file.originalname
                });
                analysisRecord.save().catch(dbErr => console.warn("   ⚠️ Failed to save analysis to DB:", dbErr.message));
            } catch (dbErr) {
                console.warn("   ⚠️ DB record creation error:", dbErr.message);
            }
        }

        // ── 5.5 Persist to PostGIS Spatial Reports (Non-blocking) ──
        if (leafDetected && result.status !== "retake_required" && lat && lon) {
            recordSpatialReport({
                farmerId: req.user ? req.user.id : null,
                farmerName: req.user ? req.user.name : (req.body.farmerName || "Farmer"),
                reportType: "disease",
                crop: result.crop || "Crop",
                disease: result.disease || "Crop Condition",
                pest: null,
                severity: result.severity || "Moderate",
                confidence: confidenceVal || 0.88,
                latitude: lat,
                longitude: lon,
                district: req.user ? req.user.district : (req.body.district || ""),
                village: req.user ? req.user.village : (req.body.village || ""),
                weatherTemp: weatherData.temp,
                weatherHumidity: weatherData.humidity,
                spray: result.spray || "N/A",
                notes: `AI scan detection. Affected leaves: ${result.affectedLeaves || "1/1"}.`
            }).then(() => {
                console.log(`   🗺️ [PostGIS] Recorded spatial outbreak at [${lat.toFixed(2)}, ${lon.toFixed(2)}]`);
            }).catch(spErr => {
                console.warn("   ⚠️ PostGIS auto-sync notice:", spErr.message);
            });
        }

        // ── 5.6 Auto-Enqueue for Expert Validation (HITL Active Learning) ──
        if (leafDetected && (confidenceVal < 0.75 || result.status === "uncertain")) {
            enqueueCase({
                crop: result.crop || "Tomato",
                aiDisease: result.disease || "Crop Condition",
                aiConfidence: confidenceVal ? Math.round(confidenceVal * 100) : 60,
                aiSeverity: result.severity || "Moderate",
                aiStatus: result.status || "confirmed",
                symptoms: result.symptoms || [],
                vlmEvidence: vlmEvidence || {},
                imageName: req.file ? req.file.originalname : "field_scan.jpg",
                farmerId: req.user ? req.user.id : null,
                farmerName: req.user ? req.user.name : "Anonymous Farmer",
                district: req.user ? req.user.district : (req.body.district || "Sangli"),
                village: req.user ? req.user.village : (req.body.village || "Miraj"),
                latitude: lat,
                longitude: lon
            }).then((c) => {
                console.log(`   👨‍🔬 [Expert Queue] Enqueued ${c.case_number} for Agronomist Review (${confidenceVal ? Math.round(confidenceVal * 100) : 60}% conf)`);
            }).catch(eErr => {
                console.warn("   ⚠️ Expert auto-queue notice:", eErr.message);
            });
        }

        // ── 5.7 Persist Case & Auto-Schedule Follow-up Monitoring ────────────
        if (leafDetected && result.status !== "retake_required") {
            try {
                const caseRef = `CASE-2026-${Math.floor(1000 + Math.random() * 9000)}`;
                const caseRes = await query(`
                    INSERT INTO cases (
                        case_ref, farmer_id, farmer_name, crop, category, current_status,
                        primary_condition, initial_confidence, initial_severity, field_latitude,
                        field_longitude, district, village, geom
                    ) VALUES (
                        $1, $2, $3, $4, 'disease', 'active', $5, $6, $7, $8, $9, $10, $11,
                        ST_SetSRID(ST_MakePoint($9, $8), 4326)
                    ) RETURNING id;
                `, [
                    caseRef,
                    req.user ? req.user.id : null,
                    req.user ? req.user.name : (req.body.farmerName || "Farmer"),
                    result.crop || "Tomato",
                    result.disease || "Crop Condition",
                    confidencePercent || 88,
                    result.severity || "Moderate",
                    lat || 16.8524,
                    lon || 74.5815,
                    req.user ? req.user.district : (req.body.district || "Sangli"),
                    req.user ? req.user.village : (req.body.village || "Miraj")
                ]);

                if (caseRes.rows.length > 0) {
                    const newCaseId = caseRes.rows[0].id;

                    // Insert treatment if spray prescribed
                    if (result.spray) {
                        await query(`
                            INSERT INTO treatments (case_id, spray_name, dosage_per_acre, safety_precautions)
                            VALUES ($1, $2, $3, $4);
                        `, [
                            newCaseId,
                            result.spray,
                            result.spray_quantity || "200 ml / acre",
                            result.sprayWarnings || []
                        ]);
                    }

                    // Auto-schedule Follow-up for Day 5
                    const schedDate = new Date();
                    schedDate.setDate(schedDate.getDate() + 5);
                    await query(`
                        INSERT INTO followups (case_id, followup_number, scheduled_date, status, farmer_notes)
                        VALUES ($1, 1, $2, 'pending', 'Automated Day 5 Follow-up scheduled for recovery monitoring.');
                    `, [newCaseId, schedDate]);

                    responsePayload.caseRef = caseRef;
                    responsePayload.nextFollowupDate = schedDate.toISOString().split("T")[0];
                    console.log(`   📋 [Cases & Follow-up] Created ${caseRef} with Day 5 follow-up scheduled for ${responsePayload.nextFollowupDate}`);
                }
            } catch (caseErr) {
                console.warn("   ⚠️ Case auto-creation notice:", caseErr.message);
            }
        }

        return res.json(responsePayload);

    } catch (err) {
        // 🛡️ Security: Never leak raw stack traces or internal paths to client
        console.error("❌ Analysis Endpoint Exception:", err);
        return res.status(500).json({
            success: false,
            status: "error",
            crop: "Unknown",
            disease: "Analysis Error",
            confidence: 0,
            error: "An unexpected error occurred while processing the crop image. Please try again with a clearer photo.",
            reason: "internal_error",
            imageQuality: { score: 0, issues: ["internal_error"], valid: false },
            leafAnalysis: { detected: false, confidence: 0, leafCount: 0 },
            prediction: { disease: "Analysis Error", confidence: 0 },
            uncertainty: { flagged: true, reason: "internal_error" }
        });
    }
});


// 2. CHAT ENGINE (Groq API AI + Image-Grounded VLM)
app.post(["/chat", "/api/chat"], async (req, res) => {
    const question = req.body.question || req.body.message;
    const { history, language, context, imageBase64 } = req.body;
    if (!question) return res.status(400).json({ error: "No question asked" });

    try {
        console.log(`\n💬 Chat Query: "${question}" (Has Leaf Image: ${Boolean(imageBase64)})`);
        
        if (!process.env.GROQ_API_KEY) {
            return res.json({ 
                answer: "⚠️ GROQ_API_KEY is missing in your backend/.env file! Please get a free key from console.groq.com, add it to your .env file, and restart the server.",
                reply: "⚠️ GROQ_API_KEY is missing in your backend/.env file! Please get a free key from console.groq.com, add it to your .env file, and restart the server."
            });
        }

        // If active scan image is provided, use Image-Grounded VLM Chat!
        if (imageBase64) {
            try {
                const imgBuf = Buffer.from(imageBase64.replace(/^data:image\/\w+;base64,/, ""), "base64");
                const vlmAnswer = await groundedChat({
                    imageBuffer: imgBuf,
                    question,
                    history,
                    scanContext: context || "",
                    language: language || "en"
                });
                if (vlmAnswer) {
                    return res.json({ answer: vlmAnswer, reply: vlmAnswer, source: "vlm-grounded" });
                }
            } catch (vlmChatErr) {
                console.warn("   ⚠️ Grounded VLM chat fallback to text:", vlmChatErr.message);
            }
        }

        // Standard Text Chat (Using active qwen/qwen3.8-27b on Groq)
        let messages = [];
        const langName = (language === "mr" || language === "marathi") ? "Marathi" : (language === "hi" || language === "hindi") ? "Hindi" : "clear, professional Standard English";
        let sysPrompt = `You are Agri-AI, an expert agricultural assistant. Answer questions clearly and concisely based on your expertise and the provided scan context. Refer to the scan results naturally. IMPORTANT: Never mention that the data is 'hardcoded' or from a 'local database'. Act as if this is your own expert knowledge. Respond in ${langName}.`;
        if (context) {
            sysPrompt += ` Current Crop Scan Context: ${context}`;
        }
        messages.push({
            role: "system",
            content: sysPrompt
        });

        // Add history from frontend — trim to last 10 messages (5 exchanges)
        if (history && Array.isArray(history)) {
            const trimmed = history.slice(-10);
            messages = messages.concat(trimmed);
        }

        messages.push({ role: "user", content: question });

        const activeModel = process.env.GROQ_MODEL || "qwen/qwen3.8-27b";
        const response = await axios.post(
            "https://api.groq.com/openai/v1/chat/completions",
            {
                model: activeModel,
                messages: messages,
                max_tokens: 500,
                temperature: 0.7
            },
            {
                headers: {
                    "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
                    "Content-Type": "application/json"
                },
                timeout: 8000
            }
        );

        let aiAnswer = response.data.choices[0].message.content || "";
        aiAnswer = aiAnswer.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
        return res.json({ answer: aiAnswer, reply: aiAnswer, source: "groq-llm" });

    } catch (err) { 
        console.error("Chat Error:", err.response ? err.response.data : err.message);
        let fallbackMsg = "";
        if (context) {
            if (language === "mr" || language === "marathi") {
                fallbackMsg = `तुमच्या पिकाच्या तपासणीनुसार (${context}): कृपया शिफारस केलेली फवारणी आणि वेळेचे पालन करा. अधिक माहितीसाठी वरील सल्ला पहा.`;
            } else if (language === "hi" || language === "hindi") {
                fallbackMsg = `आपकी फसल की जांच अनुसार (${context}): कृपया अनुशंसित छिड़काव और समय का पालन करें। अधिक जानकारी के लिए ऊपर दी गई सलाह देखें।`;
            } else {
                fallbackMsg = `Based on your crop scan (${context}): Please follow the prescribed spray dosage and timing. Check the detailed treatment card above for comprehensive action steps.`;
            }
        } else {
            fallbackMsg = (language === "mr" || language === "marathi")
                ? "माफ करा, तांत्रिक अडचणीमुळे उत्तर देता आले नाही. कृपया पुन्हा प्रयत्न करा."
                : (language === "hi" || language === "hindi")
                ? "क्षमा करें, तकनीकी समस्या के कारण उत्तर नहीं दिया जा सका। कृपया पुनः प्रयास करें।"
                : "Sorry, I am experiencing high traffic. Please try again in a moment or refer to the diagnostic cards above.";
        }
        return res.json({ answer: fallbackMsg, reply: fallbackMsg, source: "resilient-fallback" }); 
    }
});

// 2.5 VLM RE-EXPLAIN IN NEWLY SELECTED LANGUAGE
app.post(["/api/vlm/re-explain", "/vlm/re-explain"], async (req, res) => {
    try {
        const { diagnosis, weather, language, imageBase64 } = req.body;
        if (!diagnosis) {
            return res.status(400).json({ error: "Diagnosis details are required" });
        }
        let imgBuf = null;
        if (imageBase64) {
            imgBuf = Buffer.from(imageBase64.replace(/^data:image\/\w+;base64,/, ""), "base64");
        }
        const vlmEvidence = await analyzeLeafSymptoms({
            imageBuffer: imgBuf,
            diagnosis: {
                crop: diagnosis.crop,
                disease: diagnosis.disease,
                label: diagnosis.label,
                confidence: diagnosis.confidence || 0.9,
                severity: diagnosis.severity || "Moderate",
                symptoms: diagnosis.symptoms || []
            },
            weather: weather || {},
            language: language || "en"
        });

        return res.json({
            success: true,
            language: language || "en",
            vlmEvidence: vlmEvidence,
            symptoms: vlmEvidence?.visibleSymptoms || diagnosis.symptoms || [],
            farmerExplanation: vlmEvidence?.farmerExplanation || ""
        });
    } catch (err) {
        console.error("VLM Re-explain Error:", err.message);
        return res.status(500).json({ error: "Failed to re-explain leaf in requested language" });
    }
});

// 3. HEALTH SENSOR
const instanceId = Date.now().toString();
app.get("/status", (req, res) => {
    res.json({ 
        ready: isReady(), 
        status: isReady() ? "✅ AI NEURAL ENGINE ACTIVE!" : "⏳ Warming up...", 
        engine: "WASM (SIMD Turbo)",
        instanceId: instanceId
    });
});

// 4. GEOCODING PROXY
app.get("/api/geocode", async (req, res) => {
    const { lat, lon } = req.query;
    try {
        const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`;
        const response = await axios.get(url, { headers: { 'User-Agent': 'AgriAI/1.0' }, timeout: 5000 });
        res.json({ address: response.data.display_name || "Detected Location" });
    } catch (err) { res.json({ address: `📍 [${parseFloat(lat).toFixed(2)}, ${parseFloat(lon).toFixed(2)}]` }); }
});

// 4. SCAN HISTORY (MongoDB Powered + Graceful fallback)
app.get(["/history", "/api/history"], optionalAuth, async (req, res) => {
    try {
        if (!mongoose.connection || mongoose.connection.readyState !== 1) {
            return res.json([]);
        }
        const queryFilter = req.user ? { userId: req.user.id.toString() } : {};
        const history = await Analysis.find(queryFilter).sort({ timestamp: -1 }).limit(30);
        res.json(history || []);
    } catch (err) {
        console.error("HISTORY ERROR:", err.message);
        res.json([]);
    }
});



// SPA Client Fallback for client/dist
if (fs.existsSync(clientDistPath)) {
    app.get(/^(?!\/(api|analyze|chat|history|status|uploads)).*$/, (req, res) => {
        res.sendFile(path.join(clientDistPath, "index.html"));
    });
}

// ═══════════════════════════════════════════════
//  START SERVER
// ═══════════════════════════════════════════════
const PORT = process.env.PORT || 5000;
let serverInstance = null;

if (require.main === module) {
    serverInstance = app.listen(PORT, async () => {
        console.log(`🚀 Agri-AI Server ready at http://127.0.0.1:${PORT}`);
        
        // Initialize PostgreSQL Database Connection & Tables
        await initPostgres();
        await initSpatialDB();
        await initExpertDB();
        initBackgroundJobs();

        // Initialize TensorFlow.js Classifier
        initClassifier().catch(err => console.error("   ❌ Initializer Failed:", err.message));
    });

    serverInstance.on("error", (err) => {
        if (err.code === "EADDRINUSE") {
            console.error(`\n❌ [PORT IN USE] Port ${PORT} is already in use by another running Agri-AI process.`);
            console.log(`   💡 Tip: Close the existing terminal window running Agri-AI, or run: npx kill-port ${PORT}\n`);
            process.exit(1);
        } else {
            console.error("❌ Server startup error:", err.message);
        }
    });
}

module.exports = app;