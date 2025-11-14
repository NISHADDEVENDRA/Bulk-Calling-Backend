"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.circuitBreaker = void 0;
const redis_1 = require("../config/redis");
const logger_1 = require("./logger");
const ttls_1 = require("../config/ttls");
/**
 * Circuit Breaker Service
 * Stores state in Redis for cross-worker consistency
 * Uses sliding window of failures to determine circuit state
 */
class CircuitBreaker {
    /**
     * Record a failure for the campaign
     * Opens circuit if failures > threshold within window
     */
    async recordFailure(campaignId, threshold = 5) {
        const failKey = `campaign:{${campaignId}}:cb:fail`;
        const circuitKey = `campaign:{${campaignId}}:circuit`;
        const failures = await redis_1.redisClient.incr(failKey);
        await redis_1.redisClient.expire(failKey, ttls_1.TTL_CONFIG.circuitBreakerWindow);
        if (failures > threshold) {
            await redis_1.redisClient.setEx(circuitKey, ttls_1.TTL_CONFIG.circuitBreakerTTL, 'open');
            logger_1.logger.error('🚨 Circuit breaker OPEN', { campaignId, failures });
        }
    }
    /**
     * Check if circuit is open
     */
    async isOpen(campaignId) {
        const circuitKey = `campaign:{${campaignId}}:circuit`;
        const state = await redis_1.redisClient.get(circuitKey);
        return state === 'open';
    }
    /**
     * Record a success - decrements failure counter
     */
    async recordSuccess(campaignId) {
        const failKey = `campaign:{${campaignId}}:cb:fail`;
        const circuitKey = `campaign:{${campaignId}}:circuit`;
        const failures = await redis_1.redisClient.decr(failKey);
        if (failures <= 0) {
            await redis_1.redisClient.del(failKey);
            await redis_1.redisClient.del(circuitKey);
        }
    }
    /**
     * Get adjusted batch size based on circuit state
     * Reduces batch when circuit is open to prevent overload
     */
    async getBatchSize(campaignId, defaultSize = 50) {
        const circuitKey = `campaign:{${campaignId}}:circuit`;
        const state = await redis_1.redisClient.get(circuitKey);
        if (state === 'open') {
            return Math.max(1, Math.floor(defaultSize / 4)); // 25% capacity
        }
        return defaultSize;
    }
}
exports.circuitBreaker = new CircuitBreaker();
//# sourceMappingURL=circuitBreaker.js.map
