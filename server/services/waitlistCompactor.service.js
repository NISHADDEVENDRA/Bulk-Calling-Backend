"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.waitlistCompactor = void 0;
const redis_1 = require("../config/redis");
const campaignCalls_queue_1 = require("../queues/campaignCalls.queue");
const logger_1 = __importDefault(require("../utils/logger"));
const ttls_1 = require("../config/ttls");
/**
 * Waitlist Compactor Service
 * Removes stale/completed/failed job IDs from waitlists
 * Runs every 2min, samples first 1000 entries per waitlist
 */
class WaitlistCompactorService {
    constructor() {
        this.intervalId = null;
        this.running = false;
    }
    async start() {
        if (this.intervalId)
            return;
        this.intervalId = setInterval(() => {
            this.compactAll().catch(err => {
                logger_1.default.error('Waitlist compaction failed', { error: err.message });
            });
        }, ttls_1.TTL_CONFIG.compactorInterval);
        logger_1.default.info('✅ Waitlist compactor started', {
            interval: `${ttls_1.TTL_CONFIG.compactorInterval}ms`
        });
    }
    async stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.running = false;
        logger_1.default.info('Waitlist compactor stopped');
    }
    async compactAll() {
        try {
            const campaigns = await this.getActiveCampaigns();
            for (const campaignId of campaigns) {
                await this.compactCampaign(campaignId);
            }
        }
        catch (error) {
            logger_1.default.error('Waitlist compaction error', { error: error.message });
        }
    }
    async compactCampaign(campaignId) {
        const highKey = `campaign:{${campaignId}}:waitlist:high`;
        const normalKey = `campaign:{${campaignId}}:waitlist:normal`;
        for (const key of [highKey, normalKey]) {
            await this.compactWaitlist(key, campaignId);
        }
    }
    async compactWaitlist(key, campaignId) {
        const len = await redis_1.redis.lLen(key);
        if (len === 0)
            return;
        // Sample first 1000 entries
        const sample = Math.min(len, 1000);
        const ids = await redis_1.redis.lRange(key, 0, sample - 1);
        const toRemove = [];
        for (const id of ids) {
            try {
                const job = await campaignCalls_queue_1.campaignCallsQueue.getJob(id);
                if (!job) {
                    // Job doesn't exist
                    toRemove.push(id);
                }
                else {
                    const state = await job.getState();
                    if (state === 'completed' || state === 'failed') {
                        toRemove.push(id);
                    }
                }
            }
            catch (error) {
                // Job retrieval error - mark for removal
                toRemove.push(id);
            }
        }
        if (toRemove.length > 0) {
            // Remove each stale ID from list
            for (const id of toRemove) {
                await redis_1.redis.lRem(key, 1, id);
            }
            logger_1.default.info('Compacted waitlist', {
                campaignId,
                waitlist: key.includes('high') ? 'high' : 'normal',
                removed: toRemove.length,
                sampled: sample,
                totalLen: len
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
exports.waitlistCompactor = new WaitlistCompactorService();
//# sourceMappingURL=waitlistCompactor.service.js.map
