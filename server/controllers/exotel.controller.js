"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.exotelController = exports.ExotelController = void 0;
const exotel_service_1 = require("../services/exotel.service");
const phone_service_1 = require("../services/phone.service");
const Phone_1 = require("../models/Phone");
const CallLog_1 = require("../models/CallLog");
const logger_1 = require("../utils/logger");
const errors_1 = require("../utils/errors");
const uuid_1 = require("uuid");
const transcriptGeneration_service_1 = require("../services/transcriptGeneration.service");
class ExotelController {
    /**
     * Make an outbound call
     */
    async makeCall(req, res, next) {
        try {
            const userId = req.user._id.toString();
            const { phoneId, to } = req.body;
            // Get phone details
            const phone = await Phone_1.Phone.findOne({ _id: phoneId, userId }).populate('agentId');
            if (!phone) {
                throw new errors_1.NotFoundError('Phone number not found');
            }
            if (!phone.agentId) {
                throw new errors_1.ValidationError('No agent assigned to this phone number');
            }
            // Get Exotel credentials for this phone
            const exotelCredentials = await phone_service_1.phoneService.getExotelCredentials(phoneId, userId);
            if (!exotelCredentials) {
                throw new errors_1.ValidationError('No Exotel credentials found for this phone number');
            }
            // Make the call via Exotel with phone-specific credentials
            const callResponse = await exotel_service_1.exotelService.makeCallWithCredentials({
                from: phone.number,
                to,
                statusCallback: `${process.env.WEBHOOK_BASE_URL}/bulk/api/exotel/webhook/status`
            }, exotelCredentials);
            // Create call log
            const sessionId = (0, uuid_1.v4)();
            const callLog = await CallLog_1.CallLog.create({
                sessionId,
                userId,
                phoneId: phone._id,
                agentId: phone.agentId,
                fromPhone: phone.number,
                toPhone: to,
                direction: 'outbound',
                status: 'initiated',
                exotelCallSid: callResponse.sid,
                startedAt: new Date(),
                metadata: {
                    agentName: phone.agentId.name,
                    agentPrompt: phone.agentId.config?.prompt
                }
            });
            logger_1.logger.info('Call initiated successfully', {
                userId,
                phoneId,
                callSid: callResponse.sid,
                sessionId
            });
            res.status(200).json({
                success: true,
                data: {
                    callLog,
                    exotelResponse: callResponse
                },
                message: 'Call initiated successfully'
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Handle Exotel webhook for call status updates
     */
    async handleStatusWebhook(req, res, _next) {
        try {
            const webhookData = exotel_service_1.exotelService.parseWebhook(req.body);
            logger_1.logger.info('📞 Received Exotel webhook', {
                callSid: webhookData.CallSid,
                status: webhookData.Status,
                direction: webhookData.Direction,
                customField: webhookData.CustomField,
                from: webhookData.CallFrom,
                to: webhookData.CallTo
            });
            // Multiple lookup strategies to find the call log
            let callLog = null;
            let lookupMethod = 'none';
            // Strategy 1: Find by exotelCallSid (most reliable)
            if (webhookData.CallSid) {
                callLog = await CallLog_1.CallLog.findOne({ exotelCallSid: webhookData.CallSid });
                if (callLog) {
                    lookupMethod = 'exotelCallSid';
                    logger_1.logger.info('✅ Found call log by exotelCallSid', {
                        callLogId: callLog._id.toString(),
                        callSid: webhookData.CallSid
                    });
                }
            }
            // Strategy 2: Find by CustomField (contains callLogId for outbound calls)
            if (!callLog && webhookData.CustomField) {
                try {
                    callLog = await CallLog_1.CallLog.findById(webhookData.CustomField);
                    if (callLog) {
                        lookupMethod = 'customField';
                        logger_1.logger.info('✅ Found call log by CustomField', {
                            callLogId: callLog._id.toString(),
                            customField: webhookData.CustomField
                        });
                    }
                }
                catch (error) {
                    logger_1.logger.debug('CustomField is not a valid ObjectId', {
                        customField: webhookData.CustomField
                    });
                }
            }
            // Strategy 3: Find by phone numbers + recent timestamp (fallback for edge cases)
            if (!callLog && webhookData.CallFrom && webhookData.CallTo) {
                const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
                callLog = await CallLog_1.CallLog.findOne({
                    $or: [
                        { fromPhone: webhookData.CallFrom, toPhone: webhookData.CallTo },
                        { fromPhone: webhookData.CallTo, toPhone: webhookData.CallFrom }
                    ],
                    createdAt: { $gte: fiveMinutesAgo },
                    direction: webhookData.Direction === 'outbound-api' ? 'outbound' : 'inbound'
                }).sort({ createdAt: -1 });
                if (callLog) {
                    lookupMethod = 'phoneNumbers';
                    logger_1.logger.info('✅ Found call log by phone numbers + timestamp', {
                        callLogId: callLog._id.toString(),
                        from: webhookData.CallFrom,
                        to: webhookData.CallTo
                    });
                }
            }
            if (!callLog) {
                logger_1.logger.warn('⚠️ Call log not found for webhook - tried all lookup strategies', {
                    callSid: webhookData.CallSid,
                    customField: webhookData.CustomField,
                    from: webhookData.CallFrom,
                    to: webhookData.CallTo,
                    direction: webhookData.Direction,
                    status: webhookData.Status
                });
                // Still send 200 OK to Exotel
                res.status(200).json({ success: true });
                return;
            }
            // Ensure exotelCallSid is always set (in case it wasn't set during call creation)
            if (!callLog.exotelCallSid && webhookData.CallSid) {
                callLog.exotelCallSid = webhookData.CallSid;
                logger_1.logger.info('🔧 Set exotelCallSid on call log', {
                    callLogId: callLog._id.toString(),
                    callSid: webhookData.CallSid,
                    lookupMethod
                });
            }
            // Map Exotel status to our status
            const statusMap = {
                'queued': 'initiated',
                'ringing': 'ringing',
                'in-progress': 'in-progress',
                'completed': 'completed',
                'busy': 'busy',
                'failed': 'failed',
                'no-answer': 'no-answer',
                'canceled': 'canceled'
            };
            const newStatus = statusMap[webhookData.Status.toLowerCase()] || webhookData.Status;
            const previousStatus = callLog.status;
            // Log status change
            if (previousStatus !== newStatus) {
                logger_1.logger.info('🔄 Call status changing', {
                    callLogId: callLog._id.toString(),
                    previousStatus,
                    newStatus,
                    exotelStatus: webhookData.Status,
                    lookupMethod
                });
            }
            else {
                logger_1.logger.debug('Call status unchanged', {
                    callLogId: callLog._id.toString(),
                    status: newStatus
                });
            }
            // Update call log
            callLog.status = newStatus;
            // Update outboundStatus for outbound calls
            if (callLog.direction === 'outbound' && webhookData.Status) {
                const outboundStatusMap = {
                    'queued': 'queued',
                    'ringing': 'ringing',
                    'in-progress': 'connected',
                    'completed': 'connected',
                    'busy': 'busy',
                    'failed': 'no_answer',
                    'no-answer': 'no_answer',
                    'canceled': 'no_answer'
                };
                callLog.outboundStatus = outboundStatusMap[webhookData.Status.toLowerCase()];
            }
            if (webhookData.StartTime) {
                callLog.startedAt = new Date(webhookData.StartTime);
            }
            else if (newStatus === 'in-progress' && !callLog.startedAt) {
                // Fallback: Set startedAt when call goes in-progress if not already set
                callLog.startedAt = new Date();
            }
            if (webhookData.EndTime) {
                callLog.endedAt = new Date(webhookData.EndTime);
            }
            else if (['completed', 'failed', 'no-answer', 'busy', 'canceled'].includes(newStatus) && !callLog.endedAt) {
                // Fallback: Set endedAt when call ends if not already set
                callLog.endedAt = new Date();
            }
            if (webhookData.Duration) {
                callLog.durationSec = parseInt(webhookData.Duration, 10);
            }
            if (webhookData.RecordingUrl) {
                callLog.recordingUrl = webhookData.RecordingUrl;
            }
            // Store additional metadata
            callLog.metadata = {
                ...callLog.metadata,
                dialWhomNumber: webhookData.DialWhomNumber,
                callType: webhookData.CallType,
                digits: webhookData.Digits,
                lastWebhookStatus: webhookData.Status,
                lastWebhookReceivedAt: new Date().toISOString()
            };
            // Save call log with error handling
            try {
                await callLog.save();
                logger_1.logger.info('✅ Call log status updated successfully', {
                    callLogId: callLog._id.toString(),
                    status: newStatus,
                    previousStatus,
                    exotelStatus: webhookData.Status,
                    lookupMethod,
                    endedAt: callLog.endedAt,
                    durationSec: callLog.durationSec
                });
            }
            catch (saveError) {
                logger_1.logger.error('❌ Failed to save call log status update', {
                    callLogId: callLog._id.toString(),
                    status: newStatus,
                    error: saveError.message,
                    errorStack: saveError.stack,
                    lookupMethod
                });
                // Still send 200 OK to Exotel to prevent retries
                res.status(200).json({ success: true });
                return;
            }
            // If outbound call ended, mark as ended in OutgoingCallService
            if (callLog.direction === 'outbound' && ['completed', 'failed', 'no-answer', 'busy', 'canceled'].includes(newStatus)) {
                try {
                    const { outgoingCallService } = await Promise.resolve().then(() => __importStar(require('../services/outgoingCall.service')));
                    await outgoingCallService.markCallEnded(callLog._id.toString());
                }
                catch (error) {
                    logger_1.logger.error('Failed to mark outbound call as ended', { error });
                }
                // CRITICAL: Release Redis slot for campaign calls
                if (callLog.metadata?.isCampaignCall && callLog.metadata?.callId) {
                    try {
                        const { redisConcurrencyTracker } = await Promise.resolve().then(() => __importStar(require('../utils/redisConcurrency.util')));
                        const campaignId = callLog.metadata.campaignId;
                        const callId = callLog.metadata.callId;
                        const leaseToken = callLog.metadata.leaseToken;
                        const preToken = callLog.metadata.preToken;
                        let released = false;
                        // Try active lease first (if call was upgraded)
                        if (leaseToken) {
                            released = await redisConcurrencyTracker.releaseSlot(campaignId, callId, leaseToken, false, // isPreDial = false (this is active lease)
                            true // publish = true (notify waitlist)
                            );
                            if (released) {
                                logger_1.logger.info('✅ Webhook released active Redis slot', {
                                    campaignId,
                                    callId,
                                    callLogId: callLog._id.toString(),
                                    status: newStatus
                                });
                            }
                        }
                        // Fallback to pre-dial lease (if call completed before upgrade)
                        if (!released && preToken) {
                            released = await redisConcurrencyTracker.releaseSlot(campaignId, callId, preToken, true, // isPreDial = true (this is pre-dial lease)
                            true // publish = true (notify waitlist)
                            );
                            if (released) {
                                logger_1.logger.info('✅ Webhook released pre-dial Redis slot', {
                                    campaignId,
                                    callId,
                                    callLogId: callLog._id.toString(),
                                    status: newStatus
                                });
                            }
                        }
                        if (!released) {
                            logger_1.logger.warn('⚠️ Webhook failed to release slot (no valid token or already released)', {
                                campaignId,
                                callId,
                                callLogId: callLog._id.toString(),
                                hadLeaseToken: !!leaseToken,
                                hadPreToken: !!preToken
                            });
                        }
                    }
                    catch (error) {
                        logger_1.logger.error('Failed to release Redis slot from webhook', {
                            error: error.message,
                            callLogId: callLog._id.toString()
                        });
                    }
                }
                // Update campaign contact status for campaign calls
                if (callLog.metadata?.isCampaignCall && callLog.metadata?.campaignContactId) {
                    try {
                        const { CampaignContact } = await Promise.resolve().then(() => __importStar(require('../models/CampaignContact')));
                        const { Campaign } = await Promise.resolve().then(() => __importStar(require('../models/Campaign')));
                        const campaignContactId = callLog.metadata.campaignContactId;
                        const campaignId = callLog.metadata.campaignId;
                        const contact = await CampaignContact.findById(campaignContactId);
                        const campaign = await Campaign.findById(campaignId);
                        if (contact && campaign) {
                            const retryCount = callLog.metadata.retryCount || 0;
                            // Update contact based on call outcome
                            if (newStatus === 'completed' || newStatus === 'in-progress') {
                                contact.status = 'completed';
                                await contact.save();
                                await Campaign.findByIdAndUpdate(campaignId, {
                                    $inc: { completedCalls: 1, activeCalls: -1 }
                                });
                            }
                            else if (callLog.metadata?.voicemailDetected) {
                                contact.status = 'voicemail';
                                await contact.save();
                                await Campaign.findByIdAndUpdate(campaignId, {
                                    $inc: { voicemailCalls: 1, activeCalls: -1 }
                                });
                                // Check if retry voicemail
                                if (!campaign.settings.excludeVoicemail && retryCount < campaign.settings.maxRetryAttempts) {
                                    contact.retryCount = retryCount + 1;
                                    contact.nextRetryAt = new Date(Date.now() + campaign.settings.retryDelayMinutes * 60 * 1000);
                                    contact.status = 'pending';
                                    await contact.save();
                                }
                            }
                            else if (['failed', 'no-answer', 'busy'].includes(newStatus)) {
                                const shouldRetry = campaign.settings.retryFailedCalls && retryCount < campaign.settings.maxRetryAttempts;
                                if (shouldRetry) {
                                    contact.status = 'pending';
                                    contact.retryCount = retryCount + 1;
                                    contact.nextRetryAt = new Date(Date.now() + campaign.settings.retryDelayMinutes * 60 * 1000);
                                    contact.failureReason = callLog.failureReason || 'Call failed';
                                    await contact.save();
                                    await Campaign.findByIdAndUpdate(campaignId, {
                                        $inc: { queuedCalls: 1, activeCalls: -1 }
                                    });
                                }
                                else {
                                    contact.status = 'failed';
                                    contact.failureReason = callLog.failureReason || 'Call failed';
                                    await contact.save();
                                    await Campaign.findByIdAndUpdate(campaignId, {
                                        $inc: { failedCalls: 1, activeCalls: -1 }
                                    });
                                }
                            }
                            logger_1.logger.info('✅ Updated campaign contact from webhook', {
                                campaignContactId,
                                contactStatus: contact.status,
                                callStatus: newStatus
                            });
                        }
                    }
                    catch (error) {
                        logger_1.logger.error('Failed to update campaign contact from webhook', {
                            error: error.message,
                            callLogId: callLog._id.toString()
                        });
                    }
                }
            }
            logger_1.logger.info('Call log updated from webhook', {
                callSid: webhookData.CallSid,
                status: newStatus,
                outboundStatus: callLog.outboundStatus,
                direction: callLog.direction,
                duration: callLog.durationSec
            });
            // Acknowledge webhook
            res.status(200).json({ success: true });
        }
        catch (error) {
            logger_1.logger.error('Error processing webhook', { error });
            // Still send 200 OK to avoid webhook retries
            res.status(200).json({ success: true });
        }
    }
    /**
     * Handle incoming call webhook
     */
    async handleIncomingCallWebhook(req, res, _next) {
        try {
            const webhookData = exotel_service_1.exotelService.parseWebhook(req.body);
            logger_1.logger.info('Received incoming call webhook', {
                callSid: webhookData.CallSid,
                from: webhookData.CallFrom,
                to: webhookData.CallTo
            });
            // Find phone by number
            const phone = await Phone_1.Phone.findOne({ number: webhookData.CallTo }).populate('agentId userId');
            if (!phone) {
                logger_1.logger.warn('Phone number not found for incoming call', {
                    number: webhookData.CallTo
                });
                // Return empty response - call will not be connected
                res.status(200).json({ success: false, message: 'Phone not configured' });
                return;
            }
            if (!phone.agentId) {
                logger_1.logger.warn('No agent assigned to phone', {
                    phoneId: phone._id
                });
                res.status(200).json({ success: false, message: 'No agent assigned' });
                return;
            }
            // Create call log
            const sessionId = (0, uuid_1.v4)();
            await CallLog_1.CallLog.create({
                sessionId,
                userId: phone.userId,
                phoneId: phone._id,
                agentId: phone.agentId,
                fromPhone: webhookData.CallFrom,
                toPhone: webhookData.CallTo,
                direction: 'inbound',
                status: 'ringing',
                exotelCallSid: webhookData.CallSid,
                startedAt: new Date(),
                metadata: {
                    agentName: phone.agentId.name,
                    agentPrompt: phone.agentId.config?.prompt
                }
            });
            logger_1.logger.info('Incoming call logged', {
                callSid: webhookData.CallSid,
                sessionId,
                phoneId: phone._id
            });
            // Return instructions to connect the call
            // In a real implementation, you would return Exotel Flow XML
            res.status(200).json({
                success: true,
                message: 'Call connected to agent'
            });
        }
        catch (error) {
            logger_1.logger.error('Error processing incoming call webhook', { error });
            res.status(200).json({ success: false });
        }
    }
    /**
     * Get call details
     */
    async getCall(req, res, next) {
        try {
            const userId = req.user._id.toString();
            const { callId } = req.params;
            const callLog = await CallLog_1.CallLog.findOne({ _id: callId, userId })
                .populate('phoneId', 'number country')
                .populate('agentId', 'name config.prompt');
            if (!callLog) {
                throw new errors_1.NotFoundError('Call not found');
            }
            // Always prioritize Exotel's Duration (talk time) over calculated values
            const callObj = callLog.toObject();
            // First, try to fetch from Exotel API if we have exotelCallSid
            // This ensures we always show accurate talk time, not calculated total call duration
            if (callLog.exotelCallSid) {
                try {
                    const { exotelOutboundService } = await Promise.resolve().then(() => __importStar(require('../services/exotelOutbound.service')));
                    const exotelDetails = await exotelOutboundService.getCallDetails(callLog.exotelCallSid);
                    // Always update with Exotel's Duration (talk time) if available
                    if (exotelDetails.duration !== undefined && exotelDetails.duration >= 0) {
                        const oldDuration = callLog.durationSec;
                        // Update if different from stored value (to correct any timestamp-based calculations)
                        if (oldDuration !== exotelDetails.duration) {
                            callObj.durationSec = exotelDetails.duration;
                            // Update database for future requests
                            callLog.durationSec = exotelDetails.duration;
                            await callLog.save();
                            logger_1.logger.info('✅ Updated duration from Exotel API (talk time)', {
                                callLogId: callLog._id.toString(),
                                exotelCallSid: callLog.exotelCallSid,
                                oldDuration: oldDuration,
                                newDuration: exotelDetails.duration
                            });
                        }
                        else {
                            // Use existing value
                            callObj.durationSec = exotelDetails.duration;
                        }
                    }
                }
                catch (error) {
                    logger_1.logger.debug('Failed to fetch duration from Exotel API, using existing or fallback', {
                        callLogId: callLog._id.toString(),
                        exotelCallSid: callLog.exotelCallSid,
                        error: error.message
                    });
                    // Continue with existing duration or fallback calculation below
                }
            }
            // Fallback: Calculate from timestamps only if:
            // 1. No durationSec exists, AND
            // 2. No exotelCallSid to fetch from Exotel, AND
            // 3. We have timestamps to calculate from
            // Note: This gives total call duration (including ringing), not talk time
            if (!callObj.durationSec && !callLog.exotelCallSid) {
                let startTime = callObj.startedAt;
                let endTime = callObj.endedAt;
                // For completed calls without timestamps, use fallbacks
                if (callObj.status === 'completed') {
                    if (!startTime) {
                        startTime = callObj.createdAt;
                    }
                    if (!endTime) {
                        // Use updatedAt as fallback (last time record was updated, likely when it completed)
                        endTime = callObj.updatedAt;
                    }
                }
                // If we have both times, calculate duration (this is total call duration, not talk time)
                if (startTime && endTime) {
                    const durationMs = new Date(endTime).getTime() - new Date(startTime).getTime();
                    if (durationMs > 0) {
                        callObj.durationSec = Math.floor(durationMs / 1000);
                    }
                }
            }
            res.status(200).json({
                success: true,
                data: { call: callObj }
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Get call history
     */
    async getCallHistory(req, res, next) {
        try {
            const userId = req.user._id.toString();
            const { page = 1, limit = 20, status, direction, phoneId, agentId } = req.query;
            const query = { userId };
            if (status) {
                query.status = status;
            }
            if (direction) {
                query.direction = direction;
            }
            if (phoneId) {
                query.phoneId = phoneId;
            }
            if (agentId) {
                query.agentId = agentId;
            }
            const skip = (Number(page) - 1) * Number(limit);
            const [calls, total] = await Promise.all([
                CallLog_1.CallLog.find(query)
                    .populate('phoneId', 'number country')
                    .populate('agentId', 'name')
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(Number(limit)),
                CallLog_1.CallLog.countDocuments(query)
            ]);
            // Always prioritize Exotel's Duration (talk time) over calculated values
            // Fetch durations from Exotel for calls with exotelCallSid (limit to first 10 to avoid too many API calls)
            const callsWithExotelSid = calls.filter(call => call.exotelCallSid).slice(0, 10);
            // Fetch durations from Exotel to get accurate talk time (not total call duration)
            const durationFetchPromises = callsWithExotelSid.map(async (call) => {
                try {
                    const { exotelOutboundService } = await Promise.resolve().then(() => __importStar(require('../services/exotelOutbound.service')));
                    const exotelDetails = await exotelOutboundService.getCallDetails(call.exotelCallSid);
                    // Always update with Exotel's Duration (talk time) if available
                    // This ensures we show accurate talk time, not calculated total call duration
                    if (exotelDetails.duration !== undefined && exotelDetails.duration >= 0) {
                        // Update if different from stored value (to correct any timestamp-based calculations)
                        const oldDuration = call.durationSec;
                        if (oldDuration !== exotelDetails.duration) {
                            call.durationSec = exotelDetails.duration;
                            await call.save();
                            logger_1.logger.info('✅ Updated duration from Exotel (talk time)', {
                                callLogId: call._id.toString(),
                                oldDuration: oldDuration,
                                newDuration: exotelDetails.duration,
                                exotelCallSid: call.exotelCallSid
                            });
                        }
                    }
                }
                catch (error) {
                    logger_1.logger.debug('Failed to fetch duration from Exotel for call in list', {
                        callLogId: call._id.toString(),
                        error: error.message
                    });
                    // Continue with existing duration or fallback calculation
                }
            });
            // Wait for all duration fetches to complete (or timeout)
            await Promise.allSettled(durationFetchPromises);
            const callsWithDuration = calls.map(call => {
                const callObj = call.toObject();
                // If no durationSec, try to calculate from timestamps as fallback
                // Note: This gives total call duration (including ringing), not talk time
                // But it's better than showing "N/A"
                if (!callObj.durationSec) {
                    let startTime = callObj.startedAt;
                    let endTime = callObj.endedAt;
                    // Use fallback timestamps if startedAt/endedAt are missing
                    if (!startTime) {
                        // Use createdAt or initiatedAt as fallback
                        startTime = callObj.initiatedAt || callObj.createdAt;
                    }
                    if (!endTime) {
                        // For ended calls, use updatedAt as fallback
                        // For active calls, we can't calculate duration yet
                        if (['completed', 'failed', 'no-answer', 'busy', 'canceled', 'user-ended', 'agent-ended'].includes(callObj.status)) {
                            endTime = callObj.updatedAt;
                        }
                    }
                    // If we have both times, calculate duration (this is total call duration, not talk time)
                    if (startTime && endTime) {
                        const durationMs = new Date(endTime).getTime() - new Date(startTime).getTime();
                        if (durationMs > 0) {
                            callObj.durationSec = Math.floor(durationMs / 1000);
                        }
                    }
                }
                return callObj;
            });
            res.status(200).json({
                success: true,
                data: {
                    calls: callsWithDuration,
                    total,
                    page: Number(page),
                    totalPages: Math.ceil(total / Number(limit))
                }
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Get call statistics
     */
    async getCallStats(req, res, next) {
        try {
            const userId = req.user._id.toString();
            const { phoneId, agentId, startDate, endDate } = req.query;
            const query = { userId };
            if (phoneId) {
                query.phoneId = phoneId;
            }
            if (agentId) {
                query.agentId = agentId;
            }
            if (startDate || endDate) {
                query.createdAt = {};
                if (startDate) {
                    query.createdAt.$gte = new Date(startDate);
                }
                if (endDate) {
                    query.createdAt.$lte = new Date(endDate);
                }
            }
            const stats = await CallLog_1.CallLog.aggregate([
                { $match: query },
                {
                    $group: {
                        _id: null,
                        totalCalls: { $sum: 1 },
                        completedCalls: {
                            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
                        },
                        failedCalls: {
                            $sum: {
                                $cond: [
                                    { $in: ['$status', ['failed', 'no-answer', 'busy', 'canceled']] },
                                    1,
                                    0
                                ]
                            }
                        },
                        totalDuration: { $sum: '$durationSec' },
                        avgDuration: { $avg: '$durationSec' }
                    }
                }
            ]);
            const result = stats[0] || {
                totalCalls: 0,
                completedCalls: 0,
                failedCalls: 0,
                totalDuration: 0,
                avgDuration: 0
            };
            res.status(200).json({
                success: true,
                data: { stats: result }
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Hangup an active call
     */
    async hangupCall(req, res, next) {
        try {
            const userId = req.user._id.toString();
            const { callId } = req.params;
            const callLog = await CallLog_1.CallLog.findOne({ _id: callId, userId });
            if (!callLog) {
                throw new errors_1.NotFoundError('Call not found');
            }
            if (!callLog.exotelCallSid) {
                throw new errors_1.ValidationError('No Exotel call ID associated with this call');
            }
            if (!['ringing', 'in-progress'].includes(callLog.status)) {
                throw new errors_1.ValidationError('Call is not active');
            }
            // Hangup via Exotel
            await exotel_service_1.exotelService.hangupCall(callLog.exotelCallSid);
            // Update call log
            callLog.status = 'user-ended';
            callLog.endedAt = new Date();
            await callLog.save();
            logger_1.logger.info('Call hung up successfully', {
                userId,
                callId,
                exotelCallSid: callLog.exotelCallSid
            });
            res.status(200).json({
                success: true,
                message: 'Call ended successfully'
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Get formatted transcript for a call
     */
    async getFormattedTranscript(req, res, next) {
        try {
            const userId = req.user._id.toString();
            const { callId } = req.params;
            const format = req.query.format || 'json'; // json, markdown, plaintext
            // Verify call belongs to user
            const callLog = await CallLog_1.CallLog.findOne({ _id: callId, userId });
            if (!callLog) {
                throw new errors_1.NotFoundError('Call not found');
            }
            if (!callLog.transcript || callLog.transcript.length === 0) {
                res.status(200).json({
                    success: true,
                    data: {
                        transcript: null,
                        message: 'No transcript available for this call'
                    }
                });
                return;
            }
            // Generate formatted transcript on-demand
            const formatted = await transcriptGeneration_service_1.transcriptGenerationService.generateTranscriptOnDemand(callId, {
                includeSummary: true,
                includeKeyPoints: true,
                includeSentiment: true,
                includeActionItems: true
            });
            if (!formatted) {
                res.status(200).json({
                    success: true,
                    data: {
                        transcript: null,
                        message: 'Failed to generate transcript'
                    }
                });
                return;
            }
            // Return based on format requested
            if (format === 'markdown') {
                res.setHeader('Content-Type', 'text/markdown');
                res.send(formatted.markdown);
                return;
            }
            else if (format === 'plaintext' || format === 'text') {
                res.setHeader('Content-Type', 'text/plain');
                res.send(formatted.plainText);
                return;
            }
            // Default: JSON format
            res.status(200).json({
                success: true,
                data: {
                    callId,
                    transcript: formatted,
                    metadata: {
                        callDate: callLog.createdAt,
                        duration: callLog.durationSec,
                        status: callLog.status,
                        direction: callLog.direction
                    }
                }
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Regenerate transcript and summary for a call
     */
    async regenerateTranscript(req, res, next) {
        try {
            const userId = req.user._id.toString();
            const { callId } = req.params;
            // Verify call belongs to user
            const callLog = await CallLog_1.CallLog.findOne({ _id: callId, userId });
            if (!callLog) {
                throw new errors_1.NotFoundError('Call not found');
            }
            if (!callLog.transcript || callLog.transcript.length === 0) {
                throw new errors_1.ValidationError('No transcript available for this call');
            }
            logger_1.logger.info('Regenerating transcript', { userId, callId });
            // Regenerate and store
            const formatted = await transcriptGeneration_service_1.transcriptGenerationService.regenerateTranscript(callId, {
                includeSummary: true,
                includeKeyPoints: true,
                includeSentiment: true,
                includeActionItems: true
            });
            if (!formatted) {
                throw new errors_1.ValidationError('Failed to regenerate transcript');
            }
            logger_1.logger.info('Transcript regenerated successfully', { userId, callId });
            res.status(200).json({
                success: true,
                message: 'Transcript regenerated successfully',
                data: {
                    summary: formatted.summary,
                    keyPoints: formatted.keyPoints,
                    sentiment: formatted.sentiment,
                    actionItems: formatted.actionItems
                }
            });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.ExotelController = ExotelController;
exports.exotelController = new ExotelController();
//# sourceMappingURL=exotel.controller.js.map
