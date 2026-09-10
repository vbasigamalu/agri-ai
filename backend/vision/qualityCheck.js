/**
 * ============================================================
 * Agri-AI Vision Pipeline: Stage 1 — Image Quality Check
 * ============================================================
 * Prevents poor-quality or corrupted farmer images from reaching
 * the downstream disease classifier.
 *
 * Checks:
 * 1. Image exists and is readable (valid buffer & format)
 * 2. Extremely small image (<100px)
 * 3. Minimum resolution (<200px)
 * 4. Severe blur (Variance of Laplacian edge gradient)
 * 5. Extreme darkness / underexposure
 * 6. Extreme overexposure / flash blowout
 * 7. Corrupted image data
 * 8. Low contrast / washed out colors
 * 9. Basic plant/foliage visibility (non-plant guard)
 *
 * Note: Noisy field backgrounds (soil, hands, mulch) are permitted
 * as they will be handled by subsequent segmentation/suppression.
 * ============================================================
 */

const sharp = require("sharp");

/**
 * Quality thresholds
 */
const QUALITY_THRESHOLDS = {
    minResolution: 200,      // Minimum acceptable width/height
    extremelySmallSize: 100, // Reject immediately if smaller than 100x100
    blurVarianceMin: 24.0,   // Laplacian variance threshold (<24 is severely blurry)
    extremeDarkLuminance: 18,// Mean luminance < 18 is virtually black
    tooDarkLuminance: 32,    // Mean luminance < 32 is underexposed
    extremeOverexposure: 238,// Mean luminance > 238 is blown out
    overexposedLuminance: 224,
    minContrastStdDev: 12.0, // Minimum color channel standard deviation
    minPlantPixelRatio: 0.015 // At least 1.5% of pixels must show vegetation color
};

/**
 * Inspects an image buffer and returns a structured quality report.
 *
 * @param {Buffer} imageBuffer - Raw uploaded image buffer
 * @param {Object} [customThresholds] - Optional threshold overrides
 * @returns {Promise<{
 *   valid: boolean,
 *   qualityScore: number,
 *   issues: string[],
 *   recommendation: string,
 *   metrics: {
 *     width: number,
 *     height: number,
 *     format: string,
 *     brightness: number,
 *     contrast: number,
 *     blurVariance: number,
 *     plantRatio: number
 *   }
 * }>}
 */
async function checkImageQuality(imageBuffer, customThresholds = {}) {
    const t = { ...QUALITY_THRESHOLDS, ...customThresholds };
    const issues = [];
    let qualityScore = 100;

    // ── 1. Image Exists & Buffer Verification ──────────────────
    if (!imageBuffer || !Buffer.isBuffer(imageBuffer) || imageBuffer.length === 0) {
        return {
            valid: false,
            qualityScore: 0,
            issues: ["missing_image"],
            recommendation: "No image file was received. Please select or capture a crop photo.",
            metrics: {
                width: 0, height: 0, format: "none", brightness: 0, contrast: 0, blurVariance: 0, plantRatio: 0
            }
        };
    }

    let metadata;
    let image;
    try {
        image = sharp(imageBuffer);
        metadata = await image.metadata();
    } catch (err) {
        // ── 7. Corrupted image ─────────────────────────────────
        return {
            valid: false,
            qualityScore: 0,
            issues: ["corrupted_image"],
            recommendation: "The uploaded file is corrupted or not a valid image format. Please upload a clear JPG or PNG photo.",
            metrics: {
                width: 0, height: 0, format: "corrupted", brightness: 0, contrast: 0, blurVariance: 0, plantRatio: 0
            }
        };
    }

    const width = metadata.width || 0;
    const height = metadata.height || 0;
    const format = metadata.format || "unknown";

    // ── 8. Extremely Small Image / Low Resolution ──────────────
    if (width < t.extremelySmallSize || height < t.extremelySmallSize) {
        issues.push("extremely_small");
        qualityScore -= 60;
    } else if (width < t.minResolution || height < t.minResolution) {
        // ── 2. Minimum Resolution ──────────────────────────────
        issues.push("low_resolution");
        qualityScore -= 25;
    }

    // ── 5 & 6. Brightness & Contrast Analysis ──────────────────
    let brightness = 128;
    let contrast = 30;
    try {
        const stats = await image
            .clone()
            .resize(128, 128, { fit: "inside" })
            .stats();

        const channels = stats.channels.slice(0, 3);
        const meanR = channels[0] ? channels[0].mean : 128;
        const meanG = channels[1] ? channels[1].mean : 128;
        const meanB = channels[2] ? channels[2].mean : 128;

        // ITU-R BT.601 perceived luminance
        brightness = parseFloat((0.299 * meanR + 0.587 * meanG + 0.114 * meanB).toFixed(1));

        const stdevR = channels[0] ? channels[0].stdev : 30;
        const stdevG = channels[1] ? channels[1].stdev : 30;
        const stdevB = channels[2] ? channels[2].stdev : 30;
        contrast = parseFloat(((stdevR + stdevG + stdevB) / 3).toFixed(1));

        // Evaluate Darkness
        if (brightness < t.extremeDarkLuminance) {
            issues.push("extreme_darkness");
            qualityScore -= 50;
        } else if (brightness < t.tooDarkLuminance) {
            issues.push("too_dark");
            qualityScore -= 35;
        }

        // Evaluate Overexposure
        if (brightness > t.extremeOverexposure) {
            issues.push("extreme_overexposure");
            qualityScore -= 50;
        } else if (brightness > t.overexposedLuminance) {
            issues.push("overexposed");
            qualityScore -= 35;
        }

        // Evaluate Low Contrast
        if (contrast < t.minContrastStdDev && !issues.includes("too_dark") && !issues.includes("extreme_darkness") && !issues.includes("overexposed") && !issues.includes("extreme_overexposure")) {
            issues.push("low_contrast");
            qualityScore -= 20;
        }
    } catch (statErr) {
        // Non-critical fallback
    }

    // ── 3. Blur Detection (Variance of Laplacian) ──────────────
    // Note: Only evaluate blur if image is not pitch dark or blown out
    let blurVariance = 50.0;
    const isSeverelyDark = issues.includes("extreme_darkness");
    const isSeverelyOverexposed = issues.includes("extreme_overexposure");

    if (!isSeverelyDark && !isSeverelyOverexposed) {
        try {
            // Standardized 256x256 grayscale thumbnail for scale-invariant blur measurement
            const gray256 = await sharp(imageBuffer)
                .resize(256, 256, { fit: "cover" })
                .grayscale()
                .toBuffer();

            // 3x3 Laplacian edge convolution operator
            const laplacian = await sharp(gray256)
                .convolve({
                    width: 3,
                    height: 3,
                    kernel: [
                        0,  1, 0,
                        1, -4, 1,
                        0,  1, 0
                    ]
                })
                .raw()
                .toBuffer();

            // Compute Variance of Laplacian (Var(L) = E[L^2] - (E[L])^2)
            const N = laplacian.length;
            let sum = 0;
            let sumSq = 0;
            for (let i = 0; i < N; i++) {
                const val = laplacian[i];
                sum += val;
                sumSq += val * val;
            }
            const mean = sum / N;
            blurVariance = parseFloat((sumSq / N - mean * mean).toFixed(1));

            if (blurVariance < t.blurVarianceMin) {
                issues.push("too_blurry");
                qualityScore -= 45;
            }
        } catch (blurErr) {
            blurVariance = 50.0;
        }
    }

    // ── 9. Basic Plant / Foliage Visibility Check ──────────────
    // Do NOT reject simply because the background is noisy.
    // Only flag if practically ZERO plant/leaf material exists.
    let plantRatio = 0.5;
    if (!isSeverelyDark && !isSeverelyOverexposed) {
        try {
            const SAMPLE_DIM = 128;
            const { data: rawRgb } = await sharp(imageBuffer)
                .resize(SAMPLE_DIM, SAMPLE_DIM, { fit: "fill" })
                .removeAlpha()
                .raw()
                .toBuffer({ resolveWithObject: true });

            let plantPixels = 0;
            const totalSamplePixels = SAMPLE_DIM * SAMPLE_DIM;

            for (let i = 0; i < totalSamplePixels; i++) {
                const r = rawRgb[i * 3];
                const g = rawRgb[i * 3 + 1];
                const b = rawRgb[i * 3 + 2];

                // Plant / foliage chrominance heuristics:
                // 1. Excess Green Index (ExG): 2*G - R - B > 8
                // 2. Chlorotic / yellowing foliage: G > 55, R > 55, B < 120, G >= 0.75 * R
                // 3. Necrotic blight brown on leaf: R > 70, G > 45, B < 65, R > G
                const exg = 2 * g - r - b;
                const isGreen = exg > 8 && g > 35;
                const isYellow = g > 55 && r > 55 && b < 120 && g >= 0.75 * r;
                const isNecroticLeaf = r > 70 && g > 45 && b < 65 && r > g;

                if (isGreen || isYellow || isNecroticLeaf) {
                    plantPixels++;
                }
            }

            plantRatio = parseFloat((plantPixels / totalSamplePixels).toFixed(3));

            if (plantRatio < t.minPlantPixelRatio) {
                issues.push("no_plant_detected");
                qualityScore -= 40;
            }
        } catch (foliageErr) {
            plantRatio = 0.5;
        }
    }

    // ── Final Quality Score & Validity Determination ───────────
    qualityScore = Math.max(0, Math.min(100, qualityScore));

    // Fatal issues that immediately invalidate the image
    const fatalIssues = [
        "missing_image",
        "corrupted_image",
        "extremely_small",
        "extreme_darkness",
        "too_dark",
        "extreme_overexposure",
        "too_blurry",
        "no_plant_detected"
    ];

    const hasFatalIssue = issues.some(issue => fatalIssues.includes(issue));
    const valid = !hasFatalIssue && qualityScore >= 45;

    // ── Human-friendly Recommendation Synthesis ────────────────
    const recommendation = synthesizeRecommendation(issues);

    return {
        valid,
        qualityScore,
        issues,
        recommendation,
        metrics: {
            width,
            height,
            format,
            brightness,
            contrast,
            blurVariance,
            plantRatio
        }
    };
}

/**
 * Builds a clear, actionable recommendation string based on detected issues.
 */
function synthesizeRecommendation(issues) {
    if (issues.length === 0) return "";

    const hasBlur = issues.includes("too_blurry");
    const hasDark = issues.includes("too_dark") || issues.includes("extreme_darkness");
    const hasOverexposed = issues.includes("overexposed") || issues.includes("extreme_overexposure");
    const hasNoPlant = issues.includes("no_plant_detected");
    const hasSmall = issues.includes("extremely_small") || issues.includes("low_resolution");
    const hasCorrupt = issues.includes("corrupted_image") || issues.includes("missing_image");

    if (hasCorrupt) {
        return "The image file could not be read. Please upload a standard JPG or PNG photo.";
    }

    if (hasBlur && hasDark) {
        return "Please capture a clearer image in better lighting.";
    }

    if (hasOverexposed) {
        return "The image is overexposed. Please avoid direct intense flash or harsh glare on the leaf.";
    }

    if (hasDark) {
        return "The image is too dark. Please capture the leaf under natural daylight or turn on flash.";
    }

    if (hasBlur) {
        return "The image is too blurry. Please hold the camera steady and tap to focus on the leaf symptoms.";
    }

    if (hasNoPlant) {
        return "No plant or leaf detected in the photo. Please place an infected crop leaf in the center of the frame.";
    }

    if (hasSmall) {
        return "The image resolution is too low. Please bring the camera closer (15-25 cm) to the diseased leaf.";
    }

    return "Please capture a clearer image of the crop leaf under good natural lighting.";
}

module.exports = {
    checkImageQuality,
    QUALITY_THRESHOLDS,
    synthesizeRecommendation
};
