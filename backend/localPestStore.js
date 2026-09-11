/**
 * localPestStore.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Resilient JSON-based Local Storage for Pest Monitoring & Forecasting Logs
 * Used as an instant fallback when MongoDB is offline or disconnected.
 * Guarantees zero latency and persistent multi-day monitoring history.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "data");
const PEST_FILE = path.join(DATA_DIR, "local_pest_logs.json");

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Ensure local_pest_logs.json exists
if (!fs.existsSync(PEST_FILE)) {
    fs.writeFileSync(PEST_FILE, JSON.stringify([], null, 2), "utf-8");
}

function readLogs() {
    try {
        const data = fs.readFileSync(PEST_FILE, "utf-8");
        return JSON.parse(data || "[]");
    } catch (e) {
        return [];
    }
}

function writeLogs(logs) {
    try {
        fs.writeFileSync(PEST_FILE, JSON.stringify(logs, null, 2), "utf-8");
    } catch (e) {
        console.error("Failed to write to local_pest_logs.json:", e);
    }
}

function saveLog(logData) {
    const logs = readLogs();
    const newEntry = {
        _id: "pest_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
        ...logData,
        timestamp: new Date().toISOString()
    };
    logs.unshift(newEntry);
    
    // Keep last 100 entries
    if (logs.length > 100) {
        logs.length = 100;
    }

    writeLogs(logs);
    return newEntry;
}

function getLogs(filter = {}) {
    const logs = readLogs();
    if (filter.userId && filter.userId !== "guest") {
        return logs.filter(l => l.userId === filter.userId);
    }
    return logs;
}

module.exports = {
    saveLog,
    getLogs
};
