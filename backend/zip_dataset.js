/**
 * ZIP_DATASET.JS
 * Use this to prepare your dataset for Google Colab.
 * It takes 100 images from each of the 38 classes and zips them.
 */

const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const DATASET_DIR = path.join(__dirname, 'dataset');
const OUTPUT_ZIP = path.join(__dirname, 'dataset.zip');
const IMAGES_PER_CLASS = 100;

async function zipDataset() {
    console.log('📦 Starting to ZIP dataset for Colab...');
    
    if (!fs.existsSync(DATASET_DIR)) {
        console.error('❌ Error: dataset folder not found at ' + DATASET_DIR);
        return;
    }

    const output = fs.createWriteStream(OUTPUT_ZIP);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => {
        console.log(`\n✅ Done! ZIP file created: ${OUTPUT_ZIP}`);
        console.log(`📊 Total size: ${(archive.pointer() / 1024 / 1024).toFixed(2)} MB`);
        console.log('\n🚀 NEXT STEPS:');
        console.log('1. Go to https://colab.research.google.com/');
        console.log('2. Create a NEW Notebook.');
        console.log('3. Upload "dataset.zip" to the Colab files tab.');
        console.log('4. Copy and paste the Colab script I provided into a cell and click RUN.');
    });

    archive.on('error', (err) => { throw err; });
    archive.pipe(output);

    const classes = fs.readdirSync(DATASET_DIR).filter(f => 
        fs.statSync(path.join(DATASET_DIR, f)).isDirectory()
    );

    console.log(`📂 Found ${classes.length} classes.`);

    for (const className of classes) {
        const classPath = path.join(DATASET_DIR, className);
        const files = fs.readdirSync(classPath).filter(f => 
            f.toLowerCase().endsWith('.jpg') || f.toLowerCase().endsWith('.jpeg') || f.toLowerCase().endsWith('.png')
        );

        const count = Math.min(files.length, IMAGES_PER_CLASS);
        process.stdout.write(`   Adding ${className} (${count} images)...`);
        
        for (let i = 0; i < count; i++) {
            const fileName = files[i];
            const filePath = path.join(classPath, fileName);
            archive.file(filePath, { name: path.join('dataset', className, fileName) });
        }
        process.stdout.write(' ✅\n');
    }

    console.log('\n🤐 Finalizing ZIP... (this might take a minute)');
    await archive.finalize();
}

zipDataset().catch(err => console.error('❌ ZIP failed:', err));
