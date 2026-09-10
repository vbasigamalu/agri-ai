/**
 * ============================================================
 * Agri-AI Vision Pipeline: Stage 4 — Crop, Resize & Normalize
 * ============================================================
 * Converts the isolated leaf image into normalized tensor data
 * ready for direct consumption by ONNX Runtime or TensorFlow.js.
 *
 * Operations:
 * - High-quality Lanczos3/Cubic resampling to target dimensions (224x224).
 * - Alpha channel stripping for strict 3-channel RGB.
 * - ImageNet Z-score standardization: (x/255.0 - mean) / std.
 * - Layout conversion: Supports CHW (ONNX default) and HWC (TF.js).
 * ============================================================
 */

const sharp = require("sharp");

// Standard ImageNet statistics (used during PyTorch backbone training)
const IMAGENET_MEAN = [0.485, 0.456, 0.406];
const IMAGENET_STD  = [0.229, 0.224, 0.225];

/**
 * Prepares the model input tensor from an image buffer.
 *
 * @param {Buffer} imageBuffer - Image buffer (ideally background-suppressed)
 * @param {Object} [options] - Configuration options
 * @param {number} [options.targetSize=224] - Square dimension (e.g. 224)
 * @param {string} [options.layout="CHW"] - "CHW" for PyTorch/ONNX, "HWC" for TF.js
 * @param {number[]} [options.mean] - Normalization mean [R, G, B]
 * @param {number[]} [options.std] - Normalization std [R, G, B]
 * @returns {Promise<{
 *   floatData: Float32Array,
 *   tensorShape: number[],
 *   rawPixels: Buffer,
 *   width: number,
 *   height: number
 * }>}
 */
async function prepareModelInput(imageBuffer, options = {}) {
    const targetSize = options.targetSize || 224;
    const layout = options.layout || "CHW";
    const mean = options.mean || IMAGENET_MEAN;
    const std = options.std || IMAGENET_STD;

    const fit = options.fit || "contain";
    const { data: rawPixels } = await sharp(imageBuffer)
        .resize(targetSize, targetSize, {
            fit,
            position: "center",
            background: { r: 0, g: 0, b: 0 }
        })
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

    const totalPixels = targetSize * targetSize;
    const floatData = new Float32Array(3 * totalPixels);

    if (layout === "CHW") {
        // Channel-first format: [Batch, Channel, Height, Width] -> [1, 3, 224, 224]
        for (let i = 0; i < totalPixels; i++) {
            const r = rawPixels[i * 3] / 255.0;
            const g = rawPixels[i * 3 + 1] / 255.0;
            const b = rawPixels[i * 3 + 2] / 255.0;

            floatData[0 * totalPixels + i] = (r - mean[0]) / std[0]; // Channel 0 (R)
            floatData[1 * totalPixels + i] = (g - mean[1]) / std[1]; // Channel 1 (G)
            floatData[2 * totalPixels + i] = (b - mean[2]) / std[2]; // Channel 2 (B)
        }

        return {
            floatData,
            tensorShape: [1, 3, targetSize, targetSize],
            rawPixels,
            width: targetSize,
            height: targetSize
        };

    } else {
        // Channel-last format: [Batch, Height, Width, Channel] -> [1, 224, 224, 3]
        for (let i = 0; i < totalPixels; i++) {
            const r = rawPixels[i * 3] / 255.0;
            const g = rawPixels[i * 3 + 1] / 255.0;
            const b = rawPixels[i * 3 + 2] / 255.0;

            floatData[i * 3]     = (r - mean[0]) / std[0];
            floatData[i * 3 + 1] = (g - mean[1]) / std[1];
            floatData[i * 3 + 2] = (b - mean[2]) / std[2];
        }

        return {
            floatData,
            tensorShape: [1, targetSize, targetSize, 3],
            rawPixels,
            width: targetSize,
            height: targetSize
        };
    }
}

module.exports = {
    prepareModelInput,
    IMAGENET_MEAN,
    IMAGENET_STD
};
