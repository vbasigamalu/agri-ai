/**
 * =============================================================================
 * Expert Validation & Agronomist Escalation Routes
 * =============================================================================
 * Endpoints for expert case review, AI-human discrepancy tracking, and
 * active learning ground-truth dataset generation.
 * =============================================================================
 */

const express = require("express");
const router = express.Router();
const { optionalAuth } = require("../middleware/auth");
const {
    getExpertCases,
    getExpertCaseById,
    submitValidation,
    getExpertStats,
    getGroundTruthDataset,
    enqueueCase
} = require("../expert");

/**
 * GET /api/expert/stats
 * Aggregated metrics: pending cases, confirmed, corrected, agreement rate
 */
router.get("/stats", async (req, res) => {
    try {
        const stats = await getExpertStats();
        return res.json({ success: true, stats });
    } catch (err) {
        console.error("❌ Failed to fetch expert stats:", err.message);
        return res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * GET /api/expert/cases
 * List cases with filtering (status='pending'|'confirmed'|'corrected'|'uncertain'|'all', crop, search)
 */
router.get("/cases", async (req, res) => {
    try {
        const { status = "all", crop, category = "all", search, limit = 50, offset = 0 } = req.query;
        const cases = await getExpertCases({
            status,
            crop,
            category,
            search,
            limit: parseInt(limit, 10),
            offset: parseInt(offset, 10)
        });
        return res.json({ success: true, count: cases.length, cases });
    } catch (err) {
        console.error("❌ Failed to fetch expert cases:", err.message);
        return res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * GET /api/expert/cases/:id
 * Retrieve details for a specific case (including AI findings, VLM observations, and expert verdict)
 */
router.get("/cases/:id", async (req, res) => {
    try {
        const c = await getExpertCaseById(req.params.id);
        if (!c) {
            return res.status(404).json({ success: false, error: "Case not found" });
        }
        return res.json({ success: true, case: c });
    } catch (err) {
        console.error("❌ Failed to fetch case:", err.message);
        return res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * POST /api/expert/validate/:id
 * Submit expert verdict:
 * Body: {
 *   action: 'confirm' | 'correct' | 'uncertain',
 *   expertDisease: 'Tomato Septoria Leaf Spot',
 *   expertSeverity: 'Moderate',
 *   expertNotes: 'Clinical notes describing why AI was corrected or confirmed...',
 *   expertName: 'Dr. Arvind Deshmukh'
 * }
 */
router.post("/validate/:id", optionalAuth, async (req, res) => {
    try {
        const {
            action = "confirm",
            expertDisease,
            expertSeverity,
            expertNotes,
            expertName
        } = req.body;

        const expertId = req.user ? req.user.id : null;
        const finalExpertName = expertName || (req.user ? req.user.name : "Senior Agronomist");

        const updated = await submitValidation(req.params.id, {
            action,
            expertDisease,
            expertSeverity,
            expertNotes,
            expertName: finalExpertName,
            expertId
        });

        console.log(`👨‍🔬 [Expert Validation] ${updated.case_number} -> ${action.toUpperCase()} by ${finalExpertName}`);
        if (action === "correct") {
            console.log(`   ✏️ Discrepancy stored: [AI: ${updated.ai_disease}] vs [Expert: ${updated.expert_disease}]`);
        }

        return res.json({
            success: true,
            message: `Case ${updated.case_number} successfully marked as ${action.toUpperCase()}. Ground-truth data saved for model retraining.`,
            case: updated
        });
    } catch (err) {
        console.error("❌ Failed to submit validation:", err.message);
        return res.status(400).json({ success: false, error: err.message });
    }
});

/**
 * GET /api/expert/ground-truth
 * Export verified ground-truth dataset (JSON or CSV) for PyTorch ONNX retraining
 */
router.get("/ground-truth", async (req, res) => {
    try {
        const { format = "json", split = "all" } = req.query;
        const dataset = await getGroundTruthDataset({ format, split });

        if (format === "csv") {
            res.header("Content-Type", "text/csv");
            res.attachment(`agri_ai_ground_truth_${Date.now()}.csv`);
            return res.send(dataset);
        }

        return res.json({
            success: true,
            totalGroundTruthPairs: Array.isArray(dataset) ? dataset.length : 0,
            dataset
        });
    } catch (err) {
        console.error("❌ Failed to export ground-truth dataset:", err.message);
        return res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * POST /api/expert/enqueue
 * Farmer or system enqueues a scan for human agronomist escalation
 */
router.post("/enqueue", optionalAuth, async (req, res) => {
    try {
        const {
            category = "disease",
            crop = "Tomato",
            aiDisease,
            aiConfidence = 60.0,
            aiSeverity,
            aiStatus = "confirmed",
            symptoms = [],
            vlmEvidence = {},
            imageUrl,
            imageName,
            district,
            village,
            latitude,
            longitude
        } = req.body;

        const enqueued = await enqueueCase({
            category,
            crop,
            aiDisease: aiDisease || "Crop Condition",
            aiConfidence: parseFloat(aiConfidence),
            aiSeverity: aiSeverity || "Moderate",
            aiStatus,
            symptoms: Array.isArray(symptoms) ? symptoms : [symptoms],
            vlmEvidence,
            imageUrl,
            imageName,
            farmerId: req.user ? req.user.id : null,
            farmerName: req.user ? req.user.name : "Anonymous Farmer",
            district: district || (req.user ? req.user.district : "Sangli"),
            village: village || (req.user ? req.user.village : "Miraj"),
            latitude: latitude ? parseFloat(latitude) : 16.8524,
            longitude: longitude ? parseFloat(longitude) : 74.5815
        });

        return res.json({
            success: true,
            message: `Case ${enqueued.case_number} enqueued for expert review.`,
            case: enqueued
        });
    } catch (err) {
        console.error("❌ Failed to enqueue case:", err.message);
        return res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
