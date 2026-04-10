/**
 * ============================================================
 * DATA LOADER — Load & Preprocess PlantVillage Dataset
 * ============================================================
 * Uses sharp for image decoding (instead of tfjs-node)
 * Works with pure @tensorflow/tfjs — no native bindings needed
 * ============================================================
 */

const tf = require("@tensorflow/tfjs");
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const IMAGE_SIZE = 224;

/**
 * Decode an image file to a TF tensor using sharp
 * @param {string} filePath - Path to image file
 * @returns {tf.Tensor3D} - [224, 224, 3] tensor normalized to [-1, 1]
 */
async function imageToTensor(filePath) {
    // Use sharp to decode, resize, and get raw pixel data
    const { data, info } = await sharp(filePath)
        .resize(IMAGE_SIZE, IMAGE_SIZE, { fit: "cover" })
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

    // Convert raw pixel buffer to float32 tensor and normalize to [-1, 1]
    const tensor = tf.tensor3d(new Uint8Array(data), [IMAGE_SIZE, IMAGE_SIZE, 3]);
    const normalized = tensor.div(127.5).sub(1);
    tensor.dispose();
    return normalized;
}

/**
 * Decode an image buffer to a TF tensor using sharp
 * @param {Buffer} buffer - Raw image buffer
 * @returns {tf.Tensor3D} - [224, 224, 3] tensor normalized to [-1, 1]
 */
async function bufferToTensor(buffer) {
    const { data } = await sharp(buffer)
        .resize(IMAGE_SIZE, IMAGE_SIZE, { fit: "cover" })
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

    const tensor = tf.tensor3d(new Uint8Array(data), [IMAGE_SIZE, IMAGE_SIZE, 3]);
    const normalized = tensor.div(127.5).sub(1);
    tensor.dispose();
    return normalized;
}

/**
 * Load all images from the dataset directory
 * @param {string} datasetPath - Path to dataset root (e.g., ./dataset)
 * @param {string[]} classLabels - Sorted array of class folder names
 * @param {number} maxPerClass - Max images per class (for faster training)
 * @returns {{ images: tf.Tensor4D, labels: tf.Tensor2D, totalImages: number }}
 */
async function loadDataset(datasetPath, classLabels, maxPerClass = 200) {
    const allImageTensors = [];
    const allLabels = [];
    const numClasses = classLabels.length;
    let totalLoaded = 0;

    console.log(`\n📂 Loading dataset from: ${datasetPath}`);
    console.log(`📊 Classes: ${numClasses}`);
    console.log(`📷 Max images per class: ${maxPerClass}\n`);

    for (let classIdx = 0; classIdx < classLabels.length; classIdx++) {
        const className = classLabels[classIdx];
        const classDir = path.join(datasetPath, className);

        if (!fs.existsSync(classDir)) {
            console.warn(`⚠️  Folder not found: ${classDir} — skipping`);
            continue;
        }

        // Get all image files in this class folder
        let files = fs.readdirSync(classDir)
            .filter(f => /\.(jpg|jpeg|png|bmp)$/i.test(f));

        // Shuffle and limit
        files = shuffleArray(files).slice(0, maxPerClass);

        let loadedCount = 0;
        for (const file of files) {
            try {
                const filePath = path.join(classDir, file);
                const tensor = await imageToTensor(filePath);
                allImageTensors.push(tensor);

                // One-hot encode the label
                const oneHot = new Array(numClasses).fill(0);
                oneHot[classIdx] = 1;
                allLabels.push(oneHot);

                loadedCount++;
                totalLoaded++;
            } catch (err) {
                // Skip corrupted images silently
                continue;
            }
        }

        console.log(`  ✅ [${classIdx + 1}/${numClasses}] ${className}: ${loadedCount} images loaded`);
    }

    if (totalLoaded === 0) {
        throw new Error("No images were loaded! Check your dataset folder structure.");
    }

    console.log(`\n📊 Total images loaded: ${totalLoaded}`);
    console.log(`🔄 Stacking into tensors...`);

    // Stack all image tensors into a single 4D tensor [N, 224, 224, 3]
    const imagesTensor = tf.stack(allImageTensors);

    // Clean up individual tensors
    allImageTensors.forEach(t => t.dispose());

    // Create labels tensor [N, numClasses]
    const labelsTensor = tf.tensor2d(allLabels);

    console.log(`✅ Images tensor shape: [${imagesTensor.shape}]`);
    console.log(`✅ Labels tensor shape: [${labelsTensor.shape}]`);

    return { images: imagesTensor, labels: labelsTensor, totalImages: totalLoaded };
}

/**
 * Split dataset into training and validation sets
 */
function splitDataset(images, labels, valSplit = 0.2) {
    const numSamples = images.shape[0];
    const numVal = Math.floor(numSamples * valSplit);
    const numTrain = numSamples - numVal;

    const indices = tf.util.createShuffledIndices(numSamples);
    const trainIndices = Array.from(indices).slice(0, numTrain);
    const valIndices = Array.from(indices).slice(numTrain);

    const trainImages = tf.gather(images, trainIndices);
    const trainLabels = tf.gather(labels, trainIndices);
    const valImages = tf.gather(images, valIndices);
    const valLabels = tf.gather(labels, valIndices);

    return {
        train: { images: trainImages, labels: trainLabels },
        val: { images: valImages, labels: valLabels }
    };
}

/**
 * Fisher-Yates shuffle
 */
function shuffleArray(arr) {
    const shuffled = [...arr];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

module.exports = { loadDataset, splitDataset, imageToTensor, bufferToTensor, IMAGE_SIZE };
