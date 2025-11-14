"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const phone_controller_1 = require("../controllers/phone.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const validation_middleware_1 = require("../middlewares/validation.middleware");
const validation_1 = require("../utils/validation");
const router = (0, express_1.Router)();
// All routes require authentication and admin access
router.use(auth_middleware_1.authenticate);
router.use(auth_middleware_1.requireAdmin);
/**
 * @route   POST /bulk/api/phones
 * @desc    Import a new phone number
 * @access  Private
 */
router.post('/', (0, validation_middleware_1.validate)(validation_1.importPhoneSchema), phone_controller_1.phoneController.importPhone.bind(phone_controller_1.phoneController));
/**
 * @route   GET /bulk/api/phones
 * @desc    Get all phones for current user
 * @access  Private
 */
router.get('/', (0, validation_middleware_1.validate)(validation_1.getPhonesSchema), phone_controller_1.phoneController.getPhones.bind(phone_controller_1.phoneController));
/**
 * @route   GET /bulk/api/phones/:id
 * @desc    Get phone by ID
 * @access  Private
 */
router.get('/:id', (0, validation_middleware_1.validate)(validation_1.phoneIdSchema), phone_controller_1.phoneController.getPhoneById.bind(phone_controller_1.phoneController));
/**
 * @route   PUT /bulk/api/phones/:id
 * @desc    Update phone
 * @access  Private
 */
router.put('/:id', (0, validation_middleware_1.validate)(validation_1.updateTagsSchema), phone_controller_1.phoneController.updatePhone.bind(phone_controller_1.phoneController));
/**
 * @route   PUT /bulk/api/phones/:id/assign
 * @desc    Assign agent to phone
 * @access  Private
 */
router.put('/:id/assign', (0, validation_middleware_1.validate)(validation_1.assignAgentSchema), phone_controller_1.phoneController.assignAgent.bind(phone_controller_1.phoneController));
/**
 * @route   DELETE /bulk/api/phones/:id/assign
 * @desc    Unassign agent from phone
 * @access  Private
 */
router.delete('/:id/assign', (0, validation_middleware_1.validate)(validation_1.phoneIdSchema), phone_controller_1.phoneController.unassignAgent.bind(phone_controller_1.phoneController));
/**
 * @route   DELETE /bulk/api/phones/:id
 * @desc    Delete phone
 * @access  Private
 */
router.delete('/:id', (0, validation_middleware_1.validate)(validation_1.phoneIdSchema), phone_controller_1.phoneController.deletePhone.bind(phone_controller_1.phoneController));
/**
 * @route   GET /bulk/api/phones/:id/stats
 * @desc    Get phone statistics
 * @access  Private
 */
router.get('/:id/stats', (0, validation_middleware_1.validate)(validation_1.phoneIdSchema), phone_controller_1.phoneController.getPhoneStats.bind(phone_controller_1.phoneController));
exports.default = router;
//# sourceMappingURL=phone.routes.js.map
