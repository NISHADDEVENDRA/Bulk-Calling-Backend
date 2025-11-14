"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const deepgramConnectionPool_service_1 = require("../services/deepgramConnectionPool.service");
const websocket_server_1 = require("../realtime/realtime.server");
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
/**
 * GET /api/stats
 * Get system statistics including connection pool status
 */
router.get('/', async (req, res) => {
    try {
        const poolStats = deepgramConnectionPool_service_1.deepgramConnectionPool.getStats();
        const activeConnections = websocket_server_1.wsManager?.getClientCount() || 0;
        const stats = {
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            memory: {
                used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
                total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
                rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
                unit: 'MB'
            },
            activeCalls: activeConnections,
            deepgramPool: {
                active: poolStats.active,
                queued: poolStats.queued,
                capacity: poolStats.capacity,
                utilization: Math.round(poolStats.utilization * 100) / 100,
                totalAcquired: poolStats.totalAcquired,
                totalReleased: poolStats.totalReleased,
                totalQueued: poolStats.totalQueued,
                totalTimeout: poolStats.totalTimeout,
                totalFailed: poolStats.totalFailed,
                status: getPoolStatus(poolStats.utilization)
            }
        };
        logger_1.logger.debug('Stats requested', stats);
        res.json(stats);
    }
    catch (error) {
        logger_1.logger.error('Failed to get stats', {
            error: error.message
        });
        res.status(500).json({
            error: 'Failed to retrieve system statistics',
            message: error.message
        });
    }
});
/**
 * GET /api/stats/pool
 * Get detailed Deepgram connection pool statistics
 */
router.get('/pool', async (req, res) => {
    try {
        const poolStats = deepgramConnectionPool_service_1.deepgramConnectionPool.getStats();
        res.json({
            timestamp: new Date().toISOString(),
            pool: poolStats,
            status: getPoolStatus(poolStats.utilization),
            warnings: getPoolWarnings(poolStats)
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to get pool stats', {
            error: error.message
        });
        res.status(500).json({
            error: 'Failed to retrieve pool statistics',
            message: error.message
        });
    }
});
/**
 * Determine pool status based on utilization
 */
function getPoolStatus(utilization) {
    if (utilization < 50)
        return 'healthy';
    if (utilization < 75)
        return 'moderate';
    if (utilization < 90)
        return 'high';
    return 'critical';
}
/**
 * Generate warnings based on pool stats
 */
function getPoolWarnings(stats) {
    const warnings = [];
    if (stats.utilization > 90) {
        warnings.push('Pool utilization critical (>90%) - consider scaling');
    }
    else if (stats.utilization > 75) {
        warnings.push('Pool utilization high (>75%) - monitor closely');
    }
    if (stats.queued > 10) {
        warnings.push(`${stats.queued} requests queued - experiencing high load`);
    }
    if (stats.totalTimeout > 0) {
        const timeoutRate = (stats.totalTimeout / stats.totalAcquired) * 100;
        if (timeoutRate > 5) {
            warnings.push(`High timeout rate (${Math.round(timeoutRate)}%) - pool may be undersized`);
        }
    }
    if (stats.totalFailed > 0) {
        const failureRate = (stats.totalFailed / (stats.totalAcquired + stats.totalFailed)) * 100;
        if (failureRate > 5) {
            warnings.push(`High failure rate (${Math.round(failureRate)}%) - check Deepgram service`);
        }
    }
    return warnings;
}
exports.default = router;
//# sourceMappingURL=stats.routes.js.map
