/**
 * backend/services/followupService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Agri-AI Follow-up Monitoring & Disease Progression Analysis Engine
 * ─────────────────────────────────────────────────────────────────────────────
 * Tracks Day 1 initial diagnosis vs Day 5/Day N subsequent re-inspections.
 * Compares lesion coverage, severity, pathogen persistence, and determines:
 * - Improving: Lesions receding, severity decreased, recovery on track
 * - Stable: No significant changes, treatment ongoing
 * - Worsening: Lesions spreading, severity increased, urgent intervention needed
 * - Unclear: Pathogen divergence, escalated to Expert HITL Queue
 * ─────────────────────────────────────────────────────────────────────────────
 */

const { query } = require("../postgres");
const { classifyDisease } = require("../classifier");

/**
 * List all follow-up monitoring cases
 */
async function getAllFollowupCases() {
    const res = await query(`
        SELECT 
            c.id AS case_id,
            c.case_ref,
            c.crop,
            c.category,
            c.primary_condition,
            c.initial_confidence,
            c.initial_severity,
            c.district,
            c.village,
            c.current_status,
            c.created_at AS diagnosed_at,
            f.id AS followup_id,
            f.followup_number,
            f.scheduled_date,
            f.completed_date,
            f.status AS followup_status,
            f.progression_status,
            f.severity_delta_percent,
            f.verdict,
            f.farmer_notes,
            t.spray_name,
            t.dosage_per_acre,
            t.waiting_period_days,
            i1.storage_url AS day1_image_url,
            i2.storage_url AS day5_image_url
        FROM cases c
        LEFT JOIN followups f ON c.id = f.case_id
        LEFT JOIN treatments t ON c.id = t.case_id
        LEFT JOIN images i1 ON c.id = i1.case_id AND i1.image_type = 'leaf_original'
        LEFT JOIN images i2 ON f.followup_image_id = i2.id
        ORDER BY f.scheduled_date ASC, c.created_at DESC;
    `);

    return res.rows;
}

/**
 * Get detailed progression timeline for a specific case
 */
async function getCaseTimeline(caseRef) {
    const caseRes = await query(`
        SELECT * FROM cases WHERE case_ref = $1;
    `, [caseRef]);

    if (caseRes.rows.length === 0) {
        throw new Error(`Case ${caseRef} not found`);
    }

    const caseData = caseRes.rows[0];

    // Fetch initial treatment
    const treatRes = await query(`
        SELECT * FROM treatments WHERE case_id = $1 ORDER BY created_at ASC;
    `, [caseData.id]);

    // Fetch initial predictions
    const predRes = await query(`
        SELECT * FROM predictions WHERE case_id = $1 ORDER BY created_at ASC;
    `, [caseData.id]);

    // Fetch all follow-up inspections
    const followRes = await query(`
        SELECT 
            f.*,
            img.storage_url AS followup_image_url,
            img.quality_score AS followup_image_quality
        FROM followups f
        LEFT JOIN images img ON f.followup_image_id = img.id
        WHERE f.case_id = $1
        ORDER BY f.followup_number ASC;
    `, [caseData.id]);

    // Fetch original day 1 image
    const day1ImgRes = await query(`
        SELECT storage_url FROM images 
        WHERE case_id = $1 AND image_type = 'leaf_original' 
        ORDER BY created_at ASC LIMIT 1;
    `, [caseData.id]);

    return {
        case: caseData,
        day1ImageUrl: day1ImgRes.rows[0]?.storage_url || null,
        treatments: treatRes.rows,
        predictions: predRes.rows,
        followups: followRes.rows
    };
}

/**
 * Schedule a new follow-up milestone for a case
 */
async function scheduleFollowup(caseRef, daysAhead = 5) {
    const caseRes = await query(`
        SELECT id FROM cases WHERE case_ref = $1;
    `, [caseRef]);

    if (caseRes.rows.length === 0) {
        throw new Error(`Case ${caseRef} not found`);
    }

    const caseId = caseRes.rows[0].id;

    // Get next followup number
    const countRes = await query(`
        SELECT COUNT(*) FROM followups WHERE case_id = $1;
    `, [caseId]);
    const nextNumber = parseInt(countRes.rows[0].count, 10) + 1;

    const scheduledDate = new Date();
    scheduledDate.setDate(scheduledDate.getDate() + daysAhead);

    const insertRes = await query(`
        INSERT INTO followups (
            case_id, followup_number, scheduled_date, status, farmer_notes
        ) VALUES ($1, $2, $3, 'pending', $4)
        RETURNING *;
    `, [caseId, nextNumber, scheduledDate, `Follow-up #${nextNumber} scheduled for Day ${daysAhead} evaluation.`]);

    return insertRes.rows[0];
}

/**
 * Process farmer re-inspection upload (Day 5 / Day N)
 * Compares Day 1 vs Day N and computes progression
 */
async function submitFollowupInspection(caseRef, followupId, file, farmerNotes = "") {
    // 1. Fetch case details
    const caseRes = await query(`
        SELECT * FROM cases WHERE case_ref = $1;
    `, [caseRef]);

    if (caseRes.rows.length === 0) {
        throw new Error(`Case ${caseRef} not found`);
    }
    const caseData = caseRes.rows[0];

    // 2. Classify new follow-up image
    const imageUrl = `/uploads/${file.filename}`;
    const classification = await classifyDisease(file.path);

    // 3. Store new image record
    const imgRes = await query(`
        INSERT INTO images (
            case_id, image_type, storage_url, file_name, file_size_bytes, mime_type, quality_score
        ) VALUES ($1, 'followup', $2, $3, $4, $5, $6)
        RETURNING id;
    `, [
        caseData.id,
        imageUrl,
        file.filename,
        file.size,
        file.mimetype,
        classification.imageQuality?.score || 95
    ]);
    const followupImageId = imgRes.rows[0].id;

    // 4. Store follow-up prediction
    const predRes = await query(`
        INSERT INTO predictions (
            case_id, image_id, model_version, predicted_label, confidence_score, severity, all_candidates, vlm_consensus
        ) VALUES ($1, $2, 'efficientnetv2-tomato-v2', $3, $4, $5, $6, $7)
        RETURNING id;
    `, [
        caseData.id,
        followupImageId,
        classification.disease,
        classification.confidencePercent || (classification.confidence * 100),
        classification.severity || "Moderate",
        JSON.stringify(classification.allPredictions || []),
        JSON.stringify(classification.vlmEvidence || {})
    ]);
    const followupPredId = predRes.rows[0].id;

    // 5. Progression Comparison Engine
    const day1Condition = (caseData.primary_condition || "").toLowerCase();
    const dayNCondition = (classification.disease || "").toLowerCase();

    const severityRanks = { "mild": 1, "moderate": 2, "severe": 3, "critical": 4, "healthy": 0 };
    const day1Rank = severityRanks[(caseData.initial_severity || "moderate").toLowerCase()] || 2;
    const dayNRank = severityRanks[(classification.severity || "moderate").toLowerCase()] || 2;

    let progression = "stable";
    let deltaPercent = 0.0;
    let verdict = "";

    const isSamePathogen = dayNCondition.includes("healthy") 
        || day1Condition.includes("early blight") && dayNCondition.includes("early blight")
        || day1Condition.includes("late blight") && dayNCondition.includes("late blight")
        || day1Condition.includes("septoria") && dayNCondition.includes("septoria")
        || day1Condition === dayNCondition;

    if (dayNCondition.includes("healthy")) {
        progression = "improving";
        deltaPercent = -100.0;
        verdict = "Complete Recovery: No active fungal lesions detected on new foliage.";
    } else if (!isSamePathogen) {
        // Pathogen divergence: potential secondary infection or misdiagnosis
        progression = "unclear";
        deltaPercent = 0.0;
        verdict = `Pathogen Shift Detected: Day 1 diagnosed as '${caseData.primary_condition}', but follow-up indicates '${classification.disease}'. Auto-escalated to Agronomist Review.`;
        
        // Auto-escalate to expert queue
        await query(`
            UPDATE cases SET current_status = 'under_review' WHERE id = $1;
        `, [caseData.id]);
    } else if (dayNRank < day1Rank) {
        progression = "improving";
        deltaPercent = -((day1Rank - dayNRank) / day1Rank * 100.0);
        verdict = `Positive Recovery: Severity reduced from ${caseData.initial_severity} to ${classification.severity}. Fungicide arrested lesion expansion.`;
    } else if (dayNRank > day1Rank) {
        progression = "worsening";
        deltaPercent = +((dayNRank - day1Rank) / day1Rank * 100.0);
        verdict = `Disease Escalation: Severity progressed to ${classification.severity}. Recommendation: Rotate chemical group to prevent fungicide resistance.`;
    } else {
        // Same severity rank
        progression = "stable";
        deltaPercent = 0.0;
        verdict = `Stable Progression: Infection contained within original perimeter. Continue strict monitoring until next observation window.`;
    }

    // 6. Update Followup Record
    const updateRes = await query(`
        UPDATE followups SET
            completed_date = CURRENT_TIMESTAMP,
            status = 'completed',
            followup_image_id = $1,
            followup_prediction_id = $2,
            progression_status = $3,
            severity_delta_percent = $4,
            verdict = $5,
            farmer_notes = $6
        WHERE id = $7
        RETURNING *;
    `, [
        followupImageId,
        followupPredId,
        progression,
        deltaPercent,
        verdict,
        farmerNotes,
        followupId
    ]);

    return {
        success: true,
        caseRef,
        followupId,
        progression,
        severityDeltaPercent: deltaPercent,
        verdict,
        day1: {
            disease: caseData.primary_condition,
            severity: caseData.initial_severity,
            confidence: caseData.initial_confidence
        },
        dayN: {
            disease: classification.disease,
            severity: classification.severity,
            confidence: classification.confidencePercent || (classification.confidence * 100),
            imageUrl
        },
        updatedFollowup: updateRes.rows[0]
    };
}

module.exports = {
    getAllFollowupCases,
    getCaseTimeline,
    scheduleFollowup,
    submitFollowupInspection
};
