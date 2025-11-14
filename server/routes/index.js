"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_routes_1 = __importDefault(require("./auth.routes"));
const agent_routes_1 = __importDefault(require("./agent.routes"));
const phone_routes_1 = __importDefault(require("./phone.routes"));
const exotel_routes_1 = __importDefault(require("./exotel.routes"));
const exotelVoice_routes_1 = __importDefault(require("./exotelVoice.routes"));
const knowledgeBase_routes_1 = __importDefault(require("./knowledgeBase.routes"));
const stats_routes_1 = __importDefault(require("./stats.routes"));
const outgoingCalls_routes_1 = __importDefault(require("./outgoingCalls.routes"));
const scheduling_routes_1 = __importDefault(require("./scheduling.routes"));
const retry_routes_1 = __importDefault(require("./retry.routes"));
const bulk_routes_1 = __importDefault(require("./bulk.routes"));
const analytics_routes_1 = __importDefault(require("./analytics.routes"));
const settings_routes_1 = __importDefault(require("./settings.routes"));
const campaign_routes_1 = __importDefault(require("./campaign.routes"));
const maintenance_routes_1 = __importDefault(require("./maintenance.routes"));
const router = (0, express_1.Router)();
// Health check (already in app.ts but can be here too)
router.get('/health', (_req, res) => {
    res.json({
        success: true,
        message: 'API is running',
        timestamp: new Date().toISOString()
    });
});
// Mount routes
router.use('/auth', auth_routes_1.default);
router.use('/agents', agent_routes_1.default);
router.use('/phones', phone_routes_1.default);
router.use('/exotel', exotel_routes_1.default);
router.use('/exotel/voice', exotelVoice_routes_1.default);
router.use('/knowledge-base', knowledgeBase_routes_1.default);
router.use('/stats', stats_routes_1.default);
router.use('/calls', outgoingCalls_routes_1.default);
router.use('/scheduling', scheduling_routes_1.default);
router.use('/retry', retry_routes_1.default);
router.use('/bulk', bulk_routes_1.default);
router.use('/analytics', analytics_routes_1.default);
router.use('/settings', settings_routes_1.default);
router.use('/campaigns', campaign_routes_1.default);
router.use('/maintenance', maintenance_routes_1.default);
// API info endpoint
router.get('/', (_req, res) => {
    res.json({
        success: true,
        message: 'AI Calling Platform API',
        version: '1.0.0',
        endpoints: {
            auth: '/bulk/api/auth',
            agents: '/bulk/api/agents',
            phones: '/bulk/api/phones',
            incomingCalls: '/bulk/api/exotel/calls',
            outgoingCalls: '/bulk/api/calls/outbound',
            scheduling: '/bulk/api/scheduling',
            retry: '/bulk/api/retry',
            bulk: '/bulk/api/bulk',
            analytics: '/bulk/api/analytics',
            webhooks: '/bulk/api/exotel/webhook',
            knowledgeBase: '/bulk/api/knowledge-base',
            stats: '/bulk/api/stats',
            settings: '/bulk/api/settings',
            campaigns: '/bulk/api/campaigns',
            maintenance: '/bulk/api/maintenance'
        }
    });
});
exports.default = router;
//# sourceMappingURL=index.js.map
