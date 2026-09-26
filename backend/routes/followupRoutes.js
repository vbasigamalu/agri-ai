/**
 * backend/routes/followupRoutes.js
 * ─────────────────────────────────────────────────────────────────────────────
 * REST API Endpoints for Follow-up Monitoring & Disease Progression
 * ─────────────────────────────────────────────────────────────────────────────
 */

const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { optionalAuth } = require("../middleware/auth");
const {
    getAllFollowupCases,
    getCaseTimeline,
    scheduleFollowup,
    submitFollowupInspection
} = require("../services/followupService");

// Configure storage for follow-up images
const uploadDir = path.join(__dirname, "../uploads/followups");
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname) || ".jpg";
        cb(null, "followup-" + uniqueSuffix + ext);
    }
});

const upload = multer({ storage });

/**
 * @route   GET /api/followup/cases
 * @desc    Get all active and completed follow-up cases
 */
router.get("/cases", optionalAuth, async (req, res) => {
    try {
        const cases = await getAllFollowupCases();
        res.json({
            success: true,
            count: cases.length,
            cases
        });
    } catch (err) {
        console.error("Error fetching follow-up cases:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * @route   GET /api/followup/timeline/:caseRef
 * @desc    Get chronological Day 1 vs Day N comparative progression timeline
 */
router.get("/timeline/:caseRef", optionalAuth, async (req, res) => {
    try {
        const timeline = await getCaseTimeline(req.params.caseRef);
        res.json({
            success: true,
            timeline
        });
    } catch (err) {
        console.error("Error fetching case timeline:", err);
        res.status(404).json({ success: false, error: err.message });
    }
});

/**
 * @route   POST /api/followup/schedule
 * @desc    Schedule a new follow-up milestone for an active case
 */
router.post("/schedule", optionalAuth, async (req, res) => {
    try {
        const { caseRef, daysAhead } = req.body;
        if (!caseRef) {
            return res.status(400).json({ success: false, error: "caseRef is required" });
        }
        const followup = await scheduleFollowup(caseRef, daysAhead ? parseInt(daysAhead, 10) : 5);
        res.status(201).json({
            success: true,
            followup
        });
    } catch (err) {
        console.error("Error scheduling follow-up:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * @route   POST /api/followup/submit
 * @desc    Upload Day 5 / Day N re-inspection leaf image & evaluate recovery delta
 */
router.post("/submit", optionalAuth, upload.single("image"), async (req, res) => {
    try {
        const { caseRef, followupId, farmerNotes } = req.body;

        if (!req.file) {
            return res.status(400).json({ success: false, error: "Follow-up photo is required" });
        }
        if (!caseRef) {
            return res.status(400).json({ success: false, error: "caseRef is required" });
        }

        const result = await submitFollowupInspection(
            caseRef,
            followupId ? parseInt(followupId, 10) : null,
            req.file,
            farmerNotes || ""
        );

        res.json(result);
    } catch (err) {
        console.error("Error processing follow-up inspection:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
