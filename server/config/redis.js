"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cacheService = exports.CacheService = exports.buildBullRedisConfig = exports.buildIORedisOptions = exports.getRedisConnectionInfo = exports.disconnectRedis = exports.connectRedis = exports.redisClient = exports.redis = void 0;
const redis_1 = require("redis");
const env_1 = require("./env");
const logger_1 = require("../utils/logger");
const DEFAULT_REDIS_URL = env_1.env.REDIS_URL || 'redis://localhost:6379';
/**
 * Parse REDIS_URL and derive normalized connection details.
 * Supports Upstash (rediss://) and classic redis:// URLs.
 */
const parseRedisUrl = (rawUrl) => {
    try {
        const parsed = new URL(rawUrl);
        const isTls = parsed.protocol === 'rediss:';
        const dbPath = parsed.pathname?.replace(/^\//, '') || '';
        const dbNumber = dbPath ? parseInt(dbPath, 10) : 0;
        const shouldRejectUnauthorized = (process.env.REDIS_TLS_REJECT_UNAUTHORIZED ?? 'true') !== 'false';
        return {
            url: rawUrl,
            host: parsed.hostname || 'localhost',
            port: parsed.port ? parseInt(parsed.port, 10) : (isTls ? 6380 : 6379),
            username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
            password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
            db: Number.isNaN(dbNumber) ? 0 : dbNumber,
            isTls,
            provider: parsed.hostname?.includes('upstash.io') ? 'upstash' : 'generic',
            rejectUnauthorized: shouldRejectUnauthorized
        };
    }
    catch (error) {
        logger_1.logger.error('Invalid REDIS_URL provided, falling back to localhost', {
            error,
            rawUrl
        });
        return {
            url: 'redis://localhost:6379',
            host: 'localhost',
            port: 6379,
            db: 0,
            isTls: false,
            provider: 'generic',
            rejectUnauthorized: true
        };
    }
};
const derivedConnection = parseRedisUrl(DEFAULT_REDIS_URL);
// Populate legacy env vars so existing Bull/BullMQ configs pick up the derived host & port
if (!process.env.REDIS_HOST) {
    process.env.REDIS_HOST = derivedConnection.host;
}
if (!process.env.REDIS_PORT) {
    process.env.REDIS_PORT = String(derivedConnection.port);
}
if (!process.env.REDIS_DB) {
    process.env.REDIS_DB = String(derivedConnection.db ?? 0);
}
if (derivedConnection.password && !process.env.REDIS_PASSWORD) {
    process.env.REDIS_PASSWORD = derivedConnection.password;
}
if (derivedConnection.username && !process.env.REDIS_USERNAME) {
    process.env.REDIS_USERNAME = derivedConnection.username;
}
logger_1.logger.info('Redis configuration loaded', {
    provider: derivedConnection.provider,
    host: derivedConnection.host,
    port: derivedConnection.port,
    tls: derivedConnection.isTls
});
// Helpers for other modules (Bull, BullMQ, etc.)
const getRedisConnectionInfo = () => ({
    host: derivedConnection.host,
    port: derivedConnection.port,
    db: derivedConnection.db ?? 0,
    isTls: derivedConnection.isTls,
    provider: derivedConnection.provider,
    username: derivedConnection.username
});
exports.getRedisConnectionInfo = getRedisConnectionInfo;
const buildIORedisOptions = (overrides = {}) => {
    const baseOptions = {
        host: derivedConnection.host,
        port: derivedConnection.port,
        username: derivedConnection.username,
        password: derivedConnection.password,
        db: derivedConnection.db ?? 0,
        tls: derivedConnection.isTls
            ? {
                rejectUnauthorized: derivedConnection.rejectUnauthorized
            }
            : undefined
    };
    // If the caller passed a tls override, respect it, otherwise keep the base
    if (overrides.tls === undefined && baseOptions.tls === undefined) {
        return {
            ...baseOptions,
            ...overrides
        };
    }
    return {
        ...baseOptions,
        ...overrides,
        tls: overrides.tls ?? baseOptions.tls
    };
};
exports.buildIORedisOptions = buildIORedisOptions;
const buildBullRedisConfig = () => {
    const config = {
        host: derivedConnection.host,
        port: derivedConnection.port,
        password: derivedConnection.password,
        username: derivedConnection.username,
        db: derivedConnection.db ?? 0
    };
    if (derivedConnection.isTls) {
        config.tls = {
            rejectUnauthorized: derivedConnection.rejectUnauthorized
        };
    }
    return config;
};
exports.buildBullRedisConfig = buildBullRedisConfig;
// Create Redis client
exports.redis = (0, redis_1.createClient)({
    url: derivedConnection.url,
    username: derivedConnection.username,
    password: derivedConnection.password,
    database: derivedConnection.db,
    socket: derivedConnection.isTls
        ? {
            tls: true,
            rejectUnauthorized: derivedConnection.rejectUnauthorized
        }
        : undefined
});
// Alias for backward compatibility
exports.redisClient = exports.redis;
// Event handlers
exports.redis.on('error', (err) => {
    logger_1.logger.error('Redis error', { error: err });
});
exports.redis.on('connect', () => {
    logger_1.logger.info('Redis connecting...');
});
exports.redis.on('ready', () => {
    logger_1.logger.info('Redis connected successfully');
});
exports.redis.on('reconnecting', () => {
    logger_1.logger.warn('Redis reconnecting...');
});
exports.redis.on('end', () => {
    logger_1.logger.info('Redis connection closed');
});
// Connect to Redis
const connectRedis = async () => {
    try {
        await exports.redis.connect();
    }
    catch (error) {
        logger_1.logger.error('Redis connection failed', { error });
        throw error;
    }
};
exports.connectRedis = connectRedis;
// Disconnect from Redis
const disconnectRedis = async () => {
    try {
        await exports.redis.quit();
    }
    catch (error) {
        logger_1.logger.error('Error closing Redis connection', { error });
    }
};
exports.disconnectRedis = disconnectRedis;
// Cache helper class
class CacheService {
    /**
     * Get value from cache
     */
    async get(key) {
        try {
            const data = await exports.redis.get(key);
            return data ? JSON.parse(data) : null;
        }
        catch (error) {
            logger_1.logger.error('Cache get error', { error, key });
            return null;
        }
    }
    /**
     * Set value in cache
     */
    async set(key, value, ttl) {
        try {
            const data = JSON.stringify(value);
            if (ttl) {
                await exports.redis.setEx(key, ttl, data);
            }
            else {
                await exports.redis.set(key, data);
            }
        }
        catch (error) {
            logger_1.logger.error('Cache set error', { error, key });
        }
    }
    /**
     * Delete value from cache
     */
    async del(key) {
        try {
            await exports.redis.del(key);
        }
        catch (error) {
            logger_1.logger.error('Cache delete error', { error, key });
        }
    }
    /**
     * Check if key exists
     */
    async exists(key) {
        try {
            return (await exports.redis.exists(key)) === 1;
        }
        catch (error) {
            logger_1.logger.error('Cache exists error', { error, key });
            return false;
        }
    }
    /**
     * Clear all keys matching pattern
     */
    async clearPattern(pattern) {
        try {
            const keys = await exports.redis.keys(pattern);
            if (keys.length > 0) {
                await exports.redis.del(keys);
            }
        }
        catch (error) {
            logger_1.logger.error('Cache clear pattern error', { error, pattern });
        }
    }
}
exports.CacheService = CacheService;
exports.cacheService = new CacheService();
//# sourceMappingURL=redis.js.map
