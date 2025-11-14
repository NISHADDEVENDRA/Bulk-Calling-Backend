"use strict";
/**
 * Campaign Service
 * Handles CRUD operations and business logic for campaigns
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.campaignService = exports.CampaignService = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const Campaign_1 = require("../models/Campaign");
const CampaignContact_1 = require("../models/CampaignContact");
const Agent_1 = require("../models/Agent");
const Phone_1 = require("../models/Phone");
const CallLog_1 = require("../models/CallLog");
const logger_1 = __importDefault(require("../utils/logger"));
class CampaignService {
    /**
     * Create a new campaign
     */
    async createCampaign(params) {
        const { userId, agentId, phoneId, name, description, scheduledFor, settings, metadata } = params;
        // Validate agent exists
        const agent = await Agent_1.Agent.findById(agentId);
        if (!agent) {
            throw new Error('Agent not found');
        }
        // Validate agent belongs to user
        logger_1.default.debug('Checking agent ownership', {
            agentUserId: agent.userId.toString(),
            requestUserId: userId,
            agentUserIdType: typeof agent.userId,
            requestUserIdType: typeof userId,
            match: agent.userId.toString() === userId.toString()
        });
        if (agent.userId.toString() !== userId.toString()) {
            throw new Error('Agent does not belong to user');
        }
        // Validate phone if provided
        if (phoneId) {
            const phone = await Phone_1.Phone.findById(phoneId);
            if (!phone) {
                throw new Error('Phone not found');
            }
            if (phone.userId.toString() !== userId) {
                throw new Error('Phone does not belong to user');
            }
        }
        // Create campaign
        const campaign = await Campaign_1.Campaign.create({
            userId,
            agentId,
            phoneId,
            name,
            description,
            status: scheduledFor && scheduledFor > new Date() ? 'scheduled' : 'draft',
            scheduledFor,
            settings: {
                retryFailedCalls: settings?.retryFailedCalls ?? true,
                maxRetryAttempts: settings?.maxRetryAttempts ?? 3,
                retryDelayMinutes: settings?.retryDelayMinutes ?? 30,
                excludeVoicemail: settings?.excludeVoicemail ?? true,
                priorityMode: settings?.priorityMode ?? 'fifo',
                concurrentCallsLimit: settings?.concurrentCallsLimit ?? 3
            },
            metadata
        });
        logger_1.default.info('Campaign created', {
            campaignId: campaign._id,
            userId,
            agentId,
            name
        });
        return campaign;
    }
    /**
     * Get campaign by ID
     */
    async getCampaign(campaignId, userId) {
        const campaign = await Campaign_1.Campaign.findOne({ _id: campaignId, userId })
            .populate('agentId', 'name description config.voice')
            .populate('phoneId', 'number provider');
        return campaign;
    }
    /**
     * Get all campaigns for a user
     */
    async getCampaigns(userId, filters, pagination) {
        const query = { userId };
        if (filters?.status && filters.status.length > 0) {
            query.status = { $in: filters.status };
        }
        if (filters?.agentId) {
            query.agentId = filters.agentId;
        }
        if (filters?.search) {
            query.$or = [
                { name: { $regex: filters.search, $options: 'i' } },
                { description: { $regex: filters.search, $options: 'i' } }
            ];
        }
        const page = pagination?.page || 1;
        const limit = pagination?.limit || 20;
        const skip = (page - 1) * limit;
        const [campaigns, total] = await Promise.all([
            Campaign_1.Campaign.find(query)
                .populate('agentId', 'name')
                .populate('phoneId', 'number')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Campaign_1.Campaign.countDocuments(query)
        ]);
        return {
            campaigns: campaigns,
            total,
            page,
            pages: Math.ceil(total / limit)
        };
    }
    /**
     * Update campaign
     */
    async updateCampaign(campaignId, userId, updates) {
        const campaign = await Campaign_1.Campaign.findOne({ _id: campaignId, userId });
        if (!campaign) {
            throw new Error('Campaign not found');
        }
        // Can't update active or completed campaigns' core settings
        if (campaign.status === 'active' || campaign.status === 'completed') {
            throw new Error('Cannot update active or completed campaign');
        }
        if (updates.name)
            campaign.name = updates.name;
        if (updates.description !== undefined)
            campaign.description = updates.description;
        if (updates.scheduledFor)
            campaign.scheduledFor = updates.scheduledFor;
        if (updates.metadata)
            campaign.metadata = { ...campaign.metadata, ...updates.metadata };
        if (updates.settings) {
            campaign.settings = { ...campaign.settings, ...updates.settings };
        }
        await campaign.save();
        logger_1.default.info('Campaign updated', { campaignId, userId });
        return campaign;
    }
    /**
     * Delete campaign
     */
    async deleteCampaign(campaignId, userId) {
        const campaign = await Campaign_1.Campaign.findOne({ _id: campaignId, userId });
        if (!campaign) {
            throw new Error('Campaign not found');
        }
        // Can't delete active campaigns
        if (campaign.status === 'active') {
            throw new Error('Cannot delete active campaign. Pause or cancel it first.');
        }
        // Delete all contacts
        await CampaignContact_1.CampaignContact.deleteMany({ campaignId });
        // Delete campaign
        await campaign.deleteOne();
        logger_1.default.info('Campaign deleted', { campaignId, userId });
    }
    /**
     * Add contacts to campaign
     */
    async addContacts(params) {
        const { campaignId, userId, contacts } = params;
        const campaign = await Campaign_1.Campaign.findOne({ _id: campaignId, userId });
        if (!campaign) {
            throw new Error('Campaign not found');
        }
        // Can't add contacts to completed or cancelled campaigns
        if (campaign.status === 'completed' || campaign.status === 'cancelled') {
            throw new Error('Cannot add contacts to completed or cancelled campaign');
        }
        let added = 0;
        let duplicates = 0;
        let errors = 0;
        for (const contact of contacts) {
            try {
                // Check for duplicate
                const existing = await CampaignContact_1.CampaignContact.findOne({
                    campaignId,
                    phoneNumber: contact.phoneNumber
                });
                if (existing) {
                    duplicates++;
                    continue;
                }
                // Create contact
                await CampaignContact_1.CampaignContact.create({
                    campaignId,
                    userId,
                    phoneNumber: contact.phoneNumber,
                    name: contact.name,
                    email: contact.email,
                    customData: contact.customData,
                    priority: contact.priority || 0,
                    scheduledFor: contact.scheduledFor,
                    status: 'pending'
                });
                added++;
            }
            catch (error) {
                logger_1.default.error('Error adding contact to campaign', {
                    campaignId,
                    phoneNumber: contact.phoneNumber,
                    error: error.message
                });
                errors++;
            }
        }
        // Update campaign total contacts
        await Campaign_1.Campaign.findByIdAndUpdate(campaignId, {
            $inc: { totalContacts: added, queuedCalls: added }
        });
        logger_1.default.info('Contacts added to campaign', {
            campaignId,
            added,
            duplicates,
            errors
        });
        return { added, duplicates, errors };
    }
    /**
     * Get campaign contacts
     */
    async getCampaignContacts(campaignId, userId, filters, pagination) {
        const campaign = await Campaign_1.Campaign.findOne({ _id: campaignId, userId });
        if (!campaign) {
            throw new Error('Campaign not found');
        }
        const query = { campaignId };
        if (filters?.status && filters.status.length > 0) {
            query.status = { $in: filters.status };
        }
        const page = pagination?.page || 1;
        const limit = pagination?.limit || 50;
        const skip = (page - 1) * limit;
        const [contacts, total] = await Promise.all([
            CampaignContact_1.CampaignContact.find(query)
                .populate('callLogId')
                .sort({ priority: -1, createdAt: 1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            CampaignContact_1.CampaignContact.countDocuments(query)
        ]);
        return {
            contacts: contacts,
            total,
            page,
            pages: Math.ceil(total / limit)
        };
    }
    /**
     * Get campaign call logs
     */
    async getCampaignCallLogs(campaignId, userId, pagination) {
        const campaign = await Campaign_1.Campaign.findOne({ _id: campaignId, userId });
        if (!campaign) {
            throw new Error('Campaign not found');
        }
        const page = pagination?.page || 1;
        const limit = pagination?.limit || 50;
        const skip = (page - 1) * limit;
        const [callLogs, total] = await Promise.all([
            CallLog_1.CallLog.find({ campaignId: new mongoose_1.default.Types.ObjectId(campaignId) })
                .populate('agentId', 'name')
                .populate('phoneId', 'number country')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            CallLog_1.CallLog.countDocuments({ campaignId: new mongoose_1.default.Types.ObjectId(campaignId) })
        ]);
        return {
            callLogs,
            total,
            page,
            pages: Math.ceil(total / limit)
        };
    }
    /**
     * Get campaign statistics
     */
    async getCampaignStats(campaignId, userId) {
        const campaign = await Campaign_1.Campaign.findOne({ _id: campaignId, userId });
        if (!campaign) {
            throw new Error('Campaign not found');
        }
        // Get contact status breakdown
        const contactStats = await CampaignContact_1.CampaignContact.aggregate([
            { $match: { campaignId: new mongoose_1.default.Types.ObjectId(campaignId) } },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);
        const statusCounts = {};
        contactStats.forEach(stat => {
            statusCounts[stat._id] = stat.count;
        });
        // Get call outcome stats
        const callStats = await CallLog_1.CallLog.aggregate([
            { $match: { campaignId: new mongoose_1.default.Types.ObjectId(campaignId) } },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 },
                    totalDuration: { $sum: '$duration' }
                }
            }
        ]);
        const callStatusCounts = {};
        let totalCallDuration = 0;
        callStats.forEach(stat => {
            callStatusCounts[stat._id] = stat.count;
            totalCallDuration += stat.totalDuration || 0;
        });
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
                successRate: campaign.successRate,
                scheduledFor: campaign.scheduledFor,
                startedAt: campaign.startedAt,
                completedAt: campaign.completedAt
            },
            contactStatus: statusCounts,
            callStatus: callStatusCounts,
            totalCallDuration,
            avgCallDuration: campaign.completedCalls > 0 ? Math.round(totalCallDuration / campaign.completedCalls) : 0
        };
    }
}
exports.CampaignService = CampaignService;
exports.campaignService = new CampaignService();
//# sourceMappingURL=campaign.service.js.map
