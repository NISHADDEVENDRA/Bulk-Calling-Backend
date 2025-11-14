"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const agent_controller_1 = require("../controllers/agent.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const validation_middleware_1 = require("../middlewares/validation.middleware");
const validation_1 = require("../utils/validation");
const router = (0, express_1.Router)();
// All routes require authentication and admin access
router.use(auth_middleware_1.authenticate);
router.use(auth_middleware_1.requireAdmin);
/**
 * @route   POST /bulk/api/agents
 * @desc    Create a new agent
 * @access  Private
 */
router.post('/', (0, validation_middleware_1.validate)(validation_1.createAgentSchema), agent_controller_1.agentController.createAgent.bind(agent_controller_1.agentController));
/**
 * @route   GET /bulk/api/agents
 * @desc    Get all agents for current user
 * @access  Private
 */
router.get('/', (0, validation_middleware_1.validate)(validation_1.getAgentsSchema), agent_controller_1.agentController.getAgents.bind(agent_controller_1.agentController));
/**
 * @route   GET /bulk/api/agents/:id
 * @desc    Get agent by ID
 * @access  Private
 */
router.get('/:id', (0, validation_middleware_1.validate)(validation_1.agentIdSchema), agent_controller_1.agentController.getAgentById.bind(agent_controller_1.agentController));
/**
 * @route   PUT /bulk/api/agents/:id
 * @desc    Update agent
 * @access  Private
 */
router.put('/:id', (0, validation_middleware_1.validate)(validation_1.updateAgentSchema), agent_controller_1.agentController.updateAgent.bind(agent_controller_1.agentController));
/**
 * @route   DELETE /bulk/api/agents/:id
 * @desc    Delete agent
 * @access  Private
 */
router.delete('/:id', (0, validation_middleware_1.validate)(validation_1.agentIdSchema), agent_controller_1.agentController.deleteAgent.bind(agent_controller_1.agentController));
/**
 * @route   PATCH /bulk/api/agents/:id/toggle
 * @desc    Toggle agent active status
 * @access  Private
 */
router.patch('/:id/toggle', (0, validation_middleware_1.validate)(validation_1.agentIdSchema), agent_controller_1.agentController.toggleAgentStatus.bind(agent_controller_1.agentController));
/**
 * @route   GET /bulk/api/agents/:id/stats
 * @desc    Get agent statistics
 * @access  Private
 */
router.get('/:id/stats', (0, validation_middleware_1.validate)(validation_1.agentIdSchema), agent_controller_1.agentController.getAgentStats.bind(agent_controller_1.agentController));
exports.default = router;
//# sourceMappingURL=agent.routes.js.map
