"use strict";
/**
 * Auto Retry Service
 * Automatically triggers retries when calls fail
 * Integrates with webhook handlers and call status updates
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.autoRetryService = exports.AutoRetryService = void 0;
const CallLog_1 = require("../models/CallLog");
const retryManager_service_1 = require("./retryManager.service");
const logger_1 = require("../utils/logger");
class AutoRetryService {
    constructor() {
        /**
         * Configuration for auto-retry behavior
         */
        this.ENABLE_AUTO_RETRY = process.env.ENABLE_AUTO_RETRY !== 'false'; // Enabled by default
        this.AUTO_RETRY_DELAY_MINUTES = parseInt(process.env.AUTO_RETRY_DELAY_MINUTES || '5');
        this.EXCLUDE_RETRY_FOR_RETRIES = true; // Don't auto-retry failed retries (prevent cascade)
    }
    /**
     * Handle call failure - automatically schedule retry if appropriate
     * This should be called by webhook handlers when a call fails
     */
    async handleCallFailure(callLogId) {
        if (!this.ENABLE_AUTO_RETRY) {
            logger_1.logger.debug('Auto-retry disabled', { callLogId });
            return {
                retryScheduled: false,
                reason: 'Auto-retry is disabled'
            };
        }
        try {
            const callLog = await CallLog_1.CallLog.findById(callLogId);
            if (!callLog) {
                logger_1.logger.error('CallLog not found for auto-retry', { callLogId });
                return {
                    retryScheduled: false,
                    reason: 'CallLog not found'
                };
            }
            // Check if this call is itself a retry
            if (this.EXCLUDE_RETRY_FOR_RETRIES && callLog.metadata?.isRetry) {
                logger_1.logger.info('Skipping auto-retry for failed retry attempt', {
                    callLogId,
                    originalCallLogId: callLog.metadata.originalCallLogId,
                    attemptNumber: callLog.metadata.attemptNumber
                });
                return {
                    retryScheduled: false,
                    reason: 'Failed retry attempts are not auto-retried'
                };
            }
            // Check if call is in a failed state
            if (callLog.status !== 'failed') {
                logger_1.logger.debug('Call is not in failed state, skipping auto-retry', {
                    callLogId,
                    status: callLog.status
                });
                return {
                    retryScheduled: false,
                    reason: `Call status is ${callLog.status}, not failed`
                };
            }
            // Schedule retry
            logger_1.logger.info('Attempting to schedule automatic retry', {
                callLogId,
                phoneNumber: callLog.toPhone,
                failureReason: callLog.failureReason
            });
            const retryAttemptId = await retryManager_service_1.retryManagerService.scheduleRetry(callLogId, {
                respectOffPeakHours: true,
                metadata: {
                    autoRetry: true,
                    autoRetryTriggeredAt: new Date()
                }
            });
            if (retryAttemptId) {
                logger_1.logger.info('Auto-retry scheduled successfully', {
                    callLogId,
                    retryAttemptId,
                    phoneNumber: callLog.toPhone
                });
                return {
                    retryScheduled: true,
                    retryAttemptId
                };
            }
            else {
                logger_1.logger.info('Auto-retry not scheduled', {
                    callLogId,
                    reason: 'Retry conditions not met (e.g., max retries reached or non-retryable failure)'
                });
                return {
                    retryScheduled: false,
                    reason: 'Retry conditions not met'
                };
            }
        }
        catch (error) {
            logger_1.logger.error('Error in auto-retry handler', {
                callLogId,
                error: error.message,
                stack: error.stack
            });
            return {
                retryScheduled: false,
                reason: `Error: ${error.message}`
            };
        }
    }
    /**
     * Batch process recent failures for auto-retry
     * Useful for catching up on failures that occurred during downtime
     */
    async processPendingFailures(lookbackMinutes = 60) {
        logger_1.logger.info('Processing pending failures for auto-retry', { lookbackMinutes });
        const cutoffTime = new Date(Date.now() - lookbackMinutes * 60 * 1000);
        // Find failed calls that haven't been retried yet
        const failedCalls = await CallLog_1.CallLog.find({
            status: 'failed',
            endedAt: { $gte: cutoffTime },
            'metadata.autoRetryProcessed': { $ne: true }
        });
        let processed = 0;
        let scheduled = 0;
        let skipped = 0;
        let errors = 0;
        for (const callLog of failedCalls) {
            processed++;
            try {
                const result = await this.handleCallFailure(callLog._id.toString());
                if (result.retryScheduled) {
                    scheduled++;
                }
                else {
                    skipped++;
                }
                // Mark as processed
                await CallLog_1.CallLog.findByIdAndUpdate(callLog._id, {
                    $set: { 'metadata.autoRetryProcessed': true }
                });
            }
            catch (error) {
                logger_1.logger.error('Error processing pending failure', {
                    callLogId: callLog._id,
                    error: error.message
                });
                errors++;
            }
        }
        logger_1.logger.info('Pending failures processed', {
            lookbackMinutes,
            processed,
            scheduled,
            skipped,
            errors
        });
        return { processed, scheduled, skipped, errors };
    }
    /**
     * Get auto-retry configuration
     */
    getConfig() {
        return {
            enabled: this.ENABLE_AUTO_RETRY,
            delayMinutes: this.AUTO_RETRY_DELAY_MINUTES,
            excludeRetryForRetries: this.EXCLUDE_RETRY_FOR_RETRIES
        };
    }
}
exports.AutoRetryService = AutoRetryService;
// Export singleton instance
exports.autoRetryService = new AutoRetryService();
//# sourceMappingURL=autoRetry.service.js.map
