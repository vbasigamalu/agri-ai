/**
 * ============================================================
 * SETUP DATASET — Download & Organize PlantVillage Dataset
 * ============================================================
 * Run: node setupDataset.js
 * 
 * This script checks your dataset/ folder and tells you
 * exactly which class folders are missing and where to get them.
 * ============================================================
 */

const fs = require("fs");
const path = require("path");
const { getModelLabels } = require("./cropDatabase");

const DATASET_PATH = path.join(__dirname, "dataset");

function checkDataset() {
    console.log("╔══════════════════════════════════════════════════╗");
    console.log("║   📂 Agri-AI Dataset Setup Checker               ║");
    console.log("╚══════════════════════════════════════════════════╝\n");

    const requiredClasses = getModelLabels();
    
    console.log(`📍 Dataset path: ${DATASET_PATH}\n`);

    if (!fs.existsSync(DATASET_PATH)) {
        fs.mkdirSync(DATASET_PATH, { recursive: true });
        console.log("📁 Created dataset/ folder.\n");
    }

    let allPresent = true;
    let totalImages = 0;
    const missing = [];
    const present = [];

    for (const className of requiredClasses) {
        const classDir = path.join(DATASET_PATH, className);
        
        if (!fs.existsSync(classDir)) {
            missing.push(className);
            allPresent = false;
        } else {
            const images = fs.readdirSync(classDir).filter(f => /\.(jpg|jpeg|png|bmp)$/i.test(f));
            present.push({ name: className, count: images.length });
            totalImages += images.length;
            
            if (images.length === 0) {
                missing.push(className + " (folder exists but EMPTY)");
                allPresent = false;
            }
        }
    }

    // Show status
    if (present.length > 0) {
        console.log("✅ FOUND classes:\n");
        for (const p of present) {
            const status = p.count > 50 ? "🟢" : p.count > 0 ? "🟡" : "🔴";
            console.log(`   ${status} ${p.name}: ${p.count} images`);
        }
        console.log(`\n   📊 Total images found: ${totalImages}\n`);
    }

    if (missing.length > 0) {
        console.log("❌ MISSING classes:\n");
        for (const m of missing) {
            console.log(`   ❌ ${m}`);
        }

        console.log(`\n${"═".repeat(55)}`);
        console.log("\n📥 HOW TO GET THE DATASET:\n");
        console.log("   OPTION 1: Kaggle (Recommended)\n");
        console.log("   1. Go to: https://www.kaggle.com/datasets/abdallahalidev/plantvillage-dataset");
        console.log("   2. Click 'Download' (you need a free Kaggle account)");
        console.log("   3. Extract the ZIP file");
        console.log("   4. Inside you'll find folders like: plantvillage dataset/color/");
        console.log("   5. Copy only these class folders into:\n");
        console.log(`      ${DATASET_PATH}\n`);
        console.log("   Required folder structure:\n");
        console.log("   dataset/");
        for (const cls of requiredClasses) {
            console.log(`     └── ${cls}/`);
            console.log(`         └── (contains .jpg images)`);
        }

        console.log(`\n${"═".repeat(55)}`);
        console.log("\n   OPTION 2: Kaggle CLI\n");
        console.log("   pip install kaggle");
        console.log("   kaggle datasets download -d abdallahalidev/plantvillage-dataset");
        console.log(`   # Extract and copy class folders to: ${DATASET_PATH}`);

        console.log(`\n${"═".repeat(55)}`);
        console.log("\n   OPTION 3: Quick Test (Minimum 5 images per class)\n");
        console.log("   For a quick test, you can put just 5-10 images per class.");
        console.log("   Search Google Images for each disease and save a few JPGs.");
        console.log("   Example: search 'tomato early blight leaf' and save images to:");
        console.log(`   ${path.join(DATASET_PATH, "Tomato___Early_blight")}\n`);

    } else {
        console.log("\n🎉 All classes found! You're ready to train.\n");
        console.log("   Run: node train.js\n");
    }
}

checkDataset();
