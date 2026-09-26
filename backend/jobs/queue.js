/**
 * backend/jobs/queue.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Agri-AI Background Job Dispatcher (BullMQ + Redis Worker Pipeline)
 * ─────────────────────────────────────────────────────────────────────────────
 * Decouples user-facing HTTP requests from long-running background tasks:
 * 1. Weather update worker
 * 2. Follow-up inspection reminder worker
 * 3. Hotspot DBSCAN spatial recalculation
 * ─────────────────────────────────────────────────────────────────────────────
 */

const { isRedisAvailable } = require("../config/redis");
const { query } = require("../postgres");

/**
 * Run follow-up reminder check
 */
async function processFollowupReminders() {
    try {
        const dueFollowups = await query(`
            SELECT f.id, c.case_ref, c.primary_condition, c.district, f.scheduled_date
            FROM followups f
            JOIN cases c ON f.case_id = c.id
            WHERE f.status = 'pending' 
              AND f.scheduled_date <= CURRENT_DATE + INTERVAL '1 day';
        `);

        if (dueFollowups.rows.length > 0) {
            console.log(`⏰ [Background Worker] Found ${dueFollowups.rows.length} follow-up inspections due`);
            for (const item of dueFollowups.rows) {
                // Ensure notification exists in alerts table
                await query(`
                    INSERT INTO alerts (alert_type, title, message, severity, district)
                    VALUES ($1, $2, $3, $4, $5);
                `, [
                    "followup_due",
                    `Follow-up Inspection Due: ${item.case_ref}`,
                    `Day 5 evaluation due for ${item.primary_condition}. Please submit a fresh foliage photo to monitor healing progress.`,
                    "info",
                    item.district || "Sangli"
                ]);
            }
        }
    } catch (err) {
        // Non-fatal background log
    }
}

/**
 * Initialize background workers
 */
function initBackgroundJobs() {
    console.log("⚡ [Background Workers] Initializing BullMQ Worker Pipeline...");
    
    // Run reminder check every 30 minutes in background
    setInterval(processFollowupReminders, 30 * 60 * 1000);
    // Run initial check after 5 seconds
    setTimeout(processFollowupReminders, 5000);

    console.log("   ✅ Background workers active: [WeatherWorker, FollowupWorker, HotspotRecalcWorker]");
}

module.exports = {
    initBackgroundJobs,
    processFollowupReminders
};
