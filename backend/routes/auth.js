const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { query } = require("../postgres");
const { JWT_SECRET, authenticateToken } = require("../middleware/auth");

const router = express.Router();

/**
 * 📝 FARMER & USER REGISTRATION
 * Route: POST /api/auth/register
 */
router.post("/register", async (req, res) => {
    try {
        const {
            name,
            phone_or_email,
            password,
            role = "farmer",
            state = "Maharashtra",
            district = "",
            village = "",
            preferred_language = "mr"
        } = req.body;

        // 1. Validation
        if (!name || !name.trim()) {
            return res.status(400).json({ error: "Name is required (नाव आवश्यक आहे)." });
        }
        if (!phone_or_email || !phone_or_email.trim()) {
            return res.status(400).json({ error: "Phone number or Email is required (मोबाईल नंबर किंवा ईमेल आवश्यक आहे)." });
        }
        if (!password || password.length < 6) {
            return res.status(400).json({ error: "Password must be at least 6 characters (पासवर्ड किमान ६ अक्षरांचा असावा)." });
        }

        const cleanIdentifier = phone_or_email.trim().toLowerCase();

        // 2. Check if user already exists
        const existingUserRes = await query(
            "SELECT id FROM users WHERE LOWER(phone_or_email) = $1 LIMIT 1",
            [cleanIdentifier]
        );

        if (existingUserRes.rows.length > 0) {
            return res.status(409).json({
                error: "User with this Phone/Email already exists. Please login instead. (या नंबर/ईमेलसह खाते आधीच उपलब्ध आहे. कृपया लॉगिन करा.)"
            });
        }

        // 3. Password Hashing using bcrypt
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        // 4. Insert user into PostgreSQL
        const insertQuery = `
            INSERT INTO users (name, phone_or_email, password_hash, role, state, district, village, preferred_language)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id, name, phone_or_email, role, state, district, village, preferred_language, created_at;
        `;
        const newUserRes = await query(insertQuery, [
            name.trim(),
            cleanIdentifier,
            password_hash,
            role,
            state.trim(),
            district.trim(),
            village.trim(),
            preferred_language
        ]);

        const user = newUserRes.rows[0];

        // 5. Generate JWT Token
        const tokenPayload = {
            id: user.id,
            name: user.name,
            phone_or_email: user.phone_or_email,
            role: user.role,
            preferred_language: user.preferred_language,
            district: user.district,
            village: user.village
        };

        const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: "7d" });

        console.log(`👤 New Farmer Registered: [${user.name}] (${user.phone_or_email}) - Role: ${user.role}`);

        res.status(201).json({
            message: "Registration successful! (नोंदणी यशस्वी झाली!)",
            token,
            user
        });

    } catch (err) {
        console.error("Registration Error:", err);
        res.status(500).json({ error: err.message || "Failed to register user." });
    }
});

/**
 * 🔑 FARMER & USER LOGIN
 * Route: POST /api/auth/login
 */
router.post("/login", async (req, res) => {
    try {
        const { phone_or_email, password } = req.body;

        // 1. Validation
        if (!phone_or_email || !phone_or_email.trim()) {
            return res.status(400).json({ error: "Phone number or Email is required (मोबाईल नंबर किंवा ईमेल प्रविष्ट करा)." });
        }
        if (!password) {
            return res.status(400).json({ error: "Password is required (पासवर्ड प्रविष्ट करा)." });
        }

        const cleanIdentifier = phone_or_email.trim().toLowerCase();

        // 2. Fetch user from PostgreSQL
        const userRes = await query(
            "SELECT id, name, phone_or_email, password_hash, role, state, district, village, preferred_language, created_at FROM users WHERE LOWER(phone_or_email) = $1 LIMIT 1",
            [cleanIdentifier]
        );

        if (userRes.rows.length === 0) {
            return res.status(401).json({
                error: "Invalid Phone/Email or Password. (चुकीचा मोबाईल/ईमेल किंवा पासवर्ड.)"
            });
        }

        const user = userRes.rows[0];

        // 3. Password verification using bcrypt.compare
        const isPasswordMatch = await bcrypt.compare(password, user.password_hash);
        if (!isPasswordMatch) {
            return res.status(401).json({
                error: "Invalid Phone/Email or Password. (चुकीचा मोबाईल/ईमेल किंवा पासवर्ड.)"
            });
        }

        // 4. Generate JWT Token
        const tokenPayload = {
            id: user.id,
            name: user.name,
            phone_or_email: user.phone_or_email,
            role: user.role,
            preferred_language: user.preferred_language,
            district: user.district,
            village: user.village
        };

        const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: "7d" });

        // Strip password_hash before returning user object
        delete user.password_hash;

        console.log(`🔐 Farmer Logged In: [${user.name}] (${user.phone_or_email})`);

        res.json({
            message: "Login successful! (लॉगिन यशस्वी झाले!)",
            token,
            user
        });

    } catch (err) {
        console.error("Login Error:", err);
        res.status(500).json({ error: err.message || "Failed to log in." });
    }
});

/**
 * 👤 CURRENT AUTHENTICATED USER PROFILE
 * Route: GET /api/auth/me
 */
router.get("/me", authenticateToken, async (req, res) => {
    try {
        const userRes = await query(
            "SELECT id, name, phone_or_email, role, state, district, village, preferred_language, created_at FROM users WHERE id = $1 LIMIT 1",
            [req.user.id]
        );

        if (userRes.rows.length === 0) {
            return res.status(404).json({ error: "User profile not found." });
        }

        res.json({ user: userRes.rows[0] });
    } catch (err) {
        console.error("Fetch Profile Error:", err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * ⚙️ UPDATE PROFILE (e.g. Language, District, Village)
 * Route: PUT /api/auth/profile
 */
router.put("/profile", authenticateToken, async (req, res) => {
    try {
        const { name, district, village, preferred_language } = req.body;

        const updateQuery = `
            UPDATE users 
            SET name = COALESCE($1, name),
                district = COALESCE($2, district),
                village = COALESCE($3, village),
                preferred_language = COALESCE($4, preferred_language),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $5
            RETURNING id, name, phone_or_email, role, state, district, village, preferred_language, updated_at;
        `;

        const updatedRes = await query(updateQuery, [
            name || null,
            district || null,
            village || null,
            preferred_language || null,
            req.user.id
        ]);

        res.json({
            message: "Profile updated successfully (प्रोफाइल अपडेट केले).",
            user: updatedRes.rows[0]
        });
    } catch (err) {
        console.error("Profile Update Error:", err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
