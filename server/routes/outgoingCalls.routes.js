"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const joi_1 = __importDefault(require("joi"));
const outgoingCall_service_1 = require("../services/outgoingCall.service");
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
const initiateCallSchema = joi_1.default.object({
    phoneNumber: phoneNumberSchema,
    phoneId: joi_1.default.string().required(), // Required: Phone record containing Exotel credentials and appId
    agentId: joi_1.default.string().required(),
    userId: joi_1.default.string().required(),
    metadata: joi_1.default.object().optional(),
    priority: joi_1.default.string().valid('low', 'medium', 'high').optional()
});
const bulkCallSchema = joi_1.default.object({
    calls: joi_1.default.array().items(initiateCallSchema).min(1).max(1000).required()
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
 * POST /bulk/api/calls/outbound
 * Initiate an immediate outbound call
 */
router.post('/outbound', validateRequest(initiateCallSchema), asyncHandler(async (req, res) => {
    const { phoneNumber, phoneId, agentId, userId, metadata, priority } = req.validatedBody;
    logger_1.default.info('API: Initiating outbound call', {
        phoneNumber,
        phoneId,
        agentId,
        userId
    });
    try {
        const callLogId = await outgoingCall_service_1.outgoingCallService.initiateCall({
            phoneNumber,
            phoneId,
            agentId,
            userId,
            metadata,
            priority
        });
        res.status(201).json({
            success: true,
            data: {
                callLogId,
                status: 'initiated',
                message: 'Outbound call initiated successfully'
            }
        });
    }
    catch (error) {
        logger_1.default.error('API: Failed to initiate outbound call', {
            phoneNumber,
            agentId,
            error: error.message
        });
        // Handle specific errors
        if (error.message.includes('Invalid phone number')) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_PHONE_NUMBER',
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
        if (error.message.includes('Maximum concurrent calls')) {
            return res.status(429).json({
                success: false,
                error: {
                    code: 'CONCURRENT_LIMIT_REACHED',
                    message: error.message
                }
            });
        }
        if (error.message.includes('Circuit breaker is OPEN')) {
            return res.status(503).json({
                success: false,
                error: {
                    code: 'API_UNAVAILABLE',
                    message: 'Exotel API is temporarily unavailable. Please try again later.'
                }
            });
        }
        // Generic error
        return res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to initiate call. Please try again.'
            }
        });
    }
}));
/**
 * POST /bulk/api/calls/outbound/bulk
 * Initiate multiple outbound calls in bulk
 */
router.post('/outbound/bulk', validateRequest(bulkCallSchema), asyncHandler(async (req, res) => {
    const { calls } = req.validatedBody;
    logger_1.default.info('API: Initiating bulk outbound calls', {
        count: calls.length
    });
    try {
        const callLogIds = await outgoingCall_service_1.outgoingCallService.bulkInitiateCalls(calls);
        res.status(201).json({
            success: true,
            data: {
                total: calls.length,
                successful: callLogIds.length,
                failed: calls.length - callLogIds.length,
                callLogIds
            }
        });
    }
    catch (error) {
        logger_1.default.error('API: Failed to initiate bulk calls', {
            error: error.message
        });
        if (error.message.includes('Maximum 1000 calls')) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'BATCH_SIZE_EXCEEDED',
                    message: error.message
                }
            });
        }
        return res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to initiate bulk calls'
            }
        });
    }
}));
/**
 * GET /bulk/api/calls/:callLogId
 * Get call status and details
 */
router.get('/:callLogId', asyncHandler(async (req, res) => {
    const { callLogId } = req.params;
    logger_1.default.info('API: Getting call status', { callLogId });
    try {
        const callStatus = await outgoingCall_service_1.outgoingCallService.getCallStatus(callLogId);
        res.status(200).json({
            success: true,
            data: callStatus
        });
    }
    catch (error) {
        logger_1.default.error('API: Failed to get call status', {
            callLogId,
            error: error.message
        });
        if (error.message.includes('Call not found')) {
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
                message: 'Failed to get call status'
            }
        });
    }
}));
/**
 * POST /bulk/api/calls/:callLogId/cancel
 * Cancel a call (scheduled or in-progress)
 */
router.post('/:callLogId/cancel', asyncHandler(async (req, res) => {
    const { callLogId } = req.params;
    logger_1.default.info('API: Cancelling call', { callLogId });
    try {
        await outgoingCall_service_1.outgoingCallService.cancelCall(callLogId);
        res.status(200).json({
            success: true,
            data: {
                callLogId,
                status: 'canceled',
                message: 'Call cancelled successfully'
            }
        });
    }
    catch (error) {
        logger_1.default.error('API: Failed to cancel call', {
            callLogId,
            error: error.message
        });
        if (error.message.includes('Call not found')) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'CALL_NOT_FOUND',
                    message: error.message
                }
            });
        }
        if (error.message.includes('Cannot cancel call')) {
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
                message: 'Failed to cancel call'
            }
        });
    }
}));
/**
 * GET /bulk/api/calls/outbound/stats
 * Get outbound calling service statistics
 */
router.get('/outbound/stats', asyncHandler(async (req, res) => {
    logger_1.default.info('API: Getting outbound call stats');
    try {
        const stats = await outgoingCall_service_1.outgoingCallService.getStats();
        res.status(200).json({
            success: true,
            data: stats
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
/**
 * GET /bulk/api/calls/voicemail-stats
 * Get voicemail detection statistics
 */
router.get('/voicemail-stats', asyncHandler(async (req, res) => {
    const { userId, startDate, endDate } = req.query;
    logger_1.default.info('API: Getting voicemail stats', { userId, startDate, endDate });
    try {
        const { analyticsService } = await Promise.resolve().then(() => __importStar(require('../services/analytics.service')));
        const timeRange = startDate && endDate ? {
            start: new Date(startDate),
            end: new Date(endDate)
        } : undefined;
        const stats = await analyticsService.getVoicemailAnalytics(userId, timeRange);
        res.status(200).json({
            success: true,
            data: stats
        });
    }
    catch (error) {
        logger_1.default.error('API: Failed to get voicemail stats', {
            error: error.message
        });
        return res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to get voicemail statistics'
            }
        });
    }
}));
/**
 * GET /bulk/api/calls/:callLogId/voicemail-analysis
 * Get detailed voicemail detection data for a specific call
 */
router.get('/:callLogId/voicemail-analysis', asyncHandler(async (req, res) => {
    const { callLogId } = req.params;
    logger_1.default.info('API: Getting voicemail analysis', { callLogId });
    try {
        const { CallLog } = await Promise.resolve().then(() => __importStar(require('../models/CallLog')));
        const callLog = await CallLog.findById(callLogId);
        if (!callLog) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'NOT_FOUND',
                    message: 'Call not found'
                }
            });
        }
        const voicemailData = {
            isVoicemail: callLog.metadata?.voicemailDetected || false,
            confidence: callLog.metadata?.voicemailConfidence || 0,
            matchedKeywords: callLog.metadata?.voicemailKeywords || [],
            detectionTimestamp: callLog.metadata?.detectionTimestamp,
            detectionTimeSeconds: callLog.metadata?.detectionTimeSeconds,
            callDurationAtDetection: callLog.metadata?.callDurationAtDetection,
            markedAsFalsePositive: callLog.metadata?.markedAsFalsePositive || false
        };
        res.status(200).json({
            success: true,
            data: voicemailData
        });
    }
    catch (error) {
        logger_1.default.error('API: Failed to get voicemail analysis', {
            callLogId,
            error: error.message
        });
        return res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to get voicemail analysis'
            }
        });
    }
}));
/**
 * POST /bulk/api/calls/:callLogId/mark-false-positive
 * Mark a voicemail detection as a false positive
 */
router.post('/:callLogId/mark-false-positive', asyncHandler(async (req, res) => {
    const { callLogId } = req.params;
    const { isFalsePositive } = req.body;
    logger_1.default.info('API: Marking voicemail false positive', { callLogId, isFalsePositive });
    try {
        const { CallLog } = await Promise.resolve().then(() => __importStar(require('../models/CallLog')));
        const callLog = await CallLog.findByIdAndUpdate(callLogId, {
            $set: {
                'metadata.markedAsFalsePositive': isFalsePositive === true,
                'metadata.falsePositiveMarkedAt': new Date()
            }
        }, { new: true });
        if (!callLog) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'NOT_FOUND',
                    message: 'Call not found'
                }
            });
        }
        res.status(200).json({
            success: true,
            data: {
                callLogId,
                markedAsFalsePositive: isFalsePositive
            }
        });
    }
    catch (error) {
        logger_1.default.error('API: Failed to mark false positive', {
            callLogId,
            error: error.message
        });
        return res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to update call'
            }
        });
    }
}));
/**
 * GET /bulk/api/calls/retriable
 * Get failed calls that can be retried (excludes voicemail)
 */
router.get('/retriable', asyncHandler(async (req, res) => {
    const { userId, agentId, phoneId, limit } = req.query;
    logger_1.default.info('API: Getting retriable calls', { userId, agentId, phoneId, limit });
    try {
        if (!userId) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'MISSING_PARAMETER',
                    message: 'userId is required'
                }
            });
        }
        const calls = await outgoingCall_service_1.outgoingCallService.getRetriableCalls(userId, {
            agentId: agentId,
            phoneId: phoneId,
            limit: limit ? parseInt(limit) : undefined
        });
        res.status(200).json({
            success: true,
            data: calls
        });
    }
    catch (error) {
        logger_1.default.error('API: Failed to get retriable calls', {
            error: error.message
        });
        return res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to get retriable calls'
            }
        });
    }
}));
exports.default = router;
//# sourceMappingURL=outgoingCalls.routes.js.map
