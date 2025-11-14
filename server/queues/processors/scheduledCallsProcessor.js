"use strict";
/**
 * Scheduled Calls Queue Processor
 * Processes scheduled call jobs when their time arrives
 * Also handles retry jobs (isRetry flag in metadata)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.processScheduledCall = processScheduledCall;
const scheduledCalls_queue_1 = require("../scheduledCalls.queue");
const outgoingCall_service_1 = require("../../services/outgoingCall.service");
const ScheduledCall_1 = require("../../models/ScheduledCall");
const logger_1 = require("../../utils/logger");
const retryProcessor_1 = require("./retryProcessor");
/**
 * Process a scheduled call job
 */
async function processScheduledCall(job) {
    const { scheduledCallId, phoneNumber, phoneId, agentId, userId, metadata, priority, isRecurring } = job.data;
    logger_1.logger.info('Processing scheduled call', {
        jobId: job.id,
        scheduledCallId,
        phoneNumber,
        isRecurring
    });
    try {
        // Get scheduled call record
        const scheduledCall = await ScheduledCall_1.ScheduledCall.findById(scheduledCallId);
        if (!scheduledCall) {
            throw new Error(`Scheduled call not found: ${scheduledCallId}`);
        }
        // Check if already processed or cancelled
        if (scheduledCall.status !== 'pending') {
            logger_1.logger.warn('Scheduled call not in pending status', {
                scheduledCallId,
                status: scheduledCall.status
            });
            return `Skipped: status is ${scheduledCall.status}`;
        }
        // Update status to processing
        scheduledCall.status = 'processing';
        scheduledCall.processedAt = new Date();
        await scheduledCall.save();
        // Initiate the outbound call
        const callLogId = await outgoingCall_service_1.outgoingCallService.initiateCall({
            phoneNumber,
            phoneId,
            agentId,
            userId,
            metadata: {
                ...metadata,
                scheduledCallId,
                isScheduled: true,
                isRecurring: isRecurring || false
            },
            priority
        });
        // Update scheduled call with callLogId
        scheduledCall.callLogId = callLogId;
        scheduledCall.status = 'completed';
        await scheduledCall.save();
        logger_1.logger.info('Scheduled call initiated successfully', {
            scheduledCallId,
            callLogId,
            phoneNumber
        });
        // If this is a recurring call, schedule the next occurrence
        if (isRecurring && scheduledCall.recurring) {
            await scheduleNextRecurrence(scheduledCall);
        }
        return callLogId;
    }
    catch (error) {
        logger_1.logger.error('Failed to process scheduled call', {
            scheduledCallId,
            error: error.message,
            stack: error.stack
        });
        // Update scheduled call status to failed
        try {
            await ScheduledCall_1.ScheduledCall.findByIdAndUpdate(scheduledCallId, {
                status: 'failed',
                processedAt: new Date(),
                $set: {
                    'metadata.error': {
                        message: error.message,
                        timestamp: new Date()
                    }
                }
            });
        }
        catch (updateError) {
            logger_1.logger.error('Failed to update scheduled call status', { updateError });
        }
        throw error;
    }
}
/**
 * Schedule the next recurrence of a recurring call
 */
async function scheduleNextRecurrence(scheduledCall) {
    if (!scheduledCall.recurring) {
        return;
    }
    const { frequency, interval, endDate, maxOccurrences, currentOccurrence } = scheduledCall.recurring;
    // Check if we've reached the max occurrences
    if (maxOccurrences && currentOccurrence >= maxOccurrences) {
        logger_1.logger.info('Recurring call reached max occurrences', {
            scheduledCallId: scheduledCall._id,
            maxOccurrences
        });
        return;
    }
    // Calculate next scheduled time
    const nextScheduledTime = calculateNextScheduledTime(scheduledCall.scheduledFor, frequency, interval);
    // Check if next occurrence is after end date
    if (endDate && nextScheduledTime > endDate) {
        logger_1.logger.info('Recurring call reached end date', {
            scheduledCallId: scheduledCall._id,
            endDate
        });
        return;
    }
    // Create new scheduled call for next occurrence
    const nextScheduledCall = await ScheduledCall_1.ScheduledCall.create({
        phoneNumber: scheduledCall.phoneNumber,
        agentId: scheduledCall.agentId,
        userId: scheduledCall.userId,
        scheduledFor: nextScheduledTime,
        timezone: scheduledCall.timezone,
        status: 'pending',
        respectBusinessHours: scheduledCall.respectBusinessHours,
        businessHours: scheduledCall.businessHours,
        recurring: {
            frequency,
            interval,
            endDate,
            maxOccurrences,
            currentOccurrence: currentOccurrence + 1
        },
        metadata: {
            ...scheduledCall.metadata,
            parentScheduledCallId: scheduledCall._id,
            occurrenceNumber: currentOccurrence + 1
        }
    });
    logger_1.logger.info('Next recurrence scheduled', {
        originalScheduledCallId: scheduledCall._id,
        nextScheduledCallId: nextScheduledCall._id,
        nextScheduledTime,
        occurrenceNumber: currentOccurrence + 1
    });
    // Add to queue (this will be handled by CallScheduler service)
    // For now, we'll let the CallScheduler pick it up
}
/**
 * Calculate next scheduled time based on frequency and interval
 */
function calculateNextScheduledTime(currentTime, frequency, interval) {
    const nextTime = new Date(currentTime);
    switch (frequency) {
        case 'daily':
            nextTime.setDate(nextTime.getDate() + interval);
            break;
        case 'weekly':
            nextTime.setDate(nextTime.getDate() + (interval * 7));
            break;
        case 'monthly':
            nextTime.setMonth(nextTime.getMonth() + interval);
            break;
    }
    return nextTime;
}
// Register the processor with retry job handling
scheduledCalls_queue_1.scheduledCallsQueue.process(async (job) => {
    // Check if this is a retry job
    if ((0, retryProcessor_1.isRetryJob)(job.data)) {
        logger_1.logger.info('Detected retry job, routing to retry processor', {
            jobId: job.id,
            scheduledCallId: job.data.scheduledCallId
        });
        const retryJobData = (0, retryProcessor_1.extractRetryJobData)(job.data);
        if (retryJobData) {
            return await (0, retryProcessor_1.processRetryAttempt)({ ...job, data: retryJobData });
        }
    }
    // Otherwise process as regular scheduled call
    return await processScheduledCall(job);
});
logger_1.logger.info('Scheduled calls processor registered (with retry support)');
//# sourceMappingURL=scheduledCallsProcessor.js.map
