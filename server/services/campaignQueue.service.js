"use strict";
/**
 * Campaign Queue Service
 * Handles queue operations for campaigns
 */
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
exports.campaignQueueService = exports.CampaignQueueService = void 0;
const Campaign_1 = require("../models/Campaign");
const CampaignContact_1 = require("../models/CampaignContact");
const Agent_1 = require("../models/Agent");
const campaignCalls_queue_1 = require("../queues/campaignCalls.queue");
const logger_1 = __importDefault(require("../utils/logger"));
class CampaignQueueService {
    /**
     * Start a campaign by queuing all pending contacts
     */
    async startCampaign(campaignId, userId) {
        const campaign = await Campaign_1.Campaign.findOne({ _id: campaignId, userId });
        if (!campaign) {
            throw new Error('Campaign not found');
        }
        // Check campaign status
        if (campaign.status === 'active') {
            throw new Error('Campaign is already active');
        }
        if (campaign.status === 'completed') {
            throw new Error('Cannot start completed campaign');
        }
        if (campaign.status === 'cancelled') {
            throw new Error('Cannot start cancelled campaign');
        }
        // Check if campaign has contacts
        if (campaign.totalContacts === 0) {
            throw new Error('Campaign has no contacts');
        }
        // Get agent
        const agent = await Agent_1.Agent.findById(campaign.agentId);
        if (!agent) {
            throw new Error('Agent not found');
        }
        // Get all pending contacts
        const contacts = await CampaignContact_1.CampaignContact.find({
            campaignId,
            status: 'pending'
        }).sort({
            priority: -1, // Higher priority first
            createdAt: 1 // FIFO for same priority
        });
        if (contacts.length === 0) {
            throw new Error('No pending contacts to process');
        }
        logger_1.default.info('Starting campaign', {
            campaignId,
            totalContacts: contacts.length,
            agentId: campaign.agentId
        });
        // Update campaign status
        campaign.status = 'active';
        campaign.startedAt = new Date();
        await campaign.save();
        // Initialize Redis concurrent limit for the campaign
        const { redis: redisClient } = await Promise.resolve().then(() => __importStar(require('../config/redis')));
        const limitKey = `campaign:{${campaignId}}:limit`;
        const concurrentLimit = campaign.settings.concurrentCallsLimit || 5;
        await redisClient.set(limitKey, concurrentLimit.toString());
        logger_1.default.info('Initialized campaign concurrent limit', {
            campaignId,
            concurrentLimit
        });
        // Queue all contacts in bulk
        const jobs = contacts.map(contact => ({
            data: {
                campaignId: campaignId,
                campaignContactId: contact._id.toString(),
                agentId: campaign.agentId.toString(),
                phoneNumber: contact.phoneNumber,
                phoneId: campaign.phoneId?.toString(),
                userId: userId,
                name: contact.name,
                email: contact.email,
                customData: contact.customData,
                retryCount: contact.retryCount,
                isRetry: contact.retryCount > 0,
                priority: contact.priority,
                metadata: campaign.metadata
            },
            options: {
                priority: contact.priority
                // No delay specified - let addCampaignCallJob use default 24h delay
                // Jobs will be promoted by waitlist service when slots are available
            }
        }));
        // Add jobs in batches to avoid overwhelming the queue
        const batchSize = 100;
        for (let i = 0; i < jobs.length; i += batchSize) {
            const batch = jobs.slice(i, i + batchSize);
            await (0, campaignCalls_queue_1.addBulkCampaignCallJobs)(batch);
            logger_1.default.debug('Queued batch of contacts', {
                campaignId,
                batchNumber: Math.floor(i / batchSize) + 1,
                batchSize: batch.length
            });
        }
        // Update contact statuses
        await CampaignContact_1.CampaignContact.updateMany({ campaignId, status: 'pending' }, { status: 'queued' });
        logger_1.default.info('Campaign started successfully', {
            campaignId,
            queuedContacts: contacts.length
        });
    }
    /**
     * Pause a campaign
     */
    async pauseCampaign(campaignId, userId) {
        const campaign = await Campaign_1.Campaign.findOne({ _id: campaignId, userId });
        if (!campaign) {
            throw new Error('Campaign not found');
        }
        if (campaign.status !== 'active') {
            throw new Error('Campaign is not active');
        }
        logger_1.default.info('Pausing campaign', { campaignId });
        // Pause jobs in queue
        await (0, campaignCalls_queue_1.pauseCampaign)(campaignId);
        // Update campaign status
        campaign.status = 'paused';
        campaign.pausedAt = new Date();
        await campaign.save();
        logger_1.default.info('Campaign paused', { campaignId });
    }
    /**
     * Resume a paused campaign
     */
    async resumeCampaign(campaignId, userId) {
        const campaign = await Campaign_1.Campaign.findOne({ _id: campaignId, userId });
        if (!campaign) {
            throw new Error('Campaign not found');
        }
        if (campaign.status !== 'paused') {
            throw new Error('Campaign is not paused');
        }
        logger_1.default.info('Resuming campaign', { campaignId });
        // Resume jobs in queue
        await (0, campaignCalls_queue_1.resumeCampaign)(campaignId);
        // Update campaign status
        campaign.status = 'active';
        await campaign.save();
        logger_1.default.info('Campaign resumed', { campaignId });
    }
    /**
     * Cancel a campaign
     */
    async cancelCampaign(campaignId, userId) {
        const campaign = await Campaign_1.Campaign.findOne({ _id: campaignId, userId });
        if (!campaign) {
            throw new Error('Campaign not found');
        }
        if (campaign.status === 'completed') {
            throw new Error('Cannot cancel completed campaign');
        }
        if (campaign.status === 'cancelled') {
            throw new Error('Campaign is already cancelled');
        }
        logger_1.default.info('Cancelling campaign', { campaignId });
        // Cancel all jobs in queue
        const removedCount = await (0, campaignCalls_queue_1.cancelCampaignJobs)(campaignId);
        // Update campaign status
        campaign.status = 'cancelled';
        campaign.completedAt = new Date();
        await campaign.save();
        // Update pending/queued contacts to skipped
        await CampaignContact_1.CampaignContact.updateMany({ campaignId, status: { $in: ['pending', 'queued'] } }, { status: 'skipped' });
        logger_1.default.info('Campaign cancelled', {
            campaignId,
            removedJobs: removedCount
        });
    }
    /**
     * Add more contacts to an active campaign
     */
    async addContactsToCampaign(campaignId, userId, contactIds) {
        const campaign = await Campaign_1.Campaign.findOne({ _id: campaignId, userId });
        if (!campaign) {
            throw new Error('Campaign not found');
        }
        if (campaign.status !== 'active') {
            throw new Error('Can only add contacts to active campaigns');
        }
        // Get contacts
        const contacts = await CampaignContact_1.CampaignContact.find({
            _id: { $in: contactIds },
            campaignId,
            status: 'pending'
        });
        if (contacts.length === 0) {
            throw new Error('No pending contacts found');
        }
        logger_1.default.info('Adding contacts to active campaign', {
            campaignId,
            contactCount: contacts.length
        });
        // Queue contacts
        const jobs = contacts.map(contact => ({
            data: {
                campaignId: campaignId,
                campaignContactId: contact._id.toString(),
                agentId: campaign.agentId.toString(),
                phoneNumber: contact.phoneNumber,
                phoneId: campaign.phoneId?.toString(),
                userId: userId,
                name: contact.name,
                email: contact.email,
                customData: contact.customData,
                retryCount: contact.retryCount,
                isRetry: contact.retryCount > 0,
                priority: contact.priority,
                metadata: campaign.metadata
            },
            options: {
                priority: contact.priority
            }
        }));
        await (0, campaignCalls_queue_1.addBulkCampaignCallJobs)(jobs);
        // Update contact statuses
        await CampaignContact_1.CampaignContact.updateMany({ _id: { $in: contactIds } }, { status: 'queued' });
        logger_1.default.info('Contacts added to campaign', {
            campaignId,
            addedCount: contacts.length
        });
    }
    /**
     * Retry failed contacts in a campaign
     */
    async retryFailedContacts(campaignId, userId) {
        const campaign = await Campaign_1.Campaign.findOne({ _id: campaignId, userId });
        if (!campaign) {
            throw new Error('Campaign not found');
        }
        if (campaign.status !== 'active') {
            throw new Error('Campaign must be active to retry contacts');
        }
        // Get failed contacts that haven't exceeded retry limit
        const failedContacts = await CampaignContact_1.CampaignContact.find({
            campaignId,
            status: 'failed',
            retryCount: { $lt: campaign.settings.maxRetryAttempts }
        });
        if (failedContacts.length === 0) {
            logger_1.default.info('No failed contacts to retry', { campaignId });
            return 0;
        }
        logger_1.default.info('Retrying failed contacts', {
            campaignId,
            count: failedContacts.length
        });
        // Queue contacts for retry
        const jobs = failedContacts.map(contact => ({
            data: {
                campaignId: campaignId,
                campaignContactId: contact._id.toString(),
                agentId: campaign.agentId.toString(),
                phoneNumber: contact.phoneNumber,
                phoneId: campaign.phoneId?.toString(),
                userId: userId,
                name: contact.name,
                email: contact.email,
                customData: contact.customData,
                retryCount: contact.retryCount + 1,
                isRetry: true,
                priority: contact.priority,
                metadata: campaign.metadata
            },
            options: {
                priority: contact.priority,
                delay: campaign.settings.retryDelayMinutes * 60 * 1000
            }
        }));
        await (0, campaignCalls_queue_1.addBulkCampaignCallJobs)(jobs);
        // Update contact statuses and retry count
        await CampaignContact_1.CampaignContact.updateMany({ _id: { $in: failedContacts.map(c => c._id) } }, {
            status: 'queued',
            $inc: { retryCount: 1 },
            nextRetryAt: new Date(Date.now() + campaign.settings.retryDelayMinutes * 60 * 1000)
        });
        // Update campaign stats
        await Campaign_1.Campaign.findByIdAndUpdate(campaignId, {
            $inc: {
                queuedCalls: failedContacts.length,
                failedCalls: -failedContacts.length
            }
        });
        logger_1.default.info('Failed contacts queued for retry', {
            campaignId,
            retriedCount: failedContacts.length
        });
        return failedContacts.length;
    }
    /**
     * Get real-time campaign progress from queue
     */
    async getCampaignProgress(campaignId, userId) {
        const campaign = await Campaign_1.Campaign.findOne({ _id: campaignId, userId });
        if (!campaign) {
            throw new Error('Campaign not found');
        }
        // Get queue stats for this campaign
        const queueStats = await (0, campaignCalls_queue_1.getCampaignStats)(campaignId);
        return {
            campaign: {
                id: campaign._id,
                name: campaign.name,
                status: campaign.status,
                totalContacts: campaign.totalContacts,
                queuedCalls: campaign.queuedCalls,
                activeCalls: campaign.activeCalls,
                completedCalls: campaign.completedCalls,
                failedCalls: campaign.failedCalls,
                voicemailCalls: campaign.voicemailCalls,
                progress: campaign.progress,
                successRate: campaign.successRate
            },
            queue: queueStats
        };
    }
}
exports.CampaignQueueService = CampaignQueueService;
exports.campaignQueueService = new CampaignQueueService();
//# sourceMappingURL=campaignQueue.service.js.map
