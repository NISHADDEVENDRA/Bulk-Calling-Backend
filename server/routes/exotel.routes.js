"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const exotel_controller_1 = require("../controllers/exotel.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const validation_middleware_1 = require("../middlewares/validation.middleware");
const zod_1 = require("zod");
const router = (0, express_1.Router)();
// Validation schemas
const makeCallSchema = {
    body: zod_1.z.object({
        phoneId: zod_1.z.string().min(1, 'Phone ID is required'),
        to: zod_1.z.string().min(10, 'Valid phone number is required').max(15)
    })
};
const callIdSchema = {
    params: zod_1.z.object({
        callId: zod_1.z.string().min(1, 'Call ID is required')
    })
};
const getCallHistorySchema = {
    query: zod_1.z.object({
        page: zod_1.z.string().optional(),
        limit: zod_1.z.string().optional(),
        status: zod_1.z.enum([
            'initiated',
            'ringing',
            'in-progress',
            'completed',
            'failed',
            'no-answer',
            'busy',
            'canceled',
            'user-ended',
            'agent-ended'
        ]).optional(),
        direction: zod_1.z.enum(['inbound', 'outbound']).optional(),
        phoneId: zod_1.z.string().optional(),
        agentId: zod_1.z.string().optional()
    })
};
const getCallStatsSchema = {
    query: zod_1.z.object({
        phoneId: zod_1.z.string().optional(),
        agentId: zod_1.z.string().optional(),
        startDate: zod_1.z.string().optional(),
        endDate: zod_1.z.string().optional()
    })
};
// Protected routes (require authentication and admin access)
router.post('/calls', auth_middleware_1.authenticate, auth_middleware_1.requireAdmin, (0, validation_middleware_1.validate)(makeCallSchema), exotel_controller_1.exotelController.makeCall.bind(exotel_controller_1.exotelController));
router.get('/calls', auth_middleware_1.authenticate, auth_middleware_1.requireAdmin, (0, validation_middleware_1.validate)(getCallHistorySchema), exotel_controller_1.exotelController.getCallHistory.bind(exotel_controller_1.exotelController));
router.get('/calls/stats', auth_middleware_1.authenticate, auth_middleware_1.requireAdmin, (0, validation_middleware_1.validate)(getCallStatsSchema), exotel_controller_1.exotelController.getCallStats.bind(exotel_controller_1.exotelController));
router.get('/calls/:callId', auth_middleware_1.authenticate, auth_middleware_1.requireAdmin, (0, validation_middleware_1.validate)(callIdSchema), exotel_controller_1.exotelController.getCall.bind(exotel_controller_1.exotelController));
router.post('/calls/:callId/hangup', auth_middleware_1.authenticate, auth_middleware_1.requireAdmin, (0, validation_middleware_1.validate)(callIdSchema), exotel_controller_1.exotelController.hangupCall.bind(exotel_controller_1.exotelController));
// Transcript routes
router.get('/calls/:callId/transcript', auth_middleware_1.authenticate, auth_middleware_1.requireAdmin, (0, validation_middleware_1.validate)(callIdSchema), exotel_controller_1.exotelController.getFormattedTranscript.bind(exotel_controller_1.exotelController));
router.post('/calls/:callId/transcript/regenerate', auth_middleware_1.authenticate, auth_middleware_1.requireAdmin, (0, validation_middleware_1.validate)(callIdSchema), exotel_controller_1.exotelController.regenerateTranscript.bind(exotel_controller_1.exotelController));
// Webhook routes (no authentication - Exotel will call these)
router.post('/webhook/status', exotel_controller_1.exotelController.handleStatusWebhook.bind(exotel_controller_1.exotelController));
router.post('/webhook/incoming', exotel_controller_1.exotelController.handleIncomingCallWebhook.bind(exotel_controller_1.exotelController));
exports.default = router;
//# sourceMappingURL=exotel.routes.js.map
