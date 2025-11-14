"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.outgoingCallService = exports.OutgoingCallService = void 0;
const uuid_1 = require("uuid");
const CallLog_1 = require("../models/CallLog");
const Phone_1 = require("../models/Phone");
const Campaign_1 = require("../models/Campaign");
const exotelOutbound_service_1 = require("./exotelOutbound.service");
const phone_service_1 = require("./phone.service");
const redisConcurrency_util_1 = require("../utils/redisConcurrency.util");
const redis_1 = require("../config/redis");
const logger_1 = __importDefault(require("../utils/logger"));
const mongoose_1 = __importDefault(require("mongoose"));
/**
 * Outgoing Call Service
 * Handles initiating and managing outbound calls
 */
class OutgoingCallService {
    constructor() {
        this.GLOBAL_ACTIVE_CALLS_KEY = 'system:outbound:active';
        this.maxConcurrentCalls = parseInt(process.env.MAX_CONCURRENT_OUTBOUND_CALLS || '10');
        this.activeCalls = new Map();
        logger_1.default.info('OutgoingCallService initialized', {
            maxConcurrentCalls: this.maxConcurrentCalls
        });
    }
    /**
     * Validate phone number (E.164 format)
     */
    validatePhoneNumber(phoneNumber) {
        const e164Regex = /^\+[1-9]\d{1,14}$/;
        return e164Regex.test(phoneNumber);
    }
    /**
     * Check if can initiate new call (cluster-wide concurrency limit)
     * Uses Redis SET to track active calls across all instances
     */
    async canInitiateCall() {
        // Clean up stale entries (calls older than 1 hour) from Redis
        const oneHourAgo = Date.now() - 3600000;
        const allMembers = await redis_1.redis.sMembers(this.GLOBAL_ACTIVE_CALLS_KEY);
        for (const member of allMembers) {
            const [callId, timestamp] = member.split(':');
            if (parseInt(timestamp) < oneHourAgo) {
                await redis_1.redis.sRem(this.GLOBAL_ACTIVE_CALLS_KEY, member);
            }
        }
        // Get current cluster-wide count
        const activeCount = await redis_1.redis.sCard(this.GLOBAL_ACTIVE_CALLS_KEY);
        return activeCount < this.maxConcurrentCalls;
    }
    /**
     * Get active calls count (cluster-wide)
     */
    async getActiveCalls() {
        return await redis_1.redis.sCard(this.GLOBAL_ACTIVE_CALLS_KEY);
    }
    /**
     * Initiate an outbound call
     */
    async initiateCall(params) {
        logger_1.default.info('Initiating outbound call', {
            phoneNumber: params.phoneNumber,
            phoneId: params.phoneId,
            agentId: params.agentId
        });
        // Validate phone number
        if (!this.validatePhoneNumber(params.phoneNumber)) {
            throw new Error('Invalid phone number format. Please use E.164 format (e.g., +919876543210)');
        }
        // Get phone configuration (contains Exotel credentials and appId)
        const phone = await Phone_1.Phone.findById(params.phoneId).populate('agentId');
        if (!phone) {
            throw new Error('Phone not found');
        }
        // Verify phone belongs to user
        if (phone.userId.toString() !== params.userId) {
            throw new Error('Unauthorized: Phone does not belong to user');
        }
        // Check if phone has Exotel configuration
        if (!phone.exotelData) {
            throw new Error('Phone does not have Exotel configuration. Please configure Exotel credentials for this phone.');
        }
        // Verify appId is configured
        if (!phone.exotelData.appId) {
            throw new Error('Phone does not have Exotel App ID configured. Please add App ID to this phone.');
        }
        // Get decrypted credentials
        const exotelCreds = await phone_service_1.phoneService.getExotelCredentials(params.phoneId, params.userId);
        if (!exotelCreds) {
            throw new Error('Failed to retrieve Exotel credentials');
        }
        // Verify agent exists
        const Agent = mongoose_1.default.model('Agent');
        const agent = await Agent.findById(params.agentId);
        if (!agent) {
            throw new Error('Agent not found');
        }
        // Check concurrent limit based on campaign settings
        let concurrentLimit = this.maxConcurrentCalls; // Default to system-wide limit
        let trackingKey = 'system'; // Default tracking key
        // Skip slot acquisition if already acquired by caller (e.g., campaign processor)
        if (!params.skipSlotAcquisition) {
            if (params.campaignId) {
                // If campaignId is provided, use campaign's concurrent limit
                const campaign = await Campaign_1.Campaign.findById(params.campaignId);
                if (campaign) {
                    concurrentLimit = campaign.settings.concurrentCallsLimit;
                    trackingKey = params.campaignId;
                    logger_1.default.info('📊 Campaign concurrent limit check', {
                        campaignId: params.campaignId,
                        concurrentLimit,
                        activeCalls: await redisConcurrency_util_1.redisConcurrencyTracker.getActiveCalls(trackingKey),
                        phoneNumber: params.phoneNumber
                    });
                    // Try to acquire slot using Redis-based concurrency tracker
                    const slotAcquired = await redisConcurrency_util_1.redisConcurrencyTracker.acquireSlot(trackingKey, concurrentLimit);
                    if (!slotAcquired) {
                        const activeCalls = await redisConcurrency_util_1.redisConcurrencyTracker.getActiveCalls(trackingKey);
                        logger_1.default.warn('❌ Campaign concurrent limit reached', {
                            campaignId: params.campaignId,
                            activeCalls,
                            concurrentLimit,
                            phoneNumber: params.phoneNumber
                        });
                        throw new Error(`Campaign concurrent call limit reached (${activeCalls}/${concurrentLimit}). Please wait for active calls to complete.`);
                    }
                    logger_1.default.info('✅ Slot acquired for campaign call', {
                        campaignId: params.campaignId,
                        activeCalls: await redisConcurrency_util_1.redisConcurrencyTracker.getActiveCalls(trackingKey),
                        concurrentLimit
                    });
                }
                else {
                    logger_1.default.warn('Campaign not found, using system-wide limit', { campaignId: params.campaignId });
                    // Fallback to system-wide check
                    if (!await this.canInitiateCall()) {
                        throw new Error('Maximum concurrent calls reached. Please try again in a few minutes.');
                    }
                }
            }
            else {
                // No campaign specified, use system-wide limit
                if (!await this.canInitiateCall()) {
                    throw new Error('Maximum concurrent calls reached. Please try again in a few minutes.');
                }
            }
        }
        else {
            // Slot already acquired by caller, just set the tracking key
            if (params.campaignId) {
                trackingKey = params.campaignId;
                logger_1.default.info('🔄 Using pre-acquired slot for campaign call', {
                    campaignId: params.campaignId,
                    phoneNumber: params.phoneNumber
                });
            }
        }
        // Check if this is a retry
        let callLog;
        if (params.callLogId) {
            // Retry: Update existing CallLog
            callLog = await CallLog_1.CallLog.findById(params.callLogId);
            if (!callLog) {
                throw new Error('Original call log not found for retry');
            }
            // Check if call should NOT be retried (voicemail detected)
            if (callLog.failureReason === 'voicemail' || callLog.outboundStatus === 'voicemail') {
                throw new Error('Cannot retry voicemail-detected calls. The call reached a voicemail system.');
            }
            // Check metadata for voicemail detection
            if (callLog.metadata?.voicemailDetected === true) {
                throw new Error('Cannot retry voicemail-detected calls. Voicemail was detected with ' +
                    (callLog.metadata.voicemailConfidence * 100).toFixed(0) + '% confidence.');
            }
            // Create new CallLog for retry attempt
            callLog = await CallLog_1.CallLog.create({
                sessionId: (0, uuid_1.v4)(),
                userId: params.userId,
                phoneId: params.phoneId,
                agentId: params.agentId,
                fromPhone: phone.number,
                toPhone: params.phoneNumber,
                direction: 'outbound',
                status: 'initiated',
                retryOf: params.callLogId,
                retryCount: (callLog.retryCount || 0) + 1,
                initiatedAt: new Date(),
                metadata: params.metadata || {}
            });
        }
        else {
            // New call: Create CallLog
            callLog = await CallLog_1.CallLog.create({
                sessionId: (0, uuid_1.v4)(),
                userId: params.userId,
                phoneId: params.phoneId,
                agentId: params.agentId,
                campaignId: params.campaignId || undefined, // Store campaignId if provided
                fromPhone: phone.number,
                toPhone: params.phoneNumber,
                direction: 'outbound',
                status: 'initiated',
                retryCount: 0,
                initiatedAt: new Date(),
                metadata: {
                    ...(params.metadata || {}),
                    concurrencyTrackingKey: trackingKey // Store tracking key for slot release
                }
            });
        }
        const callLogId = callLog._id.toString();
        try {
            // Prepare Exotel API parameters using phone-specific configuration
            const exotelParams = {
                from: phone.number,
                to: params.phoneNumber,
                callerId: phone.number,
                appId: exotelCreds.appId, // Use phone-specific App ID
                customField: callLogId, // Pass callLogId for webhook
                credentials: {
                    apiKey: exotelCreds.apiKey,
                    apiToken: exotelCreds.apiToken,
                    sid: exotelCreds.sid,
                    subdomain: exotelCreds.subdomain
                }
            };
            // Call Exotel API with phone-specific credentials
            const response = await exotelOutbound_service_1.exotelOutboundService.makeCall(exotelParams);
            // Update CallLog with Exotel SID
            await CallLog_1.CallLog.findByIdAndUpdate(callLogId, {
                exotelCallSid: response.sid,
                outboundStatus: 'queued',
                status: 'ringing'
            });
            // Track active call (cluster-wide via Redis + local for backward compat)
            this.activeCalls.set(callLogId, new Date());
            // Add to cluster-wide tracking
            const member = `${callLogId}:${Date.now()}`;
            await redis_1.redis.sAdd(this.GLOBAL_ACTIVE_CALLS_KEY, member);
            await redis_1.redis.expire(this.GLOBAL_ACTIVE_CALLS_KEY, 3600); // 1 hour TTL
            logger_1.default.info('Outbound call initiated successfully', {
                callLogId,
                exotelCallSid: response.sid,
                phoneNumber: params.phoneNumber,
                phoneId: params.phoneId
            });
            return callLogId;
        }
        catch (error) {
            // Release the slot if call initiation failed (only if we acquired it)
            // TODO: Update to new two-phase API: releaseSlot(campaignId, callId, token)
            // Commenting out for now - campaign calls now use campaignCallsProcessor
            // if (!params.skipSlotAcquisition && params.campaignId && trackingKey !== 'system') {
            //   await redisConcurrencyTracker.releaseSlot(trackingKey);
            //   logger.info('🔓 Released concurrent slot due to call initiation failure', {
            //     campaignId: params.campaignId,
            //     trackingKey,
            //     error: error.message
            //   });
            // }
            // Update CallLog as failed
            await CallLog_1.CallLog.findByIdAndUpdate(callLogId, {
                status: 'failed',
                error: {
                    code: 'EXOTEL_API_ERROR',
                    message: error.message
                }
            });
            logger_1.default.error('Failed to initiate outbound call', {
                callLogId,
                error: error.message
            });
            throw error;
        }
    }
    /**
     * Get call status
     */
    async getCallStatus(callLogId) {
        const callLog = await CallLog_1.CallLog.findById(callLogId);
        if (!callLog) {
            throw new Error('Call not found');
        }
        return {
            callLogId: callLog._id.toString(),
            status: callLog.status,
            outboundStatus: callLog.outboundStatus,
            phoneNumber: callLog.toPhone,
            startedAt: callLog.startedAt,
            duration: callLog.durationSec
        };
    }
    /**
     * Cancel a call (scheduled or in-progress)
     */
    async cancelCall(callLogId) {
        const callLog = await CallLog_1.CallLog.findById(callLogId);
        if (!callLog) {
            throw new Error('Call not found');
        }
        // Check if can be cancelled
        if (!['initiated', 'ringing'].includes(callLog.status)) {
            throw new Error(`Cannot cancel call with status: ${callLog.status}`);
        }
        // If call has Exotel SID, try to hangup
        if (callLog.exotelCallSid) {
            try {
                await exotelOutbound_service_1.exotelOutboundService.hangupCall(callLog.exotelCallSid);
            }
            catch (error) {
                logger_1.default.error('Failed to hangup call via Exotel', {
                    callLogId,
                    error
                });
            }
        }
        // Update CallLog
        await CallLog_1.CallLog.findByIdAndUpdate(callLogId, {
            status: 'canceled',
            failureReason: 'cancelled',
            endedAt: new Date()
        });
        // Remove from active calls
        this.activeCalls.delete(callLogId);
        logger_1.default.info('Call cancelled', { callLogId });
    }
    /**
     * Bulk initiate calls
     */
    async bulkInitiateCalls(calls) {
        logger_1.default.info('Bulk initiating calls', { count: calls.length });
        if (calls.length > 1000) {
            throw new Error('Maximum 1000 calls per batch');
        }
        const callLogIds = [];
        const errors = [];
        for (let i = 0; i < calls.length; i++) {
            try {
                const callLogId = await this.initiateCall(calls[i]);
                callLogIds.push(callLogId);
            }
            catch (error) {
                errors.push({ index: i, error: error.message });
                logger_1.default.error('Failed to initiate call in batch', {
                    index: i,
                    phoneNumber: calls[i].phoneNumber,
                    error: error.message
                });
                // Check if it's a concurrency limit error - apply exponential backoff
                if (error.message?.includes('concurrent') || error.message?.includes('limit reached')) {
                    const backoffMs = Math.min(5000, 1000 * Math.pow(2, Math.min(i, 5))); // Max 5s backoff
                    logger_1.default.warn('Concurrency limit hit, applying backoff', {
                        index: i,
                        backoffMs
                    });
                    await new Promise(resolve => setTimeout(resolve, backoffMs));
                }
            }
            finally {
                // CRITICAL: Always throttle between calls, even on error
                // This prevents hammering the carrier when limits are hit
                if (i < calls.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
                }
            }
        }
        if (errors.length > 0) {
            logger_1.default.warn('Bulk call initiation completed with errors', {
                total: calls.length,
                successful: callLogIds.length,
                failed: errors.length
            });
        }
        return callLogIds;
    }
    /**
     * Mark call as ended (called by webhook handler)
     */
    async markCallEnded(callLogId) {
        // Remove from local tracking
        this.activeCalls.delete(callLogId);
        // Remove from cluster-wide tracking (scan for matching member)
        const allMembers = await redis_1.redis.sMembers(this.GLOBAL_ACTIVE_CALLS_KEY);
        for (const member of allMembers) {
            if (member.startsWith(`${callLogId}:`)) {
                await redis_1.redis.sRem(this.GLOBAL_ACTIVE_CALLS_KEY, member);
                break;
            }
        }
    }
    /**
     * Get failed calls that can be retried (excludes voicemail)
     */
    async getRetriableCalls(userId, options) {
        const query = {
            userId: new mongoose_1.default.Types.ObjectId(userId),
            direction: 'outbound',
            status: { $in: ['failed', 'no-answer', 'busy'] },
            // Exclude voicemail-detected calls
            failureReason: { $ne: 'voicemail' },
            outboundStatus: { $ne: 'voicemail' },
            'metadata.voicemailDetected': { $ne: true }
        };
        if (options?.agentId) {
            query.agentId = new mongoose_1.default.Types.ObjectId(options.agentId);
        }
        if (options?.phoneId) {
            query.phoneId = new mongoose_1.default.Types.ObjectId(options.phoneId);
        }
        const calls = await CallLog_1.CallLog.find(query)
            .sort({ createdAt: -1 })
            .limit(options?.limit || 100)
            .lean();
        logger_1.default.info('Retrieved retriable calls', {
            userId,
            count: calls.length,
            filters: options
        });
        return calls;
    }
    /**
     * Get service stats
     */
    async getStats() {
        return {
            activeCalls: this.activeCalls.size,
            maxConcurrentCalls: this.maxConcurrentCalls,
            utilization: (this.activeCalls.size / this.maxConcurrentCalls) * 100,
            circuitBreaker: exotelOutbound_service_1.exotelOutboundService.getCircuitBreakerState(),
            rateLimiter: await exotelOutbound_service_1.exotelOutboundService.getRateLimiterStats()
        };
    }
}
exports.OutgoingCallService = OutgoingCallService;
// Export singleton instance
exports.outgoingCallService = new OutgoingCallService();
//# sourceMappingURL=outgoingCall.service.js.map
