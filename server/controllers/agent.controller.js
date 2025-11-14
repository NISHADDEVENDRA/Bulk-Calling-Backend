"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.agentController = exports.AgentController = void 0;
const agent_service_1 = require("../services/agent.service");
class AgentController {
    /**
     * Create a new agent
     * POST /bulk/api/agents
     */
    async createAgent(req, res, next) {
        try {
            const userId = req.user._id.toString();
            const agentData = req.body;
            const agent = await agent_service_1.agentService.createAgent(userId, agentData);
            res.status(201).json({
                success: true,
                data: { agent }
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Get all agents for current user
     * GET /bulk/api/agents
     */
    async getAgents(req, res, next) {
        try {
            const userId = req.user._id.toString();
            const options = {
                page: req.query.page ? parseInt(req.query.page) : undefined,
                limit: req.query.limit ? parseInt(req.query.limit) : undefined,
                search: req.query.search,
                isActive: req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined
            };
            const result = await agent_service_1.agentService.getAgents(userId, options);
            res.json({
                success: true,
                data: result
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Get agent by ID
     * GET /bulk/api/agents/:id
     */
    async getAgentById(req, res, next) {
        try {
            const userId = req.user._id.toString();
            const agentId = req.params.id;
            const agent = await agent_service_1.agentService.getAgentById(agentId, userId);
            res.json({
                success: true,
                data: { agent }
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Update agent
     * PUT /bulk/api/agents/:id
     */
    async updateAgent(req, res, next) {
        try {
            const userId = req.user._id.toString();
            const agentId = req.params.id;
            const updateData = req.body;
            const agent = await agent_service_1.agentService.updateAgent(agentId, userId, updateData);
            res.json({
                success: true,
                data: { agent },
                message: 'Agent updated successfully'
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Delete agent
     * DELETE /bulk/api/agents/:id
     */
    async deleteAgent(req, res, next) {
        try {
            const userId = req.user._id.toString();
            const agentId = req.params.id;
            await agent_service_1.agentService.deleteAgent(agentId, userId);
            res.json({
                success: true,
                message: 'Agent deleted successfully'
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Toggle agent active status
     * PATCH /bulk/api/agents/:id/toggle
     */
    async toggleAgentStatus(req, res, next) {
        try {
            const userId = req.user._id.toString();
            const agentId = req.params.id;
            const agent = await agent_service_1.agentService.toggleAgentStatus(agentId, userId);
            res.json({
                success: true,
                data: { agent },
                message: `Agent ${agent.isActive ? 'activated' : 'deactivated'} successfully`
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Get agent statistics
     * GET /bulk/api/agents/:id/stats
     */
    async getAgentStats(req, res, next) {
        try {
            const userId = req.user._id.toString();
            const agentId = req.params.id;
            const stats = await agent_service_1.agentService.getAgentStats(agentId, userId);
            res.json({
                success: true,
                data: { stats }
            });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.AgentController = AgentController;
exports.agentController = new AgentController();
//# sourceMappingURL=agent.controller.js.map
