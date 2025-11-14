"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.waitlistService = void 0;
const redis_1 = require("../config/redis");
const campaignCalls_queue_1 = require("../queues/campaignCalls.queue");
const logger_1 = __importDefault(require("../utils/logger"));
const redisConcurrency_util_1 = require("../utils/redisConcurrency.util");
const circuitBreaker_1 = require("../utils/circuitBreaker");
const metrics_1 = require("../utils/metrics");
/**
 * Waitlist Service
 * Manages promotion of jobs from waitlist to BullMQ waiting state
 * Uses pub/sub for instant promotion + poller for fallback
 */
class WaitlistService {
    constructor() {
        this.subscriber = null;
        this.pollerIntervalId = null;
        this.running = false;
        this.activeCampaigns = new Set();
    }
    async start() {
        if (this.running)
            return;
        this.running = true;
        // Start pub/sub subscriber for instant promotion
        await this.startSubscriber();
        // Start fallback poller (2-5s jitter per campaign)
        this.startPoller();
        logger_1.default.info('✅ Waitlist service started (pub/sub + poller)');
    }
    async stop() {
        if (this.subscriber) {
            await this.subscriber.pUnsubscribe('campaign:*:slot-available');
            await this.subscriber.quit();
            this.subscriber = null;
        }
        if (this.pollerIntervalId) {
            clearInterval(this.pollerIntervalId);
            this.pollerIntervalId = null;
        }
        this.running = false;
        logger_1.default.info('Waitlist service stopped');
    }
    async startSubscriber() {
        this.subscriber = redis_1.redis.duplicate();
        await this.subscriber.connect();
        // Subscribe to slot-available pattern
        await this.subscriber.pSubscribe('campaign:*:slot-available', (message, channel) => {
            // Extract campaignId from channel
            const match = channel.match(/campaign:(.+?):slot-available/);
            if (!match)
                return;
            const campaignId = match[1];
            logger_1.default.info('🔔 Received slot-available notification', { campaignId, channel });
            // Trigger immediate promotion (non-blocking)
            this.promoteNextBatch(campaignId).catch(err => {
                logger_1.default.error('Promotion failed on notification', {
                    campaignId,
                    error: err.message
                });
            });
        });
        logger_1.default.info('✅ Subscribed to campaign:*:slot-available');
    }
    startPoller() {
        // Fallback poller runs every 2-5s per campaign
        this.pollerIntervalId = setInterval(async () => {
            try {
                const campaigns = await this.getActiveCampaigns();
                if (campaigns.length > 0) {
                    logger_1.default.info('⏰ Poller tick', { activeCampaigns: campaigns.length });
                }
                for (const campaignId of campaigns) {
                    // Add jitter to avoid synchronized polling
                    const jitter = Math.floor(Math.random() * 3000);
                    setTimeout(() => {
                        this.promoteNextBatch(campaignId).catch(err => {
                            logger_1.default.error('Poller promotion failed', {
                                campaignId,
                                error: err.message
                            });
                        });
                    }, jitter);
                }
            }
            catch (error) {
                logger_1.default.error('Poller failed', { error: error.message });
            }
        }, 5000); // Base interval 5s
        logger_1.default.info('✅ Fallback poller started (5s + jitter)');
    }
    async promoteNextBatch(campaignId) {
        const mutexKey = `campaign:{${campaignId}}:promote-mutex`;
        // Try to acquire mutex
        const got = await redis_1.redis.set(mutexKey, '1', {
            EX: 5,
            NX: true
        });
        if (!got) {
            metrics_1.metrics.inc('promoter_conflicts', { campaign: campaignId });
            return;
        }
        // Renew mutex every 2s while promoting
        const renewInterval = setInterval(async () => {
            await redis_1.redis.expire(mutexKey, 5);
        }, 2000);
        try {
            // Check if campaign paused
            const pausedKey = `campaign:{${campaignId}}:paused`;
            const paused = await redis_1.redis.exists(pausedKey);
            if (paused) {
                return;
            }
            // Check circuit breaker
            const isOpen = await circuitBreaker_1.circuitBreaker.isOpen(campaignId);
            if (isOpen) {
                logger_1.default.warn('⏸️ Circuit breaker open, skipping promotion', { campaignId });
                return;
            }
            // Get adjusted batch size
            const batchSize = await circuitBreaker_1.circuitBreaker.getBatchSize(campaignId, 50);
            // Call atomic pop_reserve_promote Lua
            const result = await redisConcurrency_util_1.redisConcurrencyTracker.reservePromotionSlotsWithLedger(campaignId, batchSize);
            const { count, seq, promoteIds } = result;
            if (count === 0) {
                return;
            }
            logger_1.default.info('🎯 Reserved slots for promotion', {
                campaignId,
                count,
                seq
            });
            // Promote jobs with gate seq
            const promoteStart = Date.now();
            for (const jobId of promoteIds) {
                try {
                    const job = await campaignCalls_queue_1.campaignCallsQueue.getJob(jobId);
                    if (!job) {
                        // Job doesn't exist - claim reservation and decrement counter
                        await redisConcurrency_util_1.redisConcurrencyTracker.claimReservation(campaignId, jobId);
                        await redisConcurrency_util_1.redisConcurrencyTracker.decrementReserved(campaignId, 1);
                        logger_1.default.warn('Job not found during promotion', { jobId, campaignId });
                        metrics_1.metrics.inc('promotion_job_not_found', { campaign: campaignId });
                        continue;
                    }
                    // Update job data with gate info BEFORE promoting
                    job.data.promoteSeq = seq;
                    job.data.promotedAt = Date.now();
                    await job.updateData(job.data);
                    // Now promote
                    await job.promote();
                }
                catch (error) {
                    logger_1.default.error('Failed to promote job', {
                        jobId,
                        campaignId,
                        error: error.message
                    });
                    // Claim reservation and decrement counter to avoid leak
                    await redisConcurrency_util_1.redisConcurrencyTracker.claimReservation(campaignId, jobId);
                    await redisConcurrency_util_1.redisConcurrencyTracker.decrementReserved(campaignId, 1);
                }
            }
            const promotionLatency = Date.now() - promoteStart;
            metrics_1.metrics.observe('promotion_latency_ms', promotionLatency, {
                campaign: campaignId
            });
            logger_1.default.info('✅ Promoted jobs', {
                campaignId,
                promoted: promoteIds.length,
                seq,
                latencyMs: promotionLatency
            });
            // Record success for circuit breaker
            await circuitBreaker_1.circuitBreaker.recordSuccess(campaignId);
        }
        catch (error) {
            logger_1.default.error('Promotion batch failed', {
                campaignId,
                error: error.message
            });
            // Record failure for circuit breaker
            await circuitBreaker_1.circuitBreaker.recordFailure(campaignId);
        }
        finally {
            clearInterval(renewInterval);
            await redis_1.redis.del(mutexKey);
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
exports.waitlistService = new WaitlistService();
//# sourceMappingURL=waitlist.service.js.map
