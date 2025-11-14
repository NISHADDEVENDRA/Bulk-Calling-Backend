"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const analytics_service_1 = require("../services/analytics.service");
const connectionPrewarming_service_1 = require("../services/connectionPrewarming.service");
const logger_1 = __importDefault(require("../utils/logger"));
const router = (0, express_1.Router)();
/**
 * Middleware: Error Handler
 */
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
/**
 * Helper: Parse time range from query params
 */
function parseTimeRange(req) {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
        return undefined;
    }
    return {
        start: new Date(startDate),
        end: new Date(endDate)
    };
}
/**
 * GET /bulk/api/analytics/dashboard
 * Get comprehensive dashboard analytics
 */
router.get('/dashboard', asyncHandler(async (req, res) => {
    const { userId } = req.query;
    const timeRange = parseTimeRange(req);
    logger_1.default.info('Getting dashboard analytics', { userId, timeRange });
    try {
        const analytics = await analytics_service_1.analyticsService.getDashboardAnalytics(userId, timeRange);
        res.status(200).json({
            success: true,
            data: analytics
        });
    }
    catch (error) {
        logger_1.default.error('Failed to get dashboard analytics', {
            error: error.message
        });
        return res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to get analytics'
            }
        });
    }
}));
/**
 * GET /bulk/api/analytics/calls
 * Get call analytics
 */
router.get('/calls', asyncHandler(async (req, res) => {
    const { userId } = req.query;
    const timeRange = parseTimeRange(req);
    logger_1.default.info('Getting call analytics', { userId, timeRange });
    try {
        const analytics = await analytics_service_1.analyticsService.getCallAnalytics(userId, timeRange);
        res.status(200).json({
            success: true,
            data: analytics
        });
    }
    catch (error) {
        logger_1.default.error('Failed to get call analytics', {
            error: error.message
        });
        return res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to get call analytics'
            }
        });
    }
}));
/**
 * GET /bulk/api/analytics/retry
 * Get retry analytics
 */
router.get('/retry', asyncHandler(async (req, res) => {
    const { userId } = req.query;
    const timeRange = parseTimeRange(req);
    logger_1.default.info('Getting retry analytics', { userId, timeRange });
    try {
        const analytics = await analytics_service_1.analyticsService.getRetryAnalytics(userId, timeRange);
        res.status(200).json({
            success: true,
            data: analytics
        });
    }
    catch (error) {
        logger_1.default.error('Failed to get retry analytics', {
            error: error.message
        });
        return res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to get retry analytics'
            }
        });
    }
}));
/**
 * GET /bulk/api/analytics/scheduling
 * Get scheduling analytics
 */
router.get('/scheduling', asyncHandler(async (req, res) => {
    const { userId } = req.query;
    const timeRange = parseTimeRange(req);
    logger_1.default.info('Getting scheduling analytics', { userId, timeRange });
    try {
        const analytics = await analytics_service_1.analyticsService.getSchedulingAnalytics(userId, timeRange);
        res.status(200).json({
            success: true,
            data: analytics
        });
    }
    catch (error) {
        logger_1.default.error('Failed to get scheduling analytics', {
            error: error.message
        });
        return res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to get scheduling analytics'
            }
        });
    }
}));
/**
 * GET /bulk/api/analytics/voicemail
 * Get voicemail analytics
 */
router.get('/voicemail', asyncHandler(async (req, res) => {
    const { userId } = req.query;
    const timeRange = parseTimeRange(req);
    logger_1.default.info('Getting voicemail analytics', { userId, timeRange });
    try {
        const analytics = await analytics_service_1.analyticsService.getVoicemailAnalytics(userId, timeRange);
        res.status(200).json({
            success: true,
            data: analytics
        });
    }
    catch (error) {
        logger_1.default.error('Failed to get voicemail analytics', {
            error: error.message
        });
        return res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to get voicemail analytics'
            }
        });
    }
}));
/**
 * GET /bulk/api/analytics/performance
 * Get performance metrics
 */
router.get('/performance', asyncHandler(async (req, res) => {
    const { userId } = req.query;
    const timeRange = parseTimeRange(req);
    logger_1.default.info('Getting performance metrics', { userId, timeRange });
    try {
        const metrics = await analytics_service_1.analyticsService.getPerformanceMetrics(userId, timeRange);
        res.status(200).json({
            success: true,
            data: metrics
        });
    }
    catch (error) {
        logger_1.default.error('Failed to get performance metrics', {
            error: error.message
        });
        return res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to get performance metrics'
            }
        });
    }
}));
/**
 * GET /bulk/api/analytics/cost
 * Get cost analytics
 */
router.get('/cost', asyncHandler(async (req, res) => {
    const { userId } = req.query;
    const timeRange = parseTimeRange(req);
    logger_1.default.info('Getting cost analytics', { userId, timeRange });
    try {
        const analytics = await analytics_service_1.analyticsService.getCostAnalytics(userId, timeRange);
        res.status(200).json({
            success: true,
            data: analytics
        });
    }
    catch (error) {
        logger_1.default.error('Failed to get cost analytics', {
            error: error.message
        });
        return res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to get cost analytics'
            }
        });
    }
}));
/**
 * GET /bulk/api/analytics/trends
 * Get time-series trends
 */
router.get('/trends', asyncHandler(async (req, res) => {
    const { userId } = req.query;
    const timeRange = parseTimeRange(req);
    logger_1.default.info('Getting analytics trends', { userId, timeRange });
    try {
        const trends = await analytics_service_1.analyticsService.getTrends(userId, timeRange);
        res.status(200).json({
            success: true,
            data: trends
        });
    }
    catch (error) {
        logger_1.default.error('Failed to get analytics trends', {
            error: error.message
        });
        return res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to get trends'
            }
        });
    }
}));
/**
 * GET /bulk/api/analytics/prewarming
 * Get connection pre-warming stats
 */
router.get('/prewarming', (req, res) => {
    const stats = connectionPrewarming_service_1.connectionPrewarmingService.getStats();
    res.status(200).json({
        success: true,
        data: {
            ...stats,
            isActive: connectionPrewarming_service_1.connectionPrewarmingService.isActive()
        }
    });
});
/**
 * POST /bulk/api/analytics/prewarming/measure
 * Measure latency savings from pre-warming
 */
router.post('/prewarming/measure', asyncHandler(async (req, res) => {
    logger_1.default.info('Measuring pre-warming latency savings');
    try {
        const savings = await connectionPrewarming_service_1.connectionPrewarmingService.measureLatencySavings();
        res.status(200).json({
            success: true,
            data: savings
        });
    }
    catch (error) {
        logger_1.default.error('Failed to measure latency savings', {
            error: error.message
        });
        return res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to measure latency savings'
            }
        });
    }
}));
/**
 * POST /bulk/api/analytics/prewarming/start
 * Start connection pre-warming
 */
router.post('/prewarming/start', asyncHandler(async (req, res) => {
    logger_1.default.info('Starting connection pre-warming');
    try {
        await connectionPrewarming_service_1.connectionPrewarmingService.start();
        res.status(200).json({
            success: true,
            data: {
                message: 'Connection pre-warming started'
            }
        });
    }
    catch (error) {
        logger_1.default.error('Failed to start pre-warming', {
            error: error.message
        });
        return res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to start pre-warming'
            }
        });
    }
}));
/**
 * POST /bulk/api/analytics/prewarming/stop
 * Stop connection pre-warming
 */
router.post('/prewarming/stop', asyncHandler(async (req, res) => {
    logger_1.default.info('Stopping connection pre-warming');
    try {
        await connectionPrewarming_service_1.connectionPrewarmingService.stop();
        res.status(200).json({
            success: true,
            data: {
                message: 'Connection pre-warming stopped'
            }
        });
    }
    catch (error) {
        logger_1.default.error('Failed to stop pre-warming', {
            error: error.message
        });
        return res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to stop pre-warming'
            }
        });
    }
}));
exports.default = router;
//# sourceMappingURL=analytics.routes.js.map
