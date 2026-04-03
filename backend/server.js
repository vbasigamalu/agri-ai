const express = require("express");
const cors = require("cors");
const axios = require("axios");
const multer = require("multer");
const fs = require("fs");
require("dotenv").config({ override: true });
const Groq = require("groq-sdk");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const db = require("./dbHelper");


const app = express();
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const systemInstruction = `You are Agri-AI, an expert agricultural consultant. 
    Your role is to help farmers diagnose crop diseases and provide treatment based on current analysis and weather data.
    
    1. CONTEXT AWARENESS: Always prioritize the most recent crop analysis data provided in the conversation.
    2. ACCURACY: DO NOT provide "fake" or "made up" chemical names. Only suggest verified agricultural treatments. 
    3. NO HALLUCINATION: If you are unsure about a disease or remedy, suggest consulting a local agronomist or agricultural university.
    4. TONE: Be professional, empathetic, and clear.
    5. GROUNDING: Use the provided location and weather data to tailor your advice (e.g., "Since it's very humid (80%RH), fungal growth is likely").`;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const geminiModel = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: systemInstruction
});




app.use(cors());
app.use(express.json());

console.log("✅ Agri-AI Server starting...");

// 1. IMAGE ANALYSIS (High-Performance)
app.post("/analyze", upload.single("image"), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No image uploaded" });

        const lat = parseFloat(req.body.lat);
        const lon = parseFloat(req.body.lon);
        const locationName = req.body.locationName || "Somewhere in the world";

        // A. WEATHER DATA (Parallel)
        const fetchWeather = async (lt, ln, name) => {
            let searchLat = lt;
            let searchLon = ln;

            // If coordinates are missing but name exists, try geocoding
            if ((!lt || !ln) && name) {
                try {
                    const geoRes = await axios.get(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(name)}&limit=1`);
                    if (geoRes.data && geoRes.data.length > 0) {
                        searchLat = parseFloat(geoRes.data[0].lat);
                        searchLon = parseFloat(geoRes.data[0].lon);
                    }
                } catch (e) {
                    console.error("Geocoding failed for fallback name:", name);
                }
            }

            // Default to Delhi if still no coords
            searchLat = searchLat || 28.6139;
            searchLon = searchLon || 77.2090;

            console.log(`📡 Fetching weather for: ${name} (${searchLat}, ${searchLon})`);

            return axios.get(
                `https://api.openweathermap.org/data/2.5/weather?lat=${searchLat}&lon=${searchLon}&units=metric&appid=${process.env.OPENWEATHER_API_KEY}`
            ).catch(() => null);
        };

        const weatherPromise = fetchWeather(lat, lon, locationName);

        // B. GEMINI IMAGE ANALYSIS
        const imagePart = {
            inlineData: {
                data: req.file.buffer.toString("base64"),
                mimeType: req.file.mimetype
            }
        };

        const prompt = `
        CONTEXT: The plant is located in ${locationName}. 
        Analyze this crop image and provide:
        1. Disease identification (single name).
        2. Description of the issue.
        3. A short, bulleted treatment plan.
        4. Severity Level (Critical, Major, Moderate, Low).
        5. Confidence percentage of this diagnosis (0-100).
        6. A specific 'spray' recommendation.
        7. The 'action time' for the spray (e.g., Early morning, Evening).
        8. The 'quantity' of spray to use (e.g., 2 ml/liter of water).
        Format your response as a valid JSON object ONLY:
        {
            "disease": "string",
            "description": "string",
            "treatment": ["step1", "step2"],
            "severity": "string",
            "confidence": number,
            "spray": "string",
            "spray_action_time": "string",
            "spray_quantity": "string"
        }`;

        let aiData;
        try {
            const geminiResult = await geminiModel.generateContent({
                contents: [{ role: "user", parts: [imagePart, { text: prompt }] }],
                generationConfig: { responseMimeType: "application/json" }
            });
            const geminiResponse = await geminiResult.response;
            const rawJson = geminiResponse.text().replace(/```json|```/g, "").trim();
            aiData = JSON.parse(rawJson);
        } catch (geminiErr) {
            console.error("❌ GEMINI ERROR:", geminiErr.message);

            if (geminiErr.message.includes("429") || geminiErr.message.includes("quota")) {
                return res.status(429).json({ error: "The AI is currently busy analyzing too many farms. Please wait a few minutes and try again!" });
            }
            if (geminiErr.message.includes("blocked")) {
                return res.status(400).json({ error: "Image blocked by safety filters. Please try another image." });
            }
            throw new Error("AI analysis failed: " + geminiErr.message);
        }

        // C. WEATHER INTEGRATION
        const weatherRes = await weatherPromise;
        const weather = weatherRes ? weatherRes.data : { main: { temp: 25, humidity: 60 }, wind: { speed: 5 } };

        const temp = weather.main.temp;
        const wind = weather.wind.speed;
        const humidity = weather.main.humidity;

        // LOG TO JSON DB
        try {
            db.addRecord({
                disease: aiData.disease,
                severity: aiData.severity,
                confidence: aiData.confidence,
                location: { lat, lon, name: locationName },
                weather: { temp, humidity }
            });
        } catch (dbErr) {
            console.error("📂 DB LOGGING ERROR:", dbErr.message);
        }

        // FINAL RESPONSE
        res.json({
            disease: aiData.disease,
            description: aiData.description,
            temperature: temp,
            wind: wind,
            humidity: humidity,
            alert: aiData.severity + " Severity: " + (temp > 30 ? "🔥 Hot" : "🌤️ Normal"),
            confidence: aiData.confidence || "Unknown",
            severity: aiData.severity || "Unknown",
            spray: aiData.spray || "Decision pending...",
            spray_action_time: aiData.spray_action_time || "N/A",
            spray_quantity: aiData.spray_quantity || "N/A",
            advice: aiData.treatment
        });

    } catch (err) {
        console.error("🚨 SERVER ERROR:", err.message);
        res.status(500).json({ error: "Server Error: " + err.message });
    }
});

// 2. CONTEXT-AWARE CHATBOT Q&A
app.post("/chat", async (req, res) => {
    try {
        const { question, history } = req.body;
        console.log("💬 Chat request:", question);

        // 1. Fetch Recent Crop Analysis Records for Context
        const allRecords = db.readDB();
        const userRecords = allRecords.slice(-3); // Get last 3 analyses
        let contextKnowledge = "User's Recent Crop Analysis Records:\n";

        if (userRecords.length > 0) {
            userRecords.forEach((rec, idx) => {
                contextKnowledge += `- Date: ${new Date(rec.timestamp).toLocaleDateString()}. Disease: ${rec.disease} (${rec.severity} severity). Weather: ${rec.weather.temp}°C, ${rec.weather.humidity}% humidity.\n`;
            });
        } else {
            contextKnowledge += "No previous analysis records found.\n";
        }

        // 2. Build personalized prompt with Grounding instructions
        const augmentedPrompt = `
        IMPORTANT CONTEXT:
        ${contextKnowledge}
        
        USER QUESTION: ${question}
        
        INSTRUCTION: Answer the user's question based on their history if relevant. If you mention any chemicals or treatments, ensure they are real and effective for the diseases listed above.`;

        // 3. Request completion using history
        const messages = [
            { role: "system", content: systemInstruction },
            ...(history || []),
            { role: "user", content: augmentedPrompt }
        ];

        const groqResponse = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: messages,
            max_tokens: 800
        });

        const responseText = groqResponse.choices[0].message.content;

        res.json({ answer: responseText });

    } catch (err) {
        console.error("CHAT ERROR:", err.message);
        res.status(500).json({ error: "Chat system busy." });
    }
});

// 3. RETRIEVE HISTORY
app.get("/history", (req, res) => {
    try {
        const history = db.readDB();
        res.json(history);
    } catch (err) {
        res.status(500).json({ error: "Could not read history." });
    }
});


const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
    console.log(`🚀 Agri-AI Server ready at http://127.0.0.1:${PORT}`);
});

server.on('error', (err) => {
    console.error("🚨 CRITICAL ERROR:", err.message);
    if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use! Another server is already running in the background.`);
        console.error(`❌ Please close the other terminal or restart VS Code.`);
    }
});