/**
 * trainPest.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Train Pest Classifier in Node.js with TensorFlow.js + MobileNet V2 Backbone
 * 
 * Runs 100% locally in JavaScript — No Python, No PyTorch, No AppLocker issues!
 * 
 * Pipeline:
 *   [Cleaned Pest Image 224x224] → [MobileNet V2 (1280 features)]
 *        → [Dense 128 ReLU] → [Dropout 0.3]
 *        → [Dense 9 Softmax] → [Pest Species Prediction]
 * 
 * Run: node trainPest.js
 * ─────────────────────────────────────────────────────────────────────────────
 */

const tf = require("@tensorflow/tfjs");
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const IMAGE_SIZE = 224;
const FEATURE_SIZE = 1280;
const EPOCHS = 25;
const BATCH_SIZE = 16;
const LEARNING_RATE = 0.001;

const DATASET_DIR = path.join(__dirname, "../pest-dataset/cleaned");
const MOBILENET_DIR = path.join(__dirname, "mobilenet_v2");
const MOBILENET_LOCAL = path.join(MOBILENET_DIR, "model.json");
const OUTPUT_DIR = path.join(__dirname, "pest-model");

const PEST_CLASSES = [
    "aphids", "armyworm", "beetle", "bollworm", "grasshopper",
    "mites", "mosquito", "sawfly", "stem_borer"
];

async function imageToTensor(filePath) {
    const { data } = await sharp(filePath)
        .resize(IMAGE_SIZE, IMAGE_SIZE, { fit: "cover" })
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

    const tensor = tf.tensor3d(new Uint8Array(data), [IMAGE_SIZE, IMAGE_SIZE, 3]);
    const normalized = tensor.div(255.0);
    tensor.dispose();
    return normalized;
}

async function loadLocalMobileNet() {
    console.log("🧠 Loading Local MobileNet V2 Backbone...");
    const modelJson = JSON.parse(fs.readFileSync(MOBILENET_LOCAL, "utf8"));
    const weightManifest = modelJson.weightsManifest;
    const weightDataList = [];
    for (const entry of weightManifest) {
        for (const weightPath of entry.paths) {
            weightDataList.push(fs.readFileSync(path.join(MOBILENET_DIR, weightPath)));
        }
    }
    const combinedWeights = Buffer.concat(weightDataList);
    const mobilenet = await tf.loadGraphModel({
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
    console.log("   ✅ MobileNet V2 loaded successfully from local disk.");
    return mobilenet;
}

function createPestClassifier(numClasses) {
    return tf.sequential({
        layers: [
            tf.layers.dense({
                inputShape: [FEATURE_SIZE],
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

async function runTraining() {
    console.log("╔══════════════════════════════════════════════════╗");
    console.log("║   🦗 Agri-AI: Native Pest Classifier Training    ║");
    console.log("║   Backbone: MobileNet V2 (Feature Extraction)    ║");
    console.log("╚══════════════════════════════════════════════════╝\n");

    if (!fs.existsSync(DATASET_DIR)) {
        console.error("❌ Dataset directory not found:", DATASET_DIR);
        return;
    }

    const mobilenet = await loadLocalMobileNet();

    console.log("\n📸 Extracting visual features from cleaned dataset...");
    const allFeatures = [];
    const allLabels = [];
    let processedCount = 0;

    for (let classIdx = 0; classIdx < PEST_CLASSES.length; classIdx++) {
        const cls = PEST_CLASSES[classIdx];
        const clsDir = path.join(DATASET_DIR, cls);
        if (!fs.existsSync(clsDir)) continue;

        const files = fs.readdirSync(clsDir).filter(f => f.match(/\.(jpg|jpeg|png)$/i));
        process.stdout.write(`   [${classIdx + 1}/9] ${cls.padEnd(14)}: ${files.length} images `);

        for (const file of files) {
            const imgPath = path.join(clsDir, file);
            try {
                const imgTensor = await imageToTensor(imgPath);
                const batched = imgTensor.expandDims(0);
                const featureVector = mobilenet.predict(batched);

                const featArr = await featureVector.data();
                allFeatures.push(Array.from(featArr));
                allLabels.push(classIdx);

                imgTensor.dispose();
                batched.dispose();
                featureVector.dispose();
                processedCount++;
            } catch (err) {
                // Skip faulty image
            }
        }
        console.log("✅ Features extracted");
    }

    console.log(`\n📊 Total samples processed: ${processedCount}`);

    // Convert to TF Tensors
    const xs = tf.tensor2d(allFeatures);
    const ys = tf.oneHot(tf.tensor1d(allLabels, "int32"), PEST_CLASSES.length);

    console.log("\n🏗️ Building Pest Classification Neural Head...");
    const model = createPestClassifier(PEST_CLASSES.length);

    model.compile({
        optimizer: tf.train.adam(LEARNING_RATE),
        loss: "categoricalCrossentropy",
        metrics: ["accuracy"]
    });

    console.log(`\n🚀 Training for ${EPOCHS} epochs (Batch size: ${BATCH_SIZE})...\n`);

    await model.fit(xs, ys, {
        epochs: EPOCHS,
        batchSize: BATCH_SIZE,
        validationSplit: 0.15,
        shuffle: true,
        callbacks: {
            onEpochEnd: (epoch, logs) => {
                const ep = String(epoch + 1).padStart(2);
                const loss = logs.loss.toFixed(4);
                const acc = (logs.acc * 100).toFixed(1);
                const valAcc = (logs.val_acc * 100).toFixed(1);
                console.log(`   Epoch [${ep}/${EPOCHS}] — Loss: ${loss} | Train Acc: ${acc}% | Val Acc: ${valAcc}%`);
            }
        }
    });

    // Save Model
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    console.log(`\n💾 Saving trained Pest Model to ${OUTPUT_DIR}...`);
    await model.save(tf.io.withSaveHandler(async (modelArtifacts) => {
        const weightData = Buffer.from(modelArtifacts.weightData);
        fs.writeFileSync(path.join(OUTPUT_DIR, "group1-shard1of1.bin"), weightData);
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
        fs.writeFileSync(path.join(OUTPUT_DIR, "model.json"), JSON.stringify(modelJson, null, 2));
        return {
            modelArtifactsInfo: {
                dateSaved: new Date(),
                modelTopologyType: "JSON",
                weightDataBytes: weightData.length
            }
        };
    }));

    // Save classes manifest
    fs.writeFileSync(path.join(OUTPUT_DIR, "classes.json"), JSON.stringify(PEST_CLASSES, null, 2));

    xs.dispose();
    ys.dispose();

    console.log("\n==================================================");
    console.log("🎉 Pest Classifier training complete and saved!");
    console.log("   Model files: model.json, weights.bin, classes.json");
    console.log("==================================================");
}

runTraining().catch(err => {
    console.error("Training Error:", err);
});
