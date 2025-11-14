"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bullmqReconciler = void 0;
const campaignCalls_queue_1 = require("../queues/campaignCalls.queue");
const redis_1 = require("../config/redis");
const logger_1 = __importDefault(require("../utils/logger"));
const ttls_1 = require("../config/ttls");
const metrics_1 = require("../utils/metrics");
/**
 * BullMQ Reconciler Service
 * Rebuilds waitlist entries for jobs in BullMQ delayed state
 * that are missing from the waitlist (due to missed events, crashes, etc.)
 * Runs every 5min, scans first 500 delayed jobs per campaign
 */
class BullMQReconcilerService {
    constructor() {
        this.intervalId = null;
        this.running = false;
    }
    async start() {
        if (this.intervalId)
            return;
        this.intervalId = setInterval(() => {
            this.reconcileAll().catch(err => {
                logger_1.default.error('BullMQ reconciliation failed', { error: err.message });
            });
        }, ttls_1.TTL_CONFIG.reconcilerInterval);
        logger_1.default.info('✅ BullMQ reconciler started', {
            interval: `${ttls_1.TTL_CONFIG.reconcilerInterval}ms`
        });
    }
    async stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.running = false;
        logger_1.default.info('BullMQ reconciler stopped');
    }
    async reconcileAll() {
        try {
            const campaigns = await this.getActiveCampaigns();
            for (const campaignId of campaigns) {
                await this.reconcileCampaign(campaignId);
            }
        }
        catch (error) {
            logger_1.default.error('BullMQ reconciliation error', { error: error.message });
        }
    }
    async reconcileCampaign(campaignId) {
        try {
            // Get all delayed jobs for this campaign (bounded to first 500)
            const delayedJobs = await campaignCalls_queue_1.campaignCallsQueue.getDelayed(0, 500);
            const campaignDelayed = delayedJobs.filter(job => job.data?.campaignId === campaignId);
            if (campaignDelayed.length === 0)
                return;
            // Check which are missing from waitlist
            const highKey = `campaign:{${campaignId}}:waitlist:high`;
            const normalKey = `campaign:{${campaignId}}:waitlist:normal`;
            const markerPrefix = `campaign:{${campaignId}}:waitlist:marker:`;
            let rebuilt = 0;
            for (const job of campaignDelayed) {
                const markerKey = `${markerPrefix}${job.id}`;
                const exists = await redis_1.redis.exists(markerKey);
                if (!exists) {
                    // Missing from waitlist - re-push
                    const priority = (job.opts?.priority || 0) > 0 ? 'high' : 'normal';
                    const waitlistKey = priority === 'high' ? highKey : normalKey;
                    await redis_1.redis.rPush(waitlistKey, job.id);
                    await redis_1.redis.setEx(markerKey, ttls_1.TTL_CONFIG.markerTTL, '1');
                    rebuilt++;
                }
            }
            if (rebuilt > 0) {
                logger_1.default.warn('🔧 BullMQ reconciler rebuilt waitlist entries', {
                    campaignId,
                    rebuilt,
                    scanned: campaignDelayed.length
                });
                metrics_1.metrics.inc('bullmq_waitlist_rebuilt', {
                    campaign: campaignId
                }, rebuilt);
            }
        }
        catch (error) {
            logger_1.default.error('Campaign reconciliation failed', {
                campaignId,
                error: error.message
            });
        }
    }
    async getActiveCampaigns() {
        try {
            const Campaign = require('../models/Campaign').Campaign;
            const campaigns = await Campaign.find({ status: 'active' }).select('_id');
            return campaigns.map((c) => c._id.toString());
        }
        catch (error) {
            logger_1.default.error('Failed to get active campaigns', { error });
            return [];
        }
    }
}
exports.bullmqReconciler = new BullMQReconcilerService();
//# sourceMappingURL=bullmqReconciler.service.js.map
