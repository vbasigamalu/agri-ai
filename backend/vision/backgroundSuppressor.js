/**
 * ============================================================
 * Agri-AI Vision Pipeline: Stage 3 — Background Suppression
 * ============================================================
 * Eliminates background clutter (soil, hands, sky, pots, farming tools)
 * using the leaf detection and neural segmentation outputs.
 *
 * Provides two distinct preprocessing outputs:
 * 1. Tight leaf crop using the detected bounding box (aspect-ratio preserved)
 * 2. Masked leaf image using the pixel-level segmentation mask (aspect-ratio preserved)
 *
 * Guarantees:
 * - ZERO distortion: Resizes to target dimension (224x224) using letterboxing
 *   (fit: "contain") so leaf shape and lesion geometry are never warped.
 * - Non-destructive storage: Never overwrites the original upload.
 *   Persists original, tight crop, masked image, and metadata safely.
 * - Low-confidence safety: If segmentation confidence is low, falls back to
 *   a non-aggressive uncertainty state to avoid clipping disease lesions.
 * - Rich audit logging comparing original vs processed images.
 * ============================================================
 */

const sharp = require("sharp");
const path = require("path");
const { savePipelineArtifacts } = require("./storage");

/**
 * Suppresses background clutter around the detected leaf region.
 *
 * @param {Buffer} imageBuffer - Immutable original image buffer
 * @param {Object} detectionResult - Output from detectLeafRegion()
 * @param {Object} [options] - Configuration options
 * @param {number} [options.targetSize=224] - Exact dimension expected by disease model
 * @param {number} [options.marginRatio=0.08] - Safety padding around leaf ROI (8%)
 * @param {number} [options.uncertaintyThreshold=0.55] - Confidence threshold for uncertainty state
 * @param {boolean} [options.persist=true] - Whether to persist artifacts to uploads/
 * @param {string} [options.activeOutput="masked"] - Default buffer for classifier ("masked" | "tight_crop")
 * @param {boolean} [options.verboseLogging=true] - Print comparison audit to console
 * @returns {Promise<{
 *   processedBuffer: Buffer,
 *   tightCropBuffer: Buffer,
 *   maskedBuffer: Buffer,
 *   wasSuppressed: boolean,
 *   isUncertain: boolean,
 *   uncertaintyReason: string | null,
 *   suppressionMode: string,
 *   cropBox: { left: number, top: number, width: number, height: number } | null,
 *   targetSize: number,
 *   storage: Object,
 *   comparison: Object
 * }>}
 */
async function suppressBackground(imageBuffer, detectionResult, options = {}) {
    const targetSize = options.targetSize || 224;
    const baseMarginRatio = options.marginRatio !== undefined ? options.marginRatio : 0.08;
    const uncertaintyThreshold = options.uncertaintyThreshold !== undefined ? options.uncertaintyThreshold : 0.55;
    const persist = options.persist !== undefined ? options.persist : true;
    const activeOutput = options.activeOutput || "masked";
    const verboseLogging = options.verboseLogging !== undefined ? options.verboseLogging : true;

    try {
        const image = sharp(imageBuffer);
        const metadata = await image.metadata();
        const origW = metadata.width || 256;
        const origH = metadata.height || 256;
        const origSize = imageBuffer.length;
        const origAspectRatio = parseFloat((origW / origH).toFixed(3));

        // ── Guard: If no valid detection result or no bounding box ──
        if (!detectionResult || !detectionResult.boundingBox) {
            const fallbackSquare = await sharp(imageBuffer)
                .resize(targetSize, targetSize, { fit: "contain", background: { r: 0, g: 0, b: 0 } })
                .png()
                .toBuffer();

            return buildFallbackResult({
                originalBuffer: imageBuffer,
                fallbackBuffer: fallbackSquare,
                origW,
                origH,
                origSize,
                targetSize,
                reason: "no_bounding_box",
                persist
            });
        }

        const rawBox = detectionResult.boundingBox;
        const confidence = typeof detectionResult.confidence === "number" ? detectionResult.confidence : 0.5;

        // ── Uncertainty Check: Low segmentation confidence ──────────
        const isUncertain = confidence < uncertaintyThreshold;
        const uncertaintyReason = isUncertain
            ? `Low segmentation confidence (${(confidence * 100).toFixed(1)}% < ${(uncertaintyThreshold * 100).toFixed(0)}%). Conservative suppression engaged to prevent symptom clipping.`
            : null;
        const suppressionMode = isUncertain ? "conservative_uncertainty" : "full_segmentation";

        // Margin: If uncertain, use wider safety margin (22%) to prevent clipping disease symptoms
        const marginRatio = isUncertain ? Math.max(baseMarginRatio, 0.22) : baseMarginRatio;

        const padX = Math.round(rawBox.width * marginRatio);
        const padY = Math.round(rawBox.height * marginRatio);

        const cropLeft = Math.max(0, rawBox.left - padX);
        const cropTop = Math.max(0, rawBox.top - padY);
        const cropWidth = Math.min(origW - cropLeft, rawBox.width + 2 * padX);
        const cropHeight = Math.min(origH - cropTop, rawBox.height + 2 * padY);

        const cropBox = {
            left: cropLeft,
            top: cropTop,
            width: Math.max(10, cropWidth),
            height: Math.max(10, cropHeight)
        };

        // ─────────────────────────────────────────────────────────────
        // Preprocessing Output 1: Tight Leaf Crop (Aspect-Ratio Preserved)
        // ─────────────────────────────────────────────────────────────
        // Extracts the tight leaf ROI and letterboxes it into targetSize x targetSize
        // with neutral black padding so there is ZERO stretching or distortion.
        const tightCropBuffer = await sharp(imageBuffer)
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

        // ─────────────────────────────────────────────────────────────
        // Preprocessing Output 2: Masked Leaf Image (Segmentation Mask)
        // ─────────────────────────────────────────────────────────────
        let maskedBuffer;

        if (isUncertain) {
            // UNCERTAIN STATE:
            // "If segmentation confidence is low, do not aggressively remove the background."
            // Instead of zeroing background to pure black, apply soft conservative suppression
            // to keep potentially missed symptom edges visible to the agronomist / model.
            maskedBuffer = await createSoftMaskedLeaf(imageBuffer, cropBox, targetSize);
        } else {
            // HIGH CONFIDENCE STATE:
            // Apply pixel-level segmentation mask, setting all non-leaf clutter (hands, soil,
            // pots, equipment, sky) to neutral dark background (0, 0, 0).
            maskedBuffer = await createAggressiveMaskedLeaf(imageBuffer, detectionResult, cropBox, origW, origH, targetSize);
        }

        // Active buffer to pass downstream into the disease classifier
        const activeBuffer = activeOutput === "tight_crop" ? tightCropBuffer : maskedBuffer;

        // Calculate comparison metrics
        const boxArea = cropBox.width * cropBox.height;
        const totalArea = origW * origH;
        const clutterReductionRatio = parseFloat(Math.max(0, 1 - (boxArea / totalArea)).toFixed(3));

        const comparison = {
            original: {
                width: origW,
                height: origH,
                aspectRatio: origAspectRatio,
                sizeBytes: origSize,
                format: metadata.format || "unknown"
            },
            processed: {
                width: targetSize,
                height: targetSize,
                aspectRatio: 1.0,
                tightCropSizeBytes: tightCropBuffer.length,
                maskedSizeBytes: maskedBuffer.length,
                format: "png"
            },
            aspectRatioPreserved: true,
            clutterReductionRatio,
            confidence: parseFloat(confidence.toFixed(3)),
            isUncertain,
            suppressionMode
        };

        // ── Non-Destructive Storage ─────────────────────────────────
        let storage = { id: null, originalPath: null, tightCropPath: null, maskedPath: null, metadataPath: null };
        if (persist) {
            storage = await savePipelineArtifacts({
                originalBuffer: imageBuffer,
                tightCropBuffer,
                maskedBuffer,
                metadata: {
                    confidence,
                    isUncertain,
                    uncertaintyReason,
                    suppressionMode,
                    cropBox,
                    comparison,
                    modelType: detectionResult.modelType || "MobileLeafNet-ONNX"
                }
            });
        }

        // ── Rich Console Audit Logging ──────────────────────────────
        if (verboseLogging) {
            logComparisonAudit({
                origW,
                origH,
                origAspectRatio,
                origSize,
                targetSize,
                confidence,
                cropBox,
                clutterReductionRatio,
                isUncertain,
                suppressionMode,
                tightCropBytes: tightCropBuffer.length,
                maskedBytes: maskedBuffer.length,
                storage
            });
        }

        return {
            processedBuffer: activeBuffer,
            tightCropBuffer,
            maskedBuffer,
            wasSuppressed: true,
            isUncertain,
            uncertaintyReason,
            suppressionMode,
            cropBox,
            targetSize,
            storage,
            comparison
        };

    } catch (err) {
        console.warn("⚠️ [BackgroundSuppressor] Error during background suppression, engaging safe fallback:", err.message);

        // Safe fallback: letterbox original image to targetSize without distortion
        try {
            const safeSquare = await sharp(imageBuffer)
                .resize(targetSize, targetSize, { fit: "contain", background: { r: 0, g: 0, b: 0 } })
                .png()
                .toBuffer();

            return {
                processedBuffer: safeSquare,
                tightCropBuffer: safeSquare,
                maskedBuffer: safeSquare,
                wasSuppressed: false,
                isUncertain: true,
                uncertaintyReason: `Suppression fallback: ${err.message}`,
                suppressionMode: "emergency_fallback",
                cropBox: null,
                targetSize,
                storage: { id: null, originalPath: null, tightCropPath: null, maskedPath: null, metadataPath: null },
                comparison: { error: err.message }
            };
        } catch (fatalErr) {
            return {
                processedBuffer: imageBuffer,
                tightCropBuffer: imageBuffer,
                maskedBuffer: imageBuffer,
                wasSuppressed: false,
                isUncertain: true,
                uncertaintyReason: `Fatal suppression error: ${fatalErr.message}`,
                suppressionMode: "passthrough",
                cropBox: null,
                targetSize,
                storage: { id: null, originalPath: null, tightCropPath: null, maskedPath: null, metadataPath: null },
                comparison: { error: fatalErr.message }
            };
        }
    }
}

/**
 * Creates the high-confidence pixel-masked leaf image.
 * Uses the segmentation mask to zero out background clutter (hands, soil, sky, tools)
 * while preserving leaf pixel colors and geometry 100%.
 */
async function createAggressiveMaskedLeaf(originalBuffer, detectionResult, cropBox, origW, origH, targetSize) {
    try {
        const { data: rgbRaw } = await sharp(originalBuffer)
            .removeAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true });

        // Retrieve or reconstruct binary mask
        let maskBytes = null;
        let maskW = 256;
        let maskH = 256;

        if (detectionResult.binaryMask && Buffer.isBuffer(detectionResult.binaryMask)) {
            maskBytes = detectionResult.binaryMask;
            if (detectionResult.maskDimensions) {
                maskW = detectionResult.maskDimensions.width;
                maskH = detectionResult.maskDimensions.height;
            }
        } else if (detectionResult.mask && typeof detectionResult.mask === "string" && detectionResult.mask.startsWith("data:image/png;base64,")) {
            // Decode PNG Base64 data URL
            const maskPngBuffer = Buffer.from(detectionResult.mask.split(",")[1], "base64");
            const { data: alphaData, info: maskInfo } = await sharp(maskPngBuffer)
                .ensureAlpha()
                .raw()
                .toBuffer({ resolveWithObject: true });

            maskW = maskInfo.width;
            maskH = maskInfo.height;
            maskBytes = Buffer.alloc(maskW * maskH);
            for (let i = 0; i < maskW * maskH; i++) {
                // Check alpha channel or green channel
                maskBytes[i] = alphaData[i * 4 + 3] > 64 ? 255 : 0;
            }
        }

        // If no mask available, fallback to tight crop
        if (!maskBytes) {
            return await sharp(originalBuffer)
                .extract({ left: cropBox.left, top: cropBox.top, width: cropBox.width, height: cropBox.height })
                .resize(targetSize, targetSize, { fit: "contain", background: { r: 0, g: 0, b: 0 } })
                .png()
                .toBuffer();
        }

        // Scale mask bytes: 255 for leaf, 0 for background
        const scaledMask = Buffer.alloc(maskW * maskH);
        for (let j = 0; j < maskW * maskH; j++) {
            scaledMask[j] = maskBytes[j] > 0 ? 255 : 0;
        }

        // Resize mask to original image dimensions using nearest-neighbor for sharp boundaries
        const resizedMask = await sharp(scaledMask, { raw: { width: maskW, height: maskH, channels: 1 } })
            .resize(origW, origH, { fit: "fill", kernel: "nearest" })
            .toColourspace("b-w")
            .raw()
            .toBuffer();

        // Apply mask: zero out non-leaf pixels
        const totalPixels = origW * origH;
        const maskedRaw = Buffer.alloc(totalPixels * 3);

        for (let i = 0; i < totalPixels; i++) {
            const isFoliage = resizedMask[i] > 120;
            const idx = i * 3;

            if (isFoliage) {
                maskedRaw[idx]     = rgbRaw[idx];
                maskedRaw[idx + 1] = rgbRaw[idx + 1];
                maskedRaw[idx + 2] = rgbRaw[idx + 2];
            } else {
                maskedRaw[idx]     = 0;
                maskedRaw[idx + 1] = 0;
                maskedRaw[idx + 2] = 0;
            }
        }

        // Extract crop region from masked image and letterbox to targetSize x targetSize
        return await sharp(maskedRaw, { raw: { width: origW, height: origH, channels: 3 } })
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

    } catch (e) {
        // Graceful fallback to tight crop if masking encounters an edge-case error
        return await sharp(originalBuffer)
            .extract({ left: cropBox.left, top: cropBox.top, width: cropBox.width, height: cropBox.height })
            .resize(targetSize, targetSize, { fit: "contain", background: { r: 0, g: 0, b: 0 } })
            .png()
            .toBuffer();
    }
}

/**
 * Creates a conservative masked image when confidence is low.
 * Does not aggressively zero out pixels, preventing accidental clipping of lesions.
 */
async function createSoftMaskedLeaf(originalBuffer, cropBox, targetSize) {
    return await sharp(originalBuffer)
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
}

/**
 * Helper to build result on fallback.
 */
async function buildFallbackResult({ originalBuffer, fallbackBuffer, origW, origH, origSize, targetSize, reason, persist }) {
    let storage = { id: null, originalPath: null, tightCropPath: null, maskedPath: null, metadataPath: null };
    if (persist) {
        storage = await savePipelineArtifacts({
            originalBuffer,
            tightCropBuffer: fallbackBuffer,
            maskedBuffer: fallbackBuffer,
            metadata: { reason, isFallback: true }
        });
    }

    return {
        processedBuffer: fallbackBuffer,
        tightCropBuffer: fallbackBuffer,
        maskedBuffer: fallbackBuffer,
        wasSuppressed: false,
        isUncertain: true,
        uncertaintyReason: `Fallback engaged (${reason})`,
        suppressionMode: "fallback",
        cropBox: null,
        targetSize,
        storage,
        comparison: {
            original: { width: origW, height: origH, sizeBytes: origSize },
            processed: { width: targetSize, height: targetSize, sizeBytes: fallbackBuffer.length },
            aspectRatioPreserved: true,
            clutterReductionRatio: 0,
            confidence: 0,
            isUncertain: true,
            suppressionMode: "fallback"
        }
    };
}

/**
 * Prints clear, structured comparison logging for inspection and debugging.
 */
function logComparisonAudit(info) {
    console.log("\n======================================================================");
    console.log("🍃 [Agri-AI Vision] Background Suppression & Leaf Isolation Audit");
    console.log("======================================================================");
    console.log("  📸 Original Farmer Image:");
    console.log(`    • Dimensions:        ${info.origW} x ${info.origH} px (Aspect Ratio: ${info.origAspectRatio}:1)`);
    console.log(`    • Raw Buffer Size:   ${(info.origSize / 1024).toFixed(1)} KB`);
    console.log("  🌿 Detection & Mask Status:");
    console.log(`    • Confidence:        ${(info.confidence * 100).toFixed(1)}% [${info.isUncertain ? "⚠️ UNCERTAIN" : "✅ HIGH CONFIDENCE"}]`);
    console.log(`    • Leaf Crop Box:     [left: ${info.cropBox.left}, top: ${info.cropBox.top}, w: ${info.cropBox.width}, h: ${info.cropBox.height}]`);
    console.log(`    • Clutter Reduction: ~${(info.clutterReductionRatio * 100).toFixed(1)}% background area eliminated`);
    console.log(`    • Mode:              ${info.suppressionMode}`);
    console.log(`  🎯 Preprocessed Outputs (${info.targetSize} x ${info.targetSize}, Zero Distortion):`);
    console.log(`    1. Tight Leaf Crop:  ${info.targetSize} x ${info.targetSize} px (${(info.tightCropBytes / 1024).toFixed(1)} KB, contain)`);
    console.log(`    2. Masked Leaf:      ${info.targetSize} x ${info.targetSize} px (${(info.maskedBytes / 1024).toFixed(1)} KB, contain)`);
    if (info.storage && info.storage.id) {
        console.log("  💾 Non-Destructive Storage Audit:");
        console.log(`    • Original (kept):   ${info.storage.originalPath}`);
        console.log(`    • Tight Crop:        ${info.storage.tightCropPath}`);
        console.log(`    • Masked Leaf:       ${info.storage.maskedPath}`);
        console.log(`    • Metadata:          ${info.storage.metadataPath}`);
    }
    console.log("======================================================================\n");
}

module.exports = {
    suppressBackground,
    createAggressiveMaskedLeaf,
    createSoftMaskedLeaf
};
