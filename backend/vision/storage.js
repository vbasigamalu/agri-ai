/**
 * ============================================================
 * Agri-AI Vision Pipeline: Non-Destructive Storage Manager
 * ============================================================
 * Safely persists:
 * 1. Original uploaded farmer image (never overwritten)
 * 2. Processed images (tight crop & masked leaf)
 * 3. Segmentation & pipeline metadata
 * ============================================================
 */

const fs = require("fs");
const path = require("path");

const DEFAULT_STORAGE_ROOT = path.join(__dirname, "..", "uploads");

/**
 * Ensures required storage directories exist synchronously.
 */
function ensureStorageDirs(rootDir = DEFAULT_STORAGE_ROOT) {
    const dirs = [
        rootDir,
        path.join(rootDir, "originals"),
        path.join(rootDir, "processed"),
        path.join(rootDir, "metadata")
    ];

    for (const dir of dirs) {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }

    return {
        root: rootDir,
        originals: path.join(rootDir, "originals"),
        processed: path.join(rootDir, "processed"),
        metadata: path.join(rootDir, "metadata")
    };
}

/**
 * Persists pipeline artifacts without modifying the original in-memory buffers.
 *
 * @param {Object} params
 * @param {Buffer} params.originalBuffer - Immutable original image buffer
 * @param {Buffer} [params.tightCropBuffer] - Resized tight crop buffer
 * @param {Buffer} [params.maskedBuffer] - Resized masked leaf buffer
 * @param {Object} [params.metadata] - Segmentation & processing metadata
 * @param {string} [params.prefix="leaf"] - Filename prefix
 * @param {string} [params.customId] - Optional explicit ID
 * @param {string} [params.storageDir] - Custom root storage directory
 * @returns {Promise<{
 *   id: string,
 *   originalPath: string,
 *   tightCropPath: string | null,
 *   maskedPath: string | null,
 *   metadataPath: string | null,
 *   storedAt: string
 * }>}
 */
async function savePipelineArtifacts(params) {
    const {
        originalBuffer,
        tightCropBuffer,
        maskedBuffer,
        metadata = {},
        prefix = "leaf",
        customId,
        storageDir = DEFAULT_STORAGE_ROOT
    } = params;

    const dirs = ensureStorageDirs(storageDir);
    const id = customId || `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const timestamp = new Date().toISOString();

    const originalPath = path.join(dirs.originals, `${id}_original.png`);
    let tightCropPath = null;
    let maskedPath = null;
    let metadataPath = null;

    try {
        // 1. Store immutable original image
        if (originalBuffer && Buffer.isBuffer(originalBuffer)) {
            await fs.promises.writeFile(originalPath, originalBuffer);
        }

        // 2. Store tight crop
        if (tightCropBuffer && Buffer.isBuffer(tightCropBuffer)) {
            tightCropPath = path.join(dirs.processed, `${id}_tight_crop.png`);
            await fs.promises.writeFile(tightCropPath, tightCropBuffer);
        }

        // 3. Store masked leaf image
        if (maskedBuffer && Buffer.isBuffer(maskedBuffer)) {
            maskedPath = path.join(dirs.processed, `${id}_masked.png`);
            await fs.promises.writeFile(maskedPath, maskedBuffer);
        }

        // 4. Store complete segmentation metadata
        const fullMetadata = {
            id,
            timestamp,
            files: {
                original: path.basename(originalPath),
                tightCrop: tightCropPath ? path.basename(tightCropPath) : null,
                masked: maskedPath ? path.basename(maskedPath) : null
            },
            ...metadata
        };

        metadataPath = path.join(dirs.metadata, `${id}_metadata.json`);
        await fs.promises.writeFile(metadataPath, JSON.stringify(fullMetadata, null, 2), "utf8");

        return {
            id,
            originalPath,
            tightCropPath,
            maskedPath,
            metadataPath,
            storedAt: timestamp
        };

    } catch (err) {
        console.warn("⚠️ [StorageManager] Failed to persist pipeline artifacts:", err.message);
        return {
            id,
            originalPath: null,
            tightCropPath: null,
            maskedPath: null,
            metadataPath: null,
            error: err.message,
            storedAt: timestamp
        };
    }
}

module.exports = {
    savePipelineArtifacts,
    ensureStorageDirs,
    DEFAULT_STORAGE_ROOT
};
