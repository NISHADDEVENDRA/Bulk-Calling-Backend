"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const joi_1 = __importDefault(require("joi"));
const retryManager_service_1 = require("../services/retryManager.service");
const autoRetry_service_1 = require("../services/autoRetry.service");
const logger_1 = __importDefault(require("../utils/logger"));
const router = (0, express_1.Router)();
/**
 * Validation Schemas
 */
const scheduleRetrySchema = joi_1.default.object({
    callLogId: joi_1.default.string().required(),
    forceRetry: joi_1.default.boolean().optional(),
    scheduledFor: joi_1.default.date().iso().greater('now').optional(),
    respectOffPeakHours: joi_1.default.boolean().optional(),
    overrideFailureReason: joi_1.default.string().optional(),
    metadata: joi_1.default.object().optional()
});
const batchRetrySchema = joi_1.default.object({
    callLogIds: joi_1.default.array().items(joi_1.default.string()).min(1).max(100).required(),
    forceRetry: joi_1.default.boolean().optional(),
    respectOffPeakHours: joi_1.default.boolean().optional()
});
/**
 * Middleware: Request Validation
 */
const validateRequest = (schema) => {
    return (req, res, next) => {
        const { error, value } = schema.validate(req.body, {
            abortEarly: false,
            stripUnknown: true
        });
        if (error) {
            const errors = error.details.map((detail) => ({
                field: detail.path.join('.'),
                message: detail.message
            }));
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid request data',
                    details: errors
                }
            });
        }
        req.validatedBody = value;
        next();
    };
};
/**
 * Middleware: Error Handler
 */
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
/**
 * POST /bulk/api/retry/schedule
 * Schedule a manual retry for a failed call
 */
router.post('/schedule', validateRequest(scheduleRetrySchema), asyncHandler(async (req, res) => {
    const { callLogId, forceRetry, scheduledFor, respectOffPeakHours, overrideFailureReason, metadata } = req.validatedBody;
    logger_1.default.info('API: Scheduling manual retry', { callLogId });
    try {
        const retryAttemptId = await retryManager_service_1.retryManagerService.scheduleRetry(callLogId, {
            forceRetry,
            scheduledFor,
            respectOffPeakHours,
            overrideFailureReason,
            metadata: {
                ...metadata,
                manualRetry: true,
                manualRetryTriggeredAt: new Date()
            }
        });
        if (!retryAttemptId) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'RETRY_NOT_SCHEDULED',
                    message: 'Retry could not be scheduled. Check if call is retryable or max attempts reached.'
                }
            });
        }
        res.status(201).json({
            success: true,
            data: {
                retryAttemptId,
                callLogId,
                message: 'Retry scheduled successfully'
            }
        });
    }
    catch (error) {
        logger_1.default.error('API: Failed to schedule retry', {
            callLogId,
            error: error.message
        });
        if (error.message.includes('not found')) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'CALL_NOT_FOUND',
                    message: error.message
                }
            });
        }
        return res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to schedule retry'
            }
        });
    }
}));
/**
 * POST /bulk/api/retry/batch
 * Schedule retries for multiple failed calls
 */
router.post('/batch', validateRequest(batchRetrySchema), asyncHandler(async (req, res) => {
    const { callLogIds, forceRetry, respectOffPeakHours } = req.validatedBody;
    logger_1.default.info('API: Scheduling batch retries', {
        count: callLogIds.length
    });
    const results = {
        total: callLogIds.length,
        scheduled: 0,
        failed: 0,
        details: []
    };
    for (const callLogId of callLogIds) {
        try {
            const retryAttemptId = await retryManager_service_1.retryManagerService.scheduleRetry(callLogId, {
                forceRetry,
                respectOffPeakHours,
                metadata: {
                    batchRetry: true,
                    batchRetryTriggeredAt: new Date()
                }
            });
            if (retryAttemptId) {
                results.scheduled++;
                results.details.push({
                    callLogId,
                    success: true,
                    retryAttemptId
                });
            }
            else {
                results.failed++;
                results.details.push({
                    callLogId,
                    success: false,
                    error: 'Retry conditions not met'
                });
            }
        }
        catch (error) {
            results.failed++;
            results.details.push({
                callLogId,
                success: false,
                error: error.message
            });
        }
    }
    logger_1.default.info('API: Batch retry complete', {
        total: results.total,
        scheduled: results.scheduled,
        failed: results.failed
    });
    res.status(200).json({
        success: true,
        data: results
    });
}));
/**
 * POST /bulk/api/retry/:retryAttemptId/cancel
 * Cancel a scheduled retry
 */
router.post('/:retryAttemptId/cancel', asyncHandler(async (req, res) => {
    const { retryAttemptId } = req.params;
    logger_1.default.info('API: Cancelling retry', { retryAttemptId });
    try {
        await retryManager_service_1.retryManagerService.cancelRetry(retryAttemptId);
        res.status(200).json({
            success: true,
            data: {
                retryAttemptId,
                status: 'cancelled',
                message: 'Retry cancelled successfully'
            }
        });
    }
    catch (error) {
        logger_1.default.error('API: Failed to cancel retry', {
            retryAttemptId,
            error: error.message
        });
        if (error.message.includes('not found')) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'RETRY_NOT_FOUND',
                    message: error.message
                }
            });
        }
        if (error.message.includes('Cannot cancel')) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_OPERATION',
                    message: error.message
                }
            });
        }
        return res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to cancel retry'
            }
        });
    }
}));
/**
 * GET /bulk/api/retry/history/:callLogId
 * Get retry history for a specific call
 */
router.get('/history/:callLogId', asyncHandler(async (req, res) => {
    const { callLogId } = req.params;
    logger_1.default.info('API: Getting retry history', { callLogId });
    try {
        const retryHistory = await retryManager_service_1.retryManagerService.getRetryHistory(callLogId);
        res.status(200).json({
            success: true,
            data: {
                callLogId,
                retries: retryHistory,
                totalRetries: retryHistory.length
            }
        });
    }
    catch (error) {
        logger_1.default.error('API: Failed to get retry history', {
            callLogId,
            error: error.message
        });
        return res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to get retry history'
            }
        });
    }
}));
/**
 * GET /bulk/api/retry/stats
 * Get retry statistics
 */
router.get('/stats', asyncHandler(async (req, res) => {
    const { userId } = req.query;
    logger_1.default.info('API: Getting retry stats', { userId });
    try {
        const stats = await retryManager_service_1.retryManagerService.getRetryStats(userId);
        res.status(200).json({
            success: true,
            data: stats
        });
    }
    catch (error) {
        logger_1.default.error('API: Failed to get retry stats', {
            error: error.message
        });
        return res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to get retry statistics'
            }
        });
    }
}));
/**
 * POST /bulk/api/retry/process-pending
 * Process pending failures for auto-retry
 * (Admin/maintenance endpoint)
 */
router.post('/process-pending', asyncHandler(async (req, res) => {
    const { lookbackMinutes = 60 } = req.body;
    logger_1.default.info('API: Processing pending failures', { lookbackMinutes });
    try {
        const result = await autoRetry_service_1.autoRetryService.processPendingFailures(lookbackMinutes);
        res.status(200).json({
            success: true,
            data: {
                ...result,
                message: 'Pending failures processed'
            }
        });
    }
    catch (error) {
        logger_1.default.error('API: Failed to process pending failures', {
            error: error.message
        });
        return res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to process pending failures'
            }
        });
    }
}));
/**
 * GET /bulk/api/retry/config
 * Get auto-retry configuration
 */
router.get('/config', asyncHandler(async (req, res) => {
    const config = autoRetry_service_1.autoRetryService.getConfig();
    res.status(200).json({
        success: true,
        data: config
    });
}));
exports.default = router;
//# sourceMappingURL=retry.routes.js.map
