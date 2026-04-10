/**
 * ============================================================
 * TRAIN.JS — Train Crop Disease Classifier in JavaScript
 * ============================================================
 * Uses Transfer Learning with MobileNet V2:
 * 
 *   [Image 224x224] → [MobileNet V2 Feature Extractor (frozen)]
 *        → [1280 features] → [Dense 128 ReLU] → [Dropout 0.3]
 *        → [Dense 15 Softmax] → [Disease Class Prediction]
 * 
 * Run: node train.js
 * 
 * Prerequisites:
 *   1. npm install
 *   2. Dataset folder: backend/dataset/ with class subfolders
 * ============================================================
 */

const tf = require("@tensorflow/tfjs");
const path = require("path");
const fs = require("fs");
const { loadDataset, splitDataset, IMAGE_SIZE } = require("./dataLoader");
const { getModelLabels } = require("./cropDatabase");

// ─── Configuration ──────────────────────────────────────────
const DATASET_PATH = path.join(__dirname, "dataset");
const MODEL_SAVE_PATH = "file://" + path.join(__dirname, "crop-disease-model").replace(/\\/g, "/");
const EPOCHS = 10;
const BATCH_SIZE = 16;
const LEARNING_RATE = 0.001;
const MAX_IMAGES_PER_CLASS = 200; // Limit for faster training on CPU
const VALIDATION_SPLIT = 0.2;

// MobileNet V2 feature extractor from TF Hub (no Python needed!)
const MOBILENET_URL = "https://tfhub.dev/google/tfjs-model/imagenet/mobilenet_v2_100_224/feature_vector/3/default/1";

// ─── Main Training Function ────────────────────────────────
async function train() {
    console.log("╔══════════════════════════════════════════════════╗");
    console.log("║   🌾 Agri-AI — Crop Disease Model Training       ║");
    console.log("║   Transfer Learning with MobileNet V2            ║");
    console.log("║   100% JavaScript — Zero Python                  ║");
    console.log("╚══════════════════════════════════════════════════╝\n");

    // 1. Get class labels from our hardcoded database
    const classLabels = getModelLabels();
    const numClasses = classLabels.length;
    console.log(`🏷️  Classes (${numClasses}):`);
    classLabels.forEach((label, i) => console.log(`   ${i}: ${label}`));

    // 2. Check dataset folder exists
    if (!fs.existsSync(DATASET_PATH)) {
        console.error(`\n❌ Dataset folder not found: ${DATASET_PATH}`);
        console.error(`\n📥 To download the PlantVillage dataset:`);
        console.error(`   1. Go to: https://www.kaggle.com/datasets/abdallahalidev/plantvillage-dataset`);
        console.error(`   2. Download and extract the 'color' folder`);
        console.error(`   3. Copy the class folders into: ${DATASET_PATH}`);
        console.error(`\n   Expected structure:`);
        console.error(`   dataset/`);
        classLabels.forEach(l => console.error(`     └── ${l}/   (contains .jpg images)`));
        process.exit(1);
    }

    // 3. Load dataset
    console.log(`\n📂 Loading dataset...`);
    const { images, labels, totalImages } = await loadDataset(
        DATASET_PATH, classLabels, MAX_IMAGES_PER_CLASS
    );

    // 4. Split into train/validation
    console.log(`\n✂️  Splitting into train/validation (${(1 - VALIDATION_SPLIT) * 100}%/${VALIDATION_SPLIT * 100}%)...`);
    const { train: trainData, val: valData } = splitDataset(images, labels, VALIDATION_SPLIT);
    images.dispose();
    labels.dispose();

    console.log(`   Train: ${trainData.images.shape[0]} images`);
    console.log(`   Validation: ${valData.images.shape[0]} images`);

    // 5. Load MobileNet V2 feature extractor from TF Hub
    console.log(`\n🧠 Loading MobileNet V2 feature extractor from TF Hub...`);
    console.log(`   (This may take a minute on first run — model is ~14MB)`);
    const mobilenet = await tf.loadGraphModel(MOBILENET_URL, { fromTFHub: true });
    console.log(`   ✅ MobileNet loaded!`);

    // Test the feature extractor output shape
    const testInput = tf.zeros([1, IMAGE_SIZE, IMAGE_SIZE, 3]);
    const testOutput = mobilenet.predict(testInput);
    const featureSize = testOutput.shape[1]; // Should be 1280
    console.log(`   Feature vector size: ${featureSize}`);
    testInput.dispose();
    testOutput.dispose();

    // 6. Extract features from all images using MobileNet (frozen — no backprop)
    console.log(`\n🔄 Extracting features with MobileNet...`);

    const trainFeatures = await extractFeaturesBatched(mobilenet, trainData.images, BATCH_SIZE);
    const valFeatures = await extractFeaturesBatched(mobilenet, valData.images, BATCH_SIZE);

    // Free original images from memory
    trainData.images.dispose();
    valData.images.dispose();

    console.log(`   ✅ Train features: [${trainFeatures.shape}]`);
    console.log(`   ✅ Val features: [${valFeatures.shape}]`);

    // 7. Build classification head
    console.log(`\n🏗️  Building classification head...`);
    const classifier = tf.sequential({
        layers: [
            tf.layers.dense({
                inputShape: [featureSize],
                units: 128,
                activation: "relu",
                kernelRegularizer: tf.regularizers.l2({ l2: 0.001 })
            }),
            tf.layers.dropout({ rate: 0.3 }),
            tf.layers.dense({
                units: numClasses,
                activation: "softmax"
            })
        ]
    });

    classifier.compile({
        optimizer: tf.train.adam(LEARNING_RATE),
        loss: "categoricalCrossentropy",
        metrics: ["accuracy"]
    });

    classifier.summary();

    // 8. Train the classifier
    console.log(`\n🚀 Training for ${EPOCHS} epochs...\n`);
    const startTime = Date.now();

    const history = await classifier.fit(trainFeatures, trainData.labels, {
        epochs: EPOCHS,
        batchSize: BATCH_SIZE,
        validationData: [valFeatures, valData.labels],
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

    // 9. Save the model
    const savePath = MODEL_SAVE_PATH;
    console.log(`\n💾 Saving model...`);

    // Ensure directory exists
    const modelDir = path.join(__dirname, "crop-disease-model");
    if (!fs.existsSync(modelDir)) {
        fs.mkdirSync(modelDir, { recursive: true });
    }

    await classifier.save(savePath);

    // Also save the class labels
    const labelsPath = path.join(modelDir, "labels.json");
    fs.writeFileSync(labelsPath, JSON.stringify(classLabels, null, 2));
    console.log(`   ✅ Model saved!`);
    console.log(`   ✅ Labels saved to: ${labelsPath}`);

    // Cleanup
    trainFeatures.dispose();
    valFeatures.dispose();
    trainData.labels.dispose();
    valData.labels.dispose();

    console.log(`\n╔══════════════════════════════════════════════════╗`);
    console.log(`║  🎉 Model trained successfully!                   ║`);
    console.log(`║  📊 Accuracy: ${finalAcc}%                          ║`);
    console.log(`║  🚀 Start server: node server.js                  ║`);
    console.log(`╚══════════════════════════════════════════════════╝\n`);
}


/**
 * Extract MobileNet features from images in batches
 */
async function extractFeaturesBatched(model, images, batchSize) {
    const numImages = images.shape[0];
    const featureBatches = [];

    for (let i = 0; i < numImages; i += batchSize) {
        const end = Math.min(i + batchSize, numImages);
        const batch = images.slice(i, end - i);

        const features = tf.tidy(() => {
            return model.predict(batch);
        });

        featureBatches.push(features);
        batch.dispose();

        const pct = Math.round((end / numImages) * 100);
        process.stdout.write(`\r   Extracting features: ${end}/${numImages} (${pct}%)`);
    }
    console.log("");

    const allFeatures = tf.concat(featureBatches);
    featureBatches.forEach(f => f.dispose());

    return allFeatures;
}


// Run training
train().catch(err => {
    console.error("\n❌ Training failed:", err.message);
    console.error(err.stack);
    process.exit(1);
});
