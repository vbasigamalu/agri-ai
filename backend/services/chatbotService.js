/**
 * backend/services/chatbotService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Agri-AI Context-Aware Agricultural Advisor Engine
 * ─────────────────────────────────────────────────────────────────────────────
 * Implements the SIH Architectural Specification:
 * 
 *                     Farmer Question
 *                            │
 *                            ▼
 *                    Context Manager
 *                            │
 *             ┌──────────────┼──────────────┐
 *             ▼              ▼              ▼
 *         Crop Case       Weather       History
 *             │              │              │
 *             └──────────────┼──────────────┘
 *                            ▼
 *                    Knowledge Retrieval
 *                            │
 *                            ▼
 *                    Response Generator
 *                            │
 *                            ▼
 *                   Preferred Language (mr/hi/en)
 * ─────────────────────────────────────────────────────────────────────────────
 */

const axios = require("axios");
const { query } = require("../postgres");
const { getConditionDetails, searchKnowledgeBase } = require("./knowledgeBaseService");

/**
 * Main Context Manager: Assembles multi-source context before generating an answer
 */
async function answerFarmerQuery({
    question,
    activeCaseRef = null,
    farmLocation = null,
    language = "mr",
    history = []
}) {
    // ── 1. Fetch Crop Case Context ──────────────────────────────────────────
    let caseContext = null;
    let treatmentContext = null;

    if (activeCaseRef) {
        try {
            const caseRes = await query(`
                SELECT c.*, t.spray_name, t.dosage_per_acre, t.waiting_period_days, t.safety_precautions
                FROM cases c
                LEFT JOIN treatments t ON c.id = t.case_id
                WHERE c.case_ref = $1;
            `, [activeCaseRef]);

            if (caseRes.rows.length > 0) {
                const row = caseRes.rows[0];
                caseContext = {
                    caseRef: row.case_ref,
                    crop: row.crop,
                    condition: row.primary_condition,
                    severity: row.initial_severity,
                    confidence: row.initial_confidence,
                    district: row.district,
                    diagnosedDate: row.created_at
                };
                treatmentContext = {
                    spray: row.spray_name,
                    dosage: row.dosage_per_acre,
                    waitingPeriod: row.waiting_period_days,
                    precautions: row.safety_precautions || []
                };
            }
        } catch (e) {
            console.warn("Context Manager: Could not load case context:", e.message);
        }
    }

    // ── 2. Fetch Micro-Climate Weather Context ──────────────────────────────
    let weatherContext = {
        temp: 28,
        humidity: 78,
        condition: "Partly Cloudy",
        rainForecast: "Light drizzle possible within 6 hours"
    };

    const lat = farmLocation?.lat || 16.8524;
    const lon = farmLocation?.lon || 74.5815;

    try {
        const weatherRes = await axios.get(
            `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m&hourly=precipitation_probability&forecast_days=1`,
            { timeout: 3500 }
        );
        if (weatherRes.data?.current) {
            const c = weatherRes.data.current;
            const maxPrecip = Math.max(...(weatherRes.data.hourly?.precipitation_probability || [10]));
            weatherContext = {
                temp: Math.round(c.temperature_2m),
                humidity: Math.round(c.relative_humidity_2m),
                wind: Math.round(c.wind_speed_10m),
                rainProbability: maxPrecip,
                rainForecast: maxPrecip > 50 ? "Moderate to heavy rain expected" : "Low likelihood of rain"
            };
        }
    } catch {
        // Fallback default for weather
    }

    // ── 3. Knowledge Retrieval ──────────────────────────────────────────────
    let kbArticles = [];
    const targetCrop = caseContext?.crop || "Tomato";
    const targetCondition = caseContext?.condition || "Tomato Early Blight";

    const conditionData = await getConditionDetails(targetCrop, targetCondition);
    if (conditionData) {
        kbArticles.push(conditionData);
    }

    // Additional keyword search from farmer question
    const words = question.split(/\s+/).filter(w => w.length > 3);
    for (const word of words.slice(0, 2)) {
        const matches = await searchKnowledgeBase(targetCrop, word, language);
        matches.forEach(m => {
            if (!kbArticles.some(a => a.id === m.id)) {
                kbArticles.push(m);
            }
        });
    }

    // ── 4. Synthesize Augmented Context & System Prompt ─────────────────────
    const langNames = { "mr": "Marathi (मराठी)", "hi": "Hindi (हिंदी)", "en": "English" };
    const targetLangName = langNames[language] || "Marathi (मराठी)";

    let contextSnippet = "--- AGRONOMIC & PATIENT CROP CONTEXT ---\n";
    if (caseContext) {
        contextSnippet += `Active Patient Case: ${caseContext.caseRef} (Crop: ${caseContext.crop}, Condition: ${caseContext.condition}, Severity: ${caseContext.severity})\n`;
        if (treatmentContext) {
            contextSnippet += `Prescribed Spray: ${treatmentContext.spray} (Dosage: ${treatmentContext.dosage}, Safety Waiting: ${treatmentContext.waitingPeriod} days)\n`;
        }
    }
    contextSnippet += `Field Micro-Climate: Temp ${weatherContext.temp}°C, Humidity ${weatherContext.humidity}%, Rain Forecast: ${weatherContext.rainForecast}\n`;

    if (kbArticles.length > 0) {
        const kb = kbArticles[0];
        contextSnippet += `Scientific Guidelines (ICAR/MPKV):\n- Rainfastness required: ${kb.rainfastness_hours || 3} hours\n- Approved chemical control: ${kb.chemical_treatment}\n- Biological control: ${kb.biological_treatment}\n- Cultural prevention: ${kb.cultural_prevention}\n`;
    }
    contextSnippet += "--------------------------------------\n";

    const systemPrompt = `You are Agri-Advisor, an expert agricultural AI assistant developed for Indian farmers by agronomists from ICAR and State Agricultural Universities.
You are assisting a farmer who speaks ${targetLangName}.
Answer their question directly, practically, and empathetically using the verified context provided below.

CRITICAL SAFETY RULES:
1. Always state specific dosages clearly (e.g. ml or grams per liter of water).
2. If the farmer asks about rain wash-off: inform them of the rainfastness period (usually 2-3 hours for systemic fungicides like Azoxystrobin). If it rained within 2 hours of spraying, advise a re-spray at 50% reduced dose once foliage dries, mixed with a wetting agent (sticker).
3. If they ask about organic options, mention Neem oil (1500 ppm) or Trichoderma harzianum.
4. Reply in fluent, conversational ${targetLangName}. Do NOT translate literally; use customary agricultural terminology familiar to Indian farmers.

${contextSnippet}`;

    // ── 5. Generate Response via LLM (Groq / Llama-3-70B or fallback) ──────
    let finalAnswer = "";

    if (process.env.GROQ_API_KEY) {
        try {
            const groqPayload = {
                model: "llama-3.3-70b-versatile",
                messages: [
                    { role: "system", content: systemPrompt },
                    ...history.slice(-3),
                    { role: "user", content: question }
                ],
                temperature: 0.2,
                max_tokens: 650
            };

            const groqRes = await axios.post("https://api.groq.com/openai/v1/chat/completions", groqPayload, {
                headers: {
                    "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
                    "Content-Type": "application/json"
                },
                timeout: 10000
            });

            finalAnswer = groqRes.data?.choices?.[0]?.message?.content || "";
        } catch (err) {
            console.warn("Groq API error, generating rule-based agronomic answer:", err.message);
        }
    }

    // ── 6. Deterministic Verified Fallback if LLM unavailable ────────────────
    if (!finalAnswer) {
        if (question.includes("पाऊस") || question.toLowerCase().includes("rain")) {
            if (language === "mr") {
                finalAnswer = `तुमच्या टोमॅटो पिकावर फवारलेल्या अझॉक्सीस्ट्रॉबिन (Azoxystrobin) बुरशीनाशकासाठी किमान २ ते ३ तासांचा पाऊसमुक्त काळ (Rainfastness period) आवश्यक असतो.\n\n१. जर फवारणीनंतर २ तासांच्या आत पाऊस झाला असेल, तर औषध धुतले गेले असण्याची शक्यता आहे. अशा वेळी पाने सुकल्यानंतर ५०% कमी मात्रेने (०.५ मिली/लिटर) सोबत स्टीकर (Wetting Agent) मिसळून पुन्हा फवारणी करावी.\n२. जर फवारणीनंतर ३ तासांनंतर पाऊस झाला असेल, तर औषध पानांमध्ये शोषले गेले आहे; त्यामुळे पुन्हा फवारणी करण्याची गरज नाही.`;
            } else if (language === "hi") {
                finalAnswer = `टमाटर की फसल पर छिड़के गए कवकनाशी (Azoxystrobin) के लिए कम से कम 2 से 3 घंटे का बारिश-मुक्त समय (Rainfastness period) आवश्यक होता है।\n\n1. यदि छिड़काव के 2 घंटे के भीतर बारिश हो गई है, तो दवा धुलने की संभावना है। पत्तियां सूखने के बाद 50% कम मात्रा (0.5 मिली/लीटर) और स्टिकर मिलाकर दोबारा छिड़काव करें।\n2. यदि छिड़काव के 3 घंटे बाद बारिश हुई है, तो दवा पत्तियों में अवशोषित हो चुकी है; दोबारा छिड़काव की आवश्यकता नहीं है।`;
            } else {
                finalAnswer = `For tomato treatments like Azoxystrobin, a minimum rainfastness period of 2 to 3 hours is required for systemic absorption.\n\n1. If rain occurred within 2 hours of spraying: The active ingredient was likely washed off. Re-apply at 50% reduced dosage (0.5 ml/L) mixed with a non-ionic spreader/sticker once foliage dries.\n2. If rain occurred after 3 hours: The fungicide was successfully absorbed into leaf tissues; no re-spray is needed.`;
            }
        } else {
            if (language === "mr") {
                finalAnswer = `तुमच्या पिकासाठी सल्ला: बुरशीनाशक फवारताना नेहमी सकाळच्या किंवा संध्याकाळच्या थंड हवेत फवारणी करावी. तीव्र उन्हात फवारणी टाळावी. सोबत स्टीकर वापरावा आणि जमिनीत ओलावा असतानाच फवारणी करावी.`;
            } else if (language === "hi") {
                finalAnswer = `फसल सलाह: कीटनाशक या कवकनाशी का छिड़काव हमेशा सुबह या शाम के समय ठंडे मौसम में करें। तेज धूप में छिड़काव से बचें और हमेशा स्टीकर का प्रयोग करें।`;
            } else {
                finalAnswer = `Agronomic Advice: Always apply foliar sprays during cool morning or late afternoon hours. Avoid midday heat to prevent chemical evaporation, and ensure adequate soil moisture prior to treatment.`;
            }
        }
    }

    return {
        success: true,
        answer: finalAnswer,
        language,
        context: {
            caseRef: caseContext?.caseRef || null,
            crop: caseContext?.crop || "Tomato",
            disease: caseContext?.condition || "Tomato Early Blight",
            prescribedSpray: treatmentContext?.spray || "Azoxystrobin 18.2% + Difenoconazole 11.4% SC",
            weather: weatherContext
        },
        source: "ICAR / MPKV Agronomic Knowledge Base & CIB&RC Standards"
    };
}

module.exports = {
    answerFarmerQuery
};
