"use strict";
/**
 * Retry Manager Service
 * Handles intelligent retry logic for failed outbound calls
 * Features:
 * - Exponential backoff strategy
 * - Failure type categorization
 * - Off-peak scheduling
 * - Idempotency & error recovery
 */
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.retryManagerService = exports.RetryManagerService = exports.OFF_PEAK_HOURS = exports.RETRY_CONFIG = void 0;
const moment_timezone_1 = __importDefault(require("moment-timezone"));
const CallLog_1 = require("../models/CallLog");
const RetryAttempt_1 = require("../models/RetryAttempt");
const logger_1 = require("../utils/logger");
const scheduledCalls_queue_1 = require("../queues/scheduledCalls.queue");
/**
 * Failure types and their retry configurations
 */
exports.RETRY_CONFIG = {
    no_answer: {
        maxAttempts: 3,
        baseDelay: 300000, // 5 minutes
        backoffMultiplier: 2,
        retryable: true
    },
    busy: {
        maxAttempts: 3,
        baseDelay: 600000, // 10 minutes
        backoffMultiplier: 2,
        retryable: true
    },
    voicemail: {
        maxAttempts: 2,
        baseDelay: 1800000, // 30 minutes
        backoffMultiplier: 2,
        retryable: true
    },
    network_error: {
        maxAttempts: 5,
        baseDelay: 120000, // 2 minutes
        backoffMultiplier: 2,
        retryable: true
    },
    call_rejected: {
        maxAttempts: 1,
        baseDelay: 3600000, // 1 hour
        backoffMultiplier: 1,
        retryable: true
    },
    invalid_number: {
        maxAttempts: 0,
        baseDelay: 0,
        backoffMultiplier: 1,
        retryable: false
    },
    blocked: {
        maxAttempts: 0,
        baseDelay: 0,
        backoffMultiplier: 1,
        retryable: false
    },
    compliance_block: {
        maxAttempts: 0,
        baseDelay: 0,
        backoffMultiplier: 1,
        retryable: false
    }
};
/**
 * Off-peak hours configuration
 * Retries are preferentially scheduled during these times
 */
exports.OFF_PEAK_HOURS = {
    start: '10:00', // 10 AM
    end: '16:00', // 4 PM
    timezone: 'Asia/Kolkata',
    daysOfWeek: [1, 2, 3, 4, 5] // Monday-Friday
};
class RetryManagerService {
    /**
     * Categorize a failure and determine if it's retryable
     */
    categorizeFailure(callLog) {
        let failureType = 'network_error'; // Default
        // Extract failure reason from callLog
        const failureReason = callLog.failureReason?.toLowerCase() || '';
        const status = callLog.status?.toLowerCase() || '';
        // Categorize based on failure reason and status
        if (failureReason.includes('no answer') || failureReason.includes('no_answer') || status === 'no_answer') {
            failureType = 'no_answer';
        }
        else if (failureReason.includes('busy') || status === 'busy') {
            failureType = 'busy';
        }
        else if (failureReason.includes('voicemail') || status === 'voicemail') {
            failureType = 'voicemail';
        }
        else if (failureReason.includes('invalid') || failureReason.includes('not found')) {
            failureType = 'invalid_number';
        }
        else if (failureReason.includes('blocked') || failureReason.includes('blacklist')) {
            failureType = 'blocked';
        }
        else if (failureReason.includes('compliance') || failureReason.includes('dnd')) {
            failureType = 'compliance_block';
        }
        else if (failureReason.includes('rejected') || failureReason.includes('declined')) {
            failureType = 'call_rejected';
        }
        else if (failureReason.includes('network') || failureReason.includes('timeout') || failureReason.includes('connection')) {
            failureType = 'network_error';
        }
        const config = exports.RETRY_CONFIG[failureType];
        logger_1.logger.info('Failure categorized', {
            callLogId: callLog._id,
            failureReason,
            status,
            categorizedAs: failureType,
            isRetryable: config.retryable
        });
        return {
            failureType,
            isRetryable: config.retryable,
            config
        };
    }
    /**
     * Calculate next retry time with exponential backoff
     */
    calculateRetryTime(attemptNumber, failureType, options = {}) {
        // If specific time provided, use it
        if (options.scheduledFor) {
            return options.scheduledFor;
        }
        const config = exports.RETRY_CONFIG[failureType];
        // Calculate delay with exponential backoff
        // Formula: baseDelay * (backoffMultiplier ^ (attemptNumber - 1))
        const delay = config.baseDelay * Math.pow(config.backoffMultiplier, attemptNumber - 1);
        // Add jitter (±10%) to prevent thundering herd
        const jitter = delay * 0.1 * (Math.random() * 2 - 1);
        const totalDelay = delay + jitter;
        let retryTime = (0, moment_timezone_1.default)().add(totalDelay, 'milliseconds');
        // Adjust to off-peak hours if requested
        if (options.respectOffPeakHours !== false) {
            retryTime = this.adjustToOffPeakHours(retryTime);
        }
        logger_1.logger.info('Retry time calculated', {
            attemptNumber,
            failureType,
            baseDelay: config.baseDelay,
            calculatedDelay: delay,
            jitter,
            totalDelay,
            retryTime: retryTime.toISOString(),
            adjustedToOffPeak: options.respectOffPeakHours !== false
        });
        return retryTime.toDate();
    }
    /**
     * Adjust retry time to off-peak hours
     */
    adjustToOffPeakHours(retryTime) {
        const { start, end, timezone, daysOfWeek } = exports.OFF_PEAK_HOURS;
        let adjustedTime = moment_timezone_1.default.tz(retryTime, timezone);
        // Parse off-peak hours
        const [startHour, startMinute] = start.split(':').map(Number);
        const [endHour, endMinute] = end.split(':').map(Number);
        // Check if it's a business day
        while (!daysOfWeek.includes(adjustedTime.day())) {
            // Move to next day at off-peak start
            adjustedTime.add(1, 'day').hour(startHour).minute(startMinute).second(0).millisecond(0);
        }
        // Create off-peak window for current day
        const dayStart = adjustedTime.clone().hour(startHour).minute(startMinute).second(0);
        const dayEnd = adjustedTime.clone().hour(endHour).minute(endMinute).second(0);
        // If before off-peak hours, move to start of off-peak
        if (adjustedTime.isBefore(dayStart)) {
            adjustedTime = dayStart;
        }
        // If after off-peak hours, move to next business day's off-peak start
        if (adjustedTime.isAfter(dayEnd)) {
            adjustedTime.add(1, 'day').hour(startHour).minute(startMinute).second(0).millisecond(0);
            // Check again if it's a business day
            while (!daysOfWeek.includes(adjustedTime.day())) {
                adjustedTime.add(1, 'day');
            }
        }
        logger_1.logger.debug('Adjusted to off-peak hours', {
            original: retryTime.toISOString(),
            adjusted: adjustedTime.toISOString(),
            offPeakWindow: `${start}-${end}`,
            timezone
        });
        return adjustedTime;
    }
    /**
     * Schedule a retry for a failed call
     */
    async scheduleRetry(callLogId, options = {}) {
        const callLog = await CallLog_1.CallLog.findById(callLogId)
            .populate('agentId')
            .populate('userId');
        if (!callLog) {
            throw new Error(`CallLog not found: ${callLogId}`);
        }
        // Check if call actually failed
        if (callLog.status !== 'failed' && !options.forceRetry) {
            logger_1.logger.warn('Cannot retry non-failed call', {
                callLogId,
                status: callLog.status
            });
            return null;
        }
        // Categorize the failure
        const { failureType, isRetryable, config } = this.categorizeFailure(callLog);
        if (!isRetryable && !options.forceRetry) {
            logger_1.logger.info('Call failure is not retryable', {
                callLogId,
                failureType
            });
            return null;
        }
        // Count existing retry attempts
        const existingAttempts = await RetryAttempt_1.RetryAttempt.countDocuments({
            originalCallLogId: callLogId
        });
        const nextAttemptNumber = existingAttempts + 1;
        // Check if max attempts reached
        if (nextAttemptNumber > config.maxAttempts && !options.forceRetry) {
            logger_1.logger.info('Max retry attempts reached', {
                callLogId,
                failureType,
                attemptNumber: nextAttemptNumber,
                maxAttempts: config.maxAttempts
            });
            return null;
        }
        // Calculate retry time
        const retryTime = this.calculateRetryTime(nextAttemptNumber, failureType, options);
        // Create RetryAttempt record
        const retryAttempt = await RetryAttempt_1.RetryAttempt.create({
            originalCallLogId: callLogId,
            attemptNumber: nextAttemptNumber,
            scheduledFor: retryTime,
            status: 'pending',
            failureReason: options.overrideFailureReason || failureType,
            metadata: {
                ...options.metadata,
                originalFailureReason: callLog.failureReason,
                originalStatus: callLog.status,
                retryConfig: config,
                offPeakAdjusted: options.respectOffPeakHours !== false
            }
        });
        // Schedule the retry using the scheduling queue
        const job = await (0, scheduledCalls_queue_1.addScheduledCallJob)({
            scheduledCallId: retryAttempt._id.toString(),
            phoneNumber: callLog.toPhone,
            phoneId: callLog.phoneId?.toString() || '',
            agentId: callLog.agentId._id.toString(),
            userId: callLog.userId._id.toString(),
            metadata: {
                isRetry: true,
                originalCallLogId: callLogId.toString(),
                attemptNumber: nextAttemptNumber,
                failureType
            },
            priority: 'high' // Retries get higher priority
        }, retryTime, {
            jobId: `retry-${retryAttempt._id}`,
            priority: 1 // High priority
        });
        logger_1.logger.info('Retry scheduled', {
            callLogId,
            retryAttemptId: retryAttempt._id,
            attemptNumber: nextAttemptNumber,
            failureType,
            scheduledFor: retryTime,
            jobId: job.id
        });
        return retryAttempt._id.toString();
    }
    /**
     * Process automatic retries for recent failures
     */
    async processAutomaticRetries(lookbackMinutes = 60) {
        const cutoffTime = (0, moment_timezone_1.default)().subtract(lookbackMinutes, 'minutes').toDate();
        // Find failed calls in the lookback window
        const failedCalls = await CallLog_1.CallLog.find({
            status: 'failed',
            endTime: { $gte: cutoffTime },
            // Don't retry calls that already have pending retries
            _id: {
                $nin: await RetryAttempt_1.RetryAttempt.distinct('originalCallLogId', {
                    status: { $in: ['pending', 'processing'] }
                })
            }
        });
        let processed = 0;
        let scheduled = 0;
        let skipped = 0;
        for (const callLog of failedCalls) {
            processed++;
            try {
                const retryAttemptId = await this.scheduleRetry(callLog._id.toString(), {
                    respectOffPeakHours: true
                });
                if (retryAttemptId) {
                    scheduled++;
                }
                else {
                    skipped++;
                }
            }
            catch (error) {
                logger_1.logger.error('Failed to schedule automatic retry', {
                    callLogId: callLog._id,
                    error: error.message
                });
                skipped++;
            }
        }
        logger_1.logger.info('Automatic retry processing complete', {
            lookbackMinutes,
            processed,
            scheduled,
            skipped
        });
        return { processed, scheduled, skipped };
    }
    /**
     * Cancel a scheduled retry
     */
    async cancelRetry(retryAttemptId) {
        const retryAttempt = await RetryAttempt_1.RetryAttempt.findById(retryAttemptId);
        if (!retryAttempt) {
            throw new Error(`RetryAttempt not found: ${retryAttemptId}`);
        }
        if (retryAttempt.status !== 'pending') {
            throw new Error(`Cannot cancel retry with status: ${retryAttempt.status}`);
        }
        // Cancel the queue job
        const { cancelScheduledCallJob } = await Promise.resolve().then(() => __importStar(require('../queues/scheduledCalls.queue')));
        await cancelScheduledCallJob(`retry-${retryAttemptId}`);
        // Update retry attempt status
        retryAttempt.status = 'cancelled';
        await retryAttempt.save();
        logger_1.logger.info('Retry cancelled', {
            retryAttemptId,
            originalCallLogId: retryAttempt.originalCallLogId
        });
    }
    /**
     * Get retry statistics
     */
    async getRetryStats(userId) {
        const filter = {};
        if (userId) {
            // Get user's call logs
            const userCallLogs = await CallLog_1.CallLog.distinct('_id', { userId });
            filter.originalCallLogId = { $in: userCallLogs };
        }
        const [totalRetries, pendingRetries, successfulRetries, failedRetries, byFailureType] = await Promise.all([
            RetryAttempt_1.RetryAttempt.countDocuments(filter),
            RetryAttempt_1.RetryAttempt.countDocuments({ ...filter, status: 'pending' }),
            RetryAttempt_1.RetryAttempt.countDocuments({ ...filter, status: 'completed' }),
            RetryAttempt_1.RetryAttempt.countDocuments({ ...filter, status: 'failed' }),
            RetryAttempt_1.RetryAttempt.aggregate([
                { $match: filter },
                { $group: { _id: '$failureReason', count: { $sum: 1 } } }
            ])
        ]);
        const byFailureTypeMap = {};
        byFailureType.forEach((item) => {
            byFailureTypeMap[item._id] = item.count;
        });
        return {
            totalRetries,
            pendingRetries,
            successfulRetries,
            failedRetries,
            byFailureType: byFailureTypeMap
        };
    }
    /**
     * Get retry history for a call
     */
    async getRetryHistory(callLogId) {
        const retryAttempts = await RetryAttempt_1.RetryAttempt.find({
            originalCallLogId: callLogId
        })
            .populate('retryCallLogId')
            .sort({ attemptNumber: 1 })
            .lean();
        return retryAttempts;
    }
}
exports.RetryManagerService = RetryManagerService;
// Export singleton instance
exports.retryManagerService = new RetryManagerService();
//# sourceMappingURL=retryManager.service.js.map
