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
exports.stuckCallMonitorService = void 0;
const CallLog_1 = require("../models/CallLog");
const logger_1 = require("../utils/logger");
/**
 * Stuck Call Monitor Service
 * Monitors calls stuck in "ringing" status and updates them based on timeout
 * Runs every 2 minutes to check for calls stuck for more than 3 minutes
 */
class StuckCallMonitorService {
    constructor() {
        this.intervalId = null;
        this.running = false;
        this.CHECK_INTERVAL = 2 * 60 * 1000; // 2 minutes
        this.STUCK_THRESHOLD = 3 * 60 * 1000; // 3 minutes
    }
    async start() {
        if (this.intervalId)
            return;
        this.intervalId = setInterval(() => {
            this.checkStuckCalls().catch(err => {
                logger_1.logger.error('Stuck call monitor failed', { error: err.message });
            });
        }, this.CHECK_INTERVAL);
        logger_1.logger.info('✅ Stuck call monitor service started', {
            interval: `${this.CHECK_INTERVAL}ms`,
            threshold: `${this.STUCK_THRESHOLD}ms`
        });
    }
    async stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.running = false;
        logger_1.logger.info('Stuck call monitor service stopped');
    }
    async checkStuckCalls() {
        if (this.running) {
            logger_1.logger.debug('Stuck call monitor already running, skipping');
            return;
        }
        this.running = true;
        try {
            const thresholdTime = new Date(Date.now() - this.STUCK_THRESHOLD);
            // Find calls stuck in "ringing" status for more than threshold
            const stuckCalls = await CallLog_1.CallLog.find({
                status: 'ringing',
                createdAt: { $lte: thresholdTime },
                endedAt: { $exists: false }
            }).limit(50); // Limit to 50 calls per check to avoid overload
            if (stuckCalls.length === 0) {
                logger_1.logger.debug('No stuck calls found');
                return;
            }
            logger_1.logger.info('🔍 Found stuck calls', {
                count: stuckCalls.length,
                thresholdMinutes: this.STUCK_THRESHOLD / 60000
            });
            // Process each stuck call
            for (const callLog of stuckCalls) {
                await this.processStuckCall(callLog);
            }
        }
        catch (error) {
            logger_1.logger.error('Error checking stuck calls', {
                error: error.message,
                errorStack: error.stack
            });
        }
        finally {
            this.running = false;
        }
    }
    async processStuckCall(callLog) {
        try {
            const callAge = Date.now() - callLog.createdAt.getTime();
            const ageMinutes = Math.round(callAge / 60000);
            logger_1.logger.warn('⚠️ Processing stuck call', {
                callLogId: callLog._id.toString(),
                status: callLog.status,
                ageMinutes,
                exotelCallSid: callLog.exotelCallSid,
                direction: callLog.direction
            });
            // If we have exotelCallSid, try to query Exotel API for actual status and duration
            let fetchedFromExotel = false;
            if (callLog.exotelCallSid) {
                try {
                    const { exotelOutboundService } = await Promise.resolve().then(() => __importStar(require('./exotelOutbound.service')));
                    const exotelDetails = await exotelOutboundService.getCallDetails(callLog.exotelCallSid);
                    logger_1.logger.info('📞 Fetched actual call status from Exotel API', {
                        callLogId: callLog._id.toString(),
                        exotelCallSid: callLog.exotelCallSid,
                        exotelStatus: exotelDetails.status,
                        exotelDuration: exotelDetails.duration
                    });
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
                    const mappedStatus = statusMap[exotelDetails.status.toLowerCase()] || exotelDetails.status;
                    // Update call log with actual status and duration from Exotel
                    callLog.status = mappedStatus;
                    callLog.durationSec = exotelDetails.duration || 0;
                    // Update outboundStatus for outbound calls
                    if (callLog.direction === 'outbound') {
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
                        callLog.outboundStatus = outboundStatusMap[exotelDetails.status.toLowerCase()] || 'no_answer';
                    }
                    // Set endedAt if call is completed/ended
                    if (['completed', 'failed', 'no-answer', 'busy', 'canceled'].includes(mappedStatus) && !callLog.endedAt) {
                        callLog.endedAt = new Date();
                    }
                    // Update recording URL if available
                    if (exotelDetails.recordingUrl) {
                        callLog.recordingUrl = exotelDetails.recordingUrl;
                    }
                    fetchedFromExotel = true;
                    logger_1.logger.info('✅ Updated call log with Exotel data', {
                        callLogId: callLog._id.toString(),
                        status: mappedStatus,
                        duration: callLog.durationSec
                    });
                }
                catch (error) {
                    logger_1.logger.warn('⚠️ Failed to query Exotel for call status, using timeout-based resolution', {
                        callLogId: callLog._id.toString(),
                        exotelCallSid: callLog.exotelCallSid,
                        error: error.message
                    });
                    // Continue with fallback below
                }
            }
            // Fallback: Mark as no-answer if stuck for more than threshold
            // This is used when webhook is not received AND Exotel API fetch failed
            if (!fetchedFromExotel) {
                callLog.status = 'no-answer';
                callLog.outboundStatus = callLog.direction === 'outbound' ? 'no_answer' : undefined;
                callLog.endedAt = new Date();
                callLog.durationSec = 0;
            }
            // Update metadata
            callLog.metadata = {
                ...callLog.metadata,
                stuckCallResolved: true,
                stuckCallResolvedAt: new Date().toISOString(),
                stuckCallAgeMinutes: ageMinutes,
                resolvedBy: fetchedFromExotel ? 'stuckCallMonitor-exotel' : 'stuckCallMonitor-timeout',
                fetchedFromExotel: fetchedFromExotel
            };
            await callLog.save();
            logger_1.logger.info('✅ Stuck call resolved', {
                callLogId: callLog._id.toString(),
                previousStatus: 'ringing',
                newStatus: callLog.status,
                duration: callLog.durationSec,
                fetchedFromExotel,
                ageMinutes
            });
            // If outbound call, mark as ended in OutgoingCallService
            if (callLog.direction === 'outbound') {
                try {
                    const { outgoingCallService } = await Promise.resolve().then(() => __importStar(require('./outgoingCall.service')));
                    await outgoingCallService.markCallEnded(callLog._id.toString());
                }
                catch (error) {
                    logger_1.logger.error('Failed to mark outbound call as ended', {
                        callLogId: callLog._id.toString(),
                        error: error.message
                    });
                }
            }
        }
        catch (error) {
            logger_1.logger.error('Failed to process stuck call', {
                callLogId: callLog._id.toString(),
                error: error.message,
                errorStack: error.stack
            });
        }
    }
}
exports.stuckCallMonitorService = new StuckCallMonitorService();
//# sourceMappingURL=stuckCallMonitor.service.js.map
