/**
 * ============================================================
 * Agri-AI Vision Pipeline: Multi-Leaf Detection & Aggregator
 * ============================================================
 * Handles images containing multiple leaves in a single frame:
 *
 *   Farmer Image
 *        ├── Leaf 1  (Detect → Crop → Classify → Store)
 *        ├── Leaf 2  (Detect → Crop → Classify → Store)
 *        ├── Leaf 3  (Detect → Crop → Classify → Store)
 *        └── Background Clutter
 *        ↓
 *   Multi-Leaf Consensus & Pathology-Aware Aggregator
 *
 * Design Principles:
 * 1. ZERO BLIND PROBABILITY AVERAGING:
 *    Averaging softmax probabilities across healthy and infected leaves
 *    causes severe diagnostic dilution (e.g. 91% Early Blight + 94% Healthy
 *    averages to ~60%, masking active infections). In plant pathology,
 *    an infected leaf affirms pathogen presence regardless of healthy leaves.
 *
 * 2. EPIDEMIOLOGICAL INFECTION PREVALENCE:
 *    Computes affected leaves ratio (e.g., 2/3, 67% prevalence).
 *    Categorizes plant health as:
 *      - "healthy" / "unaffected": 0/N affected leaves
 *      - "early onset / localized infection": < 50% affected leaves
 *      - "likely affected": >= 50% affected leaves
 *
 * 3. CONFIDENCE-WEIGHTED PATHOGEN CONSENSUS:
 *    Diseased leaves vote for dominant disease based on confidence & area.
 *    Dominant confidence reflects certainty among affected leaves.
 *
 * 4. MULTI-PATHOGEN / CO-INFECTION DETECTION:
 *    Detects and warns if distinct diseases coexist across leaves.
 *
 * 5. UNCERTAINTY & SIZE DEFENSE GATE:
 *    Rejects images where leaf candidates are too small, distant,
 *    or low-confidence to produce a dependable diagnosis.
 * ============================================================
 */

const sharp = require("sharp");
const { prepareModelInput } = require("./preprocessor");
const { getUncertaintyConfig } = require("./uncertaintyGate");

const DEFAULT_CONFIG = {
    minLeafConfidence: 0.50,        // Leaf detection confidence threshold
    minLeafAreaRatio: 0.015,        // Minimum leaf area (1.5% of frame) to eliminate noise specks
    minDimensionPixels: 20,         // Minimum box width and height
    marginRatio: 0.08,              // 8% safety padding around crop box
    targetSize: 224,                // Dimension expected by classifier
    highConfidenceThreshold: 0.70,  // Confidence threshold for reliable diagnosis
    diseaseDominanceThreshold: 0.50 // Fraction of leaves diseased for "likely affected" status
};

/**
 * Evaluates candidate leaf regions and filters out tiny or low-confidence noise.
 *
 * @param {Array<Object>} regions - Detected leaf candidate regions from leafDetector
 * @param {Object} [options] - Threshold options
 * @returns {{
 *   validLeaves: Array<Object>,
 *   discardedLeaves: Array<Object>,
 *   allTooSmallOrLowConfidence: boolean,
 *   reason: string | null
 * }}
 */
function filterCandidateLeaves(regions, options = {}) {
    const config = { ...DEFAULT_CONFIG, ...options };
    const validConfig = getUncertaintyConfig();
    const minLeafConf = options.minLeafConfidence !== undefined 
        ? options.minLeafConfidence 
        : (validConfig.thresholds.minLeafConfidence || DEFAULT_CONFIG.minLeafConfidence);

    if (!Array.isArray(regions) || regions.length === 0) {
        return {
            validLeaves: [],
            discardedLeaves: [],
            allTooSmallOrLowConfidence: true,
            reason: "no_regions_detected"
        };
    }

    const validLeaves = [];
    const discardedLeaves = [];

    for (const reg of regions) {
        const box = reg.boundingBox || {};
        const width = box.width || 0;
        const height = box.height || 0;
        const confidence = typeof reg.confidence === "number" ? reg.confidence : 0;
        const areaRatio = typeof reg.areaRatio === "number" ? reg.areaRatio : 0;

        const isTooSmall = areaRatio < config.minLeafAreaRatio || 
                           width < config.minDimensionPixels || 
                           height < config.minDimensionPixels;
        const isLowConfidence = confidence < minLeafConf;

        if (isTooSmall || isLowConfidence) {
            discardedLeaves.push({
                ...reg,
                discardReason: isTooSmall && isLowConfidence 
                    ? "too_small_and_low_confidence" 
                    : (isTooSmall ? "too_small" : "low_confidence")
            });
        } else {
            validLeaves.push(reg);
        }
    }

    const allTooSmallOrLowConfidence = validLeaves.length === 0 && regions.length > 0;

    return {
        validLeaves,
        discardedLeaves,
        allTooSmallOrLowConfidence,
        reason: allTooSmallOrLowConfidence ? "leaves_too_small_or_low_confidence" : null
    };
}

/**
 * Extracts, letterboxes, and prepares a normalized tensor for an individual leaf ROI.
 * Guarantees zero aspect-ratio distortion (uses contain with black letterboxing).
 *
 * @param {Buffer} imageBuffer - Raw image buffer
 * @param {Object} boundingBox - { left, top, width, height }
 * @param {Object} [options]
 * @returns {Promise<{
 *   cropBuffer: Buffer,
 *   tensorData: Float32Array,
 *   tensorShape: number[],
 *   cropBox: Object
 * }>}
 */
async function cropAndPreprocessLeaf(imageBuffer, boundingBox, options = {}) {
    const targetSize = options.targetSize || DEFAULT_CONFIG.targetSize;
    const marginRatio = options.marginRatio !== undefined ? options.marginRatio : DEFAULT_CONFIG.marginRatio;
    const layout = options.layout || "CHW";

    const image = sharp(imageBuffer);
    const metadata = await image.metadata();
    const origW = metadata.width || 256;
    const origH = metadata.height || 256;

    const padX = Math.round(boundingBox.width * marginRatio);
    const padY = Math.round(boundingBox.height * marginRatio);

    const cropLeft = Math.max(0, boundingBox.left - padX);
    const cropTop = Math.max(0, boundingBox.top - padY);
    const cropWidth = Math.min(origW - cropLeft, boundingBox.width + 2 * padX);
    const cropHeight = Math.min(origH - cropTop, boundingBox.height + 2 * padY);

    const cropBox = {
        left: cropLeft,
        top: cropTop,
        width: Math.max(10, cropWidth),
        height: Math.max(10, cropHeight)
    };

    const cropBuffer = await sharp(imageBuffer)
        .extract({
            left: cropBox.left,
            top: cropBox.top,
            width: cropBox.width,
            height: cropBox.height
        })
        .resize(targetSize, targetSize, {
            fit: "contain",
            background: { r: 0, g: 0, b: 0 }
        })
        .png()
        .toBuffer();

    const modelInput = await prepareModelInput(cropBuffer, {
        targetSize,
        layout,
        fit: "contain"
    });

    return {
        cropBuffer,
        tensorData: modelInput.floatData,
        tensorShape: modelInput.tensorShape,
        cropBox
    };
}

/**
 * Aggregates predictions across multiple leaves using a pathology-aware strategy.
 *
 * Aggregation Strategy:
 * 1. Segregates leaves into Healthy vs. Diseased categories.
 * 2. In plant pathology, if ANY leaf is infected with high confidence,
 *    the plant has contracted the disease.
 * 3. Computes the Infection Prevalence: Affected Leaves / Total Leaves (e.g. 2/3).
 * 4. Assigns status:
 *    - "healthy": 0 affected leaves
 *    - "early onset / localized infection": < 50% affected leaves
 *    - "likely affected": >= 50% affected leaves
 * 5. Dominant disease is determined by confidence-weighted voting among pathogenic leaves.
 * 6. Dominant confidence is calculated ONLY over leaves showing that disease,
 *    preventing dilution from healthy leaves.
 * 7. Checks for mixed infections (co-occurring pathogens).
 * 8. Returns uncertainty if all leaves are low-confidence or conflicting.
 *
 * @param {Array<Object>} leafPredictions - Predictions for each qualified leaf
 * @param {Object} [options] - Additional options
 * @returns {Object} Structured multi-leaf aggregated diagnosis
 */
function aggregateMultiLeafPredictions(leafPredictions, options = {}) {
    const config = { ...DEFAULT_CONFIG, ...options };

    if (!Array.isArray(leafPredictions) || leafPredictions.length === 0) {
        return {
            status: "uncertain",
            reason: "no_valid_leaves",
            disease: "Uncertain - No Valid Leaves",
            crop: "Unknown",
            confidence: 0,
            confidencePercent: 0,
            affectedLeaves: "0/0",
            prevalencePercent: 0,
            isReliable: false,
            isUncertain: true,
            multiLeafSummary: {
                totalLeaves: 0,
                affectedLeaves: 0,
                healthyLeaves: 0,
                prevalencePercent: 0,
                infectionStatus: "uncertain",
                leafDetails: []
            },
            aggregationMethod: "pathology_weighted_consensus",
            aggregationRationale: "No valid leaf candidates could be classified."
        };
    }

    const totalLeaves = leafPredictions.length;

    // Categorize each leaf into Healthy vs. Diseased
    const formattedLeaves = leafPredictions.map((leaf, idx) => {
        const rawLabel = (leaf.rawLabel || leaf.label || "").toLowerCase();
        const rawDisease = (leaf.disease || "").toLowerCase();
        const conf = typeof leaf.confidence === "number" ? leaf.confidence : 0;
        const confPercent = typeof leaf.confidencePercent === "number"
            ? leaf.confidencePercent
            : parseFloat((conf * 100).toFixed(1));

        // A leaf is healthy if label or disease explicitly contains 'healthy'
        const isHealthy = leaf.isHealthy !== undefined
            ? leaf.isHealthy
            : (rawLabel.includes("healthy") || rawDisease.includes("healthy"));

        return {
            leafId: leaf.leafId || idx + 1,
            crop: leaf.crop || "Crop",
            disease: leaf.disease || "Unknown",
            rawLabel: leaf.rawLabel || leaf.label || "",
            confidence: conf > 1 ? conf / 100 : conf,
            confidencePercent: confPercent,
            isHealthy,
            boundingBox: leaf.boundingBox || null,
            uncertaintyMetrics: leaf.uncertaintyMetrics || null
        };
    });

    const healthyLeaves = formattedLeaves.filter(l => l.isHealthy);
    const diseasedLeaves = formattedLeaves.filter(l => !l.isHealthy);
    const affectedCount = diseasedLeaves.length;
    const affectedLeavesStr = `${affectedCount}/${totalLeaves}`;
    const prevalenceRatio = affectedCount / totalLeaves;
    const prevalencePercent = parseFloat((prevalenceRatio * 100).toFixed(1));

    // ── Case 1: All Leaves are Healthy ──────────────────────────────
    if (affectedCount === 0) {
        const meanHealthyConf = healthyLeaves.reduce((sum, l) => sum + l.confidence, 0) / totalLeaves;
        const cropName = healthyLeaves[0].crop;
        const meanConfPercent = parseFloat((meanHealthyConf * 100).toFixed(1));

        return {
            status: "healthy",
            infectionStatus: "unaffected",
            disease: `${cropName} Healthy`,
            crop: cropName,
            confidence: parseFloat(meanHealthyConf.toFixed(4)),
            confidencePercent: meanConfPercent,
            affectedLeaves: affectedLeavesStr,
            prevalencePercent: 0,
            isReliable: meanHealthyConf >= config.minLeafConfidence,
            isUncertain: meanHealthyConf < config.minLeafConfidence,
            reason: meanHealthyConf < config.minLeafConfidence ? "low_confidence_healthy" : null,
            multiLeafSummary: {
                totalLeaves,
                affectedLeaves: 0,
                healthyLeaves: totalLeaves,
                prevalencePercent: 0,
                infectionStatus: "unaffected",
                mixedInfection: false,
                leafDetails: formattedLeaves
            },
            aggregationMethod: "pathology_weighted_consensus",
            aggregationRationale: "All analyzed leaves exhibit healthy foliage characteristics with no active symptoms detected."
        };
    }

    // ── Case 2: At Least One Leaf is Diseased ────────────────────────
    // Group diseased leaves by disease diagnosis
    const diseaseGroups = {};
    for (const leaf of diseasedLeaves) {
        const dName = leaf.disease;
        if (!diseaseGroups[dName]) {
            diseaseGroups[dName] = {
                disease: dName,
                crop: leaf.crop,
                leaves: [],
                totalConfidence: 0
            };
        }
        diseaseGroups[dName].leaves.push(leaf);
        diseaseGroups[dName].totalConfidence += leaf.confidence;
    }

    // Sort disease groups by aggregate score (number of leaves * mean confidence)
    const sortedDiseases = Object.values(diseaseGroups).map(group => {
        const count = group.leaves.length;
        const meanConf = group.totalConfidence / count;
        return {
            ...group,
            count,
            meanConfidence: meanConf,
            score: count * meanConf
        };
    }).sort((a, b) => b.score - a.score);

    const dominant = sortedDiseases[0];
    const dominantDisease = dominant.disease;
    const dominantCrop = dominant.crop;
    const dominantConfidence = parseFloat(dominant.meanConfidence.toFixed(4));
    const dominantConfidencePercent = parseFloat((dominant.meanConfidence * 100).toFixed(1));

    // Determine Infection Status based on prevalence
    let status = "likely affected";
    if (prevalenceRatio >= config.diseaseDominanceThreshold) {
        status = "likely affected";
    } else {
        status = "early onset / localized infection";
    }

    // Check for Mixed Infection (co-occurring pathogens on different leaves)
    const isMixedInfection = sortedDiseases.length > 1 && sortedDiseases[1].meanConfidence >= config.highConfidenceThreshold;
    const coOccurringDiseases = sortedDiseases.slice(1).map(d => ({
        disease: d.disease,
        affectedLeaves: `${d.count}/${totalLeaves}`,
        confidencePercent: parseFloat((d.meanConfidence * 100).toFixed(1))
    }));

    // Construct detailed agronomic rationale
    const rationale = prevalenceRatio >= 1.0
        ? `All ${totalLeaves} analyzed leaves exhibit symptoms of ${dominantDisease}. Plant shows systemic infection.`
        : `Pathogen detected on ${affectedCount} of ${totalLeaves} leaves (${prevalencePercent}% prevalence). In plant pathology, confirmed symptoms on individual leaves indicate active infection regardless of currently healthy foliage. Confidence is computed from infected leaves (${dominantConfidencePercent}%) to prevent diagnostic dilution from healthy foliage.`;

    return {
        status,
        infectionStatus: status,
        disease: dominantDisease,
        crop: dominantCrop,
        confidence: dominantConfidence,
        confidencePercent: dominantConfidencePercent,
        affectedLeaves: affectedLeavesStr,
        prevalencePercent,
        isReliable: dominantConfidence >= config.minLeafConfidence,
        isUncertain: dominantConfidence < config.minLeafConfidence,
        reason: dominantConfidence < config.minLeafConfidence ? "low_pathogen_confidence" : null,
        multiLeafSummary: {
            totalLeaves,
            affectedLeaves: affectedCount,
            healthyLeaves: healthyLeaves.length,
            prevalencePercent,
            infectionStatus: status,
            mixedInfection: isMixedInfection,
            coOccurringDiseases: isMixedInfection ? coOccurringDiseases : [],
            dominantDisease,
            leafDetails: formattedLeaves
        },
        aggregationMethod: "pathology_weighted_consensus",
        aggregationRationale: rationale
    };
}

module.exports = {
    DEFAULT_CONFIG,
    filterCandidateLeaves,
    cropAndPreprocessLeaf,
    aggregateMultiLeafPredictions
};
