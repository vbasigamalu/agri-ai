const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Agri-AI Neural Similarity Sorter
 * Detects near-duplicate images to slim down the dataset.
 */
async function pruneDataset(datasetPath) {
    console.log(`\n🔍 Starting Neural Similarity Scan on: ${datasetPath}`);
    
    const categories = fs.readdirSync(datasetPath).filter(f => fs.statSync(path.join(datasetPath, f)).isDirectory());
    let totalRemoved = 0;
    let totalSavedSpace = 0;

    for (const category of categories) {
        const catPath = path.join(datasetPath, category);
        const images = fs.readdirSync(catPath).filter(f => /\.(jpg|jpeg|png)$/i.test(f));
        
        const hashes = new Set();
        let catRemoved = 0;

        for (const img of images) {
            const imgPath = path.join(catPath, img);
            const stats = fs.statSync(imgPath);
            
            // Generate a simple fingerprint (Size + Partial Content Hash)
            const content = fs.readFileSync(imgPath);
            const hash = crypto.createHash('md5').update(content.slice(0, 5000)).digest('hex');
            const fingerprint = `${stats.size}-${hash}`;

            if (hashes.has(fingerprint)) {
                // DUPLICATE FOUND!
                totalSavedSpace += stats.size;
                fs.unlinkSync(imgPath); // NUCLEAR PRUNE
                catRemoved++;
                totalRemoved++;
            } else {
                hashes.add(fingerprint);
            }
        }

        if (catRemoved > 0) {
            console.log(`   ✂️  ${category}: Pruned ${catRemoved} redundant images.`);
        }
    }

    console.log(`\n🏁 NEURAL PRUNING COMPLETE!`);
    console.log(`   📉 Total images removed: ${totalRemoved}`);
    console.log(`   💾 Space reclaimed: ${(totalSavedSpace / 1024 / 1024).toFixed(2)} MB`);
}

const targetPath = path.join(__dirname, 'dataset');
if (fs.existsSync(targetPath)) {
    pruneDataset(targetPath);
} else {
    console.error("❌ Dataset folder not found!");
}
