/**
 * backend/config/redis.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Redis Client & Connection Manager with Resilient In-Memory Fallback
 * ─────────────────────────────────────────────────────────────────────────────
 */

let Redis = null;
try {
    Redis = require("ioredis");
} catch {
    // ioredis not installed, gracefully fallback to in-memory cache
}

let redisClient = null;
let isRedisAvailable = false;

const inMemoryCache = new Map();

try {
    if (Redis) {
        const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";
        redisClient = new Redis(redisUrl, {
            maxRetriesPerRequest: 1,
            retryStrategy: () => null, // Do not spam retries if offline
            enableOfflineQueue: false,
            connectTimeout: 2000
        });

        redisClient.on("connect", () => {
            isRedisAvailable = true;
            console.log("⚡ [Redis] Connected successfully for Caching & Queue Management");
        });

        redisClient.on("error", () => {
            isRedisAvailable = false;
        });
    }
} catch {
    isRedisAvailable = false;
}

/**
 * Resilient Cache Get
 */
async function getCache(key) {
    if (isRedisAvailable && redisClient) {
        try {
            const val = await redisClient.get(key);
            return val ? JSON.parse(val) : null;
        } catch {
            return inMemoryCache.get(key) || null;
        }
    }
    return inMemoryCache.get(key) || null;
}

/**
 * Resilient Cache Set
 */
async function setCache(key, value, ttlSeconds = 3600) {
    inMemoryCache.set(key, value);
    if (isRedisAvailable && redisClient) {
        try {
            await redisClient.set(key, JSON.stringify(value), "EX", ttlSeconds);
        } catch {
            // Ignore Redis write failure, in-memory cache holds it
        }
    }
}

module.exports = {
    redisClient,
    isRedisAvailable: () => isRedisAvailable,
    getCache,
    setCache
};
