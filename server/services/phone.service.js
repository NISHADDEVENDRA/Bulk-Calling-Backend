"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.phoneService = exports.PhoneService = void 0;
const Phone_1 = require("../models/Phone");
const Agent_1 = require("../models/Agent");
const errors_1 = require("../utils/errors");
const logger_1 = require("../utils/logger");
const encryption_1 = require("../utils/encryption");
class PhoneService {
    /**
     * Import a phone number
     */
    async importPhone(userId, data) {
        try {
            // Check if phone number already exists (globally - one phone can only be used once)
            const existingPhone = await Phone_1.Phone.findOne({
                number: data.number
            });
            if (existingPhone) {
                throw new errors_1.ConflictError('Phone number already exists in the system');
            }
            const phone = await Phone_1.Phone.create({
                userId,
                number: data.number,
                country: data.country,
                provider: 'exotel',
                status: 'active',
                exotelData: data.exotelConfig ? {
                    apiKey: (0, encryption_1.encrypt)(data.exotelConfig.apiKey),
                    apiToken: (0, encryption_1.encrypt)(data.exotelConfig.apiToken),
                    sid: data.exotelConfig.sid,
                    subdomain: data.exotelConfig.subdomain,
                    appId: data.exotelConfig.appId
                } : undefined,
                tags: data.tags || []
            });
            logger_1.logger.info('Phone imported successfully', {
                userId,
                phoneId: phone._id.toString(),
                number: phone.number
            });
            return phone;
        }
        catch (error) {
            if (error instanceof errors_1.ConflictError) {
                throw error;
            }
            logger_1.logger.error('Import phone error', { error, userId });
            throw new Error('Failed to import phone number');
        }
    }
    /**
     * Get all phones for a user
     */
    async getPhones(userId, options = {}) {
        try {
            const page = options.page || 1;
            const limit = options.limit || 10;
            const skip = (page - 1) * limit;
            // Build query
            const query = { userId };
            if (options.search) {
                query.number = { $regex: options.search, $options: 'i' };
            }
            if (options.isActive !== undefined) {
                query.status = options.isActive ? 'active' : 'inactive';
            }
            if (options.hasAgent !== undefined) {
                if (options.hasAgent) {
                    query.agentId = { $ne: null };
                }
                else {
                    query.agentId = null;
                }
            }
            // Execute query
            const [phones, total] = await Promise.all([
                Phone_1.Phone.find(query)
                    .populate('agentId', 'name config.prompt')
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(limit),
                Phone_1.Phone.countDocuments(query)
            ]);
            return {
                phones,
                total,
                page,
                totalPages: Math.ceil(total / limit)
            };
        }
        catch (error) {
            logger_1.logger.error('Get phones error', { error, userId });
            throw new Error('Failed to get phone numbers');
        }
    }
    /**
     * Get phone by ID
     */
    async getPhoneById(phoneId, userId) {
        const phone = await Phone_1.Phone.findById(phoneId).populate('agentId', 'name config.prompt config.voice config.llm');
        if (!phone) {
            throw new errors_1.NotFoundError('Phone number not found');
        }
        // Check ownership
        if (phone.userId.toString() !== userId) {
            throw new errors_1.ForbiddenError('Not authorized to access this phone number');
        }
        return phone;
    }
    /**
     * Assign agent to phone
     */
    async assignAgent(phoneId, userId, agentId) {
        try {
            const phone = await this.getPhoneById(phoneId, userId);
            // Verify agent exists and belongs to user
            const agent = await Agent_1.Agent.findOne({ _id: agentId, userId });
            if (!agent) {
                throw new errors_1.NotFoundError('Agent not found');
            }
            if (!agent.isActive) {
                throw new errors_1.ValidationError('Cannot assign inactive agent');
            }
            phone.agentId = agent._id;
            await phone.save();
            logger_1.logger.info('Agent assigned to phone', {
                userId,
                phoneId,
                agentId,
                phoneNumber: phone.number
            });
            // Reload with populated agent
            return await this.getPhoneById(phoneId, userId);
        }
        catch (error) {
            if (error instanceof errors_1.NotFoundError ||
                error instanceof errors_1.ForbiddenError ||
                error instanceof errors_1.ValidationError) {
                throw error;
            }
            logger_1.logger.error('Assign agent error', { error, userId, phoneId, agentId });
            throw new Error('Failed to assign agent');
        }
    }
    /**
     * Unassign agent from phone
     */
    async unassignAgent(phoneId, userId) {
        try {
            const phone = await this.getPhoneById(phoneId, userId);
            phone.agentId = undefined;
            await phone.save();
            logger_1.logger.info('Agent unassigned from phone', {
                userId,
                phoneId,
                phoneNumber: phone.number
            });
            return phone;
        }
        catch (error) {
            if (error instanceof errors_1.NotFoundError ||
                error instanceof errors_1.ForbiddenError) {
                throw error;
            }
            logger_1.logger.error('Unassign agent error', { error, userId, phoneId });
            throw new Error('Failed to unassign agent');
        }
    }
    /**
     * Update phone tags
     */
    async updatePhone(phoneId, userId, data) {
        try {
            const phone = await this.getPhoneById(phoneId, userId);
            if (data.tags !== undefined) {
                phone.tags = data.tags;
            }
            if (data.isActive !== undefined) {
                phone.status = data.isActive ? 'active' : 'inactive';
            }
            await phone.save();
            logger_1.logger.info('Phone updated successfully', {
                userId,
                phoneId,
                phoneNumber: phone.number
            });
            return phone;
        }
        catch (error) {
            if (error instanceof errors_1.NotFoundError ||
                error instanceof errors_1.ForbiddenError) {
                throw error;
            }
            logger_1.logger.error('Update phone error', { error, userId, phoneId });
            throw new Error('Failed to update phone');
        }
    }
    /**
     * Delete phone
     */
    async deletePhone(phoneId, userId) {
        try {
            const phone = await this.getPhoneById(phoneId, userId);
            await phone.deleteOne();
            logger_1.logger.info('Phone deleted successfully', {
                userId,
                phoneId,
                phoneNumber: phone.number
            });
        }
        catch (error) {
            if (error instanceof errors_1.NotFoundError ||
                error instanceof errors_1.ForbiddenError) {
                throw error;
            }
            logger_1.logger.error('Delete phone error', { error, userId, phoneId });
            throw new Error('Failed to delete phone');
        }
    }
    /**
     * Get phone statistics
     */
    async getPhoneStats(phoneId, userId) {
        try {
            // Verify ownership
            await this.getPhoneById(phoneId, userId);
            // TODO: Implement when CallLog model is integrated
            return {
                totalCalls: 0,
                successfulCalls: 0,
                failedCalls: 0,
                totalDuration: 0,
                averageDuration: 0
            };
        }
        catch (error) {
            if (error instanceof errors_1.NotFoundError ||
                error instanceof errors_1.ForbiddenError) {
                throw error;
            }
            logger_1.logger.error('Get phone stats error', { error, userId, phoneId });
            throw new Error('Failed to get phone statistics');
        }
    }
    /**
     * Get decrypted Exotel credentials for a phone
     */
    async getExotelCredentials(phoneId, userId) {
        try {
            const phone = await this.getPhoneById(phoneId, userId);
            if (!phone.exotelData) {
                return null;
            }
            return {
                apiKey: (0, encryption_1.decrypt)(phone.exotelData.apiKey),
                apiToken: (0, encryption_1.decrypt)(phone.exotelData.apiToken),
                sid: phone.exotelData.sid,
                subdomain: phone.exotelData.subdomain,
                appId: phone.exotelData.appId
            };
        }
        catch (error) {
            logger_1.logger.error('Get Exotel credentials error', { error, userId, phoneId });
            throw error;
        }
    }
}
exports.PhoneService = PhoneService;
exports.phoneService = new PhoneService();
//# sourceMappingURL=phone.service.js.map
