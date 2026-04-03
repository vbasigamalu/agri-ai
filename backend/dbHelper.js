const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '.db', 'history.json');


// Helper to read the database
function readDB() {
    try {
        if (!fs.existsSync(DB_PATH)) {
            fs.writeFileSync(DB_PATH, JSON.stringify([]), 'utf8');
            return [];
        }
        const data = fs.readFileSync(DB_PATH, 'utf8');
        return JSON.parse(data) || [];
    } catch (err) {
        console.error("Error reading database:", err);
        return [];
    }
}

// Helper to write to the database
function writeDB(data) {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (err) {
        console.error("Error writing database:", err);
        return false;
    }
}

// Helper to add a record
function addRecord(record) {
    const data = readDB();
    data.push({
        id: Date.now(),
        ...record,
        timestamp: new Date().toISOString()
    });
    return writeDB(data);
}

module.exports = {
    readDB,
    writeDB,
    addRecord
};
