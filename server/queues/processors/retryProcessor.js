"use strict";
/**
 * Retry Processor
 * Processes retry attempts for failed calls
 *
 * This processor is integrated with the scheduledCallsProcessor.
 * When a job contains metadata.isRetry = true, it's treated as a retry.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processRetryAttempt = processRetryAttempt;
exports.isRetryJob = isRetryJob;
exports.extractRetryJobData = extractRetryJobData;
const RetryAttempt_1 = require("../../models/RetryAttempt");
const outgoingCall_service_1 = require("../../services/outgoingCall.service");
const retryManager_service_1 = require("../../services/retryManager.service");
const logger_1 = require("../../utils/logger");
const mongoose_1 = __importDefault(require("mongoose"));
/**
 * Process a retry attempt
 */
async function processRetryAttempt(job) {
    const { retryAttemptId, originalCallLogId, phoneNumber, phoneId, agentId, userId, attemptNumber, failureType, metadata = {} } = job.data;
    logger_1.logger.info('Processing retry attempt', {
        jobId: job.id,
        retryAttemptId,
        originalCallLogId,
        attemptNumber,
        failureType,
        phoneNumber
    });
    // Fetch RetryAttempt record
    const retryAttempt = await RetryAttempt_1.RetryAttempt.findById(retryAttemptId);
    if (!retryAttempt) {
        const error = `RetryAttempt not found: ${retryAttemptId}`;
        logger_1.logger.error(error, { retryAttemptId });
        throw new Error(error);
    }
    // Check if already processed (idempotency)
    if (retryAttempt.status !== 'pending') {
        logger_1.logger.warn('RetryAttempt already processed', {
            retryAttemptId,
            status: retryAttempt.status
        });
        return `Already processed with status: ${retryAttempt.status}`;
    }
    // Update status to processing
    retryAttempt.status = 'processing';
    retryAttempt.processedAt = new Date();
    await retryAttempt.save();
    try {
        // Initiate the retry call
        logger_1.logger.info('Initiating retry call', {
            retryAttemptId,
            attemptNumber,
            phoneNumber,
            agentId
        });
        const callLogId = await outgoingCall_service_1.outgoingCallService.initiateCall({
            phoneNumber,
            phoneId,
            agentId,
            userId,
            metadata: {
                ...metadata,
                isRetry: true,
                originalCallLogId,
                retryAttemptId,
                attemptNumber,
                failureType
            }
        });
        // Update retry attempt with new call log
        retryAttempt.retryCallLogId = new mongoose_1.default.Types.ObjectId(callLogId);
        retryAttempt.status = 'completed';
        await retryAttempt.save();
        logger_1.logger.info('Retry attempt completed', {
            retryAttemptId,
            newCallLogId: callLogId,
            attemptNumber
        });
        return callLogId;
    }
    catch (error) {
        logger_1.logger.error('Retry attempt failed', {
            retryAttemptId,
            attemptNumber,
            error: error.message,
            stack: error.stack
        });
        // Update retry attempt status
        retryAttempt.status = 'failed';
        retryAttempt.failedAt = new Date();
        retryAttempt.metadata = {
            ...retryAttempt.metadata,
            error: error.message,
            errorStack: error.stack
        };
        await retryAttempt.save();
        // Schedule next retry if applicable
        try {
            await retryManager_service_1.retryManagerService.scheduleRetry(originalCallLogId, {
                respectOffPeakHours: true,
                metadata: {
                    previousRetryAttemptId: retryAttemptId,
                    previousError: error.message
                }
            });
        }
        catch (scheduleError) {
            logger_1.logger.error('Failed to schedule next retry', {
                originalCallLogId,
                error: scheduleError.message
            });
        }
        throw error;
    }
}
/**
 * Check if a job is a retry job
 */
function isRetryJob(jobData) {
    return jobData.metadata?.isRetry === true;
}
/**
 * Extract retry job data from scheduled call job data
 */
function extractRetryJobData(jobData) {
    if (!isRetryJob(jobData)) {
        return null;
    }
    const metadata = jobData.metadata || {};
    return {
        retryAttemptId: jobData.scheduledCallId, // For retries, scheduledCallId is the retryAttemptId
        originalCallLogId: metadata.originalCallLogId,
        phoneNumber: jobData.phoneNumber,
        phoneId: jobData.phoneId,
        agentId: jobData.agentId,
        userId: jobData.userId,
        attemptNumber: metadata.attemptNumber || 1,
        failureType: metadata.failureType || 'unknown',
        metadata: metadata
    };
}
logger_1.logger.info('Retry processor initialized');
//# sourceMappingURL=retryProcessor.js.map
