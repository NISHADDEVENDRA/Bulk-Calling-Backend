"use strict";
/**
 * Campaign Calls Queue Processor
 * Processes campaign call jobs with per-agent concurrency control
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
const ioredis_1 = __importDefault(require("ioredis"));
// Create Redis connection for worker
const connection = new ioredis_1.default((0, redis_1.buildIORedisOptions)({
    maxRetriesPerRequest: null,
    enableReadyCheck: false
}));
/**
 * Process a campaign call job
 */
async function processCampaignCall(job) {
    const { campaignId, campaignContactId, agentId, phoneNumber, phoneId, userId, name, email, customData, retryCount, isRetry, priority, metadata } = job.data;
    logger_1.logger.info('Processing campaign call', {
        jobId: job.id,
        campaignId,
        campaignContactId,
        agentId,
        phoneNumber,
        isRetry,
        retryCount,
        attemptsMade: job.attemptsMade
    });
    try {
        // Get campaign to check status and settings
        const campaign = await Campaign_1.Campaign.findById(campaignId);
        if (!campaign) {
            throw new Error(`Campaign not found: ${campaignId}`);
        }
        // Check if campaign is still active
        if (campaign.status !== 'active') {
            logger_1.logger.warn('Campaign not active, skipping call', {
                campaignId,
                status: campaign.status
            });
            return `Skipped: campaign status is ${campaign.status}`;
        }
        // Get campaign contact
        const contact = await CampaignContact_1.CampaignContact.findById(campaignContactId);
        if (!contact) {
            throw new Error(`Campaign contact not found: ${campaignContactId}`);
        }
        // Check if contact already processed
        if (contact.status === 'completed' || contact.status === 'skipped') {
            logger_1.logger.warn('Contact already processed', {
                campaignContactId,
                status: contact.status
            });
            return `Skipped: contact status is ${contact.status}`;
        }
        // Get concurrent limit from campaign settings
        const concurrentLimit = campaign.settings.concurrentCallsLimit;
        // Try to acquire a slot for this campaign
        const slotAcquired = await redisConcurrency_util_1.redisConcurrencyTracker.acquireSlot(campaignId, concurrentLimit);
        if (!slotAcquired) {
            // No slot available, move job to delayed state
            const activeCalls = await redisConcurrency_util_1.redisConcurrencyTracker.getActiveCalls(campaignId);
            logger_1.logger.warn('⏸️ No concurrent slot available for campaign, delaying job by 3 seconds', {
                campaignId,
                concurrentLimit,
                activeCalls,
                phoneNumber,
                jobId: job.id,
                attemptsMade: job.attemptsMade
            });
            // Move job back to delayed state instead of failing it
            // This allows infinite retries until a slot is available
            await job.moveToDelayed(Date.now() + 3000, job.token);
            // Return success to prevent BullMQ from marking it as failed
            return 'delayed-no-slot';
        }
        // Update contact status to calling
        contact.status = 'calling';
        contact.lastAttemptAt = new Date();
        await contact.save();
        // Update campaign active calls count
        await Campaign_1.Campaign.findByIdAndUpdate(campaignId, {
            $inc: { activeCalls: 1, queuedCalls: -1 }
        });
        // Report progress
        await job.updateProgress(25);
        // Initiate the outbound call with campaignId for concurrent tracking
        logger_1.logger.info('🚀 Initiating campaign call', {
            campaignId,
            campaignContactId,
            phoneNumber,
            concurrentLimit,
            activeCalls: await redisConcurrency_util_1.redisConcurrencyTracker.getActiveCalls(campaignId)
        });
        const callLogId = await outgoingCall_service_1.outgoingCallService.initiateCall({
            phoneNumber,
            phoneId,
            agentId,
            userId,
            campaignId, // Pass campaignId for tracking
            skipSlotAcquisition: true, // Slot already acquired above
            metadata: {
                ...metadata,
                campaignId,
                campaignContactId,
                contactName: name,
                contactEmail: email,
                customData,
                isCampaignCall: true,
                retryCount
            },
            priority: priority > 0 ? 'high' : 'medium'
        });
        logger_1.logger.info('✅ Campaign call initiated successfully', {
            campaignId,
            callLogId,
            phoneNumber
        });
        // Update contact with call log reference
        contact.callLogId = callLogId;
        await contact.save();
        await job.updateProgress(75);
        // Wait a bit to let call status update
        await new Promise(resolve => setTimeout(resolve, 2000));
        // Check call status
        const callLog = await CallLog_1.CallLog.findById(callLogId);
        const finalStatus = callLog?.status || 'initiated';
        // Update contact status based on call outcome
        if (callLog?.status === 'completed' || callLog?.status === 'in-progress') {
            contact.status = 'completed';
            await contact.save();
            // Update campaign stats
            await Campaign_1.Campaign.findByIdAndUpdate(campaignId, {
                $inc: { completedCalls: 1, activeCalls: -1 }
            });
        }
        else if (callLog?.metadata?.voicemailDetected) {
            contact.status = 'voicemail';
            await contact.save();
            // Update campaign stats
            await Campaign_1.Campaign.findByIdAndUpdate(campaignId, {
                $inc: { voicemailCalls: 1, activeCalls: -1 }
            });
            // Check if we should retry voicemail calls
            if (!campaign.settings.excludeVoicemail && retryCount < campaign.settings.maxRetryAttempts) {
                // Schedule retry
                contact.retryCount = retryCount + 1;
                contact.nextRetryAt = new Date(Date.now() + campaign.settings.retryDelayMinutes * 60 * 1000);
                contact.status = 'pending';
                await contact.save();
            }
        }
        else if (callLog?.status === 'failed' || callLog?.status === 'no-answer' || callLog?.status === 'busy') {
            const shouldRetry = campaign.settings.retryFailedCalls && retryCount < campaign.settings.maxRetryAttempts;
            if (shouldRetry) {
                contact.status = 'pending';
                contact.retryCount = retryCount + 1;
                contact.nextRetryAt = new Date(Date.now() + campaign.settings.retryDelayMinutes * 60 * 1000);
                contact.failureReason = callLog?.failureReason || 'Call failed';
                await contact.save();
                // Keep in queue counts
                await Campaign_1.Campaign.findByIdAndUpdate(campaignId, {
                    $inc: { queuedCalls: 1, activeCalls: -1 }
                });
            }
            else {
                contact.status = 'failed';
                contact.failureReason = callLog?.failureReason || 'Call failed';
                await contact.save();
                // Update campaign stats
                await Campaign_1.Campaign.findByIdAndUpdate(campaignId, {
                    $inc: { failedCalls: 1, activeCalls: -1 }
                });
            }
        }
        await job.updateProgress(100);
        logger_1.logger.info('Campaign call processed successfully', {
            campaignId,
            campaignContactId,
            callLogId,
            finalStatus,
            contactStatus: contact.status
        });
        return callLogId;
    }
    catch (error) {
        logger_1.logger.error('Failed to process campaign call', {
            campaignId,
            campaignContactId,
            error: error.message,
            stack: error.stack
        });
        // Update contact status to failed
        try {
            const contact = await CampaignContact_1.CampaignContact.findById(campaignContactId);
            if (contact && contact.status === 'calling') {
                contact.status = 'failed';
                contact.failureReason = error.message;
                await contact.save();
                // Update campaign stats
                await Campaign_1.Campaign.findByIdAndUpdate(campaignId, {
                    $inc: { failedCalls: 1, activeCalls: -1, queuedCalls: -1 }
                });
            }
        }
        catch (updateError) {
            logger_1.logger.error('Failed to update contact status', { updateError });
        }
        throw error;
    }
    // NOTE: Do NOT release slot here! The slot must remain occupied until the call
    // actually completes. It will be released by exotelVoice.handler when the call ends.
}
/**
 * Check if campaign is complete and update status
 */
async function checkCampaignCompletion(campaignId) {
    try {
        const campaign = await Campaign_1.Campaign.findById(campaignId);
        if (!campaign || campaign.status !== 'active') {
            return;
        }
        // Check if all contacts are processed
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
// CRITICAL: Only create worker on PRIMARY PM2 instance to avoid multiple workers
// When PM2 runs in cluster mode with 2 instances, each creates its own BullMQ worker
// This causes 2 workers to process jobs concurrently, bypassing concurrent limits
const isPrimary = process.env.NODE_APP_INSTANCE === '0' || !process.env.NODE_APP_INSTANCE;
let worker = null;
exports.campaignWorker = worker;
if (isPrimary) {
    // Create worker with concurrency control (ONLY on primary instance)
    exports.campaignWorker = worker = new bullmq_1.Worker('campaign-calls', async (job) => {
        const result = await processCampaignCall(job);
        // Check if campaign is complete after processing
        await checkCampaignCompletion(job.data.campaignId);
        return result;
    }, {
        connection,
        // CRITICAL: Must be 1 to enforce per-campaign concurrent limits
        // With concurrency > 1, multiple jobs process simultaneously and bypass Redis slot acquisition
        concurrency: 1,
        limiter: {
            max: 10, // Max 10 jobs per second globally
            duration: 1000
        }
    });
    // Worker event handlers
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
//# sourceMappingURL=campaignCallsProcessor.backup.js.map
