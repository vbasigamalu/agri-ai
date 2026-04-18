// 🚀 [Agri-AI] HYBRID TURBO IGNITION 
process.stdout.write("\n🚀 [Agri-AI] Ignition system powering up...\n");

let tf = null;
let model = null;
let mobilenet = null;
let modelReady = false;
let labels = [];

const fs = require("fs");
const path = require("path");
const { getDiseaseInfo, getModelLabels } = require("./cropDatabase");
const MODEL_DIR = path.join(__dirname, "crop-disease-model");

// FORCE LOG HELPER
function logStep(msg) {
    process.stdout.write(`🚀 [Agri-AI] ${msg}\n`);
}

async function initClassifier() {
    if (modelReady) return; 
    logStep("Ignition Seq: unblocking main thread...");

    try {
        labels = getModelLabels();

        // 🚀 [STEP 1] EXHAUSTIVE HYBRID BACKEND HUNT
        // 🚀 [STEP 1] FORCE HIGH-SPEED WASM BACKEND
        // (Avoiding tfjs-node as it often fails on newer Node versions/Windows without C++ tools)
        logStep("Calibrating WASM High-Performance Engine...");
        tf = require("@tensorflow/tfjs");
        const wasm = require("@tensorflow/tfjs-backend-wasm");
        
        // 🛡️ ABSOLUTE BINARY MAP: Essential for Windows stability
        const wasmDist = path.join(__dirname, 'node_modules', '@tensorflow', 'tfjs-backend-wasm', 'dist');
        wasm.setWasmPaths({
            'tfjs-backend-wasm.wasm': path.join(wasmDist, 'tfjs-backend-wasm.wasm'),
            'tfjs-backend-wasm-simd.wasm': path.join(wasmDist, 'tfjs-backend-wasm-simd.wasm'),
            'tfjs-backend-wasm-threaded.wasm': path.join(wasmDist, 'tfjs-backend-wasm-threaded.wasm'),
            'tfjs-backend-wasm-threaded-simd.wasm': path.join(wasmDist, 'tfjs-backend-wasm-threaded-simd.wasm'),
        });
        
        await tf.setBackend('wasm');
        await tf.ready();
        logStep(`Engine Signal: WASM CORE ⚡ (Active on ${tf.getBackend()})`);
        
        logStep("[1.5/5] Hooking into Core MobileNet Backbone...");
        const MOBILENET_DIR = path.join(__dirname, "mobilenet_v2");
        const MOBILENET_LOCAL = path.join(MOBILENET_DIR, "model.json");
        const MOBILENET_URL = "https://tfhub.dev/google/tfjs-model/imagenet/mobilenet_v2_100_224/feature_vector/3/default/1";
        
        // 🛠️ CUSTOM OFFLINE LOADER (Works without tfjs-node)
        const loadLocalModel = async (modelPath) => {
            const modelDir = path.dirname(modelPath);
            return {
                load: async () => {
                    const modelJson = JSON.parse(fs.readFileSync(modelPath, "utf8"));
                    const weightManifest = modelJson.weightsManifest;
                    const weightDataList = [];

                    for (const entry of weightManifest) {
                        for (const weightPath of entry.paths) {
                            const fullPath = path.join(modelDir, weightPath);
                            weightDataList.push(fs.readFileSync(fullPath));
                        }
                    }

                    const combinedWeights = Buffer.concat(weightDataList);
                    return {
                        modelTopology: modelJson.modelTopology,
                        weightSpecs: weightManifest[0].weights,
                        weightData: combinedWeights.buffer.slice(
                            combinedWeights.byteOffset,
                            combinedWeights.byteOffset + combinedWeights.byteLength
                        ),
                        format: modelJson.format,
                        generatedBy: modelJson.generatedBy,
                        convertedBy: modelJson.convertedBy
                    };
                }
            };
        };

        try {
            if (fs.existsSync(MOBILENET_LOCAL)) {
                // ⚡ TRUE OFFLINE: Read directly from bytes
                mobilenet = await tf.loadGraphModel(await loadLocalModel(MOBILENET_LOCAL));
                logStep("Backbone loaded from LOCAL disk ⚡ (Offline Mode)");
            } else {
                // 🌐 ONLINE FALLBACK
                logStep("Local backbone not found. Downloading from TFHub...");
                mobilenet = await tf.loadGraphModel(MOBILENET_URL, { fromTFHub: true });
                logStep("Backbone downloaded from TFHub ✅");
            }
        } catch (fetchErr) {
            logStep(`⚠️  MobileNet load error: ${fetchErr.message}`);
        }
        
        // Load the local classification head
        const modelJsonPath = path.join(MODEL_DIR, "model.json");
        if (fs.existsSync(modelJsonPath)) {
            let modelJson = JSON.parse(fs.readFileSync(modelJsonPath, "utf8"));

            logStep("[2/5] Translating Modern Topology...");
            const deepTranslate = (obj) => {
                if (!obj || typeof obj !== 'object') return;
                if (Array.isArray(obj)) { obj.forEach(deepTranslate); return; }
                if (obj.class_name === "InputLayer" && obj.config && obj.config.batch_shape) {
                    obj.config.batchInputShape = obj.config.batch_shape;
                }
                if (obj.inbound_nodes && Array.isArray(obj.inbound_nodes)) {
                    obj.inbound_nodes = obj.inbound_nodes.map(node => {
                        if (!Array.isArray(node) && typeof node === 'object' && node.args) {
                            const args = Array.isArray(node.args) ? node.args : [node.args];
                            return args.map(arg => (arg && arg.config && arg.config.keras_history) ? arg.config.keras_history : arg);
                        }
                        return node;
                    });
                }
                Object.values(obj).forEach(deepTranslate);
            };
            deepTranslate(modelJson.modelTopology);

            logStep("[3/5] Loading Weights (Buffered isolation)...");
            const shards = modelJson.weightsManifest[0].paths.map(p => fs.readFileSync(path.join(MODEL_DIR, p)));
            const combined = Buffer.concat(shards);
            const weightData = new Uint8Array(combined).slice().buffer;
            shards.length = 0; 
            
            logStep("[4/5] Stacking Neural Layers...");
            model = await tf.loadLayersModel({
                load: async () => ({
                    modelTopology: modelJson.modelTopology,
                    weightSpecs: modelJson.weightsManifest[0].weights,
                    weightData: weightData
                })
            });

            modelJson = null; 
            if (model && mobilenet) {
                modelReady = true;
                logStep("[5/5] AI NEURAL ENGINE READY (Success!)");
            } else {
                logStep("[5/5] Engine partially loaded. Standby.");
            }
        } else {
            logStep("⚠️  Warning: Local model files missing in 'crop-disease-model' folder.");
        }

        setTimeout(() => {
            if (model && mobilenet && tf) {
                tf.tidy(() => {
                    const img = tf.zeros([1, 224, 224, 3]);
                    const features = mobilenet.predict(img);
                    model.predict(features).dispose();
                });
                logStep("Final Diagnostic: Performance Tuned.");
            }
        }, 500);

    } catch (err) {
        logStep(`CRITICAL STARTUP ERROR: ${err.message}`);
        // Even if critical error, we keep modelReady as false so server stays up
    }
}

async function classify(imageBuffer) {
    if (!modelReady || !model || !mobilenet) throw new Error("AI is warming up.");
    const dataLoader = require("./dataLoader"); 
    const tensor = await dataLoader.bufferToTensor(imageBuffer);
    try {
        const input = tensor.expandDims(0);
        const features = mobilenet.predict(input);
        const prediction = model.predict(features);
        const output = await prediction.data();
        prediction.dispose(); features.dispose(); input.dispose(); tensor.dispose();
        const maxIndex = output.indexOf(Math.max(...output));
        const info = getDiseaseInfo(labels[maxIndex]);
        return {
            disease: info ? info.displayName : labels[maxIndex],
            label: labels[maxIndex],
            confidence: parseFloat((output[maxIndex] * 100).toFixed(1)),
            causedBy: info ? info.causedBy : "Unknown",
            severity: info ? info.severity : "Moderate",
            symptoms: info ? info.symptoms : [],
            advice: info ? info.treatment : [],
            prevention: info ? info.prevention : [],
            spray: info && info.spray ? info.spray.name : "N/A",
            spray_action_time: info && info.spray ? info.spray.timing : "N/A",
            spray_quantity: info && info.spray ? info.spray.quantity : "N/A",
            allPredictions: Array.from(output)
                .map((v, i) => ({ label: labels[i], confidence: parseFloat((v * 100).toFixed(1)) }))
                .sort((a, b) => b.confidence - a.confidence).slice(0, 3)
        };
    } catch (err) { if (tensor) tensor.dispose(); throw err; }
}

function isReady() { return modelReady && model !== null; }
module.exports = { initClassifier, classify, isReady };
