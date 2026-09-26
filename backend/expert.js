/**
 * =============================================================================
 * Agri-AI Expert Validation & Ground-Truth Annotation Subsystem
 * =============================================================================
 * Stack: PostgreSQL (Relational + JSONB) + Node.js
 *
 * Core Capabilities:
 * 1. Human-in-the-Loop (HITL) Agronomist Review Queue
 * 2. Immutable side-by-side storage of AI Diagnosis vs Expert Ground-Truth:
 *      AI:     Tomato Early Blight (61%)
 *      Expert: Tomato Septoria Leaf Spot
 *      Store both for model retraining & active learning.
 * 3. Clinical decision audit trail (Expert name, notes, timestamp).
 * 4. Ground-truth dataset export in JSON/CSV for model fine-tuning.
 * 5. Resilient offline in-memory fallback when PostgreSQL is unreachable.
 * =============================================================================
 */

const { query, isPostgresConnected } = require("./postgres");
const fs = require("fs");
const path = require("path");

const sampleCases = [
    // ── CASE #1024: USER'S SPECIFICATION ──────────────────────────
    {
        id: 1,
        case_number: "CASE-1024",
        category: "disease",
        image_url: "/dataset/Tomato___Early_blight/0012b9d2-2130-4a06-a834-b1f3af34f57e___RS_Erly.B 7889.JPG",
        image_name: "tomato_leaf_sample_1024.jpg",
        crop: "Tomato",
        ai_disease: "Tomato Early Blight",
        ai_confidence: 61.0,
        ai_severity: "Moderate (18% leaf area affected)",
        ai_status: "confirmed",
        symptoms: ["Circular brown target spots", "Yellow chlorotic halo", "Lower canopy defoliation"],
        vlm_evidence: {
            observations: [
                "Concentric rings visible on lower foliage",
                "Small sunken brownish lesions with chlorotic yellow halo",
                "Early stage defoliation near stem junction"
            ],
            morphologySummary: "Target-board circular lesions with concentric chlorotic margins on tomato leaflet."
        },
        farmer_name: "Ramesh Patil",
        district: "Sangli",
        village: "Miraj Rural",
        latitude: 16.8524,
        longitude: 74.5815,
        validation_status: "pending",
        expert_disease: null,
        expert_severity: null,
        expert_notes: null,
        expert_name: null,
        is_ground_truth: false,
        training_split: "unassigned",
        created_at: new Date(Date.now() - 2 * 3600000).toISOString()
    },

    // ── CASE #1018: HISTORICAL GROUND-TRUTH (Corrected Discrepancy) ─
    {
        id: 2,
        case_number: "CASE-1018",
        category: "disease",
        image_url: "/dataset/Tomato___Septoria_leaf_spot/00f16501-4467-4e76-8051-40994f1e9447___JR_Sept.L.S 8431.JPG",
        image_name: "tomato_septoria_field_specimen.jpg",
        crop: "Tomato",
        ai_disease: "Tomato Early Blight",
        ai_confidence: 58.4,
        ai_severity: "Moderate (15% leaf area affected)",
        ai_status: "confirmed",
        symptoms: ["Circular spots with dark borders", "Small punctate lesions"],
        vlm_evidence: {
            observations: [
                "Numerous small circular spots across leaf blade",
                "Dark brown borders with greyish central area",
                "Lacks broad concentric Alternaria rings"
            ],
            morphologySummary: "Small circular lesions with dark brown margins and grey sunken centers."
        },
        farmer_name: "Suresh Kulkarni",
        district: "Nashik",
        village: "Pimpalgaon Baswant",
        latitude: 20.0059,
        longitude: 73.7898,
        validation_status: "corrected",
        expert_disease: "Tomato Septoria Leaf Spot",
        expert_severity: "Moderate (15% affected, Stage 2)",
        expert_notes: "Microscopic review confirms small circular water-soaked lesions with dark brown margins and grey sunken centers with pycnidia fruiting bodies. Corrected for model retraining.",
        expert_name: "Dr. Arvind Deshmukh (Senior Agronomist, KVK)",
        is_ground_truth: true,
        training_split: "train",
        validated_at: new Date(Date.now() - 24 * 3600000).toISOString(),
        created_at: new Date(Date.now() - 48 * 3600000).toISOString()
    },

    // ── CASE #1021: HISTORICAL GROUND-TRUTH (Confirmed Match) ───────
    {
        id: 3,
        case_number: "CASE-1021",
        category: "disease",
        image_url: "/dataset/Tomato___Late_blight/0003faa8-4b2b-4c58-b69f-dd54d232a0ab___GHLB2 Leaf 90.1.JPG",
        image_name: "tomato_late_blight_miraj.jpg",
        crop: "Tomato",
        ai_disease: "Tomato Late Blight",
        ai_confidence: 91.8,
        ai_severity: "Severe (34% leaf area affected)",
        ai_status: "confirmed",
        symptoms: ["Large irregular water-soaked lesions", "White sporulation on leaf underside", "Rapid stem necrosis"],
        vlm_evidence: {
            observations: [
                "Large irregular brown-black necrotic blotches",
                "Fine white fungal down on abaxial surface",
                "High humidity spread pattern"
            ],
            morphologySummary: "Aggressive Phytophthora infestans water-soaked lesion with pale halo."
        },
        farmer_name: "Kisanrao Jadhav",
        district: "Sangli",
        village: "Tasgaon",
        latitude: 17.0340,
        longitude: 74.6020,
        validation_status: "confirmed",
        expert_disease: "Tomato Late Blight",
        expert_severity: "Severe (34% leaf area affected)",
        expert_notes: "Confirmed Phytophthora infestans. Extensive water-soaked greasy lesions consistent with cool, wet weather spread.",
        expert_name: "Dr. Meera Gokhale (Plant Pathologist)",
        is_ground_truth: true,
        training_split: "train",
        validated_at: new Date(Date.now() - 36 * 3600000).toISOString(),
        created_at: new Date(Date.now() - 60 * 3600000).toISOString()
    },

    // ── CASE #1025: PENDING CASE (Bacterial Spot vs Early Blight) ───
    {
        id: 4,
        case_number: "CASE-1025",
        category: "disease",
        image_url: "/dataset/Tomato___Bacterial_spot/00416648-be6e-4bd4-bc8d-82f43f8a7240___UF.GRC_BS_Lab Leaf 0488.JPG",
        image_name: "tomato_bacterial_spot_sample.jpg",
        crop: "Tomato",
        ai_disease: "Tomato Bacterial Spot",
        ai_confidence: 68.2,
        ai_severity: "Mild (8% leaf area affected)",
        ai_status: "confirmed",
        symptoms: ["Small dark greasy spots", "Shot-hole appearance in older lesions"],
        vlm_evidence: {
            observations: [
                "Angular, water-soaked dark spots",
                "Slight yellow halo around lesion perimeter"
            ],
            morphologySummary: "Small greasy angular spots characteristic of Xanthomonas bacterial infection."
        },
        farmer_name: "Bapu Shinde",
        district: "Pune",
        village: "Baramati",
        latitude: 18.5204,
        longitude: 73.8567,
        validation_status: "pending",
        expert_disease: null,
        expert_severity: null,
        expert_notes: null,
        expert_name: null,
        is_ground_truth: false,
        training_split: "unassigned",
        created_at: new Date(Date.now() - 12 * 3600000).toISOString()
    },

    // ── CASE #1026: UNCERTAIN CASE (Ambiguous Foliage) ──────────────
    {
        id: 5,
        case_number: "CASE-1026",
        category: "disease",
        image_url: "/dataset/Tomato___Spider_mites_Two-spotted_spider_mite/00a74797-1725-4c07-b248-be2e92c286d8___Com.G_SpM_FL 8980.JPG",
        image_name: "tomato_stippling_sample.jpg",
        crop: "Tomato",
        ai_disease: "Uncertain - Ambiguous Symptoms",
        ai_confidence: 42.5,
        ai_severity: "Mild (5% affected)",
        ai_status: "uncertain",
        symptoms: ["Fine yellow stippling", "Bronzing of leaf surface"],
        vlm_evidence: {
            observations: [
                "Tiny chlorotic speckles across leaf surface",
                "No fungal sporulation observed",
                "Possible mite damage or micronutrient deficiency"
            ],
            morphologySummary: "Punctate chlorotic stippling with ambiguous etiology."
        },
        farmer_name: "Ganesh More",
        district: "Solapur",
        village: "Pandharpur",
        latitude: 17.6599,
        longitude: 75.9064,
        validation_status: "pending",
        expert_disease: null,
        expert_severity: null,
        expert_notes: null,
        expert_name: null,
        is_ground_truth: false,
        training_split: "unassigned",
        created_at: new Date(Date.now() - 8 * 3600000).toISOString()
    },

    // ── CASE #1027: INSECT PEST ESCALATION (Tomato Fruit Borer) ────
    {
        id: 6,
        case_number: "CASE-1027",
        category: "pest",
        image_url: "/uploads/pests/pest-sample-borer.jpg",
        image_name: "tomato_borer_specimen.jpg",
        crop: "Tomato",
        ai_disease: "Tomato Fruit Borer (Helicoverpa armigera)",
        ai_confidence: 64.0,
        ai_severity: "High (Trap count: 9 insects, ETL exceeded)",
        ai_status: "confirmed",
        symptoms: ["Circular entrance holes in green fruits", "Frass accumulated near calyx", "Larva inside fruit"],
        vlm_evidence: {
            observations: ["Prominent circular larval bore entry near pedicel", "Greenish-brown caterpillar visible inside calyx"],
            morphologySummary: "Helicoverpa armigera larval boring damage on green tomato fruit."
        },
        farmer_name: "Sanjay Shinde",
        district: "Solapur",
        village: "Pandharpur Rural",
        latitude: 17.6744,
        longitude: 75.3218,
        validation_status: "pending",
        expert_disease: null,
        expert_severity: null,
        expert_notes: null,
        expert_name: null,
        is_ground_truth: false,
        training_split: "unassigned",
        created_at: new Date(Date.now() - 4 * 3600000).toISOString()
    }
];

let localExpertCases = [...sampleCases];

/**
 * Initialize PostgreSQL expert_cases table and indexes
 */
async function initExpertDB() {
    if (!isPostgresConnected()) {
        console.log(`👨‍🔬 Expert Validation Queue: Ready (${localExpertCases.length} benchmark & HITL cases loaded)`);
        return;
    }
    try {
        console.log("👨‍🔬 Initializing Expert Validation Subsystem...");

        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS expert_cases (
                id SERIAL PRIMARY KEY,
                case_number VARCHAR(50) UNIQUE NOT NULL,
                image_url TEXT,
                image_name VARCHAR(255),
                crop VARCHAR(100) NOT NULL,
                
                -- AI Predictions (Preserved immutable)
                ai_disease VARCHAR(255) NOT NULL,
                ai_confidence NUMERIC(5, 2) NOT NULL,
                ai_severity VARCHAR(150),
                ai_status VARCHAR(50) DEFAULT 'confirmed',
                symptoms TEXT[] DEFAULT '{}',
                vlm_evidence JSONB DEFAULT '{}'::jsonb,
                
                -- Farmer / Field Context
                farmer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                farmer_name VARCHAR(100) DEFAULT 'Anonymous Farmer',
                district VARCHAR(100) DEFAULT 'Sangli',
                village VARCHAR(100) DEFAULT 'Miraj Rural',
                latitude NUMERIC(10, 6) DEFAULT 16.8524,
                longitude NUMERIC(10, 6) DEFAULT 74.5815,
                
                -- Expert Validation & Ground-Truth
                validation_status VARCHAR(30) DEFAULT 'pending', -- 'pending' | 'confirmed' | 'corrected' | 'uncertain'
                expert_disease VARCHAR(255),
                expert_severity VARCHAR(150),
                expert_notes TEXT,
                expert_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                expert_name VARCHAR(100),
                validated_at TIMESTAMP WITH TIME ZONE,
                
                -- Active Learning & Ground-Truth Dataset Pipeline
                is_ground_truth BOOLEAN DEFAULT FALSE,
                training_split VARCHAR(20) DEFAULT 'unassigned', -- 'train' | 'val' | 'test' | 'unassigned'
                
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_expert_status ON expert_cases(validation_status);
            CREATE INDEX IF NOT EXISTS idx_expert_crop ON expert_cases(crop);
            CREATE INDEX IF NOT EXISTS idx_expert_ground_truth ON expert_cases(is_ground_truth);

            -- Ensure category column exists for disease vs pest triage
            ALTER TABLE expert_cases ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'disease';
            CREATE INDEX IF NOT EXISTS idx_expert_category ON expert_cases(category);
        `;

        await query(createTableQuery);
        console.log("   ✅ PostgreSQL [expert_cases] table & indexes verified (including category column)!");

        // Auto-seed benchmark and user-requested Case #1024 if sparse
        await seedExpertCasesIfEmpty();

    } catch (err) {
        console.log(`👨‍🔬 Expert Validation Queue: Ready (${localExpertCases.length} benchmark & HITL cases loaded)`);
    }
}

/**
 * Seed benchmark and user-specified cases (e.g. Case #1024 with Early Blight @ 61% confidence)
 */
async function seedExpertCasesIfEmpty() {
    try {
        const countRes = await query("SELECT COUNT(*) FROM expert_cases;");
        if (parseInt(countRes.rows[0].count, 10) >= 6) return;

        for (const c of sampleCases) {
            await query(`
                INSERT INTO expert_cases (
                    case_number, category, image_url, image_name, crop,
                    ai_disease, ai_confidence, ai_severity, ai_status, symptoms, vlm_evidence,
                    farmer_name, district, village, latitude, longitude,
                    validation_status, expert_disease, expert_severity, expert_notes, expert_name,
                    is_ground_truth, training_split, validated_at
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                    $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
                    $21, $22, $23, ${c.is_ground_truth ? "NOW()" : "NULL"}
                ) ON CONFLICT (case_number) DO NOTHING;
            `, [
                c.case_number, c.category || "disease", c.image_url, c.image_name, c.crop,
                c.ai_disease, c.ai_confidence, c.ai_severity, c.ai_status, c.symptoms, JSON.stringify(c.vlm_evidence),
                c.farmer_name, c.district, c.village, c.latitude, c.longitude,
                c.validation_status, c.expert_disease, c.expert_severity, c.expert_notes, c.expert_name,
                c.is_ground_truth, c.training_split || "unassigned"
            ]);
        }

        console.log("   ✅ Seeded initial expert validation cases successfully (including pest cases).");

    } catch (err) {
        // Handled silently
    }
}

/**
 * Get cases list with filtering (status, crop, category, search)
 */
async function getExpertCases({ status = "all", crop = null, category = "all", search = null, limit = 50, offset = 0 } = {}) {
    try {
        let whereClauses = [];
        let params = [];
        let idx = 1;

        if (status && status !== "all") {
            whereClauses.push(`validation_status = $${idx++}`);
            params.push(status.toLowerCase());
        }

        if (crop) {
            whereClauses.push(`crop ILIKE $${idx++}`);
            params.push(`%${crop}%`);
        }

        if (category && category !== "all") {
            whereClauses.push(`category = $${idx++}`);
            params.push(category.toLowerCase());
        }

        if (search) {
            whereClauses.push(`(case_number ILIKE $${idx} OR ai_disease ILIKE $${idx} OR expert_disease ILIKE $${idx} OR farmer_name ILIKE $${idx})`);
            params.push(`%${search}%`);
            idx++;
        }

        const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

        params.push(limit);
        const limitIdx = idx++;
        params.push(offset);
        const offsetIdx = idx++;

        const sql = `
            SELECT 
                id,
                case_number,
                COALESCE(category, 'disease') AS category,
                image_url,
                image_name,
                crop,
                ai_disease,
                ROUND(ai_confidence::numeric, 1) AS ai_confidence,
                ai_severity,
                ai_status,
                symptoms,
                vlm_evidence,
                farmer_name,
                district,
                village,
                latitude,
                longitude,
                validation_status,
                expert_disease,
                expert_severity,
                expert_notes,
                expert_name,
                is_ground_truth,
                training_split,
                validated_at,
                created_at
            FROM expert_cases
            ${whereStr}
            ORDER BY 
                CASE WHEN validation_status = 'pending' THEN 0 ELSE 1 END,
                id DESC
            LIMIT $${limitIdx} OFFSET $${offsetIdx};
        `;

        const res = await query(sql, params);
        return res.rows;
    } catch (err) {
        // Resilient in-memory fallback
        let filtered = [...localExpertCases];
        if (status && status !== "all") {
            filtered = filtered.filter(c => (c.validation_status || "").toLowerCase() === status.toLowerCase());
        }
        if (crop) {
            filtered = filtered.filter(c => (c.crop || "").toLowerCase().includes(crop.toLowerCase()));
        }
        if (category && category !== "all") {
            filtered = filtered.filter(c => (c.category || "disease").toLowerCase() === category.toLowerCase());
        }
        if (search) {
            const s = search.toLowerCase();
            filtered = filtered.filter(c =>
                (c.case_number || "").toLowerCase().includes(s) ||
                (c.ai_disease || "").toLowerCase().includes(s) ||
                (c.expert_disease || "").toLowerCase().includes(s) ||
                (c.farmer_name || "").toLowerCase().includes(s)
            );
        }
        filtered.sort((a, b) => {
            if (a.validation_status === "pending" && b.validation_status !== "pending") return -1;
            if (a.validation_status !== "pending" && b.validation_status === "pending") return 1;
            return (b.id || 0) - (a.id || 0);
        });
        return filtered.slice(offset, offset + limit);
    }
}

/**
 * Get single case by ID or case_number
 */
async function getExpertCaseById(identifier) {
    try {
        const isId = !isNaN(identifier);
        const sql = isId
            ? "SELECT * FROM expert_cases WHERE id = $1 LIMIT 1;"
            : "SELECT * FROM expert_cases WHERE case_number ILIKE $1 LIMIT 1;";
        const res = await query(sql, [identifier]);
        return res.rows[0] || null;
    } catch (err) {
        const idStr = String(identifier).toLowerCase();
        return localExpertCases.find(c => 
            String(c.id) === idStr || (c.case_number || "").toLowerCase() === idStr
        ) || null;
    }
}

/**
 * Submit Expert Validation:
 * - action: 'confirm' | 'correct' | 'uncertain'
 */
async function submitValidation(caseId, {
    action = "confirm",
    expertDisease = null,
    expertSeverity = null,
    expertNotes = "",
    expertName = "Expert Agronomist",
    expertId = null
} = {}) {
    const existing = await getExpertCaseById(caseId);
    if (!existing) {
        throw new Error(`Case #${caseId} not found`);
    }

    let finalStatus = "pending";
    let finalDisease = existing.ai_disease;
    let finalSeverity = existing.ai_severity;
    let isGroundTruth = false;

    if (action === "confirm") {
        finalStatus = "confirmed";
        finalDisease = existing.ai_disease;
        finalSeverity = expertSeverity || existing.ai_severity;
        isGroundTruth = true;
    } else if (action === "correct") {
        finalStatus = "corrected";
        finalDisease = expertDisease || existing.ai_disease;
        finalSeverity = expertSeverity || existing.ai_severity;
        isGroundTruth = true;
    } else if (action === "uncertain") {
        finalStatus = "uncertain";
        finalDisease = expertDisease || "Inconclusive / Lab Sample Required";
        finalSeverity = expertSeverity || "Uncertain";
        isGroundTruth = false;
    } else {
        throw new Error(`Invalid validation action: ${action}. Expected 'confirm', 'correct', or 'uncertain'.`);
    }

    try {
        const updateSql = `
            UPDATE expert_cases
            SET 
                validation_status = $1,
                expert_disease = $2,
                expert_severity = $3,
                expert_notes = $4,
                expert_name = $5,
                expert_id = $6,
                is_ground_truth = $7,
                validated_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $8 OR case_number ILIKE $9
            RETURNING *;
        `;

        const res = await query(updateSql, [
            finalStatus,
            finalDisease,
            finalSeverity,
            expertNotes,
            expertName,
            expertId,
            isGroundTruth,
            isNaN(caseId) ? null : parseInt(caseId, 10),
            String(caseId)
        ]);

        return res.rows[0];
    } catch (err) {
        // Update in-memory
        const idx = localExpertCases.findIndex(c => String(c.id) === String(caseId) || c.case_number === caseId);
        if (idx >= 0) {
            localExpertCases[idx] = {
                ...localExpertCases[idx],
                validation_status: finalStatus,
                expert_disease: finalDisease,
                expert_severity: finalSeverity,
                expert_notes: expertNotes,
                expert_name: expertName,
                is_ground_truth: isGroundTruth,
                validated_at: new Date().toISOString()
            };
            return localExpertCases[idx];
        }
        return existing;
    }
}

/**
 * Aggregated metrics & dashboard stats
 */
async function getExpertStats() {
    try {
        const sql = `
            SELECT 
                COUNT(*)::int AS total_cases,
                COUNT(CASE WHEN validation_status = 'pending' THEN 1 END)::int AS pending_cases,
                COUNT(CASE WHEN validation_status = 'confirmed' THEN 1 END)::int AS confirmed_cases,
                COUNT(CASE WHEN validation_status = 'corrected' THEN 1 END)::int AS corrected_cases,
                COUNT(CASE WHEN validation_status = 'uncertain' THEN 1 END)::int AS uncertain_cases,
                COUNT(CASE WHEN is_ground_truth = TRUE THEN 1 END)::int AS ground_truth_count,
                COUNT(CASE WHEN COALESCE(category, 'disease') = 'disease' THEN 1 END)::int AS disease_cases,
                COUNT(CASE WHEN category = 'pest' THEN 1 END)::int AS pest_cases,
                ROUND(AVG(ai_confidence)::numeric, 1) AS avg_ai_confidence
            FROM expert_cases;
        `;

        const res = await query(sql);
        const row = res.rows[0];

        const totalReviewed = (row.confirmed_cases || 0) + (row.corrected_cases || 0);
        const aiAgreementRate = totalReviewed > 0
            ? parseFloat(((row.confirmed_cases / totalReviewed) * 100).toFixed(1))
            : 100.0;

        return {
            totalCases: row.total_cases || 0,
            pendingCases: row.pending_cases || 0,
            confirmedCases: row.confirmed_cases || 0,
            correctedCases: row.corrected_cases || 0,
            uncertainCases: row.uncertain_cases || 0,
            groundTruthCount: row.ground_truth_count || 0,
            diseaseCases: row.disease_cases || 0,
            pestCases: row.pest_cases || 0,
            avgAiConfidence: parseFloat(row.avg_ai_confidence || 0),
            aiAgreementRate,
            discrepancyCount: row.corrected_cases || 0
        };
    } catch (err) {
        // In-memory stats
        const totalCases = localExpertCases.length;
        const pendingCases = localExpertCases.filter(c => c.validation_status === "pending").length;
        const confirmedCases = localExpertCases.filter(c => c.validation_status === "confirmed").length;
        const correctedCases = localExpertCases.filter(c => c.validation_status === "corrected").length;
        const uncertainCases = localExpertCases.filter(c => c.validation_status === "uncertain").length;
        const groundTruthCount = localExpertCases.filter(c => c.is_ground_truth).length;
        const diseaseCases = localExpertCases.filter(c => (c.category || "disease") === "disease").length;
        const pestCases = localExpertCases.filter(c => c.category === "pest").length;
        const avgAiConfidence = totalCases > 0
            ? parseFloat((localExpertCases.reduce((acc, c) => acc + (parseFloat(c.ai_confidence) || 0), 0) / totalCases).toFixed(1))
            : 85.0;
        const totalReviewed = confirmedCases + correctedCases;
        const aiAgreementRate = totalReviewed > 0
            ? parseFloat(((confirmedCases / totalReviewed) * 100).toFixed(1))
            : 100.0;

        return {
            totalCases,
            pendingCases,
            confirmedCases,
            correctedCases,
            uncertainCases,
            groundTruthCount,
            diseaseCases,
            pestCases,
            avgAiConfidence,
            aiAgreementRate,
            discrepancyCount: correctedCases
        };
    }
}

/**
 * Export Ground-Truth Dataset for Model Fine-Tuning & Retraining
 */
async function getGroundTruthDataset({ split = "all", format = "json" } = {}) {
    try {
        let where = "WHERE is_ground_truth = TRUE";
        const params = [];
        if (split && split !== "all") {
            where += " AND training_split = $1";
            params.push(split);
        }

        const sql = `
            SELECT 
                case_number,
                crop,
                COALESCE(category, 'disease') AS category,
                ai_disease,
                ai_confidence,
                ai_severity,
                expert_disease AS ground_truth_disease,
                expert_severity AS ground_truth_severity,
                validation_status,
                expert_notes,
                expert_name,
                training_split,
                image_url,
                image_name,
                district,
                village,
                latitude,
                longitude,
                validated_at
            FROM expert_cases
            ${where}
            ORDER BY id ASC;
        `;

        const res = await query(sql, params);
        const records = res.rows;

        if (format === "csv") {
            if (records.length === 0) return "case_number,category,crop,ai_disease,ai_confidence,ground_truth_disease,status,expert_notes\n";
            const headers = ["case_number", "category", "crop", "ai_disease", "ai_confidence", "ground_truth_disease", "validation_status", "training_split", "expert_notes", "validated_at"];
            const rows = records.map(r => [
                `"${r.case_number}"`,
                `"${r.category}"`,
                `"${r.crop}"`,
                `"${r.ai_disease}"`,
                r.ai_confidence,
                `"${r.ground_truth_disease || ""}"`,
                `"${r.validation_status}"`,
                `"${r.training_split}"`,
                `"${(r.expert_notes || "").replace(/"/g, '""')}"`,
                `"${r.validated_at || ""}"`
            ].join(","));
            return [headers.join(","), ...rows].join("\n");
        }

        return records;
    } catch (err) {
        let records = localExpertCases.filter(c => c.is_ground_truth);
        if (split && split !== "all") {
            records = records.filter(c => c.training_split === split);
        }
        return records;
    }
}

/**
 * Enqueue a new case into the expert queue
 */
async function enqueueCase({
    category = "disease",
    crop = "Tomato",
    aiDisease = "Unknown Condition",
    aiConfidence = 60.0,
    aiSeverity = "Moderate",
    aiStatus = "confirmed",
    symptoms = [],
    vlmEvidence = {},
    imageUrl = null,
    imageName = null,
    farmerId = null,
    farmerName = "Anonymous Farmer",
    district = "Sangli",
    village = "Miraj",
    latitude = 16.8524,
    longitude = 74.5815
}) {
    try {
        const maxRes = await query("SELECT COALESCE(MAX(id), 1023) + 1 AS next_id FROM expert_cases;");
        const nextNum = maxRes.rows[0].next_id;
        const caseNumber = `CASE-${nextNum}`;

        const sql = `
            INSERT INTO expert_cases (
                case_number, category, image_url, image_name, crop,
                ai_disease, ai_confidence, ai_severity, ai_status, symptoms, vlm_evidence,
                farmer_id, farmer_name, district, village, latitude, longitude,
                validation_status, is_ground_truth
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                $11, $12, $13, $14, $15, $16, $17, 'pending', FALSE
            ) RETURNING *;
        `;

        const res = await query(sql, [
            caseNumber, category, imageUrl, imageName, crop,
            aiDisease, aiConfidence, aiSeverity, aiStatus, symptoms, JSON.stringify(vlmEvidence),
            farmerId, farmerName, district, village, latitude, longitude
        ]);

        return res.rows[0];
    } catch (err) {
        const nextId = (localExpertCases.length > 0 ? Math.max(...localExpertCases.map(c => c.id || 1023)) : 1023) + 1;
        const newCase = {
            id: nextId,
            case_number: `CASE-${nextId}`,
            category,
            image_url: imageUrl,
            image_name: imageName,
            crop,
            ai_disease: aiDisease,
            ai_confidence: aiConfidence,
            ai_severity: aiSeverity,
            ai_status: aiStatus,
            symptoms,
            vlm_evidence: vlmEvidence,
            farmer_name: farmerName,
            district,
            village,
            latitude,
            longitude,
            validation_status: "pending",
            is_ground_truth: false,
            created_at: new Date().toISOString()
        };
        localExpertCases.unshift(newCase);
        return newCase;
    }
}

module.exports = {
    initExpertDB,
    getExpertCases,
    getExpertCaseById,
    submitValidation,
    getExpertStats,
    getGroundTruthDataset,
    enqueueCase
};
