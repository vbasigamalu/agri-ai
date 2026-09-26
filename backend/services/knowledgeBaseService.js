/**
 * backend/services/knowledgeBaseService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Agricultural Knowledge Base Service (ICAR / MPKV Agronomic Ground Truth)
 * ─────────────────────────────────────────────────────────────────────────────
 */

const { query } = require("../postgres");

/**
 * Retrieve agronomic details for a specific crop condition
 */
async function getConditionDetails(crop, conditionName) {
    const res = await query(`
        SELECT * FROM knowledge_base
        WHERE LOWER(crop) = LOWER($1) 
          AND (LOWER(disease_or_pest) = LOWER($2) OR LOWER(disease_or_pest) LIKE '%' || LOWER($2) || '%')
        LIMIT 1;
    `, [crop, conditionName]);

    return res.rows[0] || null;
}

/**
 * Search the knowledge base using keywords (e.g. "rain", "पाऊस", "fungicide", "organic")
 */
async function searchKnowledgeBase(crop, keyword, language = "en") {
    const res = await query(`
        SELECT * FROM knowledge_base
        WHERE (LOWER(crop) = LOWER($1) OR $1 IS NULL)
          AND (
            LOWER(disease_or_pest) LIKE '%' || LOWER($2) || '%'
            OR LOWER(symptoms_en) LIKE '%' || LOWER($2) || '%'
            OR LOWER(symptoms_mr) LIKE '%' || LOWER($2) || '%'
            OR LOWER(symptoms_hi) LIKE '%' || LOWER($2) || '%'
            OR LOWER(chemical_treatment) LIKE '%' || LOWER($2) || '%'
            OR LOWER(biological_treatment) LIKE '%' || LOWER($2) || '%'
            OR LOWER(causes) LIKE '%' || LOWER($2) || '%'
          )
        LIMIT 5;
    `, [crop || null, keyword]);

    return res.rows;
}

/**
 * List all knowledge base entries for a crop
 */
async function listCropKnowledge(crop = "Tomato") {
    const res = await query(`
        SELECT id, crop, disease_or_pest, category, rainfastness_hours, expert_source 
        FROM knowledge_base 
        WHERE LOWER(crop) = LOWER($1)
        ORDER BY disease_or_pest ASC;
    `, [crop]);

    return res.rows;
}

module.exports = {
    getConditionDetails,
    searchKnowledgeBase,
    listCropKnowledge
};
