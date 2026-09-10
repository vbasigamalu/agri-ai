const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "agri_ai_super_secret_jwt_key_sih_2026";

/**
 * Middleware to authenticate requests using JWT
 */
function authenticateToken(req, res, next) {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1]; // Format: "Bearer <TOKEN>"

    if (!token) {
        return res.status(401).json({
            error: "Authentication required. Please log in.",
            code: "NO_TOKEN"
        });
    }

    jwt.verify(token, JWT_SECRET, (err, decodedUser) => {
        if (err) {
            return res.status(403).json({
                error: "Session expired or invalid token. Please log in again.",
                code: "INVALID_TOKEN"
            });
        }
        req.user = decodedUser;
        next();
    });
}

/**
 * Optional authentication middleware (attaches user if token provided, but doesn't block guests)
 */
function optionalAuth(req, res, next) {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
        req.user = null;
        return next();
    }

    jwt.verify(token, JWT_SECRET, (err, decodedUser) => {
        if (!err && decodedUser) {
            req.user = decodedUser;
        } else {
            req.user = null;
        }
        next();
    });
}

/**
 * Role-based access control middleware
 * @param {string[]} allowedRoles Array of allowed roles e.g. ['officer', 'expert']
 */
function requireRole(allowedRoles = []) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: "Access denied. Authentication required." });
        }
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                error: `Access forbidden: Requires one of the following roles [${allowedRoles.join(", ")}]`,
                userRole: req.user.role
            });
        }
        next();
    };
}

module.exports = {
    JWT_SECRET,
    authenticateToken,
    optionalAuth,
    requireRole
};
