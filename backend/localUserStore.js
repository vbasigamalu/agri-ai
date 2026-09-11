/**
 * localUserStore.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Resilient JSON-based Local User Storage
 * Used automatically as a fallback when PostgreSQL is offline or not installed.
 * Guarantees that Farmer Registration & Login always work smoothly.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "data");
const USERS_FILE = path.join(DATA_DIR, "local_users.json");

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Ensure local_users.json exists
if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify([], null, 2), "utf-8");
}

function readUsers() {
    try {
        const data = fs.readFileSync(USERS_FILE, "utf-8");
        return JSON.parse(data || "[]");
    } catch (e) {
        return [];
    }
}

function writeUsers(users) {
    try {
        fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf-8");
    } catch (e) {
        console.error("Failed to write to local_users.json:", e);
    }
}

function findUserByIdentifier(identifier) {
    const users = readUsers();
    const clean = identifier.trim().toLowerCase();
    return users.find(u => u.phone_or_email && u.phone_or_email.toLowerCase() === clean);
}

function createUser(userData) {
    const users = readUsers();
    const cleanIdentifier = userData.phone_or_email.trim().toLowerCase();

    // Check duplicate
    const existing = users.find(u => u.phone_or_email && u.phone_or_email.toLowerCase() === cleanIdentifier);
    if (existing) {
        throw new Error("User with this Phone/Email already exists. Please login instead.");
    }

    const newUser = {
        id: "local_" + Date.now(),
        name: userData.name.trim(),
        phone_or_email: cleanIdentifier,
        password_hash: userData.password_hash,
        role: userData.role || "farmer",
        state: userData.state || "Maharashtra",
        district: userData.district || "",
        village: userData.village || "",
        preferred_language: userData.preferred_language || "mr",
        created_at: new Date().toISOString()
    };

    users.push(newUser);
    writeUsers(users);
    return newUser;
}

module.exports = {
    findUserByIdentifier,
    createUser
};
