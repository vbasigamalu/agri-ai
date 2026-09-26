/**
 * backend/routes/chatbotRoutes.js
 * ─────────────────────────────────────────────────────────────────────────────
 * REST API Endpoints for Context-Aware Agricultural Advisor
 * ─────────────────────────────────────────────────────────────────────────────
 */

const express = require("express");
const router = express.Router();
const { optionalAuth } = require("../middleware/auth");
const { answerFarmerQuery } = require("../services/chatbotService");

/**
 * @route   POST /api/chatbot/query
 * @desc    Context-aware query handling (injects active case, weather, treatment history)
 */
router.post("/query", optionalAuth, async (req, res) => {
    try {
        const { question, activeCaseRef, farmLocation, language, history } = req.body;

        if (!question || !question.trim()) {
            return res.status(400).json({ success: false, error: "Question cannot be empty" });
        }

        const response = await answerFarmerQuery({
            question: question.trim(),
            activeCaseRef: activeCaseRef || null,
            farmLocation: farmLocation || (req.user ? { lat: req.user.latitude, lon: req.user.longitude } : null),
            language: language || req.user?.preferred_language || "mr",
            history: history || []
        });

        res.json(response);
    } catch (err) {
        console.error("Chatbot query error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
