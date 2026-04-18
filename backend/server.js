const express = require("express");
const cors = require("cors");
const multer = require("multer");
const axios = require("axios");
const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const { Scheme, Analysis, ChatSession } = require("./models");
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

        // PERSIST TO MONGODB
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

        // Add history from frontend (which includes the system context from the analysis)
        if (history && Array.isArray(history)) {
            messages = messages.concat(history);
        }

        // Add the current user question
        messages.push({ role: "user", content: question });

        const response = await axios.post(
            "https://api.groq.com/openai/v1/chat/completions",
            {
                model: "llama-3.1-8b-instant", // Updated to a current supported model
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

        const aiAnswer = response.data.choices[0].message.content;
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

// 5. GOVT SCHEMES (MongoDB Powered)
app.get("/schemes", async (req, res) => {
    try {
        const schemes = await Scheme.find().sort({ name: 1 });
        res.json(schemes);
    } catch (err) {
        console.error("SCHEMES ERROR:", err);
        res.status(500).json({ error: "Could not fetch schemes from database." });
    }
});


// 5. AI SCHEME ADVISOR (Groq-powered personalized recommendations)
app.post("/api/scheme-advisor", async (req, res) => {
    const { query, history, language } = req.body;
    if (!query) return res.status(400).json({ error: "No query provided" });

    try {
        console.log(`\n🏛️ Scheme Advisor Query: "${query}"`);

        if (!process.env.GROQ_API_KEY) {
            return res.status(500).json({ error: "GROQ_API_KEY is missing in backend/.env" });
        }

        // Load schemes from MongoDB
        const schemesDB = await Scheme.find();


        // ── SMART PRE-FILTER: Score & pick top 12 relevant schemes ──
        const stopWords = new Set(["i", "am", "a", "an", "the", "for", "in", "of", "and", "to", "my", "me", "have", "has", "is", "are", "what", "which", "can", "do", "with", "want", "need", "get", "give", "please", "about", "from"]);
        const queryWords = query.toLowerCase().split(/\W+/).filter(w => w.length > 1 && !stopWords.has(w));

        const scored = schemesDB.map(scheme => {
            const searchText = `${scheme.name} ${scheme.category} ${scheme.target} ${scheme.eligibility} ${scheme.summary} ${scheme.state || ''}`.toLowerCase();
            let score = 0;
            queryWords.forEach(word => {
                if (searchText.includes(word)) score++;
            });
            // Boost "All India" schemes slightly so they always appear alongside state schemes
            if ((scheme.state || '').toLowerCase() === 'all india') score += 0.5;
            return { scheme, score };
        });

        // Sort by score (highest first), take top 15 — minimum 10 even if no matches
        scored.sort((a, b) => b.score - a.score);
        const MAX_SCHEMES = 15;
        const MIN_SCHEMES = 10;
        const topSchemes = scored.slice(0, Math.max(MAX_SCHEMES, MIN_SCHEMES)).map(s => s.scheme);

        console.log(`   📊 Pre-filter: ${topSchemes.length}/${schemesDB.length} schemes sent to AI (top keywords: ${queryWords.slice(0, 5).join(", ")})`);

        // Compress selected schemes for prompt
        const compactSchemes = topSchemes.map(s => ({
            id: s.id, name: s.name, cat: s.category,
            target: s.target, elig: s.eligibility
        }));

        // Build compact system prompt
        const systemPrompt = `You are an Indian govt agriculture scheme advisor. Match farmers to schemes.

SCHEMES DB:
${JSON.stringify(compactSchemes)}

Respond ONLY in JSON:
{"aiMessage":"2 sentences to farmer","userContext":{"location":"...","landSize":"...","farmerCategory":"Small/Marginal/Medium/Large/General","cropType":"...","specialCategory":"SC/ST/Women/General"},"schemes":[{"id":"from DB","name":"...","status":"eligible|maybe|not_eligible","benefitSummary":"1 line","reason":"why"}],"eligibilityScore":0-100,"followUpQuestion":"..."}

RULES: Return 5-7 relevant schemes. Never invent schemes. ${language && language !== "English" ? `Respond in ${language}.` : ""}`;

        let messages = [{ role: "system", content: systemPrompt }];

        // Add conversation history (limit to last 2 exchanges to save tokens)
        if (history && Array.isArray(history)) {
            const trimmedHistory = history.slice(-4); // last 2 user+assistant pairs
            messages = messages.concat(trimmedHistory);
        }

        messages.push({ role: "user", content: query });

        const response = await axios.post(
            "https://api.groq.com/openai/v1/chat/completions",
            {
                model: "llama-3.1-8b-instant",
                messages: messages,
                max_tokens: 1500,
                temperature: 0.4,
                response_format: { type: "json_object" }
            },
            {
                headers: {
                    "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
                    "Content-Type": "application/json"
                }
            }
        );

        const rawContent = response.data.choices[0].message.content;
        console.log("   ✅ Scheme Advisor Response received");

        // Parse JSON response from AI
        let parsed;
        try {
            parsed = JSON.parse(rawContent);
        } catch (parseErr) {
            console.error("   ⚠️ JSON parse failed, returning raw:", parseErr.message);
            parsed = {
                aiMessage: rawContent,
                userContext: { location: "Unknown", landSize: "Unknown", farmerCategory: "General", cropType: "Unknown", specialCategory: "General" },
                schemes: [],
                eligibilityScore: 0,
                followUpQuestion: "Could you tell me more about your farming situation?"
            };
        }

        // Enrich scheme data with full info from database
        if (parsed.schemes && Array.isArray(parsed.schemes)) {
            parsed.schemes = parsed.schemes.map(s => {
                const dbScheme = schemesDB.find(db => db.id === s.id);
                return {
                    ...s,
                    benefits: dbScheme ? dbScheme.benefits : [],
                    keyHighlights: dbScheme ? dbScheme.keyHighlights : [],
                    category: dbScheme ? dbScheme.category : "General",
                    target: dbScheme ? dbScheme.target : "",
                    officialUrl: s.officialUrl || (dbScheme ? dbScheme.officialUrl : "#"),
                    applyUrl: s.applyUrl || (dbScheme ? dbScheme.applyUrl : "#")
                };
            });
        }

        return res.json(parsed);

    } catch (err) {
        console.error("Scheme Advisor Error:", err.response ? err.response.data : err.message);
        res.status(500).json({ error: "Scheme advisor failed. Check API key and internet." });
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