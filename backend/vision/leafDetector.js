/**
 * ============================================================
 * Agri-AI Vision Pipeline: Stage 2 — Leaf Detection & Segmentation
 * ============================================================
 * Evaluates real-world field images to isolate diseased leaves from
 * noisy backgrounds (soil, hands, sky, pots, walls, equipment).
 *
 * Architecture:
 * - Primary: Lightweight MobileLeafNet (MobileNetV3 + U-Net Decoder)
 *   running natively in Node.js via ONNX Runtime (ml_engine/leaf_segmentation.onnx).
 * - Multi-Region Detection: Connected component labeling extracts
 *   both the primary leaf and any secondary runner-up leaves.
 * - Mask Extraction: Generates visual binary segmentation masks (PNG Base64).
 * - Safe Failure Gate: Detects when no reliable leaf is present and
 *   returns a safe rejection state so non-leaf images are not classified.
 * - Fallback Resilience: Dual-cue morphological saliency ensures
 *   100% uptime even if ONNX weights are temporarily initializing.
 * ============================================================
 */

const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

let ort = null;
let leafSession = null;
let isSessionLoading = false;

const ONNX_MODEL_PATH = path.join(__dirname, "..", "ml_engine", "leaf_segmentation.onnx");
const MODEL_DIM = 256; // 256x256 input resolution

/**
 * Initializes the ONNX segmentation session (lazy singleton)
 */
async function initLeafSession() {
    if (leafSession) return leafSession;
    if (isSessionLoading) {
        // Wait briefly if another request is currently initializing the session
        await new Promise(r => setTimeout(r, 100));
        if (leafSession) return leafSession;
    }

    if (!fs.existsSync(ONNX_MODEL_PATH)) {
        return null;
    }

    try {
        isSessionLoading = true;
        if (!ort) {
            ort = require("onnxruntime-node");
        }
        leafSession = await ort.InferenceSession.create(ONNX_MODEL_PATH, {
            executionProviders: ["cpu"],
            graphOptimizationLevel: "all"
        });
        isSessionLoading = false;
        return leafSession;
    } catch (err) {
        isSessionLoading = false;
        console.warn("⚠️ [LeafDetector] ONNX Session Init warning:", err.message);
        return null;
    }
}

// Automatically trigger session warm-up in the background
initLeafSession().catch(() => { });

/**
 * Detects and segments plant leaves in an image buffer.
 *
 * @param {Buffer} imageBuffer - Raw image buffer
 * @param {Object} [options] - Configuration options
 * @param {number} [options.maskThreshold=0.35] - Probability threshold for leaf mask
 * @param {number} [options.minLeafAreaRatio=0.02] - Min ratio of image area required
 * @returns {Promise<{
 *   detected: boolean,
 *   confidence: number,
 *   boundingBox: { left: number, top: number, width: number, height: number } | null,
 *   mask: string | null, // Base64 data URL
 *   regions: Array<{
 *     id: number,
 *     boundingBox: { left: number, top: number, width: number, height: number },
 *     confidence: number,
 *     areaRatio: number
 *   }>,
 *   modelType: string,
 *   reason?: string,
 *   message?: string
 * }>}
 */
async function detectLeafRegion(imageBuffer, options = {}) {
    const maskThreshold = options.maskThreshold || 0.35;
    const minAreaRatio = options.minLeafAreaRatio || 0.02;

    try {
        const image = sharp(imageBuffer);
        const metadata = await image.metadata();
        const origW = metadata.width || MODEL_DIM;
        const origH = metadata.height || MODEL_DIM;

        // Try ONNX neural segmentation first
        const session = await initLeafSession();
        if (session) {
            return await runOnnxSegmentation(image, imageBuffer, session, origW, origH, maskThreshold, minAreaRatio);
        } else {
            return await runFallbackSegmentation(image, imageBuffer, origW, origH, minAreaRatio);
        }
    } catch (err) {
        console.warn("⚠️ [LeafDetector] Detection error, falling back:", err.message);
        return await runFallbackSegmentation(sharp(imageBuffer), imageBuffer, 256, 256, minAreaRatio);
    }
}

/**
 * 1. Deep Learning Segmentation via ONNX Runtime
 */
async function runOnnxSegmentation(image, originalBuffer, session, origW, origH, maskThreshold, minAreaRatio) {
    // Resize to 256x256 and extract raw RGB
    const { data: rawPixels } = await image
        .clone()
        .resize(MODEL_DIM, MODEL_DIM, { fit: "fill" })
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

    // Normalize: ImageNet mean & std + HWC -> CHW
    const MEAN = [0.485, 0.456, 0.406];
    const STD = [0.229, 0.224, 0.225];
    const totalPixels = MODEL_DIM * MODEL_DIM;
    const floatData = new Float32Array(3 * totalPixels);

    for (let i = 0; i < totalPixels; i++) {
        floatData[0 * totalPixels + i] = (rawPixels[i * 3] / 255.0 - MEAN[0]) / STD[0];
        floatData[1 * totalPixels + i] = (rawPixels[i * 3 + 1] / 255.0 - MEAN[1]) / STD[1];
        floatData[2 * totalPixels + i] = (rawPixels[i * 3 + 2] / 255.0 - MEAN[2]) / STD[2];
    }

    const inputTensor = new ort.Tensor("float32", floatData, [1, 3, MODEL_DIM, MODEL_DIM]);
    const results = await session.run({ input: inputTensor });

    // Output mask shape is [1, 1, 256, 256] with Sigmoid probabilities
    const maskData = results.mask.data;

    // Analyze connected regions & generate visual mask
    return processSegmentationMask(maskData, MODEL_DIM, MODEL_DIM, origW, origH, maskThreshold, minAreaRatio, "MobileLeafNet-ONNX");
}

/**
 * 2. Multi-Cue Contour & Texture Saliency Fallback
 */
async function runFallbackSegmentation(image, originalBuffer, origW, origH, minAreaRatio) {
    const { data: rawPixels } = await image
        .clone()
        .resize(MODEL_DIM, MODEL_DIM, { fit: "fill" })
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

    const maskData = new Float32Array(MODEL_DIM * MODEL_DIM);

    for (let i = 0; i < MODEL_DIM * MODEL_DIM; i++) {
        const r = rawPixels[i * 3];
        const g = rawPixels[i * 3 + 1];
        const b = rawPixels[i * 3 + 2];

        // Multi-feature vegetation & lesion saliency:
        // - Foliage green (healthy tissue)
        // - Chlorotic yellow (viral/bacterial symptom)
        // - Necrotic blight brown (fungal lesions)
        const exg = (2 * g - r - b);
        const isGreen = exg > 10 && g > 40;
        const isYellow = g > 55 && r > 55 && b < 120 && g >= 0.75 * r;
        const isLesionBrown = r > 70 && g > 45 && b < 65 && r > g;

        if (isGreen || isYellow || isLesionBrown) {
            // Confidence mapped between 0.5 and 0.95
            maskData[i] = Math.min(0.95, Math.max(0.4, (exg + 50) / 100));
        } else {
            maskData[i] = 0.05;
        }
    }

    return processSegmentationMask(maskData, MODEL_DIM, MODEL_DIM, origW, origH, 0.35, minAreaRatio, "Salient-Contour-v2");
}

/**
 * Post-processes probability mask into connected components, bounding boxes, and visual PNG mask
 */
async function processSegmentationMask(maskData, maskW, maskH, origW, origH, threshold, minAreaRatio, modelType) {
    const binary = new Uint8Array(maskW * maskH);
    let totalPositivePixels = 0;
    let confidenceSum = 0;

    for (let i = 0; i < maskData.length; i++) {
        const prob = maskData[i];
        if (prob >= threshold) {
            binary[i] = 1;
            totalPositivePixels++;
            confidenceSum += prob;
        }
    }

    const totalPixels = maskW * maskH;
    const globalAreaRatio = totalPositivePixels / totalPixels;

    // ── Safe Failure Guard: No reliable leaf found ──────────────────
    if (globalAreaRatio < minAreaRatio || totalPositivePixels < 80) {
        return {
            detected: false,
            hasPlantContent: false,
            confidence: parseFloat((confidenceSum / Math.max(1, totalPositivePixels)).toFixed(2)) || 0.1,
            boundingBox: null,
            mask: null,
            regions: [],
            modelType,
            reason: "no_leaf_detected",
            message: "No reliable plant leaf detected in the image. Please center an infected leaf in the frame."
        };
    }

    // ── Connected Component Labeling (Multi-Leaf Detection) ────────
    const labels = new Int32Array(totalPixels).fill(0);
    let currentLabel = 0;
    const components = [];

    // Simple 4-connected flood fill
    for (let y = 0; y < maskH; y++) {
        for (let x = 0; x < maskW; x++) {
            const idx = y * maskW + x;
            if (binary[idx] === 1 && labels[idx] === 0) {
                currentLabel++;
                let compPixels = 0;
                let compConfSum = 0;
                let minX = x, maxX = x, minY = y, maxY = y;

                const stack = [idx];
                labels[idx] = currentLabel;

                while (stack.length > 0) {
                    const curr = stack.pop();
                    const cy = Math.floor(curr / maskW);
                    const cx = curr % maskW;

                    compPixels++;
                    compConfSum += maskData[curr];

                    if (cx < minX) minX = cx;
                    if (cx > maxX) maxX = cx;
                    if (cy < minY) minY = cy;
                    if (cy > maxY) maxY = cy;

                    // Check 4 neighbors
                    const neighbors = [
                        [cx + 1, cy],
                        [cx - 1, cy],
                        [cx, cy + 1],
                        [cx, cy - 1]
                    ];

                    for (const [nx, ny] of neighbors) {
                        if (nx >= 0 && nx < maskW && ny >= 0 && ny < maskH) {
                            const nidx = ny * maskW + nx;
                            if (binary[nidx] === 1 && labels[nidx] === 0) {
                                labels[nidx] = currentLabel;
                                stack.push(nidx);
                            }
                        }
                    }
                }

                // Filter out tiny noise clusters (< 50 pixels on 256x256)
                if (compPixels >= 50) {
                    const areaRatio = parseFloat((compPixels / totalPixels).toFixed(4));
                    const meanConf = parseFloat((compConfSum / compPixels).toFixed(2));
                    components.push({
                        label: currentLabel,
                        pixels: compPixels,
                        areaRatio,
                        confidence: Math.min(0.99, Math.max(0.4, meanConf)),
                        box: { minX, maxX, minY, maxY }
                    });
                }
            }
        }
    }

    if (components.length === 0) {
        return {
            detected: false,
            hasPlantContent: false,
            confidence: 0.2,
            boundingBox: null,
            mask: null,
            regions: [],
            modelType,
            reason: "no_leaf_detected",
            message: "No reliable plant leaf detected in the image."
        };
    }

    // Sort components by pixel area (descending) -> largest leaf is primary
    components.sort((a, b) => b.pixels - a.pixels);

    const scaleX = origW / maskW;
    const scaleY = origH / maskH;

    // Build multi-region array
    const regions = components.map((comp, idx) => {
        const left = Math.max(0, Math.floor(comp.box.minX * scaleX));
        const top = Math.max(0, Math.floor(comp.box.minY * scaleY));
        const width = Math.min(origW - left, Math.ceil((comp.box.maxX - comp.box.minX + 1) * scaleX));
        const height = Math.min(origH - top, Math.ceil((comp.box.maxY - comp.box.minY + 1) * scaleY));

        return {
            id: idx + 1,
            boundingBox: { left, top, width, height },
            confidence: comp.confidence,
            areaRatio: comp.areaRatio
        };
    });

    const primary = regions[0];

    // Generate Visual PNG mask data URL for debugging / UI overlay
    let visualMaskDataUrl = null;
    try {
        const maskRgba = Buffer.alloc(maskW * maskH * 4);
        for (let i = 0; i < totalPixels; i++) {
            const isFoliage = binary[i] === 1;
            maskRgba[i * 4] = isFoliage ? 34 : 0;   // R
            maskRgba[i * 4 + 1] = isFoliage ? 197 : 0;   // G (Emerald Green)
            maskRgba[i * 4 + 2] = isFoliage ? 94 : 0;   // B
            maskRgba[i * 4 + 3] = isFoliage ? 220 : 0;   // Alpha
        }
        const pngBuf = await sharp(maskRgba, { raw: { width: maskW, height: maskH, channels: 4 } })
            .png()
            .toBuffer();
        visualMaskDataUrl = `data:image/png;base64,${pngBuf.toString("base64")}`;
    } catch (e) {
        visualMaskDataUrl = null;
    }

    return {
        detected: true,
        hasPlantContent: true,
        confidence: primary.confidence,
        boundingBox: primary.boundingBox,
        mask: visualMaskDataUrl,
        binaryMask: Buffer.from(binary),
        maskDimensions: { width: maskW, height: maskH },
        regions,
        modelType
    };
}

module.exports = {
    detectLeafRegion,
    initLeafSession
};
