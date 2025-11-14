"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const joi_1 = __importDefault(require("joi"));
const callScheduler_service_1 = require("../services/callScheduler.service");
const scheduledCalls_queue_1 = require("../queues/scheduledCalls.queue");
const logger_1 = __importDefault(require("../utils/logger"));
const router = (0, express_1.Router)();
/**
 * Validation Schemas
 */
// E.164 phone number validation
const phoneNumberSchema = joi_1.default.string()
    .pattern(/^\+[1-9]\d{1,14}$/)
    .required()
    .messages({
    'string.pattern.base': 'Phone number must be in E.164 format (e.g., +919876543210)'
});
const scheduleCallSchema = joi_1.default.object({
    phoneNumber: phoneNumberSchema,
    agentId: joi_1.default.string().required(),
    userId: joi_1.default.string().required(),
    scheduledFor: joi_1.default.date().iso().greater('now').required(),
    timezone: joi_1.default.string().optional(),
    respectBusinessHours: joi_1.default.boolean().optional(),
    businessHours: joi_1.default.object({
        start: joi_1.default.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/).required(),
        end: joi_1.default.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/).required(),
        timezone: joi_1.default.string().optional(),
        daysOfWeek: joi_1.default.array().items(joi_1.default.number().min(0).max(6)).optional()
    }).optional(),
    recurring: joi_1.default.object({
        frequency: joi_1.default.string().valid('daily', 'weekly', 'monthly').required(),
        interval: joi_1.default.number().min(1).required(),
        endDate: joi_1.default.date().iso().optional(),
        maxOccurrences: joi_1.default.number().min(1).optional()
    }).optional(),
    metadata: joi_1.default.object().optional(),
    priority: joi_1.default.string().valid('low', 'medium', 'high').optional()
});
const rescheduleCallSchema = joi_1.default.object({
    scheduledFor: joi_1.default.date().iso().greater('now').required()
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
 * POST /bulk/api/scheduling/schedule
 * Schedule a call for future execution
 */
router.post('/schedule', validateRequest(scheduleCallSchema), asyncHandler(async (req, res) => {
    const params = req.validatedBody;
    logger_1.default.info('API: Scheduling call', {
        phoneNumber: params.phoneNumber,
        scheduledFor: params.scheduledFor,
        recurring: params.recurring
    });
    try {
        const scheduledCallId = await callScheduler_service_1.callSchedulerService.scheduleCall(params);
        res.status(201).json({
            success: true,
            data: {
                scheduledCallId,
                scheduledFor: params.scheduledFor,
                message: 'Call scheduled successfully'
            }
        });
    }
    catch (error) {
        logger_1.default.error('API: Failed to schedule call', {
            error: error.message
        });
        if (error.message.includes('Invalid timezone')) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_TIMEZONE',
                    message: error.message
                }
            });
        }
        if (error.message.includes('must be in the future')) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_SCHEDULED_TIME',
                    message: error.message
                }
            });
        }
        if (error.message.includes('Agent not found')) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'AGENT_NOT_FOUND',
                    message: error.message
                }
            });
        }
        return res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to schedule call'
            }
        });
    }
}));
/**
 * GET /bulk/api/scheduling/scheduled-calls
 * Get all scheduled calls for a user
 */
router.get('/scheduled-calls', asyncHandler(async (req, res) => {
    const { userId, status, startDate, endDate, agentId } = req.query;
    if (!userId) {
        return res.status(400).json({
            success: false,
            error: {
                code: 'MISSING_USER_ID',
                message: 'userId query parameter is required'
            }
        });
    }
    logger_1.default.info('API: Getting scheduled calls', { userId, status });
    try {
        const scheduledCalls = await callScheduler_service_1.callSchedulerService.getScheduledCalls(userId, {
            status,
            startDate: startDate ? new Date(startDate) : undefined,
            endDate: endDate ? new Date(endDate) : undefined,
            agentId
        });
        res.status(200).json({
            success: true,
            data: {
                scheduledCalls,
                total: scheduledCalls.length
            }
        });
    }
    catch (error) {
        logger_1.default.error('API: Failed to get scheduled calls', {
            error: error.message
        });
        return res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to get scheduled calls'
            }
        });
    }
}));
/**
 * POST /bulk/api/scheduling/:scheduledCallId/cancel
 * Cancel a scheduled call
 */
router.post('/:scheduledCallId/cancel', asyncHandler(async (req, res) => {
    const { scheduledCallId } = req.params;
    const { userId } = req.body;
    if (!userId) {
        return res.status(400).json({
            success: false,
            error: {
                code: 'MISSING_USER_ID',
                message: 'userId is required in request body'
            }
        });
    }
    logger_1.default.info('API: Cancelling scheduled call', {
        scheduledCallId,
        userId
    });
    try {
        await callScheduler_service_1.callSchedulerService.cancelScheduledCall(scheduledCallId, userId);
        res.status(200).json({
            success: true,
            data: {
                scheduledCallId,
                status: 'cancelled',
                message: 'Scheduled call cancelled successfully'
            }
        });
    }
    catch (error) {
        logger_1.default.error('API: Failed to cancel scheduled call', {
            scheduledCallId,
            error: error.message
        });
        if (error.message.includes('not found')) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'SCHEDULED_CALL_NOT_FOUND',
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
                message: 'Failed to cancel scheduled call'
            }
        });
    }
}));
/**
 * POST /bulk/api/scheduling/:scheduledCallId/reschedule
 * Reschedule a call to a new time
 */
router.post('/:scheduledCallId/reschedule', validateRequest(rescheduleCallSchema), asyncHandler(async (req, res) => {
    const { scheduledCallId } = req.params;
    const { scheduledFor } = req.validatedBody;
    const { userId } = req.body;
    if (!userId) {
        return res.status(400).json({
            success: false,
            error: {
                code: 'MISSING_USER_ID',
                message: 'userId is required in request body'
            }
        });
    }
    logger_1.default.info('API: Rescheduling call', {
        scheduledCallId,
        newTime: scheduledFor
    });
    try {
        await callScheduler_service_1.callSchedulerService.rescheduleCall(scheduledCallId, userId, scheduledFor);
        res.status(200).json({
            success: true,
            data: {
                scheduledCallId,
                scheduledFor,
                message: 'Call rescheduled successfully'
            }
        });
    }
    catch (error) {
        logger_1.default.error('API: Failed to reschedule call', {
            scheduledCallId,
            error: error.message
        });
        if (error.message.includes('not found')) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'SCHEDULED_CALL_NOT_FOUND',
                    message: error.message
                }
            });
        }
        if (error.message.includes('Cannot reschedule')) {
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
                message: 'Failed to reschedule call'
            }
        });
    }
}));
/**
 * GET /bulk/api/scheduling/stats
 * Get scheduling statistics
 */
router.get('/stats', asyncHandler(async (req, res) => {
    logger_1.default.info('API: Getting scheduling stats');
    try {
        const [schedulerStats, queueStats] = await Promise.all([
            callScheduler_service_1.callSchedulerService.getStats(),
            (0, scheduledCalls_queue_1.getQueueStats)()
        ]);
        res.status(200).json({
            success: true,
            data: {
                scheduler: schedulerStats,
                queue: queueStats
            }
        });
    }
    catch (error) {
        logger_1.default.error('API: Failed to get stats', {
            error: error.message
        });
        return res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to get statistics'
            }
        });
    }
}));
exports.default = router;
//# sourceMappingURL=scheduling.routes.js.map
