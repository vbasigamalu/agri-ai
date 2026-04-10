const express = require("express");
const cors = require("cors");
const multer = require("multer");
const axios = require("axios");
const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");
const { initClassifier, classify, isReady } = require("./classifier");
const { getDiseaseInfo, searchByKeyword } = require("./cropDatabase");

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../frontend")));

const upload = multer({ storage: multer.memoryStorage() });

// ═══════════════════════════════════════════════
//  API ENDPOINTS
// ═══════════════════════════════════════════════

// 1. ANALYSIS PIPELINE (Parallel Engine + Weather)
app.post("/analyze", upload.single("image"), async (req, res) => {
    if (!isReady()) return res.status(503).json({ error: "Agri-AI Engine warming up... please wait." });
    if (!req.file) return res.status(400).json({ error: "No image provided" });
    try {
        console.log(`\n📸 Analysis Request: [${req.file.originalname}]`);
        const aiPromise = classify(req.file.buffer);
        let weatherData = { temp: 25, condition: "Unknown", humidity: 55 };
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 3000);
            const country = req.body.country || "Global";
            const weatherRes = await axios.get(`https://api.weatherapi.com/v1/current.json?key=${process.env.WEATHER_API_KEY}&q=${country}`, { signal: controller.signal });
            clearTimeout(timeout);
            if (weatherRes.data && weatherRes.data.current) {
                weatherData = { temp: weatherRes.data.current.temp_c, condition: weatherRes.data.current.condition.text, humidity: weatherRes.data.current.humidity };
            }
        } catch (e) { console.warn("   ⚠️  Weather Bypass active."); }
        const result = await aiPromise;
        res.json({ ...result, temperature: weatherData.temp, humidity: weatherData.humidity, alert: `Weather: ${weatherData.temp}°C, ${weatherData.condition}.`, timestamp: new Date().toISOString() });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 2. CHAT ENGINE (Rule-based Knowledge Retrieval)
app.post("/chat", async (req, res) => {
    const { question } = req.body;
    if (!question) return res.status(400).json({ error: "No question asked" });

    try {
        console.log(`\n💬 Chat Query: "${question}"`);
        const keywords = ["symptoms", "treatment", "medicine", "spray", "prevent", "soil"];
        const matches = searchByKeyword(question);

        if (matches.length > 0) {
            const top = matches[0];
            let answer = `I found details for **${top.displayName}**. It is a ${top.causedBy.toLowerCase()} disease. `;
            
            if (question.toLowerCase().includes("treatment") || question.toLowerCase().includes("medicine") || question.toLowerCase().includes("spray")) {
                answer += `Treat by using **${top.spray.name}** at a concentration of ${top.spray.quantity}. ${top.spray.timing}.`;
            } else if (question.toLowerCase().includes("prevent")) {
                answer += `Prevent future outbreaks by: ${top.prevention[0]} and ${top.prevention[1]}.`;
            } else {
                answer += `Common symptoms include ${top.symptoms[0]} and ${top.symptoms[1]}.`;
            }
            return res.json({ answer });
        }

        // Generic Agri-Advice fallbacks
        const generic = [
            "Always ensure proper drainage to prevent fungal root rot.",
            "Balanced N-P-K fertilizer is essential for crop immunity.",
            "Water at the base of plants during the evening to keep leaves dry.",
            "If you see yellowing, check for aphids or nutrient deficiency."
        ];
        res.json({ answer: "I'm a local AI. Try asking about a specific crop name or treatment! " + generic[Math.floor(Math.random() * generic.length)] });

    } catch (err) { res.status(500).json({ error: "Brain error" }); }
});

// 3. HEALTH SENSOR
app.get("/status", (req, res) => {
    res.json({ ready: isReady(), status: isReady() ? "✅ AI NEURAL ENGINE ACTIVE!" : "⏳ Warming up...", engine: "WASM (SIMD Turbo)" });
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

// 4. GOVT SCHEMES (Basic Data + Live Links)
app.get("/schemes", (req, res) => {
    try {
        const schemesFile = fs.readFileSync("./schemes.json", "utf-8");
        const schemes = JSON.parse(schemesFile);
        res.json(schemes);
    } catch (err) {
        console.error("SCHEMES ERROR:", err);
        res.status(500).json({ error: "Could not read schemes data." });
    }
});

// ═══════════════════════════════════════════════
//  START SERVER
// ═══════════════════════════════════════════════
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Agri-AI Server ready at http://127.0.0.1:${PORT}`);
    initClassifier().catch(err => console.error("   ❌ Initializer Failed:", err.message));
});