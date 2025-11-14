"use strict";
/**
 * Campaign Routes
 * API endpoints for campaign management
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const joi_1 = __importDefault(require("joi"));
const campaign_service_1 = require("../services/campaign.service");
const campaignQueue_service_1 = require("../services/campaignQueue.service");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
// Apply authentication to all routes
router.use(auth_middleware_1.authenticate);
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
            const errors = error.details.map((detail) => detail.message);
            res.status(400).json({
                success: false,
                error: 'Validation error',
                details: errors
            });
            return;
        }
        req.body = value;
        next();
    };
};
/**
 * Middleware: Query Validation
 */
const validateQuery = (schema) => {
    return (req, res, next) => {
        const { error, value } = schema.validate(req.query, {
            abortEarly: false,
            stripUnknown: true
        });
        if (error) {
            const errors = error.details.map((detail) => detail.message);
            res.status(400).json({
                success: false,
                error: 'Validation error',
                details: errors
            });
            return;
        }
        req.query = value;
        next();
    };
};
/**
 * Middleware: Params Validation
 */
const validateParams = (schema) => {
    return (req, res, next) => {
        const { error, value } = schema.validate(req.params, {
            abortEarly: false,
            stripUnknown: true
        });
        if (error) {
            const errors = error.details.map((detail) => detail.message);
            res.status(400).json({
                success: false,
                error: 'Validation error',
                details: errors
            });
            return;
        }
        req.params = value;
        next();
    };
};
// Validation Schemas
const createCampaignSchema = joi_1.default.object({
    name: joi_1.default.string().trim().min(1).max(200).required().messages({
        'string.empty': 'Name is required',
        'string.min': 'Name must be at least 1 character',
        'string.max': 'Name must be at most 200 characters'
    }),
    agentId: joi_1.default.string().regex(/^[0-9a-fA-F]{24}$/).required().messages({
        'string.pattern.base': 'Invalid agent ID'
    }),
    phoneId: joi_1.default.string().optional().allow('').custom((value, helpers) => {
        // If empty string, convert to undefined
        if (value === '') {
            return undefined;
        }
        // If provided, must be valid ObjectId
        if (value && !/^[0-9a-fA-F]{24}$/.test(value)) {
            return helpers.error('string.pattern.base');
        }
        return value;
    }).messages({
        'string.pattern.base': 'Invalid phone ID'
    }),
    description: joi_1.default.string().trim().max(1000).optional().allow(''),
    scheduledFor: joi_1.default.date().iso().optional(),
    settings: joi_1.default.object({
        retryFailedCalls: joi_1.default.boolean().optional(),
        maxRetryAttempts: joi_1.default.number().integer().min(0).max(10).optional(),
        retryDelayMinutes: joi_1.default.number().integer().min(1).optional(),
        excludeVoicemail: joi_1.default.boolean().optional(),
        priorityMode: joi_1.default.string().valid('fifo', 'lifo', 'priority').optional(),
        concurrentCallsLimit: joi_1.default.number().integer().min(1).max(50).optional().messages({
            'number.min': 'Concurrent calls limit must be at least 1',
            'number.max': 'Concurrent calls limit must be at most 50'
        })
    }).optional()
});
const updateCampaignSchema = joi_1.default.object({
    name: joi_1.default.string().trim().min(1).max(200).optional(),
    description: joi_1.default.string().trim().max(1000).optional().allow(''),
    scheduledFor: joi_1.default.date().iso().optional(),
    settings: joi_1.default.object({
        retryFailedCalls: joi_1.default.boolean().optional(),
        maxRetryAttempts: joi_1.default.number().integer().min(0).max(10).optional(),
        retryDelayMinutes: joi_1.default.number().integer().min(1).optional(),
        excludeVoicemail: joi_1.default.boolean().optional(),
        priorityMode: joi_1.default.string().valid('fifo', 'lifo', 'priority').optional(),
        concurrentCallsLimit: joi_1.default.number().integer().min(1).max(50).optional()
    }).optional()
});
const addContactsSchema = joi_1.default.object({
    contacts: joi_1.default.array().min(1).items(joi_1.default.object({
        phoneNumber: joi_1.default.string().pattern(/^\+[1-9]\d{1,14}$/).required().messages({
            'string.pattern.base': 'Invalid phone number format (E.164 required)'
        }),
        name: joi_1.default.string().trim().max(200).optional().allow(''),
        email: joi_1.default.string().email().optional().allow(''),
        priority: joi_1.default.number().integer().optional(),
        metadata: joi_1.default.object().optional()
    })).required().messages({
        'array.min': 'Contacts must be a non-empty array'
    })
});
const getCampaignsQuerySchema = joi_1.default.object({
    status: joi_1.default.string().optional(),
    agentId: joi_1.default.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
    search: joi_1.default.string().optional(),
    page: joi_1.default.number().integer().min(1).optional(),
    limit: joi_1.default.number().integer().min(1).max(100).optional()
});
const getContactsQuerySchema = joi_1.default.object({
    status: joi_1.default.string().optional(),
    page: joi_1.default.number().integer().min(1).optional(),
    limit: joi_1.default.number().integer().min(1).max(100).optional()
});
const paginationQuerySchema = joi_1.default.object({
    page: joi_1.default.number().integer().min(1).optional(),
    limit: joi_1.default.number().integer().min(1).max(100).optional()
});
const idParamSchema = joi_1.default.object({
    id: joi_1.default.string().regex(/^[0-9a-fA-F]{24}$/).required().messages({
        'string.pattern.base': 'Invalid campaign ID'
    })
});
/**
 * Create a new campaign
 * POST /bulk/api/campaigns
 */
router.post('/', validateRequest(createCampaignSchema), async (req, res) => {
    try {
        const campaign = await campaign_service_1.campaignService.createCampaign({
            userId: req.user._id.toString(),
            ...req.body
        });
        res.status(201).json({
            success: true,
            data: campaign
        });
    }
    catch (error) {
        logger_1.logger.error('Error creating campaign', { error: error.message, userId: req.user._id.toString() });
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});
/**
 * Get all campaigns
 * GET /bulk/api/campaigns
 */
router.get('/', validateQuery(getCampaignsQuerySchema), async (req, res) => {
    try {
        const { status, agentId, search, page, limit } = req.query;
        const filters = {};
        if (status) {
            filters.status = status.split(',');
        }
        if (agentId) {
            filters.agentId = agentId;
        }
        if (search) {
            filters.search = search;
        }
        const pagination = {
            page: page ? parseInt(page) : 1,
            limit: limit ? parseInt(limit) : 20
        };
        const result = await campaign_service_1.campaignService.getCampaigns(req.user._id.toString(), filters, pagination);
        res.json({
            success: true,
            data: result
        });
    }
    catch (error) {
        logger_1.logger.error('Error getting campaigns', { error: error.message, userId: req.user._id.toString() });
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});
/**
 * Get campaign by ID
 * GET /bulk/api/campaigns/:id
 */
router.get('/:id', validateParams(idParamSchema), async (req, res) => {
    try {
        const campaign = await campaign_service_1.campaignService.getCampaign(req.params.id, req.user._id.toString());
        if (!campaign) {
            res.status(404).json({
                success: false,
                error: 'Campaign not found'
            });
            return;
        }
        res.json({
            success: true,
            data: campaign
        });
    }
    catch (error) {
        logger_1.logger.error('Error getting campaign', { error: error.message, campaignId: req.params.id });
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});
/**
 * Update campaign
 * PATCH /bulk/api/campaigns/:id
 */
router.patch('/:id', validateParams(idParamSchema), validateRequest(updateCampaignSchema), async (req, res) => {
    try {
        const campaign = await campaign_service_1.campaignService.updateCampaign(req.params.id, req.user._id.toString(), req.body);
        res.json({
            success: true,
            data: campaign
        });
    }
    catch (error) {
        logger_1.logger.error('Error updating campaign', { error: error.message, campaignId: req.params.id });
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});
/**
 * Delete campaign
 * DELETE /bulk/api/campaigns/:id
 */
router.delete('/:id', validateParams(idParamSchema), async (req, res) => {
    try {
        await campaign_service_1.campaignService.deleteCampaign(req.params.id, req.user._id.toString());
        res.json({
            success: true,
            message: 'Campaign deleted successfully'
        });
    }
    catch (error) {
        logger_1.logger.error('Error deleting campaign', { error: error.message, campaignId: req.params.id });
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});
/**
 * Add contacts to campaign
 * POST /bulk/api/campaigns/:id/contacts
 */
router.post('/:id/contacts', validateParams(idParamSchema), validateRequest(addContactsSchema), async (req, res) => {
    try {
        const result = await campaign_service_1.campaignService.addContacts({
            campaignId: req.params.id,
            userId: req.user._id.toString(),
            contacts: req.body.contacts
        });
        res.status(201).json({
            success: true,
            data: result
        });
    }
    catch (error) {
        logger_1.logger.error('Error adding contacts', { error: error.message, campaignId: req.params.id });
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});
/**
 * Get campaign contacts
 * GET /bulk/api/campaigns/:id/contacts
 */
router.get('/:id/contacts', validateParams(idParamSchema), validateQuery(getContactsQuerySchema), async (req, res) => {
    try {
        const { status, page, limit } = req.query;
        const filters = {};
        if (status) {
            filters.status = status.split(',');
        }
        const pagination = {
            page: page ? parseInt(page) : 1,
            limit: limit ? parseInt(limit) : 50
        };
        const result = await campaign_service_1.campaignService.getCampaignContacts(req.params.id, req.user._id.toString(), filters, pagination);
        res.json({
            success: true,
            data: result
        });
    }
    catch (error) {
        logger_1.logger.error('Error getting campaign contacts', { error: error.message, campaignId: req.params.id });
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});
/**
 * Get campaign call logs
 * GET /bulk/api/campaigns/:id/calls
 */
router.get('/:id/calls', validateParams(idParamSchema), validateQuery(paginationQuerySchema), async (req, res) => {
    try {
        const { page, limit } = req.query;
        const pagination = {
            page: page ? parseInt(page) : 1,
            limit: limit ? parseInt(limit) : 50
        };
        const result = await campaign_service_1.campaignService.getCampaignCallLogs(req.params.id, req.user._id.toString(), pagination);
        res.json({
            success: true,
            data: result
        });
    }
    catch (error) {
        logger_1.logger.error('Error getting campaign call logs', { error: error.message, campaignId: req.params.id });
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});
/**
 * Get campaign statistics
 * GET /bulk/api/campaigns/:id/stats
 */
router.get('/:id/stats', validateParams(idParamSchema), async (req, res) => {
    try {
        const stats = await campaign_service_1.campaignService.getCampaignStats(req.params.id, req.user._id.toString());
        res.json({
            success: true,
            data: stats
        });
    }
    catch (error) {
        logger_1.logger.error('Error getting campaign stats', { error: error.message, campaignId: req.params.id });
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});
/**
 * Get campaign progress
 * GET /bulk/api/campaigns/:id/progress
 */
router.get('/:id/progress', validateParams(idParamSchema), async (req, res) => {
    try {
        const progress = await campaignQueue_service_1.campaignQueueService.getCampaignProgress(req.params.id, req.user._id.toString());
        res.json({
            success: true,
            data: progress
        });
    }
    catch (error) {
        logger_1.logger.error('Error getting campaign progress', { error: error.message, campaignId: req.params.id });
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});
/**
 * Start campaign
 * POST /bulk/api/campaigns/:id/start
 */
router.post('/:id/start', validateParams(idParamSchema), async (req, res) => {
    try {
        await campaignQueue_service_1.campaignQueueService.startCampaign(req.params.id, req.user._id.toString());
        res.json({
            success: true,
            message: 'Campaign started successfully'
        });
    }
    catch (error) {
        logger_1.logger.error('Error starting campaign', { error: error.message, campaignId: req.params.id });
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});
/**
 * Pause campaign
 * POST /bulk/api/campaigns/:id/pause
 */
router.post('/:id/pause', validateParams(idParamSchema), async (req, res) => {
    try {
        await campaignQueue_service_1.campaignQueueService.pauseCampaign(req.params.id, req.user._id.toString());
        res.json({
            success: true,
            message: 'Campaign paused successfully'
        });
    }
    catch (error) {
        logger_1.logger.error('Error pausing campaign', { error: error.message, campaignId: req.params.id });
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});
/**
 * Resume campaign
 * POST /bulk/api/campaigns/:id/resume
 */
router.post('/:id/resume', validateParams(idParamSchema), async (req, res) => {
    try {
        await campaignQueue_service_1.campaignQueueService.resumeCampaign(req.params.id, req.user._id.toString());
        res.json({
            success: true,
            message: 'Campaign resumed successfully'
        });
    }
    catch (error) {
        logger_1.logger.error('Error resuming campaign', { error: error.message, campaignId: req.params.id });
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});
/**
 * Cancel campaign
 * POST /bulk/api/campaigns/:id/cancel
 */
router.post('/:id/cancel', validateParams(idParamSchema), async (req, res) => {
    try {
        await campaignQueue_service_1.campaignQueueService.cancelCampaign(req.params.id, req.user._id.toString());
        res.json({
            success: true,
            message: 'Campaign cancelled successfully'
        });
    }
    catch (error) {
        logger_1.logger.error('Error cancelling campaign', { error: error.message, campaignId: req.params.id });
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});
/**
 * Retry failed contacts
 * POST /bulk/api/campaigns/:id/retry
 */
router.post('/:id/retry', validateParams(idParamSchema), async (req, res) => {
    try {
        const retriedCount = await campaignQueue_service_1.campaignQueueService.retryFailedContacts(req.params.id, req.user._id.toString());
        res.json({
            success: true,
            message: `${retriedCount} contacts queued for retry`,
            data: { retriedCount }
        });
    }
    catch (error) {
        logger_1.logger.error('Error retrying failed contacts', { error: error.message, campaignId: req.params.id });
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});
/**
 * Update concurrent call limit dynamically
 * PATCH /bulk/api/campaigns/:id/concurrent-limit
 */
router.patch('/:id/concurrent-limit', validateParams(idParamSchema), validateRequest(joi_1.default.object({
    concurrentCallsLimit: joi_1.default.number().integer().min(1).max(100).required().messages({
        'number.base': 'Concurrent calls limit must be a number',
        'number.min': 'Limit must be at least 1',
        'number.max': 'Limit must be at most 100',
        'any.required': 'Concurrent calls limit is required'
    })
})), async (req, res) => {
    try {
        const { id } = req.params;
        const { concurrentCallsLimit } = req.body;
        // Import at runtime to avoid circular dependencies
        const { redis: redisClient } = require('../config/redis');
        const { redisConcurrencyTracker } = require('../utils/redisConcurrency.util');
        const { Campaign } = require('../models/Campaign');
        // Check saturation before reducing limit
        const activeCalls = await redisConcurrencyTracker.getActiveCalls(id);
        if (activeCalls > concurrentCallsLimit * 0.9) {
            res.status(429).json({
                success: false,
                error: 'Campaign near saturation, cannot reduce limit',
                data: { activeCalls, requestedLimit: concurrentCallsLimit }
            });
            return;
        }
        // Update database
        await Campaign.findByIdAndUpdate(id, {
            'settings.concurrentCallsLimit': concurrentCallsLimit
        });
        // Update Redis limit key
        await redisClient.set(`campaign:{${id}}:limit`, concurrentCallsLimit.toString());
        // Publish update to trigger promotion if limit increased
        await redisClient.publish(`campaign:${id}:slot-available`, '1');
        logger_1.logger.info('Campaign concurrent limit updated', {
            campaignId: id,
            newLimit: concurrentCallsLimit
        });
        res.json({
            success: true,
            message: 'Concurrent limit updated',
            data: { concurrentCallsLimit }
        });
    }
    catch (error) {
        logger_1.logger.error('Error updating concurrent limit', {
            error: error.message,
            campaignId: req.params.id
        });
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});
/**
 * Purge campaign (delete all Redis keys and cleanup)
 * DELETE /bulk/api/campaigns/:id/purge
 */
router.delete('/:id/purge', validateParams(idParamSchema), async (req, res) => {
    try {
        const { id } = req.params;
        // Import at runtime
        const { redis: redisClient } = require('../config/redis');
        const { redisConcurrencyTracker } = require('../utils/redisConcurrency.util');
        const { Campaign } = require('../models/Campaign');
        const { cancelCampaignJobs } = require('../queues/campaignCalls.queue');
        const IORedis = require('ioredis');
        // Step 1: Set paused flag
        const pausedKey = `campaign:{${id}}:paused`;
        await redisClient.setEx(pausedKey, 300, '1');
        // Step 2: Pause campaign
        await Campaign.findByIdAndUpdate(id, { status: 'paused' });
        // Wait for in-flight operations
        await new Promise(resolve => setTimeout(resolve, 2000));
        // Step 3: Cancel jobs + force release leases
        await cancelCampaignJobs(id);
        const setKey = `campaign:{${id}}:leases`;
        const members = await redisClient.sMembers(setKey);
        for (const member of members) {
            const callId = member.replace('pre-', '');
            await redisConcurrencyTracker.forceReleaseSlot(id, callId);
        }
        // Step 4: SCAN and delete all keys (cluster-safe)
        const keysToDelete = [
            `campaign:{${id}}:leases`,
            `campaign:{${id}}:limit`,
            `campaign:{${id}}:reserved`,
            `campaign:{${id}}:reserved:ledger`,
            `campaign:{${id}}:waitlist:high`,
            `campaign:{${id}}:waitlist:normal`,
            `campaign:{${id}}:waitlist:seen`,
            `campaign:{${id}}:promote-gate`,
            `campaign:{${id}}:promote-gate:seq`,
            `campaign:{${id}}:promote-mutex`,
            `campaign:{${id}}:fairness`,
            `campaign:{${id}}:cold-start`,
            `campaign:{${id}}:circuit`,
            `campaign:{${id}}:cb:fail`,
            pausedKey
        ];
        // Scan for dynamic keys
        const scanPattern = async (pattern) => {
            const keys = [];
            const isCluster = redisClient instanceof IORedis.Cluster;
            if (isCluster) {
                const masters = redisClient.nodes('master');
                for (const node of masters) {
                    let cursor = '0';
                    do {
                        const [newCursor, batch] = await node.scan(cursor, 'MATCH', pattern, 'COUNT', 1000);
                        cursor = newCursor;
                        keys.push(...batch);
                    } while (cursor !== '0');
                }
            }
            else {
                let cursor = '0';
                do {
                    const [newCursor, batch] = await redisClient.scan(cursor, 'MATCH', pattern, 'COUNT', 1000);
                    cursor = newCursor;
                    keys.push(...batch);
                } while (cursor !== '0');
            }
            return keys;
        };
        const leaseKeys = await scanPattern(`campaign:{${id}}:lease:*`);
        const markerKeys = await scanPattern(`campaign:{${id}}:waitlist:marker:*`);
        keysToDelete.push(...leaseKeys, ...markerKeys);
        // Use UNLINK for non-blocking deletion
        if (keysToDelete.length > 0) {
            await redisClient.unlink(...keysToDelete);
        }
        logger_1.logger.info('Campaign purged', {
            campaignId: id,
            keysDeleted: keysToDelete.length
        });
        res.json({
            success: true,
            message: 'Campaign purged successfully',
            data: { keysDeleted: keysToDelete.length }
        });
    }
    catch (error) {
        logger_1.logger.error('Campaign purge failed', {
            campaignId: req.params.id,
            error: error.message
        });
        res.status(500).json({
            success: false,
            error: 'Purge failed: ' + error.message
        });
    }
});
exports.default = router;
//# sourceMappingURL=campaign.routes.js.map
