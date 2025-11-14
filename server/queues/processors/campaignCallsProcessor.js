"use strict";
/**
 * Campaign Calls Queue Processor
 * Processes campaign call jobs with two-phase dial flow:
 * 1. Pre-dial slot acquisition (15-20s TTL)
 * 2. Upgrade to active lease on carrier answer (180-240s TTL)
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.campaignWorker = void 0;
exports.processCampaignCall = processCampaignCall;
const bullmq_1 = require("bullmq");
const outgoingCall_service_1 = require("../../services/outgoingCall.service");
const Campaign_1 = require("../../models/Campaign");
const CampaignContact_1 = require("../../models/CampaignContact");
const CallLog_1 = require("../../models/CallLog");
const logger_1 = require("../../utils/logger");
const redisConcurrency_util_1 = require("../../utils/redisConcurrency.util");
const coldStartGuard_1 = require("../../utils/coldStartGuard");
const redis_1 = require("../../config/redis");
const metrics_1 = require("../../utils/metrics");
const campaignLogger_1 = require("../../utils/campaignLogger");
const ioredis_1 = __importDefault(require("ioredis"));
// Create Redis connection for worker (supports Upstash TLS)
const connection = new ioredis_1.default((0, redis_1.buildIORedisOptions)({
    maxRetriesPerRequest: null,
    enableReadyCheck: false
}));
/**
 * Process a campaign call job with two-phase dial
 */
async function processCampaignCall(job) {
    const { campaignId, campaignContactId, agentId, phoneNumber, phoneId, userId, name, email, customData, retryCount, isRetry, priority, metadata = {}, promoteSeq, promotedAt } = job.data;
    logger_1.logger.info('Processing campaign call', {
        jobId: job.id,
        campaignId,
        campaignContactId,
        phoneNumber,
        promoteSeq
    });
    try {
        // ===== GUARD: Check if campaign paused =====
        const pausedKey = `campaign:{${campaignId}}:paused`;
        const paused = await redis_1.redis.exists(pausedKey);
        if (paused) {
            logger_1.logger.info('Campaign paused, re-delaying job', { campaignId, jobId: job.id });
            // Throw error to trigger BullMQ retry
            throw new Error('Campaign is paused');
        }
        // ===== GUARD: Reject jobs without promotion gate =====
        if (!promoteSeq) {
            const repairCount = metadata.gateRepairs || 0;
            if (repairCount >= 5) {
                // Hard-sync: force into waitlist
                logger_1.logger.error('🚨 Gate repair limit reached, hard-syncing to waitlist', {
                    jobId: job.id,
                    campaignId,
                    repairCount
                });
                const priority = (job.opts?.priority || 0) > 0 ? 'high' : 'normal';
                const waitlistKey = `campaign:{${campaignId}}:waitlist:${priority}`;
                await redis_1.redis.lPush(waitlistKey, job.id);
                // Set sentinel promoteSeq
                job.data.promoteSeq = -1;
                job.data.promotedAt = Date.now();
                await job.updateData(job.data);
                metrics_1.metrics.inc('gate_hard_sync', { campaign: campaignId });
                return 'hard-synced-to-waitlist';
            }
            // Increment repair counter
            metadata.gateRepairs = repairCount + 1;
            job.data.metadata = metadata;
            await job.updateData(job.data);
            logger_1.logger.warn('⚠️ Gate-less job, repairing', {
                jobId: job.id,
                campaignId,
                repairAttempt: metadata.gateRepairs
            });
            metrics_1.metrics.inc('gate_repair', { campaign: campaignId });
            // Throw error to trigger BullMQ retry with backoff (don't try to move job manually)
            throw new Error(`Gate-less job needs retry (attempt ${metadata.gateRepairs})`);
        }
        // ===== Verify promotion gate =====
        const currentSeq = await redis_1.redis.get(`campaign:{${campaignId}}:promote-gate`);
        if (currentSeq && promoteSeq !== -1) { // -1 is sentinel from hard-sync
            const current = parseInt(currentSeq);
            if (promoteSeq < current) {
                logger_1.logger.warn('⚠️ Job from old promotion gate, re-delaying', {
                    campaignId,
                    jobSeq: promoteSeq,
                    currentSeq: current
                });
                // Throw error to trigger BullMQ retry
                throw new Error(`Stale promotion gate: job seq ${promoteSeq} < current ${current}`);
            }
        }
        // Check if promotion too old (15s grace)
        if (promotedAt && Date.now() - promotedAt > 15000) {
            logger_1.logger.warn('⚠️ Job promotion expired, re-delaying', {
                campaignId,
                age: Date.now() - promotedAt
            });
            // Throw error to trigger BullMQ retry
            throw new Error(`Promotion expired: ${Date.now() - promotedAt}ms old`);
        }
        // ===== Get campaign =====
        const campaign = await Campaign_1.Campaign.findById(campaignId);
        if (!campaign) {
            throw new Error(`Campaign not found: ${campaignId}`);
        }
        if (campaign.status !== 'active') {
            logger_1.logger.warn('Campaign not active, skipping', {
                campaignId,
                status: campaign.status
            });
            return `Skipped: campaign status is ${campaign.status}`;
        }
        // ===== Get campaign contact =====
        const contact = await CampaignContact_1.CampaignContact.findById(campaignContactId);
        if (!contact) {
            throw new Error(`Campaign contact not found: ${campaignContactId}`);
        }
        if (contact.status === 'completed' || contact.status === 'skipped') {
            logger_1.logger.warn('Contact already processed', {
                campaignContactId,
                status: contact.status
            });
            return `Skipped: contact status is ${contact.status}`;
        }
        // ===== Check cold-start guard =====
        await (0, coldStartGuard_1.coldStartGuard)(campaignId);
        if (await (0, coldStartGuard_1.isColdStartBlocking)(campaignId)) {
            logger_1.logger.warn('⏸️ Campaign in cold-start grace period, delaying job', {
                campaignId
            });
            // Throw error to trigger BullMQ retry with backoff (don't try to move job manually)
            throw new Error('Campaign in cold-start grace period');
        }
        // ===== PHASE 1: Acquire pre-dial slot =====
        const concurrentLimit = campaign.settings.concurrentCallsLimit;
        const callId = `call-${Date.now()}-${campaignContactId}`;
        const preToken = await redisConcurrency_util_1.redisConcurrencyTracker.acquirePreDialSlot(campaignId, callId, concurrentLimit);
        if (!preToken) {
            // Failed to acquire - release reservation
            await redisConcurrency_util_1.redisConcurrencyTracker.claimReservation(campaignId, job.id);
            const activeCalls = await redisConcurrency_util_1.redisConcurrencyTracker.getActiveCalls(campaignId);
            // Log concurrency status when at capacity
            campaignLogger_1.campaignLogger.logConcurrencySnapshot({
                campaignId,
                activeSlots: activeCalls,
                limit: concurrentLimit
            });
            metrics_1.metrics.inc('no_slot_delays', { campaign: campaignId });
            // Throw error to trigger BullMQ retry
            throw new Error(`No slot available: ${activeCalls}/${concurrentLimit} slots in use`);
        }
        // Log slot acquisition
        campaignLogger_1.campaignLogger.logSlotEvent({
            campaignId,
            callId,
            action: 'acquired',
            slotType: 'pre-dial'
        });
        // Update contact status
        contact.status = 'calling';
        contact.lastAttemptAt = new Date();
        await contact.save();
        await Campaign_1.Campaign.findByIdAndUpdate(campaignId, {
            $inc: { activeCalls: 1, queuedCalls: -1 }
        });
        await job.updateProgress(25);
        // ===== Initiate call =====
        let callLogId;
        let renewPreDialInterval;
        let finalStatus = 'unknown';
        try {
            logger_1.logger.info('🚀 Initiating campaign call', {
                campaignId,
                campaignContactId,
                phoneNumber,
                callId
            });
            // Start pre-dial renewal heartbeat (every 10s, up to 45s cap)
            renewPreDialInterval = setInterval(async () => {
                const renewed = await redisConcurrency_util_1.redisConcurrencyTracker.renewPreDialLease(campaignId, callId, preToken);
                if (!renewed) {
                    clearInterval(renewPreDialInterval);
                }
            }, 10000);
            callLogId = await outgoingCall_service_1.outgoingCallService.initiateCall({
                phoneNumber,
                phoneId,
                agentId,
                userId,
                campaignId,
                skipSlotAcquisition: true, // CRITICAL: Slot already acquired above via pre-dial lease
                metadata: {
                    ...metadata,
                    campaignId,
                    campaignContactId,
                    contactName: name,
                    contactEmail: email,
                    customData,
                    isCampaignCall: true,
                    retryCount,
                    callId,
                    preToken // For upgrade later
                },
                priority: priority > 0 ? 'high' : 'medium'
            });
            await job.updateProgress(50);
            // Stop pre-dial renewal
            if (renewPreDialInterval) {
                clearInterval(renewPreDialInterval);
            }
            // Brief delay to allow call initiation status update
            await new Promise(resolve => setTimeout(resolve, 1000));
            // ===== PHASE 2: Upgrade to active lease =====
            const callLog = await CallLog_1.CallLog.findById(callLogId);
            if (callLog?.status === 'in-progress' || callLog?.status === 'ringing') {
                const upgradeStart = Date.now();
                const activeToken = await redisConcurrency_util_1.redisConcurrencyTracker.upgradeToActive(campaignId, callId, preToken);
                if (!activeToken) {
                    logger_1.logger.error('❌ Failed to upgrade to active lease', {
                        campaignId,
                        callId
                    });
                    // Release pre-dial + claim reservation
                    await redisConcurrency_util_1.redisConcurrencyTracker.forceReleaseSlot(campaignId, callId);
                    await redisConcurrency_util_1.redisConcurrencyTracker.claimReservation(campaignId, job.id);
                    throw new Error('Lease upgrade failed');
                }
                const upgradeLatency = Date.now() - upgradeStart;
                metrics_1.metrics.observe('pre_to_active_upgrade_latency_ms', upgradeLatency, {
                    campaign: campaignId
                });
                logger_1.logger.info('✅ Upgraded to active lease', {
                    campaignId,
                    callId,
                    tokenPrefix: activeToken.substring(0, 8) + '...',
                    latencyMs: upgradeLatency
                });
                // Store token in call log for webhook release
                callLog.metadata = callLog.metadata || {};
                callLog.metadata.leaseToken = activeToken;
                callLog.metadata.callId = callId;
                await callLog.save();
                // Progressive cold-start unblock
                await (0, coldStartGuard_1.onSuccessfulUpgrade)(campaignId);
                // Success - claim reservation
                await redisConcurrency_util_1.redisConcurrencyTracker.claimReservation(campaignId, job.id);
            }
            else {
                // Call failed before answer, release pre-dial
                logger_1.logger.warn('⚠️ Call failed before answer, releasing pre-dial', {
                    campaignId,
                    callId,
                    status: callLog?.status
                });
                await redisConcurrency_util_1.redisConcurrencyTracker.releaseSlot(campaignId, callId, preToken, true, // isPreDial
                true // publish
                );
                // Claim reservation
                await redisConcurrency_util_1.redisConcurrencyTracker.claimReservation(campaignId, job.id);
            }
            await job.updateProgress(75);
            // NOTE: Contact status updates will be handled by webhook when call completes
            // Processor only handles initial call initiation and lease upgrade
            logger_1.logger.info('Campaign call initiated and lease upgraded', {
                campaignId,
                campaignContactId,
                callLogId,
                callId
            });
            // Mark job complete - webhook will handle final status and slot release
            await job.updateProgress(100);
            return callLogId || 'completed';
        }
        catch (error) {
            // Cleanup on error
            if (renewPreDialInterval) {
                clearInterval(renewPreDialInterval);
            }
            // Try to release pre-dial slot
            try {
                await redisConcurrency_util_1.redisConcurrencyTracker.releaseSlot(campaignId, callId, preToken, true, // isPreDial
                true // publish - MUST notify waitlist!
                );
            }
            catch (releaseError) {
                logger_1.logger.error('Failed to release pre-dial on error', { releaseError });
            }
            // Claim reservation
            await redisConcurrency_util_1.redisConcurrencyTracker.claimReservation(campaignId, job.id);
            throw error;
        }
    }
    catch (error) {
        // Outer catch - log but don't process contact status
        // (webhook will handle it)
        logger_1.logger.error('Failed to process campaign call', {
            campaignId,
            campaignContactId,
            error: error.message
        });
        throw error;
    }
}
// NOTE: Contact status updates and slot release are now handled by webhook
// This avoids blocking the worker and creates a single source of truth
/**
 * Check if campaign is complete and update status
 */
async function checkCampaignCompletion(campaignId) {
    try {
        const campaign = await Campaign_1.Campaign.findById(campaignId);
        if (!campaign || campaign.status !== 'active') {
            return;
        }
        const totalProcessed = campaign.completedCalls + campaign.failedCalls + campaign.voicemailCalls;
        if (totalProcessed >= campaign.totalContacts && campaign.activeCalls === 0 && campaign.queuedCalls === 0) {
            campaign.status = 'completed';
            campaign.completedAt = new Date();
            await campaign.save();
            logger_1.logger.info('Campaign completed', {
                campaignId,
                totalContacts: campaign.totalContacts,
                completedCalls: campaign.completedCalls,
                failedCalls: campaign.failedCalls,
                voicemailCalls: campaign.voicemailCalls
            });
        }
    }
    catch (error) {
        logger_1.logger.error('Error checking campaign completion', { campaignId, error });
    }
}
// CRITICAL: Only create worker on PRIMARY PM2 instance
const isPrimary = process.env.NODE_APP_INSTANCE === '0' || !process.env.NODE_APP_INSTANCE;
let worker = null;
exports.campaignWorker = worker;
if (isPrimary) {
    exports.campaignWorker = worker = new bullmq_1.Worker('campaign-calls', async (job) => {
        const result = await processCampaignCall(job);
        await checkCampaignCompletion(job.data.campaignId);
        return result;
    }, {
        connection,
        concurrency: 1, // Sequential processing
        limiter: {
            max: 10,
            duration: 1000
        }
    });
    worker.on('completed', (job) => {
        logger_1.logger.info('Campaign call job completed', {
            jobId: job.id,
            campaignId: job.data.campaignId
        });
    });
    worker.on('failed', (job, error) => {
        logger_1.logger.error('Campaign call job failed', {
            jobId: job?.id,
            campaignId: job?.data?.campaignId,
            error: error.message,
            attemptsMade: job?.attemptsMade
        });
    });
    worker.on('error', (error) => {
        logger_1.logger.error('Campaign worker error', {
            error: error.message,
            stack: error.stack
        });
    });
    logger_1.logger.info('✅ Campaign calls processor registered on PRIMARY instance', {
        concurrency: 1,
        instanceId: process.env.NODE_APP_INSTANCE || '0'
    });
}
else {
    logger_1.logger.info('⏭️ Skipping campaign worker registration on secondary instance', {
        instanceId: process.env.NODE_APP_INSTANCE
    });
}
//# sourceMappingURL=campaignCallsProcessor.js.map
