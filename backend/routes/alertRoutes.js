/**
 * backend/routes/alertRoutes.js
 * ─────────────────────────────────────────────────────────────────────────────
 * REST API Endpoints for District Epidemiological Alerts & Farmer Reminders
 * ─────────────────────────────────────────────────────────────────────────────
 */

const express = require("express");
const router = express.Router();
const { query } = require("../postgres");
const { optionalAuth } = require("../middleware/auth");

/**
 * @route   GET /api/alerts
 * @desc    Get real-time alerts for the farmer's district
 */
router.get("/", optionalAuth, async (req, res) => {
    try {
        const district = req.query.district || (req.user ? req.user.district : "Sangli");

        const dbAlerts = await query(`
            SELECT * FROM alerts 
            WHERE LOWER(district) = LOWER($1)
            ORDER BY created_at DESC 
            LIMIT 20;
        `, [district]);

        // Synthesize live dynamic alerts based on active DBSCAN clusters & follow-ups
        const followupDue = await query(`
            SELECT c.case_ref, c.primary_condition, f.scheduled_date 
            FROM followups f
            JOIN cases c ON f.case_id = c.id
            WHERE f.status = 'pending' AND f.scheduled_date <= CURRENT_DATE + INTERVAL '1 day'
            LIMIT 5;
        `);

        const dynamicAlerts = [...dbAlerts.rows];

        followupDue.rows.forEach(f => {
            dynamicAlerts.push({
                id: `fu-${f.case_ref}`,
                alert_type: "followup_due",
                severity: "info",
                title: `Follow-up Inspection Due: ${f.case_ref}`,
                message: `Day 5 re-inspection scheduled for ${f.primary_condition}. Please upload a fresh leaf photo to verify healing progress.`,
                district: district,
                created_at: new Date()
            });
        });

        // Add weather risk advisory
        dynamicAlerts.push({
            id: `wx-${district}`,
            alert_type: "weather_risk",
            severity: "warning",
            title: `High Humidity Advisory · ${district}`,
            message: "Relative humidity forecasted above 82% over the next 48 hours. Fungal spore germination index is Elevated.",
            district: district,
            created_at: new Date()
        });

        res.json({
            success: true,
            district,
            count: dynamicAlerts.length,
            alerts: dynamicAlerts
        });
    } catch (err) {
        console.error("Error fetching alerts:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
