"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.agentService = exports.AgentService = void 0;
const Agent_1 = require("../models/Agent");
const errors_1 = require("../utils/errors");
const logger_1 = require("../utils/logger");
class AgentService {
    /**
     * Create a new agent
     */
    async createAgent(userId, data) {
        try {
            const agent = await Agent_1.Agent.create({
                userId,
                name: data.name,
                config: data.config,
                isActive: true
            });
            logger_1.logger.info('Agent created successfully', {
                userId,
                agentId: agent._id.toString(),
                name: agent.name
            });
            return agent;
        }
        catch (error) {
            logger_1.logger.error('Create agent error', { error, userId });
            throw new Error('Failed to create agent');
        }
    }
    /**
     * Get all agents for a user
     */
    async getAgents(userId, options = {}) {
        try {
            const page = options.page || 1;
            const limit = options.limit || 10;
            const skip = (page - 1) * limit;
            // Build query
            const query = { userId };
            if (options.search) {
                query.name = { $regex: options.search, $options: 'i' };
            }
            if (options.isActive !== undefined) {
                query.isActive = options.isActive;
            }
            // Execute query
            const [agents, total] = await Promise.all([
                Agent_1.Agent.find(query)
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(limit),
                Agent_1.Agent.countDocuments(query)
            ]);
            return {
                agents,
                total,
                page,
                totalPages: Math.ceil(total / limit)
            };
        }
        catch (error) {
            logger_1.logger.error('Get agents error', { error, userId });
            throw new Error('Failed to get agents');
        }
    }
    /**
     * Get agent by ID
     */
    async getAgentById(agentId, userId) {
        const agent = await Agent_1.Agent.findById(agentId);
        if (!agent) {
            throw new errors_1.NotFoundError('Agent not found');
        }
        // Check ownership
        if (agent.userId.toString() !== userId) {
            throw new errors_1.ForbiddenError('Not authorized to access this agent');
        }
        return agent;
    }
    /**
     * Update agent
     */
    async updateAgent(agentId, userId, data) {
        try {
            const agent = await this.getAgentById(agentId, userId);
            // Update fields
            if (data.name !== undefined) {
                agent.name = data.name;
            }
            if (data.config) {
                // Explicitly handle enableAutoLanguageDetection to ensure false values are saved
                const enableAutoDetection = data.config.enableAutoLanguageDetection !== undefined
                    ? data.config.enableAutoLanguageDetection
                    : agent.config.enableAutoLanguageDetection;
                agent.config = {
                    ...agent.config,
                    ...data.config,
                    enableAutoLanguageDetection: enableAutoDetection
                };
            }
            await agent.save();
            logger_1.logger.info('Agent updated successfully', {
                userId,
                agentId,
                name: agent.name
            });
            return agent;
        }
        catch (error) {
            if (error instanceof errors_1.NotFoundError ||
                error instanceof errors_1.ForbiddenError) {
                throw error;
            }
            logger_1.logger.error('Update agent error', { error, userId, agentId });
            throw new Error('Failed to update agent');
        }
    }
    /**
     * Delete agent
     */
    async deleteAgent(agentId, userId) {
        try {
            const agent = await this.getAgentById(agentId, userId);
            await agent.deleteOne();
            logger_1.logger.info('Agent deleted successfully', {
                userId,
                agentId,
                name: agent.name
            });
        }
        catch (error) {
            if (error instanceof errors_1.NotFoundError ||
                error instanceof errors_1.ForbiddenError) {
                throw error;
            }
            logger_1.logger.error('Delete agent error', { error, userId, agentId });
            throw new Error('Failed to delete agent');
        }
    }
    /**
     * Toggle agent active status
     */
    async toggleAgentStatus(agentId, userId) {
        try {
            const agent = await this.getAgentById(agentId, userId);
            agent.isActive = !agent.isActive;
            await agent.save();
            logger_1.logger.info('Agent status toggled', {
                userId,
                agentId,
                isActive: agent.isActive
            });
            return agent;
        }
        catch (error) {
            if (error instanceof errors_1.NotFoundError ||
                error instanceof errors_1.ForbiddenError) {
                throw error;
            }
            logger_1.logger.error('Toggle agent status error', { error, userId, agentId });
            throw new Error('Failed to toggle agent status');
        }
    }
    /**
     * Get agent statistics
     */
    async getAgentStats(agentId, userId) {
        try {
            // Verify ownership
            await this.getAgentById(agentId, userId);
            // TODO: Implement when CallLog model is integrated
            return {
                totalCalls: 0,
                activeCalls: 0,
                averageDuration: 0,
                successRate: 0
            };
        }
        catch (error) {
            if (error instanceof errors_1.NotFoundError ||
                error instanceof errors_1.ForbiddenError) {
                throw error;
            }
            logger_1.logger.error('Get agent stats error', { error, userId, agentId });
            throw new Error('Failed to get agent statistics');
        }
    }
}
exports.AgentService = AgentService;
exports.agentService = new AgentService();
//# sourceMappingURL=agent.service.js.map
