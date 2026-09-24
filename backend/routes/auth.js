const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { query, isPostgresConnected } = require("../postgres");
const { JWT_SECRET, authenticateToken } = require("../middleware/auth");
const localStore = require("../localUserStore");

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

        const rawIdentifier = (phone_or_email || req.body.identifier || req.body.email || req.body.phone || "").toString().trim();

        // 1. Validation
        if (!name || !name.toString().trim()) {
            return res.status(400).json({ 
                success: false, 
                error: "Name is required (नाव आवश्यक आहे).", 
                message: "Name is required (नाव आवश्यक आहे)." 
            });
        }
        if (!rawIdentifier) {
            return res.status(400).json({ 
                success: false, 
                error: "Phone number or Email is required (मोबाईल नंबर किंवा ईमेल आवश्यक आहे).", 
                message: "Phone number or Email is required (मोबाईल नंबर किंवा ईमेल आवश्यक आहे)." 
            });
        }
        if (!password || password.length < 6) {
            return res.status(400).json({ 
                success: false, 
                error: "Password must be at least 6 characters (पासवर्ड किमान ६ अक्षरांचा असावा).", 
                message: "Password must be at least 6 characters (पासवर्ड किमान ६ अक्षरांचा असावा)." 
            });
        }

        const cleanIdentifier = rawIdentifier.toLowerCase();

        // Password Hashing using bcrypt
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        let user = null;

        // Try PostgreSQL first
        try {
            const existingUserRes = await query(
                "SELECT id FROM users WHERE LOWER(phone_or_email) = $1 LIMIT 1",
                [cleanIdentifier]
            );

            if (existingUserRes.rows.length > 0) {
                return res.status(409).json({
                    success: false,
                    error: "User with this Phone/Email already exists. Please login instead. (या नंबर/ईमेलसह खाते आधीच उपलब्ध आहे. कृपया लॉगिन करा.)",
                    message: "User with this Phone/Email already exists. Please login instead. (या नंबर/ईमेलसह खाते आधीच उपलब्ध आहे. कृपया लॉगिन करा.)"
                });
            }

            const insertQuery = `
                INSERT INTO users (name, phone_or_email, password_hash, role, state, district, village, preferred_language)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING id, name, phone_or_email, role, state, district, village, preferred_language, created_at;
            `;
            const newUserRes = await query(insertQuery, [
                name.toString().trim(),
                cleanIdentifier,
                password_hash,
                role || "farmer",
                (state || "Maharashtra").toString().trim(),
                (district || "").toString().trim(),
                (village || "").toString().trim(),
                preferred_language || "mr"
            ]);
            user = newUserRes.rows[0];

        } catch (dbErr) {
            if (dbErr.code === "23505" || (dbErr.message && dbErr.message.includes("unique constraint"))) {
                return res.status(409).json({
                    success: false,
                    error: "User with this Phone/Email already exists. Please login instead.",
                    message: "User with this Phone/Email already exists. Please login instead."
                });
            }
            console.warn("⚠️ PostgreSQL offline or error, saving user to local store fallback:", dbErr.message);
            // Fallback to local file store
            try {
                user = localStore.createUser({
                    name: name.toString().trim(),
                    phone_or_email: cleanIdentifier,
                    password_hash,
                    role: role || "farmer",
                    state: state || "Maharashtra",
                    district: district || "",
                    village: village || "",
                    preferred_language: preferred_language || "mr"
                });
            } catch (localErr) {
                return res.status(409).json({ 
                    success: false, 
                    error: localErr.message, 
                    message: localErr.message 
                });
            }
        }

        // Generate JWT Token
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

        const safeUser = { ...user };
        delete safeUser.password_hash;

        res.status(201).json({
            success: true,
            message: "Registration successful! (नोंदणी यशस्वी झाली!)",
            token,
            user: safeUser
        });

    } catch (err) {
        console.error("Registration Error:", err);
        res.status(500).json({ 
            success: false, 
            error: err.message || "Failed to register user.", 
            message: err.message || "Failed to register user." 
        });
    }
});

/**
 * 🔑 FARMER & USER LOGIN
 * Route: POST /api/auth/login
 */
router.post("/login", async (req, res) => {
    try {
        const { phone_or_email, password } = req.body;
        const rawIdentifier = (phone_or_email || req.body.identifier || req.body.email || req.body.phone || "").toString().trim();

        // 1. Validation
        if (!rawIdentifier) {
            return res.status(400).json({ 
                success: false, 
                error: "Phone number or Email is required (मोबाईल नंबर किंवा ईमेल प्रविष्ट करा).", 
                message: "Phone number or Email is required (मोबाईल नंबर किंवा ईमेल प्रविष्ट करा)." 
            });
        }
        if (!password) {
            return res.status(400).json({ 
                success: false, 
                error: "Password is required (पासवर्ड प्रविष्ट करा).", 
                message: "Password is required (पासवर्ड प्रविष्ट करा)." 
            });
        }

        const cleanIdentifier = rawIdentifier.toLowerCase();
        let user = null;

        // Try PostgreSQL first
        try {
            const userRes = await query(
                "SELECT id, name, phone_or_email, password_hash, role, state, district, village, preferred_language, created_at FROM users WHERE LOWER(phone_or_email) = $1 LIMIT 1",
                [cleanIdentifier]
            );

            if (userRes.rows.length > 0) {
                user = userRes.rows[0];
            }
        } catch (dbErr) {
            console.warn("⚠️ PostgreSQL offline, checking local store fallback:", dbErr.message);
        }

        // Check local store fallback if not found in PG
        if (!user) {
            user = localStore.findUserByIdentifier(cleanIdentifier);
        }

        if (!user) {
            return res.status(401).json({
                success: false,
                error: "Invalid Phone/Email or Password. (चुकीचा मोबाईल/ईमेल किंवा पासवर्ड.)",
                message: "Invalid Phone/Email or Password. (चुकीचा मोबाईल/ईमेल किंवा पासवर्ड.)"
            });
        }

        // Verify password using bcrypt.compare
        const isPasswordMatch = await bcrypt.compare(password, user.password_hash);
        if (!isPasswordMatch) {
            return res.status(401).json({
                success: false,
                error: "Invalid Phone/Email or Password. (चुकीचा मोबाईल/ईमेल किंवा पासवर्ड.)",
                message: "Invalid Phone/Email or Password. (चुकीचा मोबाईल/ईमेल किंवा पासवर्ड.)"
            });
        }

        // Generate JWT Token
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
        const safeUser = { ...user };
        delete safeUser.password_hash;

        console.log(`🔐 Farmer Logged In: [${user.name}] (${user.phone_or_email})`);

        res.json({
            success: true,
            message: "Login successful! (लॉगिन यशस्वी झाले!)",
            token,
            user: safeUser
        });

    } catch (err) {
        console.error("Login Error:", err);
        res.status(500).json({ 
            success: false, 
            error: err.message || "Failed to log in.", 
            message: err.message || "Failed to log in." 
        });
    }
});

/**
 * 👤 CURRENT AUTHENTICATED USER PROFILE
 * Route: GET /api/auth/me
 */
router.get("/me", authenticateToken, async (req, res) => {
    try {
        let user = null;
        try {
            const userRes = await query(
                "SELECT id, name, phone_or_email, role, state, district, village, preferred_language, created_at FROM users WHERE id = $1 LIMIT 1",
                [req.user.id]
            );
            if (userRes.rows.length > 0) {
                user = userRes.rows[0];
            }
        } catch (dbErr) {
            // Offline fallback
        }

        if (!user && req.user.phone_or_email) {
            user = localStore.findUserByIdentifier(req.user.phone_or_email);
        }

        if (!user) {
            // Construct from token payload
            user = {
                id: req.user.id,
                name: req.user.name,
                phone_or_email: req.user.phone_or_email,
                role: req.user.role || "farmer",
                district: req.user.district || "",
                village: req.user.village || ""
            };
        }

        const safeUser = { ...user };
        delete safeUser.password_hash;

        res.json({ user: safeUser });
    } catch (err) {
        console.error("Fetch Profile Error:", err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * ⚙️ UPDATE PROFILE
 * Route: PUT /api/auth/profile
 */
router.put("/profile", authenticateToken, async (req, res) => {
    try {
        const { name, district, village, preferred_language } = req.body;

        try {
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

            return res.json({
                message: "Profile updated successfully (प्रोफाइल अपडेट केले).",
                user: updatedRes.rows[0]
            });
        } catch (dbErr) {
            // Return updated token user representation
            return res.json({
                message: "Profile updated successfully (offline mode).",
                user: {
                    ...req.user,
                    name: name || req.user.name,
                    district: district || req.user.district,
                    village: village || req.user.village
                }
            });
        }
    } catch (err) {
        console.error("Profile Update Error:", err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
