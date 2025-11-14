"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.gracefulShutdown = gracefulShutdown;
const logger_1 = __importDefault(require("./logger"));
const redis_1 = require("../config/redis");
const campaignCalls_queue_1 = require("../queues/campaignCalls.queue");
const redisConcurrency_util_1 = require("./redisConcurrency.util");
const waitlist_service_1 = require("../services/waitlist.service");
const leaseJanitor_service_1 = require("../services/leaseJanitor.service");
const waitlistCompactor_service_1 = require("../services/waitlistCompactor.service");
const bullmqReconciler_service_1 = require("../services/bullmqReconciler.service");
const reconciliation_service_1 = require("../services/reconciliation.service");
const invariantMonitor_service_1 = require("../services/invariantMonitor.service");
const stuckCallMonitor_service_1 = require("../services/stuckCallMonitor.service");
/**
 * Graceful Shutdown Handler
 * Cleanly shuts down all services and preserves active call leases
 */
async function gracefulShutdown(signal = 'SIGTERM') {
    logger_1.default.info('🛑 Graceful shutdown initiated', { signal });
    try {
        // 1. Stop accepting new jobs
        await campaignCalls_queue_1.campaignCallsQueue.pause();
        logger_1.default.info('Queue paused, no new jobs accepted');
        // 2. Stop all background services
        await Promise.all([
            waitlist_service_1.waitlistService.stop(),
            leaseJanitor_service_1.leaseJanitor.stop(),
            waitlistCompactor_service_1.waitlistCompactor.stop(),
            bullmqReconciler_service_1.bullmqReconciler.stop(),
            reconciliation_service_1.reconciliationService.stop(),
            invariantMonitor_service_1.invariantMonitor.stop(),
            stuckCallMonitor_service_1.stuckCallMonitorService.stop()
        ]);
        logger_1.default.info('All background services stopped');
        // 3. Release all pre-dial leases (but keep active leases)
        const campaigns = await getActiveCampaigns();
        for (const campaign of campaigns) {
            const campaignId = campaign._id.toString();
            const setKey = `campaign:{${campaignId}}:leases`;
            const members = await redis_1.redis.sMembers(setKey);
            const preDialLeases = members.filter(m => m.startsWith('pre-'));
            for (const preDialMember of preDialLeases) {
                const callId = preDialMember.replace('pre-', '');
                await redisConcurrency_util_1.redisConcurrencyTracker.forceReleaseSlot(campaignId, callId);
                logger_1.default.info('Released pre-dial lease', { campaignId, callId });
            }
        }
        // 4. Drain reserved ledger back to waitlist
        await new Promise(resolve => setTimeout(resolve, 3000)); // 3s grace
        for (const campaign of campaigns) {
            const campaignId = campaign._id.toString();
            const ledgerKey = `campaign:{${campaignId}}:reserved:ledger`;
            const reservedKey = `campaign:{${campaignId}}:reserved`;
            // Get all reserved jobIds with origin prefix
            const reserved = await redis_1.redis.zRange(ledgerKey, 0, -1);
            if (reserved.length > 0) {
                logger_1.default.warn('Draining reserved jobs back to waitlist', {
                    campaignId,
                    count: reserved.length
                });
                // Push back to waitlist (parse origin prefix)
                for (const entry of reserved) {
                    const [origin, jobId] = entry.split(':');
                    if (!jobId)
                        continue;
                    const waitlistKey = origin === 'H'
                        ? `campaign:{${campaignId}}:waitlist:high`
                        : `campaign:{${campaignId}}:waitlist:normal`;
                    await redis_1.redis.lPush(waitlistKey, jobId);
                }
                // Clear reservation
                await redis_1.redis.del(reservedKey);
                await redis_1.redis.del(ledgerKey);
            }
        }
        // 5. Wait for active calls to complete (with timeout)
        logger_1.default.info('Waiting for active calls to complete (30s timeout)...');
        await waitForActiveCalls(30000);
        // 6. Close queue
        await campaignCalls_queue_1.campaignCallsQueue.close();
        logger_1.default.info('Queue closed');
        logger_1.default.info('✅ Graceful shutdown complete');
        process.exit(0);
    }
    catch (error) {
        logger_1.default.error('Graceful shutdown error', { error: error.message });
        process.exit(1);
    }
}
async function waitForActiveCalls(timeoutMs) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
        const activeCount = await campaignCalls_queue_1.campaignCallsQueue.getActiveCount();
        if (activeCount === 0) {
            logger_1.default.info('All active calls completed');
            return;
        }
        logger_1.default.info('Waiting for active calls', { activeCount });
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    logger_1.default.warn('⚠️ Shutdown timeout, some calls still active');
}
async function getActiveCampaigns() {
    try {
        const Campaign = require('../models/Campaign').Campaign;
        return await Campaign.find({ status: 'active' });
    }
    catch (error) {
        logger_1.default.error('Failed to get active campaigns', { error });
        return [];
    }
}
// Register signal handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
logger_1.default.info('✅ Graceful shutdown handlers registered');
//# sourceMappingURL=gracefulShutdown.js.map
