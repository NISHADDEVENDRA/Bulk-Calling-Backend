"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.phoneController = exports.PhoneController = void 0;
const phone_service_1 = require("../services/phone.service");
class PhoneController {
    /**
     * Import a new phone number
     * POST /bulk/api/phones
     */
    async importPhone(req, res, next) {
        try {
            const userId = req.user._id.toString();
            const phoneData = req.body;
            const phone = await phone_service_1.phoneService.importPhone(userId, phoneData);
            res.status(201).json({
                success: true,
                data: { phone },
                message: 'Phone number imported successfully'
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Get all phones for current user
     * GET /bulk/api/phones
     */
    async getPhones(req, res, next) {
        try {
            const userId = req.user._id.toString();
            const options = {
                page: req.query.page ? parseInt(req.query.page) : undefined,
                limit: req.query.limit ? parseInt(req.query.limit) : undefined,
                search: req.query.search,
                isActive: req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined,
                hasAgent: req.query.hasAgent === 'true' ? true : req.query.hasAgent === 'false' ? false : undefined
            };
            const result = await phone_service_1.phoneService.getPhones(userId, options);
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
     * Get phone by ID
     * GET /bulk/api/phones/:id
     */
    async getPhoneById(req, res, next) {
        try {
            const userId = req.user._id.toString();
            const phoneId = req.params.id;
            const phone = await phone_service_1.phoneService.getPhoneById(phoneId, userId);
            res.json({
                success: true,
                data: { phone }
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Assign agent to phone
     * PUT /bulk/api/phones/:id/assign
     */
    async assignAgent(req, res, next) {
        try {
            const userId = req.user._id.toString();
            const phoneId = req.params.id;
            const { agentId } = req.body;
            const phone = await phone_service_1.phoneService.assignAgent(phoneId, userId, agentId);
            res.json({
                success: true,
                data: { phone },
                message: 'Agent assigned successfully'
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Unassign agent from phone
     * DELETE /bulk/api/phones/:id/assign
     */
    async unassignAgent(req, res, next) {
        try {
            const userId = req.user._id.toString();
            const phoneId = req.params.id;
            const phone = await phone_service_1.phoneService.unassignAgent(phoneId, userId);
            res.json({
                success: true,
                data: { phone },
                message: 'Agent unassigned successfully'
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Update phone
     * PUT /bulk/api/phones/:id
     */
    async updatePhone(req, res, next) {
        try {
            const userId = req.user._id.toString();
            const phoneId = req.params.id;
            const updateData = req.body;
            const phone = await phone_service_1.phoneService.updatePhone(phoneId, userId, updateData);
            res.json({
                success: true,
                data: { phone },
                message: 'Phone updated successfully'
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Delete phone
     * DELETE /bulk/api/phones/:id
     */
    async deletePhone(req, res, next) {
        try {
            const userId = req.user._id.toString();
            const phoneId = req.params.id;
            await phone_service_1.phoneService.deletePhone(phoneId, userId);
            res.json({
                success: true,
                message: 'Phone deleted successfully'
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Get phone statistics
     * GET /bulk/api/phones/:id/stats
     */
    async getPhoneStats(req, res, next) {
        try {
            const userId = req.user._id.toString();
            const phoneId = req.params.id;
            const stats = await phone_service_1.phoneService.getPhoneStats(phoneId, userId);
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
exports.PhoneController = PhoneController;
exports.phoneController = new PhoneController();
//# sourceMappingURL=phone.controller.js.map
