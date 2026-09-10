const { Pool } = require("pg");
const dotenv = require("dotenv");

dotenv.config();

// Construct Postgres Pool Configuration
const poolConfig = process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_URL.includes("localhost") || process.env.DATABASE_URL.includes("127.0.0.1")
            ? false
            : { rejectUnauthorized: false }
    }
    : {
        user: process.env.PG_USER || "postgres",
        host: process.env.PG_HOST || "localhost",
        database: process.env.PG_DATABASE || "agri_ai",
        password: process.env.PG_PASSWORD || "postgres",
        port: parseInt(process.env.PG_PORT || "5432", 10),
    };

const pool = new Pool(poolConfig);

let isPostgresConnected = false;

/**
 * Initialize PostgreSQL and ensure essential tables exist
 */
async function initPostgres() {
    try {
        const client = await pool.connect();
        isPostgresConnected = true;
        console.log("🐘 PostgreSQL Connected Successfully!");

        // Auto-create users table if not exists
        const createUsersTableQuery = `
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                phone_or_email VARCHAR(100) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                role VARCHAR(20) DEFAULT 'farmer',
                state VARCHAR(50) DEFAULT 'Maharashtra',
                district VARCHAR(50),
                village VARCHAR(50),
                preferred_language VARCHAR(10) DEFAULT 'mr',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `;

        await client.query(createUsersTableQuery);
        console.log("   ✅ PostgreSQL [users] table verified & ready");
        client.release();
    } catch (err) {
        isPostgresConnected = false;
        console.warn("⚠️  PostgreSQL Connection Warning:", err.message);
        console.warn("   ℹ️  Please ensure PostgreSQL is running or set valid DATABASE_URL in backend/.env");
    }
}

/**
 * Safe query helper
 */
async function query(text, params) {
    try {
        return await pool.query(text, params);
    } catch (err) {
        if (err.code === "ECONNREFUSED" || err.message.includes("Connection terminated") || err.message.includes("connect")) {
            isPostgresConnected = false;
            throw new Error(`PostgreSQL is not reachable (${err.message}). Check if PostgreSQL service is running or provide DATABASE_URL in backend/.env.`);
        }
        if (err.code === "28P01") {
            throw new Error(`PostgreSQL Authentication Failed: Invalid password for user in backend/.env.`);
        }
        if (err.code === "3D000") {
            throw new Error(`PostgreSQL Database "${process.env.PG_DATABASE || 'agri_ai'}" does not exist. Please create it or change PG_DATABASE to "postgres" in backend/.env.`);
        }
        throw err;
    }
}

module.exports = {
    pool,
    query,
    initPostgres,
    isPostgresConnected: () => isPostgresConnected
};
