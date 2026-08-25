const express = require("express");
const cors = require("cors");
const multer = require("multer");
const axios = require("axios");
const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const { Analysis, ChatSession } = require("./models");
const { initClassifier, classify, isReady } = require("./classifier");
const { getDiseaseInfo, searchByKeyword, getSpraySafetyCheck } = require("./cropDatabase");

dotenv.config();

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log("🍃 MongoDB Connected Successfully"))
    .catch(err => console.error("❌ MongoDB Connection Error:", err.message));


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
        
        const lat = req.body.lat || 28.6139;
        const lon = req.body.lon || 77.2090;

        let weatherData = { temp: 25, condition: "Unknown", humidity: 55, wind: 5 };
        
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 4000);
            
            // Use OpenWeatherMap since that's what's in the .env file
            const apiKey = process.env.OPENWEATHER_API_KEY || process.env.WEATHER_API_KEY;
            const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;
            
            const weatherRes = await axios.get(weatherUrl, { signal: controller.signal });
            clearTimeout(timeout);
            
            if (weatherRes.data && weatherRes.data.main) {
                weatherData = { 
                    temp: Math.round(weatherRes.data.main.temp), 
                    condition: weatherRes.data.weather[0].main, 
                    humidity: weatherRes.data.main.humidity,
                    wind: (weatherRes.data.wind.speed * 3.6).toFixed(1) // Convert m/s to km/h
                };
                console.log(`   🌤️  Weather Resolved: ${weatherData.temp}°C, ${weatherData.condition}`);
            }
        } catch (e) { 
            console.warn("   ⚠️  Weather Fetch Failed (Using default values):", e.message); 
        }

        const result = await aiPromise;
        
        // Calculate Spray Safety using the weather data
        const sprayCheck = getSpraySafetyCheck(weatherData.temp, weatherData.humidity, weatherData.wind);

        // PERSIST TO MONGODB (Only if connected to avoid buffering timeout)
        if (mongoose.connection.readyState === 1) {
            try {
                const analysisRecord = new Analysis({
                    diseaseName: result.disease || "Healthy",
                    confidence: result.confidence || 0,
                    temperature: weatherData.temp,
                    humidity: weatherData.humidity,
                    sprayWarnings: sprayCheck.warnings,
                    alert: `Weather: ${weatherData.temp}°C, ${weatherData.condition}.`,
                    imageName: req.file.originalname
                });
                await analysisRecord.save();
                console.log("   💾 Analysis record saved to MongoDB");
            } catch (dbErr) {
                console.warn("   ⚠️ Failed to save analysis to DB:", dbErr.message);
            }
        }

        res.json({ 
            ...result, 
            temperature: weatherData.temp, 
            humidity: weatherData.humidity, 
            sprayWarnings: sprayCheck.warnings,
            alert: `Weather: ${weatherData.temp}°C, ${weatherData.condition}.`, 
            timestamp: new Date().toISOString() 
        });

    } catch (err) { 
        console.error("Analysis Error:", err);
        res.status(500).json({ error: err.message }); 
    }
});

// 2. CHAT ENGINE (Groq API AI)
app.post("/chat", async (req, res) => {
    const { question, history, language } = req.body;
    if (!question) return res.status(400).json({ error: "No question asked" });

    try {
        console.log(`\n💬 Chat Query: "${question}"`);
        
        if (!process.env.GROQ_API_KEY) {
            return res.json({ answer: "⚠️ GROQ_API_KEY is missing in your backend/.env file! Please get a free key from console.groq.com, add it to your .env file, and restart the server." });
        }

        // Build messages array
        let messages = [];
        
        // Add a primary system prompt
        messages.push({
            role: "system",
            content: `You are Agri-AI, an expert agricultural assistant. Answer questions clearly and concisely based on your expertise and the provided scan context. Refer to the scan results naturally. IMPORTANT: Never mention that the data is 'hardcoded' or from a 'local database'. Act as if this is your own expert knowledge. Respond in ${language || "English"}.`
        });

        // Add history from frontend — trim to last 10 messages (5 exchanges) to avoid token overflow
        if (history && Array.isArray(history)) {
            const trimmed = history.slice(-10);
            messages = messages.concat(trimmed);
        }

        // Add the current user question
        messages.push({ role: "user", content: question });

        const activeModel = process.env.GROQ_MODEL || "openai/gpt-oss-20b";
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
                }
            }
        );

        let aiAnswer = response.data.choices[0].message.content || "";
        // Clean out any internal <think> tags if model produces reasoning tokens
        aiAnswer = aiAnswer.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
        return res.json({ answer: aiAnswer });

    } catch (err) { 
        console.error("Chat Error:", err.response ? err.response.data : err.message);
        res.status(500).json({ error: "Brain error", answer: "Oops, my AI brain had a hiccup. Check the API key and internet connection." }); 
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

// 4. SCAN HISTORY (MongoDB Powered)
app.get("/history", async (req, res) => {
    try {
        const history = await Analysis.find().sort({ timestamp: -1 }).limit(20);
        res.json(history);
    } catch (err) {
        console.error("HISTORY ERROR:", err);
        res.status(500).json({ error: "Could not fetch history." });
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