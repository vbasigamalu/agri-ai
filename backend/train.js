/**
 * ============================================================
 * TRAIN.JS — Train Crop Disease Classifier in JavaScript
 * ============================================================
 * Uses Transfer Learning with MobileNet V2 + Streaming Extraction:
 *
 *   [Image 224x224] → [MobileNet V2 (frozen)] → [1280 features]
 *        → [Dense 128 ReLU] → [Dropout 0.3]
 *        → [Dense N Softmax] → [Disease Class Prediction]
 *
 * Memory-Safe: Images are processed in micro-batches of 20,
 * so RAM usage stays under 1GB even with 15,000+ images.
 *
 * Fine-Tuning: If a previous model exists, it loads the old
 * weights and continues training (no forgetting).
 *
 * Run: node train.js
 * ============================================================
 */

const tf = require("@tensorflow/tfjs");
const path = require("path");
const fs = require("fs");
const { loadAndExtractFeatures, splitDataset, IMAGE_SIZE } = require("./dataLoader");
const { getModelLabels } = require("./cropDatabase");

// ─── Configuration ──────────────────────────────────────────
const DATASET_PATH = path.join(__dirname, "dataset");
const TARGET_CROP = "Tomato"; // Train only Tomato crop classes
const EPOCHS = 30;
const BATCH_SIZE = 16;
const LEARNING_RATE = 0.0005; // Stable fine-tuning
const MAX_IMAGES_PER_CLASS = 900; // 900 images per class
const VALIDATION_SPLIT = 0.2;

const MOBILENET_DIR = path.join(__dirname, "mobilenet_v2");
const MOBILENET_LOCAL = path.join(MOBILENET_DIR, "model.json");
const MOBILENET_URL = "https://tfhub.dev/google/tfjs-model/imagenet/mobilenet_v2_100_224/feature_vector/3/default/1";

/**
 * Creates a fresh classification head
 */
function createNewModel(featureSize, numClasses) {
    return tf.sequential({
        layers: [
            tf.layers.dense({
                inputShape: [featureSize],
                units: 128,
                activation: "relu",
                kernelInitializer: "varianceScaling",
                kernelRegularizer: tf.regularizers.l2({ l2: 0.001 })
            }),
            tf.layers.dropout({ rate: 0.3 }),
            tf.layers.dense({
                units: numClasses,
                activation: "softmax",
                kernelInitializer: "glorotNormal"
            })
        ]
    });
}

// ─── Main Training Function ────────────────────────────────
async function train() {
    console.log("╔══════════════════════════════════════════════════╗");
    console.log("║   🌾 Agri-AI — Crop Disease Model Training       ║");
    console.log(`║   Target Crop: ${TARGET_CROP.padEnd(33)} ║`);
    console.log(`║   Images/Class: ${String(MAX_IMAGES_PER_CLASS).padEnd(32)} ║`);
    console.log("║   Memory-Safe Streaming Extraction               ║");
    console.log("╚══════════════════════════════════════════════════╝\n");

    // 1. Get class labels (Filtered for Target Crop)
    let classLabels = getModelLabels();
    if (TARGET_CROP) {
        classLabels = classLabels.filter(label => label.toLowerCase().startsWith(TARGET_CROP.toLowerCase()));
    }
    const numClasses = classLabels.length;
    console.log(`🏷️  Target Classes (${numClasses}):`);
    classLabels.forEach((c, idx) => console.log(`   [${idx + 1}] ${c}`));

    // 2. Check dataset folder exists
    if (!fs.existsSync(DATASET_PATH)) {
        console.error(`\n❌ Dataset folder not found: ${DATASET_PATH}`);
        process.exit(1);
    }

    // 3. Load MobileNet feature extractor FIRST (needed for streaming)
    console.log(`\n🧠 Loading MobileNet V2 Backbone...`);
    let mobilenet;
    try {
        if (fs.existsSync(MOBILENET_LOCAL)) {
            // Load local MobileNet offline
            const modelJson = JSON.parse(fs.readFileSync(MOBILENET_LOCAL, "utf8"));
            const weightManifest = modelJson.weightsManifest;
            const weightDataList = [];
            for (const entry of weightManifest) {
                for (const weightPath of entry.paths) {
                    weightDataList.push(fs.readFileSync(path.join(MOBILENET_DIR, weightPath)));
                }
            }
            const combinedWeights = Buffer.concat(weightDataList);
            mobilenet = await tf.loadGraphModel({
                load: async () => ({
                    modelTopology: modelJson.modelTopology,
                    weightSpecs: weightManifest[0].weights,
                    weightData: combinedWeights.buffer.slice(
                        combinedWeights.byteOffset,
                        combinedWeights.byteOffset + combinedWeights.byteLength
                    ),
                    format: modelJson.format,
                    generatedBy: modelJson.generatedBy,
                    convertedBy: modelJson.convertedBy
                })
            });
            console.log(`   ✅ MobileNet loaded from LOCAL disk (Offline Mode).`);
        } else {
            mobilenet = await tf.loadGraphModel(MOBILENET_URL, { fromTFHub: true });
            console.log(`   ✅ MobileNet downloaded from TFHub.`);
        }
    } catch (err) {
        console.warn(`   ⚠️ Local load failed, falling back to TFHub: ${err.message}`);
        mobilenet = await tf.loadGraphModel(MOBILENET_URL, { fromTFHub: true });
    }

    const featureSize = 1280;

    // 4. Stream dataset: Load images → Extract features → Dispose images (memory-safe)
    console.log(`\n🔄 Streaming feature extraction (Max ${MAX_IMAGES_PER_CLASS}/class)...`);
    const { features, labels, totalImages } = await loadAndExtractFeatures(
        DATASET_PATH, classLabels, mobilenet, MAX_IMAGES_PER_CLASS
    );

    console.log(`\n📊 Total features extracted: ${totalImages}`);
    console.log(`   Features tensor: [${features.shape}]`);
    console.log(`   Labels tensor: [${labels.shape}]`);

    // 5. Split into train/validation
    console.log(`\n✂️  Splitting into train/validation (80/20)...`);
    const { train: trainData, val: valData } = splitDataset(features, labels, VALIDATION_SPLIT);
    features.dispose();
    labels.dispose();

    console.log(`   Train: ${trainData.images.shape[0]} samples`);
    console.log(`   Validation: ${valData.images.shape[0]} samples`);

    // 6. Load existing model for fine-tuning OR create new one
    let classifier;
    const modelDir = path.join(__dirname, "crop-disease-model");
    const modelJsonPath = path.join(modelDir, "model.json");
    const labelsJsonPath = path.join(modelDir, "labels.json");

    let existingLabels = [];
    if (fs.existsSync(labelsJsonPath)) {
        try { existingLabels = JSON.parse(fs.readFileSync(labelsJsonPath, "utf8")); } catch (e) {}
    }

    if (fs.existsSync(modelJsonPath) && existingLabels.length === numClasses) {
        console.log(`\n♻️  Compatible model found (${numClasses} classes)! Loading for FINE-TUNING...`);
        try {
            const modelJson = JSON.parse(fs.readFileSync(modelJsonPath, "utf8"));
            classifier = await tf.loadLayersModel({
                load: async () => {
                    const weightDataPath = path.join(modelDir, "group1-shard1of1.bin");
                    const weightData = fs.readFileSync(weightDataPath);
                    return {
                        modelTopology: modelJson.modelTopology,
                        weightSpecs: modelJson.weightsManifest[0].weights,
                        weightData: new Uint8Array(weightData).buffer
                    };
                }
            });
            console.log("   ✅ Previous weights loaded successfully.");
        } catch (e) {
            console.log(`   ⚠️  Structure mismatch detected. Building fresh model.`);
            classifier = createNewModel(featureSize, numClasses);
        }
    } else {
        console.log(`\n🏗️  Building fresh architecture for ${numClasses} Tomato classes...`);
        classifier = createNewModel(featureSize, numClasses);
    }

    classifier.compile({
        optimizer: tf.train.adam(LEARNING_RATE),
        loss: "categoricalCrossentropy",
        metrics: ["accuracy"]
    });

    classifier.summary();

    // 7. Train the classifier
    console.log(`\n🚀 Training for ${EPOCHS} epochs...\n`);
    const startTime = Date.now();

    const history = await classifier.fit(trainData.images, trainData.labels, {
        epochs: EPOCHS,
        batchSize: BATCH_SIZE,
        validationData: [valData.images, valData.labels],
        callbacks: {
            onEpochEnd: (epoch, logs) => {
                const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
                console.log(
                    `   Epoch ${epoch + 1}/${EPOCHS} — ` +
                    `loss: ${logs.loss.toFixed(4)} — acc: ${(logs.acc * 100).toFixed(1)}% — ` +
                    `val_loss: ${logs.val_loss.toFixed(4)} — val_acc: ${(logs.val_acc * 100).toFixed(1)}% — ` +
                    `[${elapsed}s]`
                );
            }
        }
    });

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    const finalAcc = (history.history.val_acc[EPOCHS - 1] * 100).toFixed(1);

    console.log(`\n✅ Training complete in ${totalTime}s!`);
    console.log(`📊 Final validation accuracy: ${finalAcc}%`);

    // 8. Save the model
    console.log(`\n💾 Saving upgraded model...`);
    if (!fs.existsSync(modelDir)) fs.mkdirSync(modelDir, { recursive: true });

    await classifier.save(tf.io.withSaveHandler(async (modelArtifacts) => {
        const weightData = Buffer.from(modelArtifacts.weightData);
        fs.writeFileSync(path.join(modelDir, "group1-shard1of1.bin"), weightData);
        const modelJson = {
            modelTopology: modelArtifacts.modelTopology,
            format: modelArtifacts.format,
            generatedBy: modelArtifacts.generatedBy,
            convertedBy: modelArtifacts.convertedBy,
            weightsManifest: [{
                paths: ["group1-shard1of1.bin"],
                weights: modelArtifacts.weightSpecs
            }]
        };
        fs.writeFileSync(path.join(modelDir, "model.json"), JSON.stringify(modelJson));
        return {
            modelArtifactsInfo: {
                dateSaved: new Date(),
                modelTopologyType: "JSON",
                weightDataBytes: weightData.length
            }
        };
    }));

    // Save labels
    fs.writeFileSync(path.join(modelDir, "labels.json"), JSON.stringify(classLabels, null, 2));
    console.log(`   ✅ Model & labels saved!`);

    // Cleanup
    trainData.images.dispose(); valData.images.dispose();
    trainData.labels.dispose(); valData.labels.dispose();

    console.log(`\n╔══════════════════════════════════════════════════╗`);
    console.log(`║  🎉 Model trained successfully!                   ║`);
    console.log(`║  📊 Accuracy: ${finalAcc}%                          ║`);
    console.log(`║  🚀 Start server: node server.js                  ║`);
    console.log(`╚══════════════════════════════════════════════════╝\n`);
}

// Run training
train().catch(err => {
    console.error("\n❌ Training failed:", err.message);
    console.error(err.stack);
    process.exit(1);
});
